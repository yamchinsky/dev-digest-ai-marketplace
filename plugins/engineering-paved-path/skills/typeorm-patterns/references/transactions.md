# Transactions

## The callback form

```ts
await dataSource.transaction(async (manager) => {
  const order = await manager.getRepository(Order).save(draft);
  await manager.getRepository(Stock).decrement({ sku: draft.sku }, 'quantity', draft.qty);
  return order;
});
```

TypeORM's documentation states the trap in capitals, and it is the one that actually happens: *"ALWAYS use the provided instance of entity manager — `transactionalEntityManager` in this example. DO NOT USE GLOBAL ENTITY MANAGER."*

A repository obtained from the `DataSource` — rather than from the callback's manager — runs on a **different connection**. Its writes are outside the transaction: they commit independently, they are invisible to the transaction's own reads, and they survive a rollback. Nothing errors. The symptom is partial state after a failure, discovered much later.

## Propagating the manager

This is why transactional code has to thread the manager through. Make it an explicit optional parameter rather than ambient state:

```ts
class OrdersRepository {
  constructor(private readonly dataSource: DataSource) {}

  private repo(manager?: EntityManager) {
    return (manager ?? this.dataSource.manager).getRepository(Order);
  }

  findById(id: string, manager?: EntityManager) {
    return this.repo(manager).findOneBy({ id });
  }

  runInTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(work);
  }
}
```

The `runInTransaction` wrapper is what lets a service compose a transaction **without holding a `DataSource`** — which keeps the ORM behind the repository boundary (`engineering-paved-path:onion-architecture`).

Raw SQL threads the same way: `EntityManager.query()` delegates verbatim to `DataSource.query()`, so `(manager ?? dataSource).query(...)` behaves identically inside and outside a transaction, including its result-shape quirks ([raw-sql.md](raw-sql.md)).

## `QueryRunner` — manual control, and an obligation

```ts
const runner = dataSource.createQueryRunner();
await runner.connect();
await runner.startTransaction('REPEATABLE READ');
try {
  await runner.manager.save(entity);
  await runner.commitTransaction();
} catch (err) {
  await runner.rollbackTransaction();
  throw err;
} finally {
  await runner.release();          // documented obligation — not optional
}
```

The docs are explicit: *"you need to release query runner which is manually created."* A leaked runner holds a pooled connection forever. With `pg`'s default pool of 10, ten leaks are a total outage — and it presents as "the database got slow", not as a leak.

Use the callback form unless you genuinely need to interleave non-database work with an open transaction, or need savepoints. The callback form releases for you.

## Isolation levels

```ts
await dataSource.transaction('SERIALIZABLE', async (manager) => { … });
```

The documented caveat: *"isolation level implementations are not agnostic across all databases. Each driver declares which levels it supports, and TypeORM will throw an error if you request an unsupported level."*

On PostgreSQL, the level you ask for is the level you get, and `SERIALIZABLE` (and `REPEATABLE READ`) can abort with a serialization failure (`40001`) that a correct application **retries**. If you raise the isolation level, add the retry loop in the same change — otherwise you have swapped a silent race for an intermittent 500.

Before raising it, check whether a single atomic statement solves the problem instead. A conditional `UPDATE … WHERE … RETURNING` needs no elevated isolation at all ([raw-sql.md](raw-sql.md)).

## What must throw, and what must not

When a transaction has already written something conditional — an idempotency claim, a reservation, a lock row — an **expected** rejection must throw *inside* the transaction so that write rolls back with it:

```ts
// ❌ the claim row commits; the key is burned and can never be retried
await repo.runInTransaction(async (m) => {
  await claimIdempotencyKey(m, key);
  if (balance < amount) return null;        // the no-op commits
  await debit(m, amount);
});

// ✅ the claim rolls back with the rejection
await repo.runInTransaction(async (m) => {
  await claimIdempotencyKey(m, key);
  if (balance < amount) throw new InsufficientBalance();
  await debit(m, amount);
});
```

The house style of "return a sentinel, throw at the edge" is fine everywhere else — and wrong exactly here. Pin it with a test named for the behaviour: *"an insufficient-balance rejection does not permanently claim the idempotency key."*

## Scope of a transaction

- **Keep it short.** A transaction held open across an HTTP call to a third party holds a connection and its locks for that call's latency, including its timeout.
- **No side effects that cannot roll back.** Sending an email, publishing an event or writing to object storage inside a transaction means a rollback leaves the side effect done. Collect them and fire after commit, or use an outbox row written *in* the transaction and drained after.
- **Do not nest by accident.** A transactional method calling another transactional method through the *global* manager opens a second, independent transaction. Threading the manager is what prevents it.

## The decorators are long gone

`@Transaction`, `@TransactionManager` and `@TransactionRepository` were removed in **TypeORM 0.3.0 (2021)** — this is not part of the 1.x migration. If you find them in a codebase or in an article, the material predates 0.3.

## Checklist

- [ ] Every call inside a transaction uses the provided manager.
- [ ] Manually created query runners are released in a `finally`.
- [ ] Raised isolation levels come with a serialization-failure retry.
- [ ] Non-rollbackable side effects happen after commit.
- [ ] Expected rejections that share a transaction with a claim write **throw**.
