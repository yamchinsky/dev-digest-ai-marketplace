---
name: persistence
description: Wiring the ORM into a Nest application — module registration, repository injection, the layer boundary
metadata:
  tags: typeorm, database, repository, injectrepository, datasource, migrations
---

# Wiring persistence

This file covers the **Nest side** of the database: how the connection is registered, how repositories reach a service, and where the boundary sits. Query construction, entity mapping, migrations, transactions and soft deletes belong to `engineering-paved-path:typeorm-patterns`; PostgreSQL schema design belongs to `engineering-paved-path:postgresql-table-design`.

`@nestjs/typeorm` is a **separate package**, and so is every ORM integration. What generalises is the boundary: connection options resolved asynchronously from configuration, the ORM confined to a repository class, and nothing above it holding a connection handle. Substitute the equivalents for whatever the project uses.

## Registration

```ts
// app.module.ts
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    url: config.getOrThrow('DATABASE_URL'),
    entities: [/* explicit imports */],
    migrations: [/* explicit imports */],
    synchronize: false,        // never true outside a throwaway database
    migrationsRun: false,      // run migrations as a deploy step, not at boot
  }),
})
```

Four decisions in that block, each with a reason:

- **`forRootAsync`, not `forRoot`.** Module metadata evaluates before `ConfigModule` has validated anything — see [configuration.md](configuration.md).
- **`synchronize: false`.** TypeORM's own documentation is blunt: *"it is unsafe to use `synchronize: true` for schema synchronization on production once you get data in your database."* Treat it as development-only, and preferably never.
- **`migrationsRun: false`.** Running migrations at application boot means every replica races to run them, and a failed migration becomes a crash loop instead of a failed deploy step. Run them as an explicit step.
- **Explicit entity/migration imports over glob strings.** Globs resolve differently under `ts-node`, a compiled `dist/`, a bundler and a test runner; an explicit array fails at compile time instead of silently loading nothing.

Per feature module:

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderLine])],
  providers: [OrdersService, OrdersRepository],
  exports: [OrdersService],
})
export class OrdersModule {}
```

## Repository injection

```ts
@Injectable()
export class OrdersRepository {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}
}
```

`@InjectRepository` and `@InjectDataSource` resolve by token, so — unlike a constructor-injected class — **these imports may stay `import type`** ([dependency-injection.md](dependency-injection.md)).

## The boundary

- **A service does not inject `Repository<T>` or `DataSource`.** Both go into the module's own repository class. A service holding a `DataSource` will eventually run a query, and then the query lives somewhere nobody greps.
- **A repository does not read configuration.** When a query needs an environment-derived value, take it as a parameter (`upsertItem(item, mediaBaseUrl)`) and keep the resolution in the service or the factory.
- **A repository is module-private.** No file outside `modules/<name>/` imports another module's repository. Crossing that boundary bypasses whatever caching, telemetry, error translation and invariants the owning service holds, and it turns a schema change into a silent cross-module break. Call the sibling module's **service**, or define a port both modules depend on. `engineering-paved-path:onion-architecture` owns this rule in full.

Detection is mechanical: search for an import of `…/modules/<name>/repository` from any file whose own path is outside `modules/<name>/`.

## Transactions across the boundary

A service that needs two repository calls in one transaction should not acquire the transaction itself — that would put the `DataSource` back in the service. Expose the wrapper from the repository:

```ts
// repository
runInTransaction<T>(work: (tx: EntityManager) => Promise<T>): Promise<T> {
  return this.dataSource.transaction(work);
}
```

and thread the transactional manager through the repository methods that participate. The mechanics — and the documented trap of using the global manager inside the callback — are in `engineering-paved-path:typeorm-patterns`.

## Migrations are a deliverable, not a by-product

Generated migrations need a review pass before they are committed; what a differ proposes is not what you meant. The specific systematic defects, and the rules for hand-writing one, are in `engineering-paved-path:typeorm-patterns`. The Nest-side obligation is narrower and easy to forget:

**A migration that adds a table with a user-owned foreign key is not finished until the account-deletion path knows about it.** Where accounts are soft-deleted, an `ON DELETE CASCADE` on that key never fires — it is decorative — and the rows (plus any object-storage blobs they reference) outlive the account in full. Add the erase step and a test asserting it, in the same change as the table.

## Multiple data sources

Naming the connection is required as soon as there are two:

```ts
TypeOrmModule.forRoot({ name: 'reporting', … })
// …
constructor(@InjectRepository(Report, 'reporting') private readonly reports: Repository<Report>) {}
```

An unnamed second registration silently overwrites the default one, and the failure surfaces as queries hitting the wrong database rather than as an error.

## Checklist

- [ ] `synchronize: false`, migrations run as a deploy step.
- [ ] Connection options resolved through `forRootAsync` + `ConfigService`.
- [ ] Repository classes hold the ORM; services hold repositories.
- [ ] No cross-module repository imports.
- [ ] New user-owned table → an erasure step exists and is tested.
