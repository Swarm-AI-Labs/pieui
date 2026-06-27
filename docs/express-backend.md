# Express backend (`@swarm.ing/pieui/server`)

A TypeScript/Express backend that mirrors the Python `pie` FastAPI runtime
one-to-one: per-page modules with `getContent`/`process`, a `Card` tree that
serialises to the exact `{card, data, content}` wire format the PieUI frontend
consumes, plus the same HTTP surface.

## Quick start

```ts
// web.ts
import { Web, AsyncPage, UnionCard, HiddenCard } from '@swarm.ing/pieui/server'

class HomePage extends AsyncPage {
    constructor() {
        super(true)
        this.fields = new UnionCard({
            content: [new HiddenCard({ name: 'email' })],
        })
    }
    async getContent(ctx: Record<string, unknown>) {
        return this.fields!.fill(ctx)
    }
    async process(data: Record<string, unknown>) {
        // ... do work ...
        return `/welcome?e=${data.email}` // string → 303 redirect
    }
}

const web = new Web(
    { '': new HomePage(), home: '' /* alias → '' */ },
    {
        enableCors: true,
        disableServing: true,
        servingUrl: 'http://localhost:3000',
        corsOrigins: ['http://localhost:3000'],
        useCentrifugeSupport: true,
        centrifugeUrl: 'http://centrifugo:8000',
        centrifugeApiKey: process.env.CENTRIFUGO_API_KEY,
        centrifugeHmacSecret: process.env.CENTRIFUGO_HMAC_SECRET,
    }
)

web.getApp().listen(8000)
```

## Directory convention (mirrors pie)

```
my-app/
  web.ts                 # Web instance + .getApp().listen()
  pages/
    main.ts              # default page (route "")
    trade.ts             # route "trade"
    components/
      my_card.ts         # custom Card subclasses
```

A page is a class extending `AsyncPage`; a card is a class extending `Card`
(or `InputCard` for form fields). Property values that are `Card` instances
become children in the generated tree; everything else becomes `data`. Field
names are emitted verbatim — no key transformation — because a server card
binds 1:1 to its frontend counterpart's `*Data` interface, whose fields are
already camelCase. The `card` field defaults to the class name.

Each built-in card is a one-liner parameterised by the frontend `*Data` type;
the base `Card` supplies an auto-constructor (`new Card(props)` →
`Object.assign(this, props)`), so no per-card constructor is needed:

```ts
// 1:1 with the frontend HiddenCard component
export class HiddenCard extends InputCard<HiddenCardData> {}
// containers add a typed child slot
export class UnionCard extends Card<UnionCardData & { content: Card[] }> {}

new HiddenCard({ name: 'email' })        // runtime value filled later via fill()
new UnionCard({ content: [/* … */] })    // child cards become tree nodes
```

## Route table (all under `adminSubdomain`, default `/`)

| Method | Route | Handler |
| --- | --- | --- |
| GET | `/api/content/{pathname}` | `page.getContent(ctx)` → UIConfig JSON |
| POST | `/api/process/{pathname}` | `page.process(data)` → 303 redirect (string) |
| POST | `/api/ajax_content/{pathname}` | registered POST ajax handler → JSON |
| GET | `/api/ajax_content/{pathname}` | registered GET ajax handler → JSON |
| GET | `/api/support/{name}` | bare `boolean` (whether `name` has realtime support) |
| GET | `/api/centrifuge/gen_token` | `{ token }` HS256 JWT (`sub` from cookies) |

`ctx` = cookies (those in `cookieKeys`) merged with query params. `process`
receives the parsed form body (`form2dict` + optional `by_underscore`
`aggregate`).

## Realtime

Pages publish via `this.emit(card.createEvent('update', payload), to?)`. Events
are named `pie{method}_{card.name}`. When `useCentrifugeSupport` +
`centrifugeUrl` + `centrifugeApiKey` are set, `Web` wires a publisher that POSTs
to Centrifugo's HTTP API (`/api/publish`); `to` scopes the channel to
`${event.name}_${to}`. Exact replay of missed events requires history on the
Centrifugo namespace — see `docs/realtime-recovery.md`.

## pie → TypeScript contract

| pie (Python) | this package (TS) |
| --- | --- |
| `class P(AsyncPage)` + `get_content`/`process` | `class P extends AsyncPage` + `getContent`/`process` |
| dataclass `Card` + `generate()` | `class Card` + `generate()` (split by `instanceof Card`) |
| `field.type == Card` → child | property `instanceof Card` → child |
| `page.fields.input_child_loc` | `card.inputChildLoc()` |
| `card.parse(raw)` | `InputCard.parse(raw)` |
| `page.register_ajax(...)` | `page.registerAjax(...)` |
| JWT(sub, exp) HMAC | `jsonwebtoken` HS256 |
| `pie{method}_{name}` | identical |

## Known divergences from pie (v1)

- `process` returning a non-string does not stream an arbitrary framework
  `Response` (pie supports this); v1 responds 204 and assumes the handler wrote
  the response.
- Typed-page per-field parsing (`isTyped` + `card.parse()` over
  `inputChildLoc`) is available on cards but the routes currently pass the raw
  `form2dict` body to `process`; wiring per-field parse for typed pages is a
  follow-up.
- Static asset serving + SPA fallback (pie's `serve_react_app`) is not included;
  v1 targets the external-frontend mode (`disableServing: true`).
- Socket.IO *server* hosting is out of scope; realtime publishing goes through
  Centrifugo's HTTP API.
