# Onion architecture — concrete examples

Skeletons referenced from [SKILL.md](SKILL.md). They are written in **NestJS +
TypeORM**, which is one instantiation of the rules — not a requirement. The
*shape* is the point: an HTTP edge that only translates, a service that only
orchestrates, a repository that owns the ORM, adapters behind ports, and a
single composition root. Map the names onto your stack using the vocabulary
table in SKILL.md.

Paths assume an API package rooted at `src/`, a shared contracts package
imported as `@app/shared`, and (for Example 3) a pure engine package imported
as `@app/engine`.

For the framework mechanics — provider forms, injection tokens, validation
pipes, testing modules — see `engineering-paved-path:nestjs-best-practices`.
For the ORM mechanics see `engineering-paved-path:typeorm-patterns`.

---

## Example 1: New module from scratch

Scenario: add a `widgets` module — list and create widgets, scoped to a workspace.

### `src/modules/widgets/dto/create-widget.dto.ts`

```ts
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

// Transport DTO (HTTP edge). Keep separate from any domain schema.
export class CreateWidgetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsIn(['red', 'green', 'blue'])
  color!: 'red' | 'green' | 'blue';
}
```

### `src/modules/widgets/widgets.controller.ts`

```ts
import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentContext } from '../../platform/current-context.decorator';
import type { RequestContext } from '../../platform/request-context';
import { CreateWidgetDto } from './dto/create-widget.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WidgetsService } from './widgets.service';

@Controller('widgets')
export class WidgetsController {
  constructor(private readonly widgets: WidgetsService) {}

  @Get()
  list(@CurrentContext() ctx: RequestContext) {
    return this.widgets.list(ctx.workspaceId);
  }

  @Post()
  create(@CurrentContext() ctx: RequestContext, @Body() body: CreateWidgetDto) {
    return this.widgets.create(ctx.workspaceId, ctx.userId, body);
  }

  @Get(':id')
  getOne(@CurrentContext() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.widgets.getById(ctx.workspaceId, id);
  }
}
```

Notes:
- Validation runs in the globally registered pipe, **before** the handler. No parsing in the body.
- `@CurrentContext()` is one custom parameter decorator over the execution context — it is what keeps framework request types out of every signature.
- The `eslint-disable` on the service import is deliberate: converting a constructor-injected class to `import type` erases the DI metadata and breaks the container at boot. Token-resolved parameters do not need it.

### `src/modules/widgets/widgets.service.ts`

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WidgetsRepository } from './widgets.repository';

export interface CreateWidgetInput {
  name: string;
  color: 'red' | 'green' | 'blue';
}

@Injectable()
export class WidgetsService {
  constructor(private readonly repo: WidgetsRepository) {}

  list(workspaceId: string) {
    return this.repo.listByWorkspace(workspaceId);
  }

  create(workspaceId: string, userId: string, input: CreateWidgetInput) {
    return this.repo.insert({ workspaceId, createdBy: userId, ...input });
  }

  async getById(workspaceId: string, id: string) {
    const widget = await this.repo.findById(workspaceId, id);
    if (!widget) throw new NotFoundException(`widget ${id} not found`);
    return widget;
  }
}
```

Notes:
- Takes its repository by constructor injection; it never constructs one.
- No ORM import here — the repository owns it.
- Throws a typed error. The global exception filter renders the envelope.

### `src/modules/widgets/widgets.repository.ts`

```ts
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import type { Repository } from 'typeorm';       // token-resolved → `import type` is fine
import { Widget } from './widget.entity';

@Injectable()
export class WidgetsRepository {
  constructor(@InjectRepository(Widget) private readonly widgets: Repository<Widget>) {}

  listByWorkspace(workspaceId: string) {
    return this.widgets.findBy({ workspaceId });
  }

  findById(workspaceId: string, id: string) {
    return this.widgets.findOneBy({ workspaceId, id });
  }

  async insert(input: {
    workspaceId: string;
    createdBy: string;
    name: string;
    color: 'red' | 'green' | 'blue';
  }): Promise<Widget> {
    const { identifiers } = await this.widgets.insert(input);
    return this.widgets.findOneByOrFail({ id: identifiers[0].id as string });
  }
}
```

Notes:
- The only ORM importer in the module.
- Workspace scoping is enforced in **every** query.
- Reads no configuration. When a query needs an env-derived value, take it as a parameter.
- Multi-aggregate module? Split into `repository/widget.repo.ts` + `repository/tag.repo.ts` and compose them.

### `src/modules/widgets/widgets.module.ts`

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Widget } from './widget.entity';
import { WidgetsController } from './widgets.controller';
import { WidgetsRepository } from './widgets.repository';
import { WidgetsService } from './widgets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Widget])],
  controllers: [WidgetsController],
  providers: [WidgetsService, WidgetsRepository],
  exports: [WidgetsService],           // the service, never the repository
})
export class WidgetsModule {}
```

