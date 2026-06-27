# Express Backend (pie parity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new `@swarm.ing/pieui/server` entry — a TypeScript/Express backend that mirrors the Python `pie` runtime one-to-one: per-page modules with `getContent`/`process`, a `Card` tree that serialises to the exact `{card, data, content}` wire format, plus `/api/content`, `/api/process`, `/api/ajax_content`, `/api/support`, `/api/centrifuge/gen_token`, and Centrifuge/Socket.IO publishing.

**Architecture:** A new `src/server` package builds to `dist/server` alongside the existing entries. `Card` is a base class whose `generate()` splits own properties into `data` (scalars, camelCased) vs `content`/children (values that are `instanceof Card`) — the runtime-`instanceof` equivalent of pie's dataclass-`field.type` introspection. `AsyncPage` holds a `fields: Card` and exposes `getContent`/`process`/`registerAjax`. `Web` takes a `{pathname: AsyncPage}` map plus options and returns a configured Express `app` with every route pie exposes. Realtime publishing targets Centrifugo's HTTP API (via `fetch`) and an optional Socket.IO server.

**Tech Stack:** TypeScript, Express 5, `jsonwebtoken`, `socket.io` (optional server), `bun build`, `bun test`. Reuses `UIConfigType` from `src/types`.

**Reference (authoritative wire/contract source):** `/Users/kaspar_george/pie/pie/{fastweb.py,async_page.py,card.py,types.py,components/}`. Every endpoint path, JSON shape, and signature must match these.

## Global Constraints

- React/React-DOM peer floor `>=19` is irrelevant here (server has no React); do NOT add the `"use client"` banner to any `dist/server/*` file (it is server code) — exclude it from `build:banner`.
- Endpoint paths, request parsing, and response shapes must match pie exactly (see Reference). Where pie prefixes routes with `admin_subdomain` (default `/`), mirror it: option `adminSubdomain` defaults to `/`, must start and end with `/`.
- Wire format: `Card.generate()` → `{ ...children, card: <ClassName>, data: <scalars> }`; keys camelCased; children are `Card` / `Card[]` / `Record<string, Card>`. This must byte-match pie's `Card.generate()`.
- Event/channel naming: `pie${methodName}_${card.name}` (Socket.IO/Mitt) and the card's `centrifugeChannel` for Centrifuge — identical to pie and to the frontend `PieCard`.
- Run tests with `bun test`; type-check with `bun run typecheck`.
- CLI symmetry (CLAUDE.md): this adds a runtime, not a CLI surface — no `src/cli.ts` change. Note the new entry in CLAUDE.md's architecture section (Task 13).

---

### Task 1: Package scaffold + build wiring

**Files:**
- Create: `src/server/index.ts`
- Create: `src/server/types.ts`
- Modify: `package.json` (deps + build scripts)
- Test: `src/tests/server/entry.test.ts`

**Interfaces:**
- Produces: the `@swarm.ing/pieui/server` entry; `src/server/types.ts` exporting `SocketIOEvent`, `WebOptions`, `PageContext`, and re-exporting `UIConfigType`.

- [ ] **Step 1: Add dependencies**

```bash
bun add express jsonwebtoken
bun add -d @types/express @types/jsonwebtoken
```

- [ ] **Step 2: Write the failing entry test**

```ts
// src/tests/server/entry.test.ts
import { expect, test } from 'bun:test'
import * as server from '../../server'

test('server entry exports core building blocks', () => {
    expect(typeof server.Web).toBe('function')
    expect(typeof server.AsyncPage).toBe('function')
    expect(typeof server.Card).toBe('function')
})
```

- [ ] **Step 3: Run it to verify failure**

Run: `bun test src/tests/server/entry.test.ts`
Expected: FAIL — `Cannot find module '../../server'` (and missing exports).

- [ ] **Step 4: Create the types module**

```ts
// src/server/types.ts
import type { UIConfigType } from '../types'

export type { UIConfigType }

/** A realtime event: name `pie{method}_{cardName}` + payload. Mirrors pie's SocketIOEvent. */
export interface SocketIOEvent {
    name: string
    data: Record<string, unknown>
}

/** Subset of request context handed to page methods (cookies + query + body merged). */
export type PageContext = Record<string, unknown>

export interface WebOptions {
    cookieKeys?: string[]
    cookieOptions?: Record<string, unknown>
    enableCors?: boolean
    corsOrigins?: string[]
    adminSubdomain?: string // must start & end with "/", default "/"
    disableServing?: boolean
    servingUrl?: string
    assetsPath?: string
    aggregationRule?: 'by_underscore'
    useSocketioSupport?: boolean
    useCentrifugeSupport?: boolean
    centrifugeUrl?: string
    centrifugeApiKey?: string
    centrifugeHmacSecret?: string
    centrifugeSubFn?: (cookies: Record<string, string>) => string
}
```

- [ ] **Step 5: Create a placeholder entry that re-exports (filled by later tasks)**

```ts
// src/server/index.ts
export { Card, InputCard } from './card'
export { AsyncPage } from './page'
export { Web } from './web'
export * from './cards'
export type {
    SocketIOEvent,
    WebOptions,
    PageContext,
    UIConfigType,
} from './types'
```

(The imported modules are created in Tasks 2–11; this file will not type-check until those exist. That is expected — Step 6 build/test runs after Task 11. For now, create empty stub files `src/server/card.ts`, `src/server/page.ts`, `src/server/web.ts`, and `src/server/cards/index.ts` each exporting a `{}` placeholder so the entry test compiles.)

Create minimal stubs:
```ts
// src/server/card.ts
export class Card {}
export class InputCard extends Card {}
```
```ts
// src/server/page.ts
export class AsyncPage {}
```
```ts
// src/server/web.ts
export class Web {}
```
```ts
// src/server/cards/index.ts
export {}
```

