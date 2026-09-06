---
name: validation
description: class-validator DTOs, ValidationPipe options, transformation traps, where validation belongs
metadata:
  tags: validation, dto, class-validator, class-transformer, validationpipe, whitelist
---

# Validation at the edge

Untrusted input is validated **once**, at the HTTP boundary, by a DTO class plus a global `ValidationPipe`. Downstream code receives a typed object and does not re-check it.

```ts
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,            // strip properties with no validation decorator
    forbidNonWhitelisted: true, // …or reject the request outright
    transform: true,            // hand the handler a DTO instance, not a plain object
  }),
);
```

The documented framing for the global registration is *"binding `ValidationPipe` at the application level, thus ensuring all endpoints are protected from receiving incorrect data"* ([validation](https://docs.nestjs.com/techniques/validation)).

## DTOs are classes, not interfaces

```ts
export class CreateOrderDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
```

An interface produces no runtime artifact, so the pipe has nothing to validate against. This is the same emitted-metadata dependency that DI has — see [typescript-setup.md](typescript-setup.md).

## The option semantics, verbatim

| Option | Documented behaviour |
|---|---|
| `whitelist` | *"validator will strip validated (returned) object of any properties that do not use any validation decorators"* |
| `forbidNonWhitelisted` | *"instead of stripping non-whitelisted properties validator will throw an exception"* |
| `transform` | converts the payload to an instance of the DTO class; also *"performs conversion of primitive types"* for path and query parameters |
| `disableErrorMessages` | *"validation errors will not be returned to the client"* |
| `stopAtFirstError` | *"validation of the given property will stop after encountering the first error"* |

`whitelist: true` is the one that earns its keep. Without it, a client can post extra keys that a later `Object.assign` or spread quietly persists.

## The generics and interfaces caveat

Documented, and it catches people out: *"TypeScript does not store metadata about generics or interfaces, so when you use them in your DTOs, `ValidationPipe` may not be able to properly validate incoming data."*

The practical consequences:

- A DTO field typed as a generic wrapper is not validated in the way you expect.
- Nested objects need `@ValidateNested()` **and** `@Type(() => Child)` — the `@Type` decorator is what tells `class-transformer` the runtime class, since the emitted metadata for `Child[]` is just `Array`.
- Arrays need `{ each: true }` on the validators.

```ts
export class CreateInvoiceDto {
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  @ArrayMinSize(1)
  lines!: InvoiceLineDto[];
}
```

## `transformOptions.enableImplicitConversion`

This is a `class-transformer` option surfaced through the pipe, not a documented NestJS behaviour — the validation docs describe `transform: true` performing primitive conversion for path and query parameters, and do not cover the implicit-conversion flag.

Turning it on makes `class-transformer` coerce values based on the emitted design type, which converts `?limit=20` into a `number` without an explicit `@Type(() => Number)`. It also coerces things you did not want coerced: `"false"` becomes truthy or falsy depending on the target type, a numeric-looking string in a `string` field can round-trip through `Number`, and the behaviour is invisible in the DTO source.

Prefer explicit `@Type(() => Number)` / `@Transform(...)` per field. If you enable implicit conversion globally, treat it as a decision to document, not a default to inherit.

## Validate primitives too

A route parameter that is not validated is an unvalidated input, even when it is "just an id":

```ts
@Get(':id')
getOne(@Param('id', ParseUUIDPipe) id: string) {}
```

`ParseUUIDPipe` turns a malformed id into a `400` before any query runs. Without it, the value reaches the repository and produces either a driver error surfacing as a `500`, or — worse — a successful query against an unexpected value.

## Where validation must not happen

- **Not a second time in the service.** If a service re-validates, either the pipe is not doing its job (fix the pipe) or the service is enforcing a *domain invariant* — which is a different thing and should throw a domain error, not a validation error.
- **Not by hand inside the handler.** Parsing the body manually inside a controller method bypasses the pipe entirely, and with it the whole error-shaping path.
- **Not on the response.** A DTO type on a response is a *type*, not a guarantee — see the exposure audit in [enhancers.md](enhancers.md). If a response must be filtered, filter it with an interceptor or an explicit mapper, and assert on the real object in tests.

## Boundary enums

When a database enum and a wire contract's literal union diverge on purpose (the database is deliberately the wider set), convert through an exhaustive lookup:

```ts
const LOCALE_MAP: Record<DbLocale, WireLocale> = { uk: 'uk', en: 'en', pl: 'en' };
```

Two failure modes worth knowing:

- **Audit the read path as carefully as the write path.** Conversion on writes is the visible half and creates a false sense of coverage; a response path that spreads a repository snapshot leaks the raw enum while the write path looks disciplined.
- **The fix that finds the holes is retyping the response field to the contract type**, not inserting a conversion at the one call site you noticed. Retyping makes the compiler enumerate every leak.

## Third-party schema validation

`class-validator` is the default because the DTO class doubles as the transformation target. Zod (or another Standard Schema library) is a legitimate alternative for request bodies, especially where the schema is shared with a client package — implement a small pipe that runs `safeParse` and throws a `BadRequestException` with the flattened issues. For Zod mechanics see `engineering-paved-path:zod`.

Note the version reality: `class-validator`'s last release is 0.15.1 (2026-02), and `class-transformer` has had **no tagged release since 0.5.1 in 2021**. They work, and Nest's docs still build on them, but do not expect fixes. That is a real argument for schema-library validation on new code.
