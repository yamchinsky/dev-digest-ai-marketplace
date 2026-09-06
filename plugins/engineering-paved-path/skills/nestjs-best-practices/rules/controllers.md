---
name: controllers
description: Thin controllers, parameter decorators, status codes, passthrough responses, streaming
metadata:
  tags: controllers, routing, params, status-codes, res, streaming
---

# Controllers

A controller method does three things, in this order:

1. take validated input and the caller's identity out of the request,
2. call exactly one service method with **domain values**,
3. return the result.

Anything else — branching on business state, composing two services, shaping an error body — belongs in the service or in a filter.

```ts
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getById(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateOrderDto) {
    return this.orders.create(user.id, body);
  }
}
```

## Framework types must not cross into the service

A service method signature that includes `Request`, `Response`, or `ExecutionContext` couples the application layer to the delivery mechanism. It also makes the service impossible to unit-test without an HTTP stack.

```ts
// ❌ passes the request wholesale
create(@Req() req: Request) { return this.orders.create(req); }

// ✅ extract domain values in the controller
create(@CurrentUser() user: AuthUser, @Body() body: CreateOrderDto) {
  return this.orders.create(user.id, body);
}
```

If the service needs something from the request that the current decorators do not surface, extract it in the controller and pass the value — do not widen the service signature.

## Status codes

Nest resolves the status code from the decorator statically: `200` for everything except `@Post`, which is `201`. Override with `@HttpCode(204)`. That resolution happens **before** the handler runs, which matters for the `@Res` case below.

## `@Res({ passthrough: true })` — the trap

Reaching for the raw response object to set a header is legitimate. Reaching for it to set a *status* is not:

```ts
// ❌ "Cannot remove headers after they are sent" on every request
@Get(':id/media')
async media(@Res({ passthrough: true }) res: Response) {
  res.status(304).end();
}
```

Nest re-applies the decorator-resolved static status to a passthrough response, so a manual `res.status(...).end()` fights the router and logs errors on the hot path.

Set headers, return a body (or `undefined`), and let the framework own the status:

```ts
@Get(':id/media')
@Header('Cache-Control', 'private, max-age=0, must-revalidate')
async media(
  @Param('id') id: string,
  @Req() req: Request,
  @Res({ passthrough: true }) res: Response,
) {
  const meta = await this.gallery.resolveMedia(id);   // access decision FIRST
  res.set('ETag', meta.etag);
  if (req.headers['if-none-match'] === meta.etag) {
    res.status(HttpStatus.NOT_MODIFIED);              // explicit, not inferred
    return undefined;
  }
  return new StreamableFile(await this.gallery.openMedia(meta));
}
```

Two rules that fall out of this and cost real production incidents:

- **Never rely on the framework auto-downgrading a response to `304`.** Express's own freshness check will do it locally and can be bypassed by an edge proxy in front of your app, producing a `200` with a zero-byte body — an "empty image" for every revalidating client. Set the status explicitly so the wire contract is identical in every environment.
- **Resolve the access decision before the caching short-circuit.** An `ETag` may skip bytes; it must never skip an authorisation check.

## Streaming

Return `StreamableFile` rather than piping into the response yourself — it keeps the handler declarative and lets Nest own the lifecycle. Note that a `StreamableFile` bypasses the framework's own `send()` path, so any behaviour you were relying on there (freshness checks, implicit content-type) does not apply. Decide before you construct the stream.

## Parameter decorators and parsing

- `@Param('id', ParseUUIDPipe)` / `ParseIntPipe` / `ParseBoolPipe` for individual values.
- `@Body()` with a DTO class for structured input — see [validation.md](validation.md).
- `@Query()` with a DTO class, not a bag of `@Query('a') @Query('b')`. Query values arrive as strings; a DTO plus a transforming `ValidationPipe` is what converts them.
- Build one `@CurrentUser()` custom decorator over `ExecutionContext` instead of `@Req() req` plus a `req.user` cast in twenty controllers.

## Route paths and the Express 5 change

Since NestJS 11, the default adapter is Express 5, whose stricter path parser **rejects bare wildcards**: `'*'` and `'/*'` now throw `Missing parameter name`. Named wildcards are required — `'/*splat'`. This bites catch-all routes, static-file fallbacks and legacy `@All('*')` handlers on upgrade. See [versions-and-upgrades.md](versions-and-upgrades.md).

## Controller checklist

- [ ] No business branching in the handler body.
- [ ] No framework request/response types in any service signature it calls.
- [ ] Every input parsed by a DTO or a parse pipe — never `JSON.parse` or a manual cast.
- [ ] Status is decorator-driven, or set explicitly; never left to a framework auto-downgrade.
- [ ] For a publicly reachable route, the exposure audit in [enhancers.md](enhancers.md) has been done.