- [ ] **Step 6: Add build scripts**

In `package.json` `scripts`, add (mirroring the `agent` entry pattern):
```json
"build:server:esm": "bun build src/server/index.ts --outfile dist/server/index.esm.js --format esm --target node --jsx=automatic --jsx-import-source=react --minify --packages=external",
"build:server:cjs": "bun build src/server/index.ts --outfile dist/server/index.js --format cjs --target node --jsx=automatic --jsx-import-source=react --minify --packages=external",
```
Add `NODE_ENV=production bun run build:server:esm && NODE_ENV=production bun run build:server:cjs &&` into the main `build` chain (after the `agent` entries). Do NOT add the server files to `build:banner`.

- [ ] **Step 7: Run the entry test**

Run: `bun test src/tests/server/entry.test.ts`
Expected: PASS (stubs export the three classes).

- [ ] **Step 8: Commit**

```bash
git add src/server package.json src/tests/server/entry.test.ts
git commit -m "feat(server): scaffold express backend entry + build wiring"
```

---

### Task 2: `Card.generate()` — wire-format serialisation

**Files:**
- Modify: `src/server/card.ts`
- Test: `src/tests/server/card-generate.test.ts`

**Interfaces:**
- Produces: `Card` with `card: string` (defaults to `this.constructor.name`), `generate(): UIConfigType`-shaped object. Own enumerable props that are `Card` → child (recursed); `Card[]` → array; `Record<string,Card>` → mapping; everything else → `data[camelCase(key)]`. Keys `card`/internal are excluded from `data`.

- [ ] **Step 1: Write failing tests**

```ts
// src/tests/server/card-generate.test.ts
import { describe, expect, test } from 'bun:test'
import { Card } from '../../server/card'

class Leaf extends Card {
    constructor(public name: string, public value: unknown) { super() }
}
class Box extends Card {
    constructor(public title: string, public child: Card) { super() }
}
class ListBox extends Card {
    constructor(public content: Card[]) { super() }
}

describe('Card.generate', () => {
    test('scalars go to data, camelCased; card = class name', () => {
        expect(new Leaf('email', 1).generate()).toEqual({
            card: 'Leaf',
            data: { name: 'email', value: 1 },
        })
    })
    test('a Card-typed prop becomes a generated child under its camelCase key', () => {
        expect(new Box('t', new Leaf('n', 2)).generate()).toEqual({
            card: 'Box',
            data: { title: 't' },
            child: { card: 'Leaf', data: { name: 'n', value: 2 } },
        })
    })
    test('Card[] becomes an array of generated children', () => {
        expect(new ListBox([new Leaf('a', 1)]).generate()).toEqual({
            card: 'ListBox',
            data: {},
            content: [{ card: 'Leaf', data: { name: 'a', value: 1 } }],
        })
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/tests/server/card-generate.test.ts`
Expected: FAIL — `generate` is not a function on the stub `Card`.

- [ ] **Step 3: Implement `Card` + `camelCase` + `generate`**

```ts
// src/server/card.ts
function camelCase(s: string): string {
    return s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

export class Card {
    /** Registered frontend component name; defaults to the class name. */
    card: string = this.constructor.name

    /** Serialise to the PieUI `{ ...children, card, data }` wire format. */
    generate(): Record<string, unknown> {
        const data: Record<string, unknown> = {}
        const children: Record<string, unknown> = {}
        for (const key of Object.keys(this)) {
            if (key === 'card') continue
            const value = (this as Record<string, unknown>)[key]
            const outKey = camelCase(key)
            if (value instanceof Card) {
                children[outKey] = value.generate()
            } else if (Array.isArray(value) && value.every((v) => v instanceof Card)) {
                children[outKey] = (value as Card[]).map((v) => v.generate())
            } else if (isCardRecord(value)) {
                children[outKey] = Object.fromEntries(
                    Object.entries(value).map(([k, v]) => [k, (v as Card).generate()])
                )
            } else {
                data[outKey] = value
            }
        }
        return { ...children, card: this.card, data }
    }
}

function isCardRecord(v: unknown): v is Record<string, Card> {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
    const vals = Object.values(v)
    return vals.length > 0 && vals.every((x) => x instanceof Card)
}

export class InputCard extends Card {}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `bun test src/tests/server/card-generate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/card.ts src/tests/server/card-generate.test.ts
git commit -m "feat(server): Card.generate wire-format serialisation"
```

---

### Task 3: `InputCard.parse` + child discovery + `fill`

**Files:**
- Modify: `src/server/card.ts`
- Test: `src/tests/server/card-fill.test.ts`

**Interfaces:**
- Produces:
  - `InputCard.parse(raw: unknown): unknown` (default: identity; overridable).
  - `Card.inputChildLoc(): Record<string, InputCard>` — map of `name` → InputCard found anywhere in the tree (used by `process` to parse form fields).
  - `Card.fill(data: Record<string, unknown>): UIConfigType` — assign `data[name]` to each named child's `value` (if present) then `generate()`. Mirrors pie's `Card.fill`.

- [ ] **Step 1: Write failing tests**

```ts
// src/tests/server/card-fill.test.ts
import { describe, expect, test } from 'bun:test'
import { Card, InputCard } from '../../server/card'

class Hidden extends InputCard {
    constructor(public name: string, public value: unknown = null) { super() }
}
class Group extends Card {
    constructor(public content: Card[]) { super() }
}

