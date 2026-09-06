# Entities and relations

## Entity basics

```ts
@Entity({ name: 'orders' })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total!: string;                       // numeric arrives as a STRING — see postgres-specifics.md

  @Column({ type: 'enum', enum: OrderStatus })
  status!: OrderStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
```

Rules that pay off later:

- **Name the table explicitly.** Relying on the naming strategy means a class rename silently becomes a schema change proposal in the next generated migration.
- **State the column `type`.** Inference is convenient and produces surprises — `number` becoming `integer` when you needed `bigint`, `Date` becoming `timestamp` when you needed `timestamptz`.
- **`timestamptz`, not `timestamp`,** for anything that is a moment in time. See [postgres-specifics.md](postgres-specifics.md).
- **Type `numeric` and `bigint` columns as `string`** and convert at the boundary — that is what the driver returns, and typing them `number` is a lie the compiler will not catch.

An entity is a persistence mapping, not a domain model. Where the domain type lives, and whether an entity may cross a module boundary, is `engineering-paved-path:onion-architecture`'s question.

## Relations

```ts
@ManyToOne(() => User, (user) => user.orders, { nullable: false, onDelete: 'RESTRICT' })
@JoinColumn({ name: 'user_id' })
user!: User;

@OneToMany(() => OrderLine, (line) => line.order, { cascade: ['insert', 'update'] })
lines!: OrderLine[];
```

- **Arrow functions for the target type** (`() => User`) — this is what makes circular entity imports resolvable.
- `onDelete` is a **DDL** setting on the foreign key: `RESTRICT` (default), `CASCADE`, `SET NULL`. It is enforced by the database, not by TypeORM.
- `@JoinColumn` names the column; without it you inherit the naming strategy's guess.

### `nullable: false` now means `INNER JOIN`

**Changed in TypeORM 1.0.** A non-nullable `@ManyToOne` (or owning `@OneToOne`) generates an `INNER JOIN` where 0.3.x generated a `LEFT JOIN`.

Consequence: a row whose relation is missing — which the FK's `NOT NULL` says cannot happen, but data outlives constraints — is now **silently excluded from result sets** instead of coming back with a null relation. If a query started returning fewer rows after the upgrade, this is the first thing to check.

Soft-deleted relations still use `LEFT JOIN` regardless.

### `cascade` only reaches loaded relations

`cascade` lets related objects be inserted, updated or removed through the parent's `save()`/`remove()` — but TypeORM only traverses relations that are **populated on the object**. A cascade-remove for a relation you never loaded does nothing, silently.

So `cascade` is a convenience for aggregates you construct in memory, not a data-integrity mechanism. Integrity belongs to the foreign key's `onDelete`, in the database.

### `orphanedRowAction` changed too

**Changed in 1.0:** with `orphanedRowAction: "nullify"` (the default) against a **non-nullable** FK column, TypeORM previously threw a constraint violation; it now **deletes the orphaned child row**. A save that used to fail loudly now removes data. Audit any `@OneToMany` where you replace the whole child collection on save.

### Eager vs lazy

- `eager: true` loads the relation on every `find*` — and is **ignored by `createQueryBuilder`** ([query-builder.md](query-builder.md)). Because half your read paths silently drop it, eager relations create two different shapes for the same entity. Prefer explicit `relations` in find options.
- Lazy relations must be typed `Promise<T>`, which changes the property's type everywhere and makes accidental N+1 easy. Reach for them rarely.

### `@RelationId`

```ts
@RelationId((order: Order) => order.user)
userId!: string;
```

Read-only and derived: *"the underlying relation is not added/removed/changed when changing the value."* Assigning to it does nothing to the relation. If you want a writable foreign key, declare an explicit `@Column({ name: 'user_id' })` alongside the relation and keep the two in sync deliberately — that is the more common and more predictable shape.

## Enums

`@Column({ type: 'enum', enum: X })` maps to a PostgreSQL enum type. Two things to know before choosing it over a lookup table or a `text` + `CHECK`:

- **Adding a value** is cheap now — TypeORM 1.0 emits `ALTER TYPE … ADD VALUE` directly instead of the old rename/recreate/drop dance ([PR #10956](https://github.com/typeorm/typeorm/pull/10956)) — but the new value **cannot be used until the transaction commits**, so adding and using it in one migration fails.
- **Removing or renaming a value** is not supported by PostgreSQL at all and needs a hand-written migration. See [postgres-specifics.md](postgres-specifics.md).

A TypeScript string enum is also **not assignable to a disjoint string-literal union** with identical runtime values. Where an entity enum meets a wire contract's union, map through an exhaustive `Record<Enum, Literal>` rather than casting — the exhaustiveness check is what tells you when someone adds a value.

## Column transformers

```ts
@Column({
  type: 'bigint',
  transformer: { to: (v: bigint) => v.toString(), from: (v: string) => BigInt(v) },
})
amount!: bigint;
```

Useful, with one condition: **transformers run on the repository path only.** Raw SQL and `getRawMany()` return untransformed driver values ([raw-sql.md](raw-sql.md)). A transformer is therefore not a place to put an invariant — it is a convenience for the paths that happen to use it.

## Changing an entity is a package-wide change

Adding a required column breaks every fixture factory that builds the entity by object literal, across the whole package, in files no task list mentions. `ts-jest` does not structurally check object literals, so **Jest can stay green while `tsc --noEmit` fails**. Before adding a required field, grep for the fixture builders; and run the typecheck, not just the tests.

## Checklist

- [ ] Explicit table names and column types.
- [ ] `timestamptz` for moments; `numeric`/`bigint` typed as `string`.
- [ ] `onDelete` chosen deliberately — and remembered to be inert under soft deletion ([soft-deletes.md](soft-deletes.md)).
- [ ] No reliance on `cascade` for integrity.
- [ ] No `eager: true` unless every read path is a `find*`.
- [ ] Enum changes beyond an addition planned as a hand-written migration.
