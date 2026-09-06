---
name: configuration
description: ConfigModule, schema validation, typed access, fail-closed factories and what they cost
metadata:
  tags: config, configmodule, env, validation, secrets, factories
---

# Configuration

`@nestjs/config` is a **separate package**. The principles here — resolve configuration through a provider, validate the whole environment once at boot, never read `process.env` deep in the tree — hold without it: a plain `useFactory` provider that parses and validates `process.env` gives you the same seam. The snippets below assume the package because it is the common choice.

## `ConfigModule` baseline

```ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: appConfigSchema,   // fails at boot on a bad env
      cache: true,
    }),
  ],
})
export class AppModule {}
```

`isGlobal: true` removes the need to re-import `ConfigModule` in every feature module. This is one of the narrow, legitimate uses of a global module ([modules.md](modules.md)).

## Validation — the shape depends on your major

**On `@nestjs/config` 12+**, validation goes through **Standard Schema**, so Zod, Valibot, ArkType and friends work directly.

**On 11 and earlier**, `validationSchema` is Joi-shaped: pass a Joi schema, any Joi version, with `validationOptions` flat (no `libraryOptions` nesting). Zod does not work there without a custom `validate` function — which is available in every major and is the version-independent option:

```ts
ConfigModule.forRoot({ validate: (raw) => appConfigSchema.parse(raw) })
```

Reach for `validate` when the project must work across majors, or when you want the schema library to be your choice rather than the framework's. The rest of this section describes the 12+ path:

```ts
const appConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(3000),
});
```

Joi still works, with two migration details: it needs **Joi 18+** (the first release implementing Standard Schema), and its library-specific settings move from the top of `validationOptions` into `validationOptions.libraryOptions`. Joi's historical defaults (`allowUnknown: true`, `abortEarly: false`) are preserved and merged with whatever you pass ([migration guide](https://docs.nestjs.com/migration-guide)).

For Zod schema mechanics see `engineering-paved-path:zod`.

## Typed access

```ts
// strictNullChecks + the `true` generic removes `undefined` from the inferred types
constructor(private readonly config: ConfigService<AppConfig, true>) {}

const url = this.config.get('DATABASE_URL', { infer: true });  // string, not string | undefined
```

Registering namespaced config with `registerAs` gives a typed slice per concern instead of one flat bag:

```ts
export const dbConfig = registerAs('db', () => ({
  url: process.env.DATABASE_URL!,
  poolMax: Number(process.env.DB_POOL_MAX ?? 10),
}));
```

## Timing: config is not available at module-definition time

Module metadata is evaluated when the class is defined, before `ConfigModule` has loaded or validated anything. That is why `forRootAsync` exists:

```ts
// ❌ reads process.env before validation has run
TypeOrmModule.forRoot({ url: process.env.DATABASE_URL })

// ✅ resolves after ConfigModule is initialised
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({ url: config.getOrThrow('DATABASE_URL') }),
})
```

The docs also note that where partial/`forFeature` registration is involved, module initialisation order is not guaranteed — a value another module registers may not be there in your constructor. Read it in `onModuleInit()` in that case ([configuration](https://docs.nestjs.com/techniques/configuration)).

## Fail-closed factories — and the bill they come with

The right default for a factory that binds an adapter is to refuse to start when a required variable is missing, rather than silently degrade to a stub:

```ts
export function createMailAdapter(config: ConfigService): MailPort {
  const provider = config.getOrThrow('MAIL_PROVIDER');
  if (provider === 'log') return new LoggingMailAdapter();
  return new ResendMailAdapter(
    config.getOrThrow('RESEND_API_KEY'),
    config.getOrThrow('MAIL_FROM'),
  );
}
```

**Know what that means operationally: the failure is "the process does not boot", not "the feature is off".** Adding a newly-required variable to a fail-closed factory is a *configuration change with a code change attached*, and both must land in the same deploy. Miss the config half and every route dies, including the health check.

It is also a failure no test catches: unit specs set the variable, and end-to-end runs usually pick the stub branch (`MAIL_PROVIDER=log`), which never reaches the `getOrThrow`. The habit that catches it is mechanical — after touching a factory, grep the deployment configuration for every name the factory now requires, before deploying.

## Environment gates: allow-list, and interpolate the value

```ts
// ❌ admits a typo: NODE_ENV=stagng is "not production", so the unsafe stub runs
if (process.env.NODE_ENV !== 'production') return new StubAdapter();

// ✅ positive allow-list
const STUB_SAFE = new Set(['development', 'test']);
if (STUB_SAFE.has(env)) return new StubAdapter();
throw new Error(`refusing to use the stub adapter while NODE_ENV=${env || '(unset)'}`);
```

Two details that matter more than they look:

- `!== 'production'` and an allow-list are not equivalent. The negative form silently admits every misspelling.
- **Do not hardcode the environment name in the refusal message.** Once more than one value is legal, a fixed *"while NODE_ENV=production"* tells whoever typed `stagng` that they are on production. Interpolate the real value, `(unset)` included.

There is no single house style for which environments are stub-safe: it is a per-factory judgement about what the stub can actually reach. A stub that writes raw reset tokens to the log or loses uploads on restart is `development`/`test` only; a stub that cannot reach a real user in a closed test may safely include `staging`. Say which class the guard belongs to in a comment rather than copying whichever neighbouring factory you opened first.

## Where configuration must not be read

- **Not in a repository.** A repository owns database I/O. When a method needs an env-derived value, pass the resolved value in (`upsertItem(item, mediaBaseUrl)`) and keep the resolution in the service or the factory.
- **Not in a pure domain package.** See `engineering-paved-path:onion-architecture`.
- **Not scattered.** One `ConfigService` (or one namespaced config per concern) beats `process.env` reads in fifteen files, because the validation schema is then the exhaustive list of what the app needs.

## The `.env` trap in tests

A test that tries to simulate "variable unset" by *omitting* it does not test the disabled path if anything in the boot chain loads a `.env` file: `dotenv` fills in keys absent from `process.env` while leaving present ones alone. The developer's real value gets supplied and the assertion measures the machine rather than the code.

Pass the variable explicitly as `''` for the not-configured case. And do not pin a literal derived from an env gate in an assertion — assert the union (`expect(['active', 'off']).toContain(value)`), which still fails on a missing field or an unexpected value while staying true in both CI and a developer's machine.

## Secrets

- A manifest, a schema, or a config file may **name** a secret; it never contains one.
- URL templates and other non-credential shapes belong in plain environment configuration, not in the secret store — keeping the secret store small is what makes an audit of it meaningful.
- A secret existing in the deployment platform proves that someone once typed the name. It does not prove anything reads it. Grep for a **reader** before believing a path is live.
