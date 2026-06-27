# `@swarm.ing/pieui/server`

TypeScript/Express backend mirroring the Python `pie` FastAPI runtime: pages
with `getContent`/`process`, a `Card` tree serialising to the PieUI
`{card, data, content}` wire format, and the same HTTP surface
(`/api/content`, `/api/process`, `/api/ajax_content`, `/api/support`,
`/api/centrifuge/gen_token`) plus Centrifuge publishing.

See [`docs/express-backend.md`](../../docs/express-backend.md) for the full
guide, route table, directory convention, and the pie→TS contract.

Modules:

- `card.ts` — `Card` (`generate`/`fill`/`inputChildLoc`/`createEvent`), `InputCard` (`parse`)
- `cards/` — built-in cards, one class per file (`HiddenCard`, `UnionCard`, `AjaxGroupCard`, `OneOfCard`, `HTMLEmbedCard`)
- `page.ts` — `AsyncPage` (`getContent`/`process`/`registerAjax`/`emit`)
- `form.ts` — `form2dict` + `aggregate` (by_underscore)
- `web.ts` — `Web` (Express app + all routes + publisher wiring)
- `realtime.ts` — `publishToCentrifuge`, `Publisher`
- `types.ts` — `WebOptions`, `SocketIOEvent`, `PageContext`
