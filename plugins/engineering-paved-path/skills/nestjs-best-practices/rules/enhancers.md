---
name: enhancers
description: Guards, interceptors, pipes and filters — execution order, global registration, Reflector metadata, fail-closed auth
metadata:
  tags: guards, interceptors, pipes, filters, reflector, app-guard, middleware, lifecycle-order
---

# Guards, interceptors, pipes, filters

Four enhancer kinds, one request pipeline. Getting the *order* wrong is the usual bug; getting the *registration scope* wrong is the expensive one.

## Execution order (documented)

```
request
  → middleware            (global, then module-bound)
  → guards                (global → controller → route)
  → interceptors (pre)    (global → controller → route)
  → pipes                 (global → controller → route → parameter)
  → handler
  → interceptors (post)   (route → controller → global)
  → exception filters     (route → controller → global)
response
```

Two consequences fall straight out of that ordering ([request lifecycle](https://docs.nestjs.com/faq/request-lifecycle)):

- **Guards run before pipes.** A guard sees the raw, unvalidated request. Do not write a guard that assumes a parsed DTO.
- **Interceptors unwind in reverse.** The docs put it this way: *"as interceptors return RxJS Observables, the observables will be resolved in a first in last out manner."* A global logging interceptor therefore wraps everything a route interceptor does.

And one that is easy to get wrong: **exceptions thrown in middleware bypass controller- and method-scoped filters.** Only a global filter catches them ([exception filters](https://docs.nestjs.com/exception-filters)).

## Which one to reach for

| Need | Kind |
|---|---|
| May this caller proceed? | **Guard** — returns boolean, throws `ForbiddenException`/`UnauthorizedException` |
| Transform or validate an input value | **Pipe** |
| Wrap the call: timing, logging, response mapping, caching, timeouts | **Interceptor** |
| Turn a thrown error into a response body | **Filter** |

If you find yourself doing authorisation in an interceptor, you have chosen the wrong kind: it runs after the guard stage, so the decision arrives too late to keep other enhancers from doing work.

## Global registration: two ways, one of them injectable

```ts
// main.ts — cannot inject anything
app.useGlobalGuards(new AuthGuard());

// app.module.ts — full DI, this is what you almost always want
providers: [{ provide: APP_GUARD, useClass: GlobalAuthGuard }]
```

Use the `APP_GUARD` / `APP_INTERCEPTOR` / `APP_PIPE` / `APP_FILTER` provider tokens for anything that needs a dependency. The `main.ts` form is for enhancers with no dependencies at all.

## Fail-closed auth with one exemption channel

The shape that survives review: **one global guard that denies everything**, and exactly **one decorator** that exempts a route, applied in the route's own controller.

```ts
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

@Injectable()
export class GlobalAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    // On a public route, still populate the user when a valid token is present
    // (optional auth) so owner-views and block-checks can use it — but never fail.
    return isPublic ? this.attachUserIfPresent(ctx) : this.requireUser(ctx);
  }
}
```

`getAllAndOverride` is the right `Reflector` method here: it lets a handler-level decorator override a class-level one. (In NestJS 12 the CLI's decorator schematic generates `Reflector.createDecorator()`-style decorators, which give you a typed key instead of a string constant — prefer that form on new code.)

Two rules that come from this shape going wrong in production:

- **Never add a second exemption channel.** A central path allow-list — a regex, an array of routes in the guard — drifts from the controllers instantly and is invisible at the route it exempts. One decorator, applied at the route, is auditable by reading the controller.
- **A publicly reachable route's exposure is what it *serialises*, and whether its subject is still active.** Two separate audits, both easy to skip:
  1. Assert on the **real response object** in a test, not on the DTO type. A DTO type is not a guarantee of what a service method actually puts on the object — a field added by a spread three layers down ships without touching the DTO.
  2. Check that the row's **owner still exists**. Where accounts are soft-deleted, an entity looked up by id with no join to the owner keeps serving an erased account's data indefinitely. The ORM's find-family excludes soft-deleted *roots*; hand-written SQL and query builders do not — see `engineering-paved-path:typeorm-patterns`.

## Interceptors: what they are good at

```ts
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      timeout(5_000),
      catchError((err) =>
        err instanceof TimeoutError
          ? throwError(() => new RequestTimeoutException())
          : throwError(() => err),
      ),
    );
  }
}
```

Good uses: timeouts, correlation ids, response envelopes, cache read-through, metrics. Bad uses: authorisation (too late), input validation (pipes do it, with better errors), business logic (it becomes invisible to anyone reading the service).

## Custom parameter decorators

Build the one your codebase needs, once:

```ts
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
```

This is what keeps `@Req() req` — and with it framework types — out of controller signatures.

## Rate limiting

Rate limiting is a **guard**, so the seam is always there. `@nestjs/throttler` is the common package for it — if the project already has it, two operational facts matter; if it does not, a hand-written guard over the same seam is a legitimate answer and adding a package is its owners' call:

- **Version gap (2026-09-06):** the current `@nestjs/throttler@6.5.0` peer range tops out at `@nestjs/core@^11`; it does not yet declare `^12`. Check before assuming a clean install on NestJS 12.
- **Every booted application instance gets its own storage** unless you configure a shared one. In an end-to-end suite where each spec file boots its own application, the throttle budget is per file — and a test that exceeds it gets a `429` that reads as a wrong-status-code assertion failure, not as rate limiting. Budget the calls and reuse one fixture account per file. See [testing.md](testing.md).

## Enhancer checklist

- [ ] Registered through an `APP_*` token if it needs DI.
- [ ] Guards do not assume validated input.
- [ ] Exactly one exemption channel for auth, applied at the route.
- [ ] No authorisation logic in interceptors.
- [ ] Anything registered globally is also present in the test harness — see [testing.md](testing.md).
