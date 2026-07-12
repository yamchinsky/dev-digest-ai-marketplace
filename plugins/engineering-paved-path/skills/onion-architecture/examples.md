# Onion architecture — concrete examples

Skeletons referenced from [SKILL.md](SKILL.md). Paths assume the layout from
SKILL.md §1: an API package rooted at `src/`, a shared contracts package
imported as `@app/shared`, and (for Example 3) a pure engine package imported
as `@app/engine`. Adapt the names to your repository — the *shape* is the
point, not the paths.

---

## Example 1: New module from scratch

Scenario: add a `widgets` module — list and create widgets, scoped to a workspace.

### `src/modules/widgets/routes.ts`

```ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { WidgetService } from './service.js';

// Transport DTOs (HTTP edge). Keep separate from any domain Zod schemas.
const CreateWidgetBody = z.object({
  name: z.string().min(1).max(80),
  color: z.enum(['red', 'green', 'blue']),
});

export default async function widgetsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const service = new WidgetService(container);

  app.get('/widgets', async (req) => {
    const { workspaceId } = await getContext(container, req);
    return { widgets: await service.list(workspaceId) };
  });

  app.post(
    '/widgets',
    { schema: { body: CreateWidgetBody } },
    async (req) => {
      const { workspaceId, userId } = await getContext(container, req);
      const widget = await service.create(workspaceId, userId, req.body);
      return { widget };
    },
  );

  app.get(
    '/widgets/:id',
    { schema: { params: IdParams } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return { widget: await service.getById(workspaceId, req.params.id) };
    },
  );
}
```

Then in `src/modules/index.ts`:

```ts
import widgetsRoutes from './widgets/routes.js';
// …existing imports…

export const modules = [
  // …existing entries…
  { name: 'widgets', plugin: widgetsRoutes },
];
```

### `src/modules/widgets/service.ts`

```ts
import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';
import { WidgetRepository } from './repository.js';

export interface CreateWidgetInput {
  name: string;
  color: 'red' | 'green' | 'blue';
}

export class WidgetService {
  private repo: WidgetRepository;

  constructor(private container: Container) {
    this.repo = new WidgetRepository(container.db);
  }

  list(workspaceId: string) {
    return this.repo.listByWorkspace(workspaceId);
  }

  async create(workspaceId: string, userId: string, input: CreateWidgetInput) {
    return this.repo.insert({ workspaceId, createdBy: userId, ...input });
  }

  async getById(workspaceId: string, id: string) {
    const widget = await this.repo.findById(workspaceId, id);
    if (!widget) throw new NotFoundError(`widget ${id} not found`);
    return widget;
  }
}
```

Notes:
- Constructor takes `Container`, never raw adapters.
- Throws `NotFoundError` (from `platform/errors.ts`) — the global handler renders the API error envelope.
- No Drizzle import here — the repository owns it.

### `src/modules/widgets/repository.ts`

```ts
import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

// Drizzle row type — module-internal. Map to a shared type if it ever crosses
// the module boundary in a wider-than-this-module API.
export type WidgetRow = typeof t.widgets.$inferSelect;

export class WidgetRepository {
  constructor(private db: Db) {}

  listByWorkspace(workspaceId: string) {
    return this.db.select().from(t.widgets).where(eq(t.widgets.workspaceId, workspaceId));
  }

  findById(workspaceId: string, id: string) {
    return this.db
      .select()
      .from(t.widgets)
      .where(and(eq(t.widgets.workspaceId, workspaceId), eq(t.widgets.id, id)))
      .then((rows) => rows[0]);
  }

  async insert(input: {
    workspaceId: string;
    createdBy: string;
    name: string;
    color: 'red' | 'green' | 'blue';
  }): Promise<WidgetRow> {
    const [row] = await this.db.insert(t.widgets).values(input).returning();
    return row;
  }
}
```

Notes:
- `Db` is imported from `../../db/client.js` — the only DB import in the module.
- Workspace scoping is enforced in **every** query (`and(eq(workspaceId), …)`).
- Multi-aggregate module? Split into `repository/widget.repo.ts` + `repository/tag.repo.ts` and have `repository.ts` compose them.

### What NOT to do

```ts
// ❌ Drizzle in the service
// service.ts
import { eq } from 'drizzle-orm';
import * as t from '../../db/schema.js';
class WidgetService {
  list(workspaceId: string) {
    return this.container.db.select().from(t.widgets).where(eq(t.widgets.workspaceId, workspaceId));
  }
}

// ❌ Schema.parse in the handler
app.post('/widgets', async (req) => {
  const body = CreateWidgetBody.parse(req.body); // bypasses 422 path
  // …
});

// ❌ Service-to-service import
// widgets/service.ts
import { OrderService } from '../orders/service.js'; // forbidden cross-module dep
```

---

## Example 2: Adding a new outbound port

Scenario: the widget creation flow needs to call a third-party "Sentiment API" to score the widget name. New outbound HTTP → new port.