describe('InputCard discovery & fill', () => {
    test('inputChildLoc finds named InputCards in the tree', () => {
        const g = new Group([new Hidden('email'), new Hidden('token')])
        expect(Object.keys(g.inputChildLoc()).sort()).toEqual(['email', 'token'])
    })
    test('fill assigns values by name and generates', () => {
        const g = new Group([new Hidden('email')])
        const out = g.fill({ email: 'a@b.c' }) as any
        expect(out.content[0]).toEqual({
            card: 'Hidden',
            data: { name: 'email', value: 'a@b.c' },
        })
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/tests/server/card-fill.test.ts`
Expected: FAIL — `inputChildLoc`/`fill` not defined.

- [ ] **Step 3: Implement**

Add to `Card` in `src/server/card.ts`:
```ts
    /** Recursively collect named InputCard descendants (incl. self). */
    inputChildLoc(): Record<string, InputCard> {
        const acc: Record<string, InputCard> = {}
        const visit = (card: Card) => {
            if (card instanceof InputCard && typeof (card as any).name === 'string') {
                acc[(card as any).name] = card
            }
            for (const key of Object.keys(card)) {
                const v = (card as Record<string, unknown>)[key]
                if (v instanceof Card) visit(v)
                else if (Array.isArray(v)) v.forEach((x) => x instanceof Card && visit(x))
                else if (v && typeof v === 'object')
                    Object.values(v).forEach((x) => x instanceof Card && visit(x))
            }
        }
        visit(this)
        return acc
    }

    /** Assign values to named input children, then generate. Mirrors pie Card.fill. */
    fill(data: Record<string, unknown>): Record<string, unknown> {
        const loc = this.inputChildLoc()
        for (const [name, card] of Object.entries(loc)) {
            if (name in data) (card as Record<string, unknown>).value = data[name]
        }
        return this.generate()
    }
```
Add to `InputCard`:
```ts
    parse(raw: unknown): unknown {
        return raw
    }
```

- [ ] **Step 4: Run tests**

Run: `bun test src/tests/server/card-fill.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/card.ts src/tests/server/card-fill.test.ts
git commit -m "feat(server): InputCard parse, child discovery, and fill"
```

---

### Task 4: Built-in cards + `createEvent`

**Files:**
- Create: `src/server/cards/index.ts` (replace stub)
- Test: `src/tests/server/cards.test.ts`

**Interfaces:**
- Produces classes mirroring `pie/components`: `HiddenCard`, `UnionCard`, `AjaxGroupCard`, `OneOfCard`, `HTMLEmbedCard`, `IOCard`. `Card.createEvent(method, data)` → `SocketIOEvent` named `pie${method}_${name}` (throws if no `name`/no IO support), mirroring pie.

- [ ] **Step 1: Write failing tests**

```ts
// src/tests/server/cards.test.ts
import { describe, expect, test } from 'bun:test'
import { HiddenCard, UnionCard, IOCard } from '../../server/cards'

describe('built-in cards', () => {
    test('HiddenCard generates name+value', () => {
        expect(new HiddenCard('email', 'x').generate()).toEqual({
            card: 'HiddenCard',
            data: { name: 'email', value: 'x', useSocketioSupport: false, useCentrifugeSupport: false, centrifugeChannel: null },
        })
    })
    test('UnionCard nests content', () => {
        const u = new UnionCard([new HiddenCard('a', 1)])
        const out = u.generate() as any
        expect(out.card).toBe('UnionCard')
        expect(out.content[0].data.name).toBe('a')
    })
    test('createEvent builds pie{method}_{name}', () => {
        const c = new IOCard('chat', { useCentrifugeSupport: true })
        expect(c.createEvent('update', { x: 1 })).toEqual({
            name: 'pieupdate_chat',
            data: { x: 1 },
        })
    })
    test('createEvent throws without IO support', () => {
        const c = new IOCard('chat')
        expect(() => c.createEvent('update', {})).toThrow()
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/tests/server/cards.test.ts`
Expected: FAIL — modules/classes missing.

- [ ] **Step 3: Add `createEvent` to `Card`**

In `src/server/card.ts`, add to `Card`:
```ts
    createEvent(method: string, data: Record<string, unknown> = {}) {
        const name = (this as Record<string, unknown>).name
        if (typeof name !== 'string') {
            throw new Error('Card.createEvent requires a string `name`')
        }
        const io =
            (this as any).useSocketioSupport ||
            (this as any).useCentrifugeSupport ||
            (this as any).useMittSupport
        if (!io) {
            throw new Error('Card.createEvent requires an IO support flag enabled')
        }
        return { name: `pie${method}_${name}`, data }
    }
```

- [ ] **Step 4: Implement the built-in cards**

```ts
// src/server/cards/index.ts
import { Card, InputCard } from '../card'

export class HiddenCard extends InputCard {
    useSocketioSupport = false
    useCentrifugeSupport = false
    centrifugeChannel: string | null = null
    constructor(public name: string, public value: unknown = null) { super() }
}

export class UnionCard extends Card {
    constructor(public content: Card[], public name: string | null = null) { super() }
}

export class AjaxGroupCard extends Card {
    useLoader = true
    noReturn = false
    returnType: 'content' | 'events' = 'content'
    useSocketioSupport = false
    useCentrifugeSupport = false
    centrifugeChannel: string | null = null
    constructor(public content: Card, public name = '') { super() }
}

export class OneOfCard extends Card {
    constructor(public content: Card[], public name: string | null = null) { super() }
}

export class HTMLEmbedCard extends Card {
    constructor(public html: string, public name: string | null = null) { super() }
}

export class IOCard extends Card {
    useSocketioSupport = false
    useCentrifugeSupport = false
    useMittSupport = false
    centrifugeChannel: string | null = null
    constructor(
        public name: string,
        opts: Partial<Pick<IOCard, 'useSocketioSupport' | 'useCentrifugeSupport' | 'useMittSupport' | 'centrifugeChannel'>> = {}
    ) {
        super()
        Object.assign(this, opts)
    }
}
```

- [ ] **Step 5: Run tests**

Run: `bun test src/tests/server/cards.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/cards/index.ts src/server/card.ts src/tests/server/cards.test.ts
git commit -m "feat(server): built-in cards and createEvent"
```

---

### Task 5: `AsyncPage`

**Files:**
- Modify: `src/server/page.ts`
- Test: `src/tests/server/page.test.ts`

**Interfaces:**
- Produces: `AsyncPage` with `fields?: Card`; `async getContent(ctx): Promise<UIConfigType>` (default: `this.fields.fill({})`, else throw); `async process(data): Promise<string | Response>` (default throw); `registerAjax(pathname, fn, method)` storing into `ajaxPost`/`ajaxGet`.

- [ ] **Step 1: Write failing tests**

```ts
// src/tests/server/page.test.ts
import { describe, expect, test } from 'bun:test'
import { AsyncPage } from '../../server/page'
import { UnionCard, HiddenCard } from '../../server/cards'

class P extends AsyncPage {
    constructor() { super(); this.fields = new UnionCard([new HiddenCard('email')]) }
}

describe('AsyncPage', () => {
    test('default getContent fills fields', async () => {
        const out = (await new P().getContent({ email: 'z' })) as any
        expect(out.content[0].data).toEqual({ name: 'email', value: 'z' })
    })
    test('registerAjax stores a POST handler', () => {
        const p = new P()
        const fn = async () => ({ ok: true })
        p.registerAjax('/x', fn, 'POST')
        expect(p.ajaxPost['/x']).toBe(fn)
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/tests/server/page.test.ts`
Expected: FAIL — methods missing on stub.

- [ ] **Step 3: Implement**

```ts
// src/server/page.ts
import { Card } from './card'

type AjaxFn = (data: Record<string, unknown>) => Promise<unknown>

export class AsyncPage {
    fields?: Card
    isTyped: boolean
    ajaxPost: Record<string, AjaxFn> = {}
    ajaxGet: Record<string, AjaxFn> = {}

    constructor(isTyped = false) {
        this.isTyped = isTyped
    }

    async getContent(_ctx: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
        if (this.fields) return this.fields.fill({})
        throw new Error('getContent not implemented and no `fields` set')
    }

    async process(_data: Record<string, unknown>): Promise<string | unknown> {
        throw new Error('process not implemented')
    }

    registerAjax(pathname: string, fn: AjaxFn, method: 'POST' | 'GET' = 'POST') {
        if (method === 'POST') this.ajaxPost[pathname] = fn
        else this.ajaxGet[pathname] = fn
    }
}
```

Note: `getContent`'s default uses `fill({})`; pages that need the request context override `getContent(ctx)` and call `this.fields!.fill(ctx)` themselves (mirrors pie, where `get_content(**kwargs)` receives cookies+query).

- [ ] **Step 4: Run tests**

Run: `bun test src/tests/server/page.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/page.ts src/tests/server/page.test.ts
git commit -m "feat(server): AsyncPage with getContent/process/registerAjax"
```

---

### Task 6: Form parsing — `form2dict` + `aggregate`

**Files:**
- Create: `src/server/form.ts`
- Test: `src/tests/server/form.test.ts`

**Interfaces:**
- Produces: `form2dict(body): Record<string, unknown>` (repeated keys → arrays, single → scalar); `aggregate(data, rule?)` implementing pie's `by_underscore` nesting (`addr__city` → `addr.city`).

- [ ] **Step 1: Write failing tests**

```ts
// src/tests/server/form.test.ts
import { describe, expect, test } from 'bun:test'
import { form2dict, aggregate } from '../../server/form'

describe('form parsing', () => {
    test('repeated keys become arrays, singles stay scalar', () => {
        expect(form2dict({ a: '1', b: ['x', 'y'] })).toEqual({ a: '1', b: ['x', 'y'] })
    })
    test('by_underscore nests double-underscore keys', () => {
        expect(aggregate({ name: 'J', addr__city: 'NY', addr__zip: '1' }, 'by_underscore'))
            .toEqual({ name: 'J', addr: { city: 'NY', zip: '1' } })
    })
    test('no rule returns data unchanged', () => {
        expect(aggregate({ a: 1 })).toEqual({ a: 1 })
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/tests/server/form.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/server/form.ts
export function form2dict(
    body: Record<string, unknown>
): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(body ?? {})) {
        out[k] = Array.isArray(v) && v.length === 1 ? v[0] : v
    }
    return out
}

export function aggregate(
    data: Record<string, unknown>,
    rule?: 'by_underscore'
): Record<string, unknown> {
    if (rule !== 'by_underscore') return data
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(data)) {
        const idx = k.indexOf('__')
        if (idx === -1) {
            out[k] = v
        } else {
            const parent = k.slice(0, idx)
            const child = k.slice(idx + 2)
            const bucket = (out[parent] ??= {}) as Record<string, unknown>
            bucket[child] = v
        }
    }
    return out
}
```

- [ ] **Step 4: Run tests**

Run: `bun test src/tests/server/form.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/form.ts src/tests/server/form.test.ts
git commit -m "feat(server): form2dict + by_underscore aggregate"
```

---

### Task 7: `Web` + `GET /api/content`

**Files:**
- Modify: `src/server/web.ts`
- Test: `src/tests/server/web-content.test.ts`

**Interfaces:**
- Consumes: `AsyncPage` (Task 5), `WebOptions` (Task 1).
- Produces: `Web` with `constructor(pages: Record<string, AsyncPage | string>, opts?: WebOptions)`, `getApp(): express.Express`. Routes `GET {adminSubdomain}api/content/*` → resolve pathname (follow string aliases) → merge cookies(in cookieKeys)+query → `page.getContent(ctx)` → JSON.

- [ ] **Step 1: Write failing test (supertest-style via fetch on a listening app)**

```ts
// src/tests/server/web-content.test.ts
import { afterAll, describe, expect, test } from 'bun:test'
import { Web } from '../../server/web'
import { AsyncPage } from '../../server/page'
import { UnionCard, HiddenCard } from '../../server/cards'

class Home extends AsyncPage {
    constructor() { super(); this.fields = new UnionCard([new HiddenCard('email')]) }
    async getContent(ctx: Record<string, unknown>) { return this.fields!.fill(ctx) }
}

const web = new Web({ '': new Home(), home: '' as any }, { enableCors: true })
const server = web.getApp().listen(0)
const port = (server.address() as any).port
afterAll(() => server.close())

describe('GET /api/content', () => {
    test('returns the UIConfig for the root page with query merged', async () => {
        const res = await fetch(`http://localhost:${port}/api/content/?email=q`)
        const body = await res.json()
        expect(body.card).toBe('UnionCard')
        expect(body.content[0].data).toEqual({ name: 'email', value: 'q' })
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/tests/server/web-content.test.ts`
Expected: FAIL — `getApp` undefined.

- [ ] **Step 3: Implement Web core + content route**

```ts
// src/server/web.ts
import express, { type Express, type Request, type Response } from 'express'
import { AsyncPage } from './page'
import type { WebOptions } from './types'

export class Web {
    pages: Record<string, AsyncPage | string>
    opts: Required<Pick<WebOptions, 'adminSubdomain'>> & WebOptions

    constructor(pages: Record<string, AsyncPage | string>, opts: WebOptions = {}) {
        this.pages = pages
        const adminSubdomain = opts.adminSubdomain ?? '/'
        if (!adminSubdomain.startsWith('/') || !adminSubdomain.endsWith('/')) {
            throw new Error('adminSubdomain must start and end with "/"')
        }
        this.opts = { ...opts, adminSubdomain }
    }

    /** Resolve a pathname to a page, following string aliases. */
    resolvePage(pathname: string): AsyncPage | null {
        let key = pathname.replace(/^\/+/, '')
        let hops = 0
        while (hops++ < 10) {
            const entry = this.pages[key]
            if (entry === undefined) return null
            if (typeof entry === 'string') { key = entry; continue }
            return entry
        }
        return null
    }

    private contextFromRequest(req: Request): Record<string, unknown> {
        const ctx: Record<string, unknown> = {}
        const keys = this.opts.cookieKeys ?? []
        for (const k of keys) {
            const c = (req as any).cookies?.[k]
            if (c !== undefined) ctx[k] = c
        }
        Object.assign(ctx, req.query)
        return ctx
    }

    getApp(): Express {
        const app = express()
        app.use(express.urlencoded({ extended: true }))
        app.use(express.json())
        if (this.opts.enableCors) app.use(this.corsMiddleware())

        const sub = this.opts.adminSubdomain // e.g. "/"
        app.get(`${sub}api/content/*`, async (req: Request, res: Response) => {
            const pathname = decodeURIComponent(
                req.path.slice(`${sub}api/content/`.length)
            )
            const page = this.resolvePage(pathname)
            if (!page) return res.status(404).json({ error: 'page not found' })
            const ctx = this.contextFromRequest(req)
            try {
                const content = await page.getContent(ctx)
                res.json(content)
            } catch (e) {
                res.status(500).json({ error: String(e) })
            }
        })
        return app
    }

    private corsMiddleware() {
        const origins = this.opts.corsOrigins
        return (req: Request, res: Response, next: () => void) => {
            const origin = req.headers.origin
            if (!origins || (origin && origins.includes(origin))) {
                res.setHeader('Access-Control-Allow-Origin', origin ?? '*')
            }
            res.setHeader('Access-Control-Allow-Credentials', 'true')
            res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
            if (req.method === 'OPTIONS') return res.sendStatus(204)
            next()
        }
    }
}
```

(Cookie reading uses `req.cookies`; wire up `cookie-parser` in Task 10 when cookieKeys are first needed end-to-end, or add `bun add cookie-parser` here and `app.use(cookieParser())`. For this task query-merge suffices.)

- [ ] **Step 4: Run tests**

Run: `bun test src/tests/server/web-content.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/web.ts src/tests/server/web-content.test.ts
git commit -m "feat(server): Web core + GET /api/content route"
```

---

### Task 8: `POST /api/process` (redirect + form parse)

**Files:**
- Modify: `src/server/web.ts`
- Test: `src/tests/server/web-process.test.ts`

**Interfaces:**
- Consumes: `form2dict`/`aggregate` (Task 6), `page.process` (Task 5).
- Produces: route `POST {sub}api/process/*` → `form2dict(req.body)` → `aggregate(…, rule)` → `page.process(data)`; string result → 303 redirect (relative rewritten with `adminSubdomain`, prefixed with `servingUrl` when `disableServing`); non-string → assume the handler already wrote the response (documented limitation: full `Response` passthrough is out of scope for v1).

- [ ] **Step 1: Write failing test**

```ts
// src/tests/server/web-process.test.ts
import { afterAll, describe, expect, test } from 'bun:test'
import { Web } from '../../server/web'
import { AsyncPage } from '../../server/page'

class P extends AsyncPage {
    async process(data: Record<string, unknown>) {
        return data.ok === 'yes' ? '/done' : '/retry'
    }
}
const web = new Web({ form: new P() })
const server = web.getApp().listen(0)
const port = (server.address() as any).port
afterAll(() => server.close())

describe('POST /api/process', () => {
    test('returns a 303 redirect from process() string', async () => {
        const res = await fetch(`http://localhost:${port}/api/process/form`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: 'ok=yes',
            redirect: 'manual',
        })
        expect(res.status).toBe(303)
        expect(res.headers.get('location')).toBe('/done')
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/tests/server/web-process.test.ts`
Expected: FAIL — no process route (404).

- [ ] **Step 3: Implement the route inside `getApp()`**

Add before `return app`:
```ts
        app.post(`${sub}api/process/*`, async (req: Request, res: Response) => {
            const pathname = decodeURIComponent(
                req.path.slice(`${sub}api/process/`.length)
            )
            const page = this.resolvePage(pathname)
            if (!page) return res.status(404).json({ error: 'page not found' })
            const { form2dict, aggregate } = await import('./form')
            const data = aggregate(
                form2dict(req.body as Record<string, unknown>),
                this.opts.aggregationRule
            )
            try {
                const result = await page.process(data)
                if (typeof result !== 'string') {
                    if (!res.headersSent) res.status(204).end()
                    return
                }
                let url = result
                if (url.startsWith('/')) {
                    url = sub + url.slice(1)
                    if (this.opts.disableServing && this.opts.servingUrl) {
                        url = this.opts.servingUrl + url
                    }
                }
                res.redirect(303, url)
            } catch (e) {
                res.status(500).json({ error: String(e) })
            }
        })
```

- [ ] **Step 4: Run tests**

Run: `bun test src/tests/server/web-process.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/web.ts src/tests/server/web-process.test.ts
git commit -m "feat(server): POST /api/process with 303 redirect"
```

---

### Task 9: `GET`/`POST /api/ajax_content/*`

**Files:**
- Modify: `src/server/web.ts`
- Test: `src/tests/server/web-ajax.test.ts`

**Interfaces:**
- Produces: routes that look up an ajax handler across all pages' `ajaxPost`/`ajaxGet` registries by pathname and return its JSON result. Mirrors pie's `send_ajax_post_content`/`send_ajax_get_content`.

- [ ] **Step 1: Write failing test**

```ts
// src/tests/server/web-ajax.test.ts
import { afterAll, describe, expect, test } from 'bun:test'
import { Web } from '../../server/web'
import { AsyncPage } from '../../server/page'

class P extends AsyncPage {
    constructor() {
        super()
        this.registerAjax('/sum', async (d) => ({ n: Number(d.a) + Number(d.b) }), 'POST')
    }
}
const web = new Web({ '': new P() })
const server = web.getApp().listen(0)
const port = (server.address() as any).port
afterAll(() => server.close())

describe('POST /api/ajax_content', () => {
    test('routes to a registered ajax handler', async () => {
        const res = await fetch(`http://localhost:${port}/api/ajax_content/sum`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: 'a=2&b=3',
        })
        expect(await res.json()).toEqual({ n: 5 })
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/tests/server/web-ajax.test.ts`
Expected: FAIL — 404.

- [ ] **Step 3: Implement — collect ajax registries + routes**

Add a helper and routes in `getApp()`:
```ts
        const collectAjax = (kind: 'ajaxPost' | 'ajaxGet') => {
            const map: Record<string, (d: Record<string, unknown>) => Promise<unknown>> = {}
            for (const entry of Object.values(this.pages)) {
                if (typeof entry === 'string') continue
                Object.assign(map, entry[kind])
            }
            return map
        }
        const postAjax = collectAjax('ajaxPost')
        const getAjax = collectAjax('ajaxGet')

        app.post(`${sub}api/ajax_content/*`, async (req: Request, res: Response) => {
            const pathname = '/' + req.path.slice(`${sub}api/ajax_content/`.length)
            const fn = postAjax[pathname]
            if (!fn) return res.status(404).json({ error: 'ajax handler not found' })
            const { form2dict, aggregate } = await import('./form')
            const data = aggregate(form2dict(req.body as Record<string, unknown>), this.opts.aggregationRule)
            res.json(await fn(data))
        })

        app.get(`${sub}api/ajax_content/*`, async (req: Request, res: Response) => {
            const pathname = '/' + req.path.slice(`${sub}api/ajax_content/`.length)
            const fn = getAjax[pathname]
            if (!fn) return res.status(404).json({ error: 'ajax handler not found' })
            const { aggregate } = await import('./form')
            res.json(await fn(aggregate({ ...req.query } as Record<string, unknown>, this.opts.aggregationRule)))
        })
```

- [ ] **Step 4: Run tests**

Run: `bun test src/tests/server/web-ajax.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/web.ts src/tests/server/web-ajax.test.ts
git commit -m "feat(server): ajax_content GET/POST routes"
```

---

### Task 10: `GET /api/support/{name}` + `GET /api/centrifuge/gen_token`

**Files:**
- Modify: `src/server/web.ts`
- Modify: `package.json` (add `cookie-parser` for cookie reading)
- Test: `src/tests/server/web-token.test.ts`

**Interfaces:**
- Produces: `GET {sub}api/support/:name` → `{ "socketio": boolean, "centrifuge": boolean }`-style support flags; `GET /api/centrifuge/gen_token` → `{ token }` JWT signed with `centrifugeHmacSecret`, `sub` derived from `centrifugeSubFn(cookies)` (default `sha256(JSON.stringify(cookies))`), `exp = now+3600`.

- [ ] **Step 1: Add cookie-parser**

```bash
bun add cookie-parser
bun add -d @types/cookie-parser
```

- [ ] **Step 2: Write failing test**

```ts
// src/tests/server/web-token.test.ts
import { afterAll, describe, expect, test } from 'bun:test'
import jwt from 'jsonwebtoken'
import { Web } from '../../server/web'

const web = new Web({}, { useCentrifugeSupport: true, centrifugeHmacSecret: 'sek' })
const server = web.getApp().listen(0)
const port = (server.address() as any).port
afterAll(() => server.close())

describe('gen_token', () => {
    test('signs a JWT with sub and exp', async () => {
        const res = await fetch(`http://localhost:${port}/api/centrifuge/gen_token`)
        const { token } = await res.json()
        const decoded = jwt.verify(token, 'sek') as any
        expect(typeof decoded.sub).toBe('string')
        expect(decoded.exp).toBeGreaterThan(decoded.iat)
    })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `bun test src/tests/server/web-token.test.ts`
Expected: FAIL — 404 / no route.

- [ ] **Step 4: Implement routes**

At the top of `web.ts` add imports:
```ts
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import { createHash } from 'node:crypto'
```
In `getApp()` after `express.json()`:
```ts
        app.use(cookieParser())
```
Add routes:
```ts
        app.get(`${sub}api/support/:name`, (req: Request, res: Response) => {
            res.json({
                socketio: !!this.opts.useSocketioSupport,
                centrifuge: !!this.opts.useCentrifugeSupport,
            })
        })

        app.get('/api/centrifuge/gen_token', (req: Request, res: Response) => {
            const secret = this.opts.centrifugeHmacSecret
            if (!secret) return res.status(403).json({ error: 'no centrifuge secret' })
            const keys = this.opts.cookieKeys ?? []
            const cookies: Record<string, string> = {}
            for (const k of keys) {
                const v = (req as any).cookies?.[k]
                if (typeof v === 'string') cookies[k] = v
            }
            const sub =
                this.opts.centrifugeSubFn?.(cookies) ??
                createHash('sha256').update(JSON.stringify(cookies)).digest('hex')
            const now = Math.floor(Date.now() / 1000)
            const token = jwt.sign({ sub, iat: now, exp: now + 3600 }, secret, {
                algorithm: 'HS256',
            })
            res.json({ token })
        })
```

- [ ] **Step 5: Run tests**

Run: `bun test src/tests/server/web-token.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/web.ts package.json src/tests/server/web-token.test.ts
git commit -m "feat(server): support + centrifuge gen_token routes"
```

---

### Task 11: Realtime publishing (Centrifuge HTTP + emit)

**Files:**
- Create: `src/server/realtime.ts`
- Modify: `src/server/page.ts` (add `emit`), `src/server/index.ts` (export realtime helpers)
- Test: `src/tests/server/realtime.test.ts`

**Interfaces:**
- Produces:
  - `publishToCentrifuge(opts: { url: string; apiKey: string; channel: string; data: unknown }): Promise<void>` — POSTs to Centrifugo HTTP API `/api/publish` with `X-API-Key`, body `{ channel, data }`.
  - `AsyncPage.emit(event: SocketIOEvent | SocketIOEvent[], to?: string)` — publishes each event; channel resolution `to ? `${event.name}_${to}` : event.name` (mirrors pie's wrapping), routed through a configured publisher injected via `setPublisher`.

- [ ] **Step 1: Write failing test (publisher uses an injectable fetch)**

```ts
// src/tests/server/realtime.test.ts
import { describe, expect, test } from 'bun:test'
import { publishToCentrifuge } from '../../server/realtime'

describe('publishToCentrifuge', () => {
    test('POSTs channel+data with api key header', async () => {
        const calls: any[] = []
        const fakeFetch = async (url: string, init: any) => {
            calls.push({ url, init })
            return { ok: true, json: async () => ({}) } as any
        }
        await publishToCentrifuge(
            { url: 'http://cf:8000', apiKey: 'k', channel: 'pieupdate_x', data: { a: 1 } },
            fakeFetch as any
        )
        expect(calls[0].url).toBe('http://cf:8000/api/publish')
        expect(calls[0].init.headers['X-API-Key']).toBe('k')
        expect(JSON.parse(calls[0].init.body)).toEqual({
            channel: 'pieupdate_x',
            data: { a: 1 },
        })
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/tests/server/realtime.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement realtime + page.emit**

```ts
// src/server/realtime.ts
import type { SocketIOEvent } from './types'

type FetchFn = typeof fetch

export async function publishToCentrifuge(
    opts: { url: string; apiKey: string; channel: string; data: unknown },
    fetchFn: FetchFn = fetch
): Promise<void> {
    const res = await fetchFn(`${opts.url.replace(/\/$/, '')}/api/publish`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': opts.apiKey,
        },
        body: JSON.stringify({ channel: opts.channel, data: opts.data }),
    })
    if (!res.ok) throw new Error(`centrifuge publish failed: ${res.status}`)
}

export type Publisher = (event: SocketIOEvent, to?: string) => Promise<void>
```

Add to `AsyncPage` in `page.ts`:
```ts
import type { SocketIOEvent } from './types'
import type { Publisher } from './realtime'
// ...
    private publisher?: Publisher
    setPublisher(p: Publisher) { this.publisher = p }
    async emit(event: SocketIOEvent | SocketIOEvent[], to?: string) {
        if (!this.publisher) throw new Error('no publisher configured (Web must call setPublisher)')
        const events = Array.isArray(event) ? event : [event]
        for (const ev of events) await this.publisher(ev, to)
    }
```

In `Web.getApp()` (or constructor), wire a publisher into each page when `useCentrifugeSupport`:
```ts
        if (this.opts.useCentrifugeSupport && this.opts.centrifugeUrl && this.opts.centrifugeApiKey) {
            const { publishToCentrifuge } = await import('./realtime')
            for (const entry of Object.values(this.pages)) {
                if (typeof entry === 'string') continue
                entry.setPublisher(async (ev, to) => {
                    const channel = to ? `${ev.name}_${to}` : ev.name
                    await publishToCentrifuge({
                        url: this.opts.centrifugeUrl!,
                        apiKey: this.opts.centrifugeApiKey!,
                        channel,
                        data: ev.data,
                    })
                })
            }
        }
```
(Since `getApp` is sync, move the publisher wiring into the constructor with a top-level `import { publishToCentrifuge } from './realtime'` instead of dynamic import.)

Export from `index.ts`:
```ts
export { publishToCentrifuge } from './realtime'
export type { Publisher } from './realtime'
```

- [ ] **Step 4: Run tests**

Run: `bun test src/tests/server/realtime.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/realtime.ts src/server/page.ts src/server/index.ts src/tests/server/realtime.test.ts
git commit -m "feat(server): centrifuge publishing + page.emit"
```

---

### Task 12: End-to-end parity test + full build

**Files:**
- Create: `src/tests/server/e2e.test.ts`
- Test: the whole entry

**Interfaces:** none new — validates the assembled app.

- [ ] **Step 1: Write an end-to-end test mirroring a pie page lifecycle**

```ts
// src/tests/server/e2e.test.ts
import { afterAll, describe, expect, test } from 'bun:test'
import { Web, AsyncPage, UnionCard, HiddenCard } from '../../server'

class Home extends AsyncPage {
    constructor() { super(true); this.fields = new UnionCard([new HiddenCard('email')]) }
    async getContent(ctx: Record<string, unknown>) { return this.fields!.fill(ctx) }
    async process(data: Record<string, unknown>) { return `/welcome?e=${data.email}` }
}
const web = new Web({ '': new Home() }, { enableCors: true })
const server = web.getApp().listen(0)
const port = (server.address() as any).port
afterAll(() => server.close())

describe('e2e: content + process', () => {
    test('content returns the UIConfig tree', async () => {
        const r = await fetch(`http://localhost:${port}/api/content/?email=a@b.c`)
        const body = await r.json()
        expect(body).toEqual({
            card: 'UnionCard',
            data: { name: null },
            content: [{ card: 'HiddenCard', data: { name: 'email', value: 'a@b.c', useSocketioSupport: false, useCentrifugeSupport: false, centrifugeChannel: null } }],
        })
    })
    test('process redirects', async () => {
        const r = await fetch(`http://localhost:${port}/api/process/`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: 'email=z',
            redirect: 'manual',
        })
        expect(r.status).toBe(303)
        expect(r.headers.get('location')).toBe('/welcome?e=z')
    })
})
```

- [ ] **Step 2: Run the full server test suite + typecheck + build**

Run: `bun run typecheck && bun test src/tests/server/ && bun run build:server:esm && bun run build:server:cjs`
Expected: PASS; `dist/server/index.esm.js` and `dist/server/index.js` produced, with NO `"use client"` banner.

- [ ] **Step 3: Commit**

```bash
git add src/tests/server/e2e.test.ts
git commit -m "test(server): end-to-end content+process parity"
```

---

### Task 13: Project layout convention + docs

**Files:**
- Create: `docs/express-backend.md`
- Create: `src/server/README.md` (page/components layout convention mirroring pie)
- Modify: `CLAUDE.md` (note the new `server` entry under architecture; record any intentional divergence from pie)

**Interfaces:** docs only.

- [ ] **Step 1: Document the layout + a worked example**

Create `docs/express-backend.md` describing the directory convention (`pages/<name>.ts` exporting a page class, `pages/components/*.ts` for cards), a `web.ts` example assembling `new Web({...}).getApp().listen()`, and the route table (content/process/ajax/support/gen_token). Include the pie→TS contract table from this plan's header.

- [ ] **Step 2: Update CLAUDE.md**

Add a bullet under the architecture section: the `@swarm.ing/pieui/server` entry is a TS/Express mirror of the `pie` FastAPI runtime; pages expose `getContent`/`process`; `Card.generate()` matches pie's wire format; document any intentional divergence (e.g. v1 returns 204 instead of arbitrary `Response` passthrough in `process`).

- [ ] **Step 3: Commit**

```bash
git add docs/express-backend.md src/server/README.md CLAUDE.md
git commit -m "docs(server): express backend layout convention + CLAUDE.md note"
```

---

## Self-Review

**Spec coverage (full parity, exact mirror):**
- Page module with `getContent`/`process` → Task 5; exact-mirror authoring (class per page) demonstrated in Tasks 7/12.
- `{card, data, content}` wire format identical to pie `Card.generate()` → Task 2 (+ camelCase, class-name `card`).
- `/api/content` → Task 7; `/api/process` (303 + rewrite) → Task 8; `/api/ajax_content` GET/POST → Task 9; `/api/support` + `/api/centrifuge/gen_token` (JWT) → Task 10; Centrifuge publishing + `emit` → Task 11.
- Built-in cards + `pie{method}_{name}` event naming → Task 4.
- Form parsing + `by_underscore` aggregation → Task 6.
- New `src/server` entry + build wiring (no `use client` banner) → Task 1; layout convention → Task 13.

**Placeholder scan:** None — every code step has full code.

**Type consistency:** `WebOptions`/`SocketIOEvent`/`PageContext` defined in Task 1 and consumed unchanged in Tasks 7/8/10/11. `AsyncPage.getContent(ctx)` / `process(data)` signatures consistent across Tasks 5/7/8/12. `publishToCentrifuge(opts, fetchFn?)` consistent in Tasks 11. `Card.generate()`/`fill()`/`inputChildLoc()`/`createEvent()` names consistent across Tasks 2/3/4.

**Known divergences from pie (documented, intentional for v1):**
- `process` returning a non-string does not stream an arbitrary framework `Response` (pie supports this); v1 returns 204 and assumes the handler wrote the response. Flag in Task 13.
- Typed-page form parsing via `inputChildLoc`/`parse` is available (Task 3) but the Express routes pass raw `form2dict` data to `process`; wiring per-field `card.parse()` for `isTyped` pages is a follow-up (note in `docs/express-backend.md`).
- Static serving + SPA fallback (pie's `serve_react_app`) is only relevant when `disableServing=false`; v1 targets the `disableServing=true` external-frontend mode (the PieUI default). Add a follow-up task if same-origin serving is needed.

**Out of scope (follow-up plans):** Socket.IO *server* hosting (v1 publishes via Centrifuge HTTP); typed-page per-field parsing; static asset serving; CLI scaffolding of a server project (a `pieui` CLI generator, separate plan honouring CLAUDE.md symmetry).
