---
name: lifecycle
description: Lifecycle hooks, shutdown hooks, async initialisation, background work
metadata:
  tags: lifecycle, onmoduleinit, shutdown-hooks, bootstrap, schedulers
---

# Lifecycle

## The hooks

| Hook | Fires |
|---|---|
| `onModuleInit()` | after the host module's dependencies are resolved |
| `onApplicationBootstrap()` | after **all** modules are initialised, before listening |
| `onModuleDestroy()` | on shutdown, before the connection teardown |
| `beforeApplicationShutdown()` | after `onModuleDestroy` handlers have settled |
| `onApplicationShutdown()` | last; receives the signal |

Two constraints ([lifecycle events](https://docs.nestjs.com/fundamentals/lifecycle-events)):

- **Shutdown hooks require `app.enableShutdownHooks()`.** Without it none of the three shutdown hooks fire, and the process exits with in-flight work abandoned.
- **Request-scoped providers do not get lifecycle hooks.** If a provider needs `onModuleInit`, it cannot be request-scoped.

**NestJS 12 changed the ordering:** hooks are now invoked *by component hierarchy level*. Code that silently depended on the previous ordering — module A's `onModuleInit` running before module B's — can change behaviour on upgrade. If initialisation order matters, make the dependency explicit (import the module, inject the provider) rather than relying on hook sequencing.

## Which hook for what

```ts
@Injectable()
export class SearchIndexService implements OnModuleInit, OnApplicationShutdown {
  async onModuleInit() {
    await this.client.connect();          // this module's own resource
  }

  async onApplicationShutdown(signal?: string) {
    await this.client.close();            // release it
  }
}
```

- **Own resource, own module** → `onModuleInit`.
- **Needs the whole graph to exist** (warm a cache from three modules, start a scheduler that calls other services) → `onApplicationBootstrap`.
- **Never** put work in a constructor. A constructor that opens a connection makes the class unusable in a test and unbounded in a boot: it runs during graph construction, when failures produce "cannot resolve dependencies" noise rather than a clear error.

## Async providers

When a provider genuinely cannot exist until something asynchronous completes, use an async factory rather than a half-built object with an `init()` the caller must remember:

```ts
{
  provide: SEARCH_CLIENT,
  inject: [ConfigService],
  useFactory: async (config: ConfigService) => {
    const client = new SearchClient(config.getOrThrow('SEARCH_URL'));
    await client.connect();
    return client;
  },
}
```

Nest awaits the factory before anything that injects the token is constructed. The cost is boot time: every async factory serialises into startup, and a slow one delays readiness for the whole application.

## Graceful shutdown

```ts
app.enableShutdownHooks();
await app.listen(port);
```

What "graceful" has to mean in practice:

- Stop accepting new work (the HTTP server closing does this for requests; a scheduler or consumer needs to be told).
- Let in-flight work finish, with a bound. An unbounded drain is a hang, and the orchestrator's `SIGKILL` is a worse outcome than a bounded cancel.
- Close pooled resources last — database pool, cache client, message broker.

## Background work

Schedulers (`@nestjs/schedule`) and event listeners (`@nestjs/event-emitter`) run **outside the request lifecycle**. Three consequences:

- **No filter renders their failures.** An unhandled rejection in a cron handler goes to the process, not to your error envelope. Wrap the body and log deliberately — see [exceptions.md](exceptions.md).
- **No request context.** Nothing populates a request-scoped provider, so anything the job needs must be an explicit argument or resolved from a singleton.
- **Multiple instances run multiple copies.** A scheduler in a horizontally-scaled deployment fires once per instance. Idempotency has to be enforced in the database (a unique constraint claimed before the side effect), not in memory — an in-process guard fails at the first restart and at every second replica.

## State machines driven by external callbacks need a sweep

Any state that only advances when a webhook arrives will eventually be wrong, because exactly one dropped delivery leaves it stale forever, and the stale state looks internally consistent. Pair every callback-driven expiry with a scheduled comparison of the stored deadline against the clock, replaying the write the missing callback would have made.

The general form of the mistake is worth remembering on its own: *"the column is written"* is not evidence that anything ever **reads** it. Before trusting a persisted flag, grep for a reader; before trusting a feature, grep for a writer.

## Bootstrap

```ts
export function configurePlatform(app: INestApplication): void { … }

async function bootstrap() { … }

if (require.main === module) void bootstrap();   // ESM: compare import.meta.url
```

Two reasons for that shape, both about tests:

- The hardening applied in `bootstrap()` — body limits, security headers, CORS, global pipes — is **not** applied by the testing harness, which builds the application without ever calling your bootstrap function. Exporting a `configurePlatform(app)` helper and calling it from both places is what keeps them in step. See [testing.md](testing.md).
- Guarding the side effect means a test can import the module for the helper without starting a server.