### Step 1 — declare the port in the shared contracts package

In `shared/adapters.ts`:

```ts
// ---------- Sentiment ----------
export interface SentimentClient {
  score(text: string): Promise<{ value: number; label: 'pos' | 'neg' | 'neu' }>;
}
```

Re-export from the package index if it isn't picked up by an existing `export *` line.

### Step 2 — concrete adapter

`src/adapters/sentiment/http.ts`:

```ts
import type { SentimentClient } from '@app/shared';
import { ExternalServiceError } from '../../platform/errors.js';

export class HttpSentimentClient implements SentimentClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  async score(text: string) {
    const res = await fetch(`${this.baseUrl}/score`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      throw new ExternalServiceError(`sentiment api ${res.status}`);
    }
    const json = (await res.json()) as { value: number; label: 'pos' | 'neg' | 'neu' };
    return json;
  }
}
```

Notes:
- `implements SentimentClient` — typecheck is the contract.
- Failure throws `ExternalServiceError` (from `platform/errors.ts`) so the global handler can shape the response. **Never** swallow + rethrow with a string.
- No DB, no Fastify, no module imports — adapters are leaves.

Re-export from `src/adapters/index.ts`:

```ts
export { HttpSentimentClient } from './sentiment/http.js';
```

### Step 3 — DI wiring in `src/platform/container.ts`

```ts
import type { SentimentClient } from '@app/shared';
import { HttpSentimentClient } from '../adapters/sentiment/http.js';
import { ConfigError } from './errors.js';

export interface ContainerOverrides {
  // …existing fields…
  sentiment?: SentimentClient;
}

export class Container {
  // …existing fields…
  private _sentiment?: SentimentClient;

  sentiment(): SentimentClient {
    if (this._sentiment) return this._sentiment;
    if (!this.config.SENTIMENT_ENABLED) {
      throw new ConfigError('sentiment is disabled (SENTIMENT_ENABLED=false)');
    }
    const key = this.config.SENTIMENT_API_KEY;
    if (!key) throw new ConfigError('SENTIMENT_API_KEY missing');
    this._sentiment = new HttpSentimentClient(this.config.SENTIMENT_BASE_URL, key);
    return this._sentiment;
  }
}
```

Notes:
- Resolver is lazy: SDK constructor never runs until the adapter is asked for. Gate check happens **before** any keys are read or clients constructed.
- Cached on the container instance — one per app instance.
- Override path for tests: `new Container({ ..., overrides: { sentiment: new MockSentimentClient() } })`.

### Step 4 — consume from a service

```ts
// widgets/service.ts
async create(workspaceId: string, userId: string, input: CreateWidgetInput) {
  const sentiment = this.container.sentiment().score(input.name).catch(() => null);
  const row = await this.repo.insert({ workspaceId, createdBy: userId, ...input });
  const scored = await sentiment;
  if (scored) await this.repo.attachSentiment(row.id, scored);
  return row;
}
```

The service consumes the port via `this.container.sentiment()`. It never sees `fetch` or the SDK.

### Step 5 — test fake

Add to `src/adapters/mocks.ts`:

```ts
import type { SentimentClient } from '@app/shared';

export class MockSentimentClient implements SentimentClient {
  constructor(private fixed: { value: number; label: 'pos' | 'neg' | 'neu' } = { value: 0, label: 'neu' }) {}
  async score() { return this.fixed; }
}
```

Now the widget service tests can pass `{ sentiment: new MockSentimentClient({ value: 0.9, label: 'pos' }) }` via `ContainerOverrides` and stay hermetic (no network, no `.it.` suffix).

---

## Example 3: Adding capability to the pure engine

Scenario: the engine (a pure computation package, e.g. an analysis pipeline) needs the project's `README.md` text to bias its output.

The wrong instinct is to read it from inside the engine. That breaks purity. The right move is to take it as an argument and let the caller (the host application) supply it.

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
  // …
}
```

This fails the purity checklist on every line: fs import, `process.cwd()` read, and the engine now silently depends on a working directory layout.

### ✅ Right: take it as an argument

In `engine/src/run.ts`:

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

In `src/modules/analyses/service.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runAnalysis } from '@app/engine';

const readme = await readFile(join(this.container.config.REPOS_DIR, repo.slug, 'README.md'), 'utf8')
  .catch(() => undefined);

const outcome = await runAnalysis({
  // …existing inputs…
  llm: this.container.llm(agent.providerId),
  readme,
});
```

The host owns the I/O. The engine stays pure, hermetic-testable, and reusable from other entry points without modification.

### Purity checklist for the change

- [x] No `node:fs` in the engine package
- [x] No `process.env` in the engine package
- [x] New optional input declared on the input struct
- [x] Input assembly no-ops on empty `readme` (matches existing slot behavior)
- [x] Public types exported from `engine/src/index.ts`
- [x] Engine test passes a literal string — no file fixtures
- [x] The host-side test that exercises the new wiring is the integration test (it touches the real filesystem layout)
