# Soft deletes

A `@DeleteDateColumn` turns deletion into an `UPDATE`. That is a decision about *filtering*, and the filter is implemented in the ORM — not in the database. Every query path that does not go through the ORM's find layer therefore sees deleted rows.

```ts
@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
```

## The four operations

| Call | Operates on | Behaves like |
|---|---|---|
| `repo.softDelete(criteria)` | a **condition** | `update()` — no SELECT, no cascade |
| `repo.restore(criteria)` | a **condition** | `update()` |
| `repo.softRemove(entity)` | an **entity instance** | `remove()` — cascades apply |
| `repo.recover(entity)` | an **entity instance** | `save()` |

The condition/instance split is the same split as `update()` vs `save()` throughout the API. `softDelete` is cheaper and does not touch relations; `softRemove` walks the cascade graph — but only across relations that are actually **loaded on the object**, which is the trap covered in [entities-and-relations.md](entities-and-relations.md).

## Which reads filter, and which do not

| Path | Filters soft-deleted rows? |
|---|---|
| `find`, `findOne`, `findBy`, `findOneBy`, `count`, … | **Yes**, automatically |
| the same, with `withDeleted: true` | No — opted out deliberately |
| `createQueryBuilder(...)` — **root entity** | **NO** |
| `createQueryBuilder(...)` — **joined relations** | Yes (but see the ordering bug below) |
| `dataSource.query()` / raw SQL | **NO** |

**The query-builder root is the one people get wrong.** A query builder on a soft-deletable entity happily returns deleted rows unless you say otherwise:

```ts
// ❌ returns soft-deleted users
const rows = await repo.createQueryBuilder('u')
  .where('u.workspaceId = :workspaceId', { workspaceId })
  .getMany();

// ✅
const rows = await repo.createQueryBuilder('u')
  .where('u.workspaceId = :workspaceId', { workspaceId })
  .andWhere('u.deletedAt IS NULL')
  .getMany();
```

> **Open upstream issue:** `QueryBuilder.withDeleted()` behaves differently depending on whether it is called *before* or *after* `leftJoinAndSelect()`, so soft-deleted rows can leak back in — or stay excluded — on joined relations depending on call order ([typeorm#11906](https://github.com/typeorm/typeorm/issues/11906), open as of 2026-09-06). If a query mixes `withDeleted()` and joins, assert the behaviour in a test rather than reasoning about it.

## The exposure this creates

A route that looks a row up by id, with no join to its owner, keeps serving the data of an erased account forever — because the row itself was never deleted, only its owner was. The ORM's automatic filter applies to the **query's own root entity**; it does nothing about a *different* entity's deletion state.

Two rules:

- **A publicly reachable read must check that the subject is still active**, explicitly, whether by joining the owner or by a second lookup. Do not assume the find-family filter covers it.
- **Audit what a response serialises, not what it is typed as.** A DTO type is not a guarantee about what a service actually put on the object.

## `ON DELETE CASCADE` is dead code under soft deletion

If account erasure soft-deletes the owner row, then **no foreign key cascade off that row ever fires.** The cascade is decorative: it reads as erasure coverage in review and in the migration, and it never runs.

Consequences worth writing on a checklist:

- Every new table carrying an owner foreign key needs its **own explicit erasure step**, plus a test asserting it. Keep the cascade as a backstop for the hard-delete case, but do not count it.
- Object-storage blobs referenced by such rows outlive the account too. Delete the blob before the row — a failure between the two should leave a row pointing at a missing object, not an orphaned object nobody can find.
- The question *"who purges this on erasure?"* belongs in the review of the migration that adds the table, not in a later audit.

## `withDeleted` and its blast radius

`withDeleted: true` is right for admin views, audit exports and restore flows. It is wrong as a way to make a failing query return rows. If a query needs deleted rows to work, either:

- the row should not have been soft-deleted (it is reference data, not user data), or
- the reading code needs a snapshot of what it read, not a live join to a mutable row.

## Testing

- A hermetic spec cannot prove any of this — the filter is generated SQL. Use a database-backed test that inserts a row, soft-deletes it, and asserts each read path.
- Test the **query-builder** path specifically. It is the one that differs from the intuition, and it is the one that ships.