Then add `WidgetsModule` to the composition root — and to nowhere else:

```ts
// src/app.module.ts
@Module({
  imports: [/* …existing… */ WidgetsModule],
})
export class AppModule {}
```

The module must stay independently bootable:

```ts
await Test.createTestingModule({ imports: [WidgetsModule] }).compile();
```

If that fails while the whole app boots, the module is relying on something a sibling happens to provide.

### What NOT to do

```ts
// ❌ ORM in the service
@Injectable()
class WidgetsService {
  constructor(@InjectRepository(Widget) private readonly widgets: Repository<Widget>) {}
  list(workspaceId: string) { return this.widgets.findBy({ workspaceId }); }
}

// ❌ parsing in the handler — bypasses the validation pipe and the error path
@Post()
create(@Req() req: Request) {
  const body = JSON.parse(req.body as string);
}

// ❌ the request object crossing into the service
create(@Req() req: Request) { return this.widgets.create(req); }

// ❌ another module's repository
import { OrdersRepository } from '../orders/orders.repository';

// ❌ exporting the repository — it is module-private
@Module({ exports: [WidgetsService, WidgetsRepository] })
```

---

## Example 2: Adding a new outbound port

Scenario: widget creation should call a third-party "Sentiment API" to score the widget name. New outbound HTTP → new port.

### Step 1 — declare the port in the shared contracts package

`shared/adapters.ts`:

```ts
// ---------- Sentiment ----------
export interface SentimentClient {
  score(text: string): Promise<{ value: number; label: 'pos' | 'neg' | 'neu' }>;
}
```

Re-export from the package index if an existing `export *` does not pick it up.

### Step 2 — a DI token

An interface has no runtime identity, so it cannot be an injection token.

`src/modules/widgets/widgets.tokens.ts`:

```ts
export const SENTIMENT_CLIENT = Symbol('SENTIMENT_CLIENT');
```

### Step 3 — concrete adapter

`src/adapters/sentiment/http-sentiment.adapter.ts`:

```ts
import type { SentimentClient } from '@app/shared';
import { ExternalServiceError } from '../../platform/errors';

export class HttpSentimentClient implements SentimentClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async score(text: string) {
    const res = await fetch(`${this.baseUrl}/score`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new ExternalServiceError(`sentiment api ${res.status}`);
    return (await res.json()) as Awaited<ReturnType<SentimentClient['score']>>;
  }
}
```

Notes:
- `implements SentimentClient` — the typecheck is the contract.
- Failure throws a typed application error so the global filter can shape the response. **Never** swallow and rethrow with a bare string.
- No DB, no framework, no module imports — adapters are leaves.

### Step 4 — a factory that owns the safety checks

`src/adapters/sentiment/sentiment.factory.ts`:

```ts
import type { ConfigService } from '@nestjs/config';
import type { SentimentClient } from '@app/shared';
import { ConfigError } from '../../platform/errors';
import { HttpSentimentClient } from './http-sentiment.adapter';
import { NoopSentimentClient } from './noop-sentiment.adapter';

const STUB_SAFE_ENVIRONMENTS = new Set(['development', 'test']);

export function createSentimentClient(config: ConfigService): SentimentClient {
  if (!config.get<boolean>('SENTIMENT_ENABLED')) {
    const env = config.get<string>('NODE_ENV') ?? '';
    if (STUB_SAFE_ENVIRONMENTS.has(env)) return new NoopSentimentClient();
    throw new ConfigError(`sentiment is disabled while NODE_ENV=${env || '(unset)'}`);
  }
  // Gate first, credentials second: the SDK constructor never runs on a disabled path.
  return new HttpSentimentClient(
    config.getOrThrow('SENTIMENT_BASE_URL'),
    config.getOrThrow('SENTIMENT_API_KEY'),
  );
}
```

Notes:
- The environment check is a **positive allow-list**. `!== 'production'` silently admits a typo like `stagng`.
- The refusal message interpolates the real value rather than naming an environment.
- This factory is the *only* legitimate binding for the token. A second module that binds `HttpSentimentClient` directly loses every check above.

