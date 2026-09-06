---
name: exceptions
description: HttpException hierarchy, domain errors, exception filters, one error envelope
metadata:
  tags: exceptions, filters, http-exception, error-handling, error-codes
---

# Exceptions and error responses

One rule underpins the rest: **handlers throw, one filter renders.** A controller that builds an error body by hand is a controller whose error shape will drift from every other route.

## The built-in hierarchy

`@nestjs/common` ships `HttpException` and the standard subclasses — `BadRequestException`, `UnauthorizedException`, `ForbiddenException`, `NotFoundException`, `ConflictException`, `UnprocessableEntityException`, `TooManyRequestsException`, `InternalServerErrorException`, and the rest. Throwing one anywhere in the request path produces the right status without touching the response object.

NestJS 12 added a machine-readable code to the options bag:

```ts
throw new BadRequestException('Password is too weak', { errorCode: 'WEAK_PASSWORD' });
```

`errorCode` is serialised into the body, which gives clients something stable to branch on instead of matching on a human-readable message. If you already ship your own error-code envelope, keep yours — do not run two.

## Domain errors, then a filter that maps them

Services should not import HTTP exception classes. That is the delivery layer's vocabulary, and importing it makes a service untestable without asserting on status codes.

```ts
// modules/orders/orders.errors.ts
export class OrderNotFound extends Error {
  constructor(readonly orderId: string) { super(`order ${orderId} not found`); }
}
export class InsufficientStock extends Error {
  constructor(readonly productId: string, readonly available: number) { super('insufficient stock'); }
}
```

```ts
// common/filters/domain-exception.filter.ts
@Catch(OrderNotFound, InsufficientStock)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(err: Error, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const mapped =
      err instanceof OrderNotFound
        ? { status: 404, code: 'ORDER_NOT_FOUND' }
        : { status: 409, code: 'INSUFFICIENT_STOCK' };
    res.status(mapped.status).json({ statusCode: mapped.status, code: mapped.code, message: err.message });
  }
}
```

Register it globally through `APP_FILTER` so it can inject a logger:

```ts
providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }]
```

For a small application, skipping the domain-error layer and throwing `NotFoundException` from the service is a defensible trade. Make it a decision, not a drift: pick one and apply it everywhere, because a codebase where half the services throw HTTP exceptions and half throw domain errors has two error paths and one of them is always the untested one.

## The catch-all filter

One filter for everything unhandled, registered last (global filters run last in the chain):

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Log the cause chain, not just the top-level message.
    this.logger.error({ err: exception }, 'unhandled exception');

    res.status(status).json({
      statusCode: status,
      message: status >= 500 ? 'Internal Server Error' : (exception as HttpException).message,
    });
  }
}
```

Two things it must do and one it must not:

- **Must** collapse `5xx` messages in production. An unhandled driver error's message can contain a query, a column list, or a value.
- **Must** log before responding, with the `cause` chain intact — `new Error('...', { cause: err })` preserves it.
- **Must not** swallow the exception silently. A filter that returns a `200` with an error-shaped body is how a client-side retry loop is born.

## Where filters do not reach

Exceptions thrown in **middleware** bypass controller- and method-scoped filters; only global filters see them ([exception filters](https://docs.nestjs.com/exception-filters)). If middleware can fail — and anything doing I/O can — the global filter is the only thing standing between it and an unformatted stack trace.

The same applies outside the request lifecycle entirely: a scheduled job, an event handler, or a queue consumer is not in an HTTP context, so no filter renders its failure. Those need their own `try/catch` and their own logging, or a failure disappears into an unhandled rejection.

## Errors that must roll back

When an expected rejection happens inside a transaction that has *already written* something — an idempotency claim row, a reservation — it must **throw inside the transaction**, not return a sentinel and throw outside.

```ts
// ❌ the claim row commits; the key is permanently burned and cannot be retried
const result = await this.repo.runInTransaction(async (tx) => {
  await tx.claimIdempotencyKey(key);
  if (balance < amount) return null;          // no-op commits
  …
});
if (result === null) throw new ConflictException('insufficient balance');

// ✅ the throw rolls the claim back with it
await this.repo.runInTransaction(async (tx) => {
  await tx.claimIdempotencyKey(key);
  if (balance < amount) throw new InsufficientBalance();
  …
});
```

The "return a sentinel, throw at the edge" pattern is fine — right up until the guarded mutation shares a transaction with a write that must not survive the rejection. See `engineering-paved-path:typeorm-patterns` for the transaction mechanics.

## Checklist

- [ ] No error body constructed in a controller.
- [ ] One global catch-all filter, registered via `APP_FILTER`.
- [ ] `5xx` messages are generic in production; full detail is logged.
- [ ] Non-HTTP entry points (schedulers, consumers, listeners) have their own error handling.
- [ ] Expected rejections inside a write transaction throw rather than return.