### Step 5 — bind it

```ts
// src/modules/widgets/widgets.module.ts
providers: [
  WidgetsService,
  WidgetsRepository,
  { provide: SENTIMENT_CLIENT, useFactory: createSentimentClient, inject: [ConfigService] },
],
```

If a second module needs the same port later, it imports this module (with `SENTIMENT_CLIENT` added to `exports`) or the port moves to its own module — it does **not** re-bind the class.

### Step 6 — consume from the service

```ts
@Injectable()
export class WidgetsService {
  constructor(
    private readonly repo: WidgetsRepository,
    @Inject(SENTIMENT_CLIENT) private readonly sentiment: SentimentClient,
  ) {}

  async create(workspaceId: string, userId: string, input: CreateWidgetInput) {
    const scoring = this.sentiment.score(input.name).catch(() => null);
    const widget = await this.repo.insert({ workspaceId, createdBy: userId, ...input });
    const scored = await scoring;
    if (scored) await this.repo.attachSentiment(widget.id, scored);
    return widget;
  }
}
```

The service consumes the port through its token. It never sees `fetch` or the SDK.

### Step 7 — the test fake

`src/adapters/mocks.ts`:

```ts
import type { SentimentClient } from '@app/shared';

export class MockSentimentClient implements SentimentClient {
  constructor(private readonly fixed = { value: 0, label: 'neu' as const }) {}
  async score() { return this.fixed; }
}
```

```ts
const moduleRef = await Test.createTestingModule({ imports: [WidgetsModule] })
  .overrideProvider(SENTIMENT_CLIENT)
  .useValue(new MockSentimentClient({ value: 0.9, label: 'pos' }))
  .compile();
```

Hermetic: no network, no `.integration-spec.` suffix. Note that overriding the provider also skips the factory — so keep one test that compiles the module **without** overrides, or the factory's own wiring is never exercised.

---

## Example 3: Adding capability to the pure engine

Scenario: the engine (a pure computation package, e.g. an analysis pipeline) needs the project's `README.md` text to bias its output.

The wrong instinct is to read it from inside the engine. That breaks purity. The right move is to take it as an argument and let the host supply it.

### ❌ Wrong: filesystem access in the engine

```ts
// engine/src/run.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export async function runAnalysis(input: AnalysisInput) {
  const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8'); // ❌ ❌ ❌
  // - filesystem access in a pure engine
  // - process.cwd() assumption
  // - now every other entry point (CLI, CI) needs the file at cwd, too
}
```

This fails the purity checklist on every line: fs import, `process.cwd()` read, and the engine now silently depends on a working-directory layout.

### ✅ Right: take it as an argument

`engine/src/run.ts`:

```ts
export interface AnalysisInput {
  // …existing fields…
  llm: LLMProvider;

  /** Optional project README text — caller supplies, engine never reads files. */
  readme?: string;
}

export async function runAnalysis(input: AnalysisInput): Promise<AnalysisOutcome> {
  const parts: PromptParts = {
    // …existing parts…
    ...(input.readme ? { readme: input.readme } : {}),
  };
  // …
}
```

Add the slot to the engine's input-assembly step and make it silently skip when empty — optional slots must no-op, not throw and not insert placeholder headers (SKILL.md §6).

If a new public type came out of this, re-export it from `engine/src/index.ts` — the public surface lives in one file.

### ✅ The host application reads the file

```ts
// src/modules/analyses/analyses.service.ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runAnalysis } from '@app/engine';

const readme = await readFile(join(this.config.getOrThrow('REPOS_DIR'), repo.slug, 'README.md'), 'utf8')
  .catch(() => undefined);

const outcome = await runAnalysis({
  // …existing inputs…
  llm: this.llm,
  readme,
});
```

The host owns the I/O. The engine stays pure, hermetic-testable, and reusable from other entry points without modification.

### Purity checklist for the change

- [x] No `node:fs` in the engine package
- [x] No `process.env` in the engine package
- [x] No DI container dependency in the engine package
- [x] New optional input declared on the input struct
- [x] Input assembly no-ops on empty `readme` (matches existing slot behavior)
- [x] Public types exported from `engine/src/index.ts`
- [x] Engine test passes a literal string — no file fixtures
- [x] The host-side test that exercises the new wiring is the integration test (it touches the real filesystem layout)
