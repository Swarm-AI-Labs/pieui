# PieUI

**PieUI** (`@swarm.ing/pieui`) is a React library for rendering **server-driven UIs**. A backend returns a JSON description of a screen, and PieUI turns it into a React tree by looking up each node in a component **registry**. On top of rendering it ships real-time messaging (Socket.IO, Centrifuge, Mitt), server-driven AJAX updates, host integrations (Telegram Mini Apps, MAX, React Native), an OpenAI voice-agent bridge, a Storybook addon, and a `pieui` CLI for scaffolding apps, pages, and cards.

- **Server-driven** — screens are described by data (`UIConfigType`), not code.
- **Registry-based** — register components by name; the backend references them by that name.
- **Real-time** — cards can subscribe to Socket.IO, Centrifuge, or in-process Mitt events.
- **Multi-platform** — web, Telegram Mini Apps, MAX (VK), and React Native from one core.
- **Tooling** — a CLI that scaffolds Next.js apps, generates cards/pages, and syncs a component registry.

> React and React DOM `>=19` are peer dependencies. React Native `>=0.74` and `@openai/agents` are **optional** peers (only needed for the `/native` and `/agent` entries).

---

## Table of contents

- [Installation](#installation)
- [Core concepts](#core-concepts)
- [Quick start](#quick-start)
- [Package entry points](#package-entry-points)
- [Root components](#root-components)
- [Registering components](#registering-components)
- [Component prop shapes](#component-prop-shapes)
- [Built-in cards](#built-in-cards)
- [Real-time messaging](#real-time-messaging)
- [Server-driven AJAX updates](#server-driven-ajax-updates)
- [`depsNames` — client-side submit sources](#depsnames--client-side-submit-sources)
- [Configuration & environment](#configuration--environment)
- [Registry API](#registry-api)
- [Styling helpers](#styling-helpers)
- [Platform integrations](#platform-integrations)
  - [Telegram Mini Apps](#telegram-mini-apps)
  - [MAX (VK Messenger)](#max-vk-messenger)
  - [React Native](#react-native)
- [OpenAI agent integration](#openai-agent-integration)
- [Storybook integration](#storybook-integration)
- [CLI reference](#cli-reference)
- [API reference](#api-reference)
- [License](#license)

---

## Installation

```sh
bun add @swarm.ing/pieui
# or
npm install @swarm.ing/pieui
# or
pnpm add @swarm.ing/pieui
```

```jsonc
// peerDependencies
"react": ">=19",
"react-dom": ">=19",
"react-native": ">=0.74",     // optional — only for @swarm.ing/pieui/native
"@openai/agents": "^0.4.5"     // optional — only for @swarm.ing/pieui/agent
```

---

## Core concepts

**Server-driven UI.** The backend describes a screen as a tree of `UIConfigType` nodes:

```ts
interface UIConfigType {
    card: string                              // registry name of the component to render
    data: any                                 // props bag passed to the component as `data`
    content: UIConfigType | UIConfigType[]    // nested child config(s), if any
}
```

**The registry.** Every renderable component is registered under a `name`. The renderer (`UI`) reads `config.card`, looks it up in the registry, and renders it — passing `data`, `content`, and `setUiAjaxConfiguration` as appropriate.

**Cards.** A "card" is just a registered React component. PieUI ships a handful of built-in container/leaf cards (`SequenceCard`, `BoxCard`, `HTMLEmbedCard`, …) and you register your own for everything app-specific.

**Side-effect registration.** Importing from `@swarm.ing/pieui` (or `@swarm.ing/pieui/components`) registers the built-in cards automatically as a side effect — there is **no `initializePieComponents()` call to make** anymore. Your own cards register themselves when their module is imported (see [Registering components](#registering-components)).

---

## Quick start

```tsx
'use client'

import { PieRoot } from '@swarm.ing/pieui'
// Importing your registry module triggers side-effect registration of your cards.
import './piecomponents/registry'

export function App() {
    return (
        <PieRoot
            location={{
                pathname: window.location.pathname,
                search: window.location.search,
            }}
            fallback={<>Loading…</>}
            onError={() => window.location.reload()}
            onNavigate={(url) => {
                window.location.href = url
            }}
            config={{
                apiServer: 'https://api.example.com/',
                centrifugeServer:
                    'wss://realtime.example.com/connection/websocket',
                enableRenderingLog: false,
            }}
        />
    )
}
```

`PieRoot` fetches the screen config from `` `${config.apiServer}/api/content${pathname}?${search}` `` with React Query + Axios, sets up every provider PieUI needs, and renders the resulting tree.

- **Telegram Mini App?** Use `PieTelegramRoot` from `@swarm.ing/pieui/telegram`.
- **MAX mini-app?** Use `PieMaxRoot` from `@swarm.ing/pieui/max`.
- **React Native?** Use `PieRoot`/`PieNativeRoot` from `@swarm.ing/pieui/native`.

---

## Package entry points

PieUI is split into focused entry points so apps only ship what they use:

| Import path                        | Contents                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `@swarm.ing/pieui`                 | Main barrel: roots, `UI`, `PieCard`, registry API, hooks, types, built-in card side-effect |
| `@swarm.ing/pieui/components`      | Just the built-in cards + `UI`/`PieCard` (registers built-ins on import)                  |
| `@swarm.ing/pieui/telegram`        | `PieTelegramRoot`, Telegram WebApp hooks, `CloudStorageCard`/`SecureStorageCard`          |
| `@swarm.ing/pieui/max`             | `PieMaxRoot` and MAX (VK) WebApp hooks                                                     |
| `@swarm.ing/pieui/native`          | React Native core + native card variants + native source wiring                          |
| `@swarm.ing/pieui/agent`           | OpenAI agent tools (`getMittAgentTools`, `useOpenAIWebRTC`) — pulls in `@openai/agents`   |
| `@swarm.ing/pieui/storybook`       | Storybook providers/decorators for testing cards in isolation                            |
| `@swarm.ing/pieui/storybook/addon` | Storybook addon (panel + manager) for firing PieCard methods from the Storybook UI       |

The Telegram, MAX, and agent integrations are deliberately split out so apps that don't target those hosts never bundle their code.

---

## Root components

All roots wrap children in the PieUI provider stack (React Query, Mitt, Socket.IO, Centrifuge, config, navigation, and — unless disabled — a global `<form>`).

### `PieRoot`

Fetches a `UIConfigType` from `api/content{pathname}{search}` and renders it.

| Prop                | Type                                          | Description                                                                                                   |
| ------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `location`          | `{ pathname: string; search: string }`        | Current route. Used to build the request URL and as part of the React Query key.                             |
| `config`            | `PieConfig`                                    | Runtime configuration (API URLs, logging, page processor). **Required.**                                     |
| `fallback`          | `ReactNode`                                    | Rendered while loading or on fetch failure.                                                                   |
| `piecache`          | `Record<string, UIConfigType>`                 | Optional per-pathname snapshot; a cached shell is shown via `UILoading` instead of the plain `fallback`.     |
| `onError`           | `(error?: unknown) => void`                    | Called on a render-blocking error (config fetch throws, or a lazy card chunk fails after retries).           |
| `onNavigate`        | `(url: string) => void`                        | Navigation handler forwarded through `NavigateContext` so cards route via the host router, not a full reload. |
| `queryOptions`      | `PieQueryOptions`                              | React Query overrides (everything except `queryKey`/`queryFn`/`enabled`, which PieRoot manages).             |
| `queryClient`       | `QueryClient`                                  | Supply a stable (module-singleton) client so the config cache survives remounts. Otherwise one is made per mount. |
| `disableGlobalForm` | `boolean`                                      | When `true`, the implicit `<form id="piedata_global_form">` wrapper is not rendered.                          |

### `PieBaseRoot`

The provider stack **without** any fetch. Renders `children` inside the same providers and (optional) form shell. Use it when you already have a `UIConfigType` (render it with `UI`) or want PieUI context without a network round-trip.

### `PiePreviewRoot`

A root tailored to the CLI preview harness (`pieui registry dev`/`build`) for previewing a single card.

### Platform roots

- **`PieTelegramRoot`** (`/telegram`) — like `PieRoot`, but appends Telegram WebApp `initData` to the request query string via `useWebApp`. Throws if `apiServer` is missing.
- **`PieMaxRoot`** (`/max`) — MAX (VK) equivalent.
- **`PieNativeRoot`** (`/native`) — `PieBaseRoot` for React Native (no HTML form).

---

## Registering components

A card is any React component registered under a name. The CLI generates a per-card `index.ts` that calls `registerPieComponent`, and a `piecomponents/registry.ts` that side-effect-imports each card. Registering manually:

```tsx
import { registerPieComponent } from '@swarm.ing/pieui'
import MyCard from './MyCard'

registerPieComponent({
    name: 'MyCard',
    component: MyCard,
    metadata: { author: 'You', version: '1.0.0', description: 'A custom card' },
})
```

**Lazy / code-split cards** — pass a `loader` instead of `component`; PieUI wraps it in `React.lazy` and renders it inside `Suspense` (with an optional `fallback`):

```tsx
registerPieComponent({
    name: 'HeavyChart',
    loader: () => import('./HeavyChart'),
    fallback: <Spinner />,
})
```

`ComponentRegistration` shape:

```ts
interface ComponentRegistration<TProps> {
    name: string
    component?: ComponentType<TProps>
    loader?: () => Promise<{ default: ComponentType<TProps> }>
    fallback?: ComponentType<{}>
    metadata?: { author?: string; version?: string; description?: string; tags?: string[] }
}
```

> A registration must provide a `name` **and** either `component` or `loader`, otherwise `registerPieComponent` throws.

---

## Component prop shapes

The renderer passes different props depending on a card's "kind". Pick the matching prop type for your component:

| Kind                | Prop type                              | Props received                                            | `card add` type     |
| ------------------- | -------------------------------------- | -------------------------------------------------------- | ------------------- |
| Simple              | `PieSimpleComponentProps<T>`           | `{ data }`                                                | `simple`            |
| Complex             | `PieComplexComponentProps<T>`          | `{ data, setUiAjaxConfiguration? }`                      | `complex`           |
| Container           | `PieContainerComponentProps<T>`        | `{ data, content: UIConfigType, setUiAjaxConfiguration? }` | `simple-container`  |
| Complex container   | `PieComplexContainerComponentProps<T>` | `{ data, content: UIConfigType[], setUiAjaxConfiguration? }` | `complex-container` |

Each has an `InputPie…ComponentProps<T, TStored>` variant that adds a typed `stored` prop (used when a card needs locally stored state — wired through `<PieCard stored={…} />`).

```tsx
import type { PieContainerComponentProps } from '@swarm.ing/pieui'

interface MyData { title: string }

export default function Panel({
    data,
    content,
}: PieContainerComponentProps<MyData>) {
    return (
        <section>
            <h2>{data.title}</h2>
            <UI uiConfig={content} />
        </section>
    )
}
```

---

## Built-in cards

These register automatically when you import `@swarm.ing/pieui` (or `/components`).

### Containers

| Card            | Kind              | Description                                                                    |
| --------------- | ----------------- | ----------------------------------------------------------------------------- |
| `SequenceCard`  | complex-container | Renders an array of children sequentially inside a styled wrapper.            |
| `UnionCard`     | complex-container | Renders an array of children with no wrapping element.                        |
| `OneOfCard`     | complex-container | Renders children in a styled wrapper (typically for conditional selection).  |
| `BoxCard`       | container         | Single-child wrapper with optional click-to-navigate and inline styling.     |
| `AjaxGroupCard` | container         | Single-child group that loads/replaces its content via AJAX and emits events. |

### Common (leaf)

| Card                 | Kind   | Description                                                                          |
| -------------------- | ------ | ----------------------------------------------------------------------------------- |
| `HiddenCard`         | simple | Renders a hidden input with state management and real-time value sync.              |
| `HTMLEmbedCard`      | simple | Parses and renders arbitrary HTML (optionally driven by OpenAI WebRTC generation).  |
| `AutoRedirectCard`   | simple | Redirects on mount (internal route or external URL).                                |
| `IOEventsCard`       | simple | Handles toast notifications, alerts, push notifications, and redirect/reload events. |
| `DeviceStorageCard`  | simple | Persists data to `localStorage`, mirrored into a hidden input for form submission.  |
| `SessionStorageCard` | simple | Persists data to `sessionStorage`, mirrored into a hidden input.                    |

### Telegram-only (register via `@swarm.ing/pieui/telegram`)

| Card                | Kind   | Description                                                       |
| ------------------- | ------ | ----------------------------------------------------------------- |
| `CloudStorageCard`  | simple | Persists data to Telegram `CloudStorage` (async), hidden-input mirror. |
| `SecureStorageCard` | simple | Persists data to Telegram `SecureStorage` (async), hidden-input mirror. |

The storage cards pair with the AJAX `depsNames` prefixes: `localStorage:` ↔ `DeviceStorageCard`, `sessionStorage:` ↔ `SessionStorageCard`, `telegram:cloud:` ↔ `CloudStorageCard`, `telegram:secure:` ↔ `SecureStorageCard` (see [`depsNames`](#depsnames--client-side-submit-sources)).

---

## Real-time messaging

`PieCard` wires a card into PieUI's real-time transports. It renders no UI of its own — it returns its `children` and, on mount, subscribes the supplied `methods` map to whichever transports are enabled:

| Transport     | Event / channel format                              | Enable with             |
| ------------- | --------------------------------------------------- | ----------------------- |
| **Socket.IO** | `pie{methodName}_{data.name}`                       | `useSocketioSupport`    |
| **Centrifuge**| `pie{methodName}_{data.name}_{centrifugeChannel}`   | `useCentrifugeSupport` + `centrifugeChannel` |
| **Mitt**      | `pie{methodName}_{data.name}`                       | `useMittSupport`        |

```tsx
import { PieCard } from '@swarm.ing/pieui'

function LiveCounter({ data }) {
    const [count, setCount] = useState(0)
    return (
        <PieCard
            card="LiveCounter"
            data={data}
            useMittSupport
            useSocketioSupport
            methods={{
                increment: (payload) => setCount((c) => c + (payload?.by ?? 1)),
                reset: () => setCount(0),
            }}
        >
            <span>{count}</span>
        </PieCard>
    )
}
```

The `methods` map is held in a ref, so you can pass freshly-created closures every render without re-subscribing. Cleanup runs on unmount or when `data.name`/the support flags change.

### Emitting Mitt events — `usePieEmit`

Trigger a card's Mitt-subscribed method from anywhere in the tree:

```tsx
import { usePieEmit } from '@swarm.ing/pieui'

function Controls() {
    const emit = usePieEmit('LiveCounter') // card name
    return <button onClick={() => emit('increment', { by: 5 })}>+5</button>
}
```

`getEmitter()` returns the shared emitter for imperative use outside React.

---

## Server-driven AJAX updates

Cards that trigger updates receive a `setUiAjaxConfiguration` callback. Combined with `useAjaxSubmit`, a card can POST to the backend and swap part of the UI — or stream UI events — without a full reload.

```tsx
import { useAjaxSubmit } from '@swarm.ing/pieui'

function SubmitButton({ data, setUiAjaxConfiguration }) {
    const submit = useAjaxSubmit(
        setUiAjaxConfiguration,
        data.kwargs,          // static key/values from the card config
        data.deps_names,      // client-side values resolved at submit time
        data.pathname,        // backend handler path
        { timeout: 10_000, retryPolicy: { maxRetries: 2, baseDelay: 1000 } }
    )
    return <button onClick={() => submit({ extra: 'value' })}>Submit</button>
}
```

The request is `POST {apiServer}/api/ajax_content{pathname}`, and the response either replaces the `UIConfigType` subtree or streams JSON-line UI events through `setUiAjaxConfiguration`. The body is assembled from three sources:

1. **`kwargs`** — static key/value pairs from the card config.
2. **`extraKwargs`** — values passed to the returned submit function at call time.
3. **`depsNames`** — names whose **current client-side value** is read at submit time (see below).

### `RetryPolicy`

```ts
type RetryPolicy = {
    maxRetries?: number   // default 0 (no retries)
    baseDelay?: number    // default 1000 ms; doubled each attempt
    retryOn?: number[]    // default [502, 503, 504]; timeouts/network errors always retry
}
```

---

## `depsNames` — client-side submit sources

Each entry in `depsNames` is a "magic name": an optional **source prefix** plus a key. The value is submitted under the **bare key** (the part after the prefix), so `localStorage:token` is sent as the field `token`.

| `depsNames` entry        | Read from                                                      |
| ------------------------ | ------------------------------------------------------------- |
| `email` *(no prefix)*    | DOM input named `email` (`document.getElementsByName`)        |
| `sid`                    | `window.sid` — Socket.IO session id (awaits the socket)       |
| `localStorage:<key>`     | `localStorage.getItem(key)`                                   |
| `sessionStorage:<key>`   | `sessionStorage.getItem(key)`                                 |
| `cookie:<name>`          | matching cookie from `document.cookie` (URL-decoded)          |
| `url:<param>`            | `?<param>` query params (repeated → multiple values)          |
| `telegram:cloud:<key>`   | `Telegram.WebApp.CloudStorage.getItem` *(async)*              |
| `telegram:secure:<key>`  | `Telegram.WebApp.SecureStorage.getItem` *(async)*             |

```ts
depsNames: ['email', 'localStorage:token', 'url:ref', 'sid']
// POST body fields: email, token, ref, sid
```

Notes:

- A **missing value contributes nothing** — the field is simply omitted (same as an absent DOM input).
- A single entry can yield **multiple values** (a multi-file `<input>`, repeated `url:` params); each is appended under the same bare key.
- `telegram:cloud:` / `telegram:secure:` are **async**. The submit flow awaits them; the sync `readAjaxKey` returns `[]` for them, so use `readAjaxKeyAsync` to read directly. `parseDepName(name)` returns `{ source, key }`.
- `depsNames` is normally supplied by the backend `UIConfig` at runtime — it is data interpreted by the frontend, not a CLI surface.

---

## Configuration & environment

`PieConfig` (passed to roots as `config`):

```ts
interface PieConfig {
    apiServer: string            // base URL of the PieUI API (build endpoints from it)
    centrifugeServer?: string    // Centrifuge websocket URL
    enableRenderingLog?: boolean // verbose render/AJAX/realtime logging
    pageProcessor?: string       // page-processing configuration
}
```

When PieUI is wired through the CLI scaffold, these are read from environment variables (multiple framework prefixes supported):

- `PIE_API_SERVER` / `VITE_PIE_API_SERVER` / `NEXT_PUBLIC_PIE_API_SERVER`
- `PIE_CENTRIFUGE_SERVER` / `VITE_PIE_CENTRIFUGE_SERVER` / `NEXT_PUBLIC_PIE_CENTRIFUGE_SERVER`
- `PIE_ENABLE_RENDERING_LOG` (optional)
- `PIE_PAGE_PROCESSOR` (optional)

Use the literal value `auto-api` for a server URL to derive it automatically from the current hostname.

---

## Registry API

All exported from `@swarm.ing/pieui` (and `/native`):

| Function                          | Description                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `registerPieComponent(reg)`       | Register a component or lazy loader. Returns the (possibly lazy) component.   |
| `registerMultipleComponents([…])` | Register an array of registrations at once.                                  |
| `unregisterComponent(name)`       | Remove a component from the registry.                                        |
| `hasComponent(name)`              | `true` if a name is registered.                                              |
| `getRegistryEntry(name)`          | Full `ComponentRegistration` (incl. `fallback` / `isLazy`).                  |
| `getComponentMeta(name)`          | The `metadata` supplied at registration, if any.                            |
| `getAllRegisteredComponents()`    | Array of all registered names.                                              |
| `getRegistrySize()`               | Number of registered components.                                            |
| `getLazyComponentNames()`         | Names of code-split (lazy) components.                                      |
| `preloadComponent(name)`          | Warm a single lazy chunk so the next render resolves without a fallback flash. |
| `prefetchLazyComponents()`        | Idle-time, connection-aware background warm-up of every lazy chunk (idempotent). |
| `registry`                        | The underlying `Map` (shared singleton across all entry points).            |
| `trackLazy(loader, name)`         | Low-level `React.lazy` wrapper with named tracking.                          |

> The registry is stored on `globalThis` under a shared `Symbol.for` key, so a card registered through one entry point (`/components`) is visible to a renderer loaded from another (`/telegram`). This avoids "[UI] Component not found in registry" across bundles.

---

## Styling helpers

- **`cn(...classes)`** — class-name merge built on `clsx` + `tailwind-merge` (dedupes conflicting Tailwind utilities).
- **`sx2radium(style)`** — converts a style object into Radium-friendly `CSSProperties`, including turning an object `animationName` into Radium keyframes.
- **`PIEBREAK`** — the `__piedemo__` delimiter used internally to build form field names.
- **`pieName(...)`** — helper for composing Pie event/field names.
- **`submitGlobalForm()`** — programmatically submits the implicit global `<form>`.

---

## Platform integrations

### Telegram Mini Apps

```tsx
import { PieTelegramRoot, useWebApp, useInitData } from '@swarm.ing/pieui/telegram'

function App() {
    return <PieTelegramRoot location={location} config={config} />
}
```

- `useWebApp()` — the full `Telegram.WebApp` object (typed: `MainButton`, `BackButton`, `HapticFeedback`, `CloudStorage`, `BiometricManager`, theme params, safe-area insets, fullscreen/orientation, and the Bot API methods).
- `useInitData()` — the parsed init data.
- Importing this entry also registers `CloudStorageCard` and `SecureStorageCard`.

### MAX (VK Messenger)

```tsx
import {
    PieMaxRoot,
    useMaxWebApp,
    useMaxInitData,
    useMaxBackButton,
    useMaxHapticFeedback,
} from '@swarm.ing/pieui/max'
```

Typed access to the MAX bridge (`BackButton`, `HapticFeedback`, `DeviceStorage`/`SecureStorage`, `BiometricManager`, share/download helpers, screen capture, etc.).

### React Native

The `/native` entry exposes the platform-agnostic core (registry, `UI`, `PieCard`, real-time contexts, AJAX helpers) plus native-specific wiring. It deliberately does **not** export the DOM container/leaf cards — on native the host registers its own React Native leaf components and renders them through `UI`/`PieCard`. Metro resolves the `.native` platform layer automatically.

Wire the host's storage / route / form sources once at startup:

```ts
import { configureNativeClientSources } from '@swarm.ing/pieui/native'
import { MMKV } from 'react-native-mmkv'

const mmkv = new MMKV()

configureNativeClientSources({
    storage: {
        getItem: (k) => mmkv.getString(k) ?? null,
        setItem: (k, v) => mmkv.set(k, v),
        removeItem: (k) => mmkv.delete(k),
    },
    getRouteParams: (key) => getCurrentRoute().params[key] ?? [],
    getInput: (name) => readNativeField(name),
    submitForm: () => {/* host submit */},
})
```

`NativeClientConfig` supports sync (`storage`, `sessionStorage`) and async (`asyncStorage`, `asyncSessionStorage`) adapters, `getCookie`, `getRouteParams`, `getInput`, and `submitForm`. Unconfigured sources degrade to the same "missing value" semantics as web (`null` / `[]`). Render with `PieRoot`/`PieNativeRoot` and pass `disableGlobalForm` (there is no HTML form on native). A small native form store is exposed via `setNativeField` / `clearNativeField` / `readNativeField`.

---

## OpenAI agent integration

The `/agent` entry exposes PieCard methods as OpenAI function tools and provides a WebRTC voice hook. It pulls in `@openai/agents`, so it's a separate entry to keep it out of apps that don't need it.

```tsx
import {
    usePieMittAgentTools,  // hook: build tools from the active Mitt emitter
    getMittAgentTools,     // imperative variant
    useOpenAIWebRTC,       // WebRTC voice session hook
} from '@swarm.ing/pieui/agent'
```

- `getMittAgentTools(descriptors, options)` / `usePieMittAgentTools(...)` — turn PieCard methods into agent tools. Options: `filter`, `describe`, and `nameFor` to control which descriptors become tools, their descriptions, and tool names.
- `useOpenAIWebRTC(audioElement?, onEvent?)` — returns `{ isSessionActive, startSession(ephemeralKey, useMicrophone?), stopSession(), sendTextMessage(text) }` for an OpenAI Realtime WebRTC session (pass an `<audio>` element to play remote audio). Pairs with `HTMLEmbedCard`'s AI-generation support.

---

## Storybook integration

Test cards in isolation with the PieUI providers and fire their real-time methods from the Storybook UI.

```tsx
// .storybook/preview.tsx
import { withPieCard } from '@swarm.ing/pieui/storybook'
export const decorators = [withPieCard]
```

```tsx
// MyCard.stories.tsx
import { PieStorybookProviders, PieMethodTrigger } from '@swarm.ing/pieui/storybook'

export const Live = () => (
    <PieStorybookProviders>
        <MyCard data={{ name: 'MyCard' }} />
        <PieMethodTrigger card="MyCard" method="increment" payload={{ by: 1 }} />
    </PieStorybookProviders>
)
```

- `PieStorybookProviders` — mounts the full provider stack with a stubbed config and a local Mitt emitter.
- `withPieCard` — decorator wrapping a story in those providers + a channel bridge.
- `PieMethodTrigger` — a button that fires a `pie{method}_{card}` Mitt event.
- `firePieMethod(emitter, card, method, payload)` / `usePieStorybookEmitter()` — imperative helpers.
- The **addon** (`@swarm.ing/pieui/storybook/addon`) adds a Storybook panel to fire methods interactively; register it in `.storybook/main` (the CLI's `card add-story` does this automatically).

---

## CLI reference

The CLI ships as `pieui` (run via `bunx pieui …` or the installed bin). It mirrors the backend `pie` Python CLI — subcommand names, positionals, and flags are kept in sync.

### Scaffolding

```sh
pieui create <AppName>          # create a Next.js app and run `pieui init` inside it
pieui create-pie-app <AppName>  # create a blank PieUI Next.js template (alias: create-pieui)
pieui init [--out-dir <dir>]    # add piecomponents/, registry.ts, Tailwind & Next config to an existing app
```

`create` scaffolds Next.js (`next-app@latest`), installs `@swarm.ing/pieui`, runs `init`, installs Storybook, then `bun run dev`. `init` also searches your home directory (depth ≤ 2) for a backend project with `pages/` and `components/` dirs and, in a TTY, offers to link them (saved to `.pie/config.json`).

### Build

```sh
pieui postbuild [--src-dir <dir>] [--out-dir <dir>] [--append]
```

Scans for `registerPieComponent()` calls, generates a JSON Schema per card data type, and writes `pieui.components.json`. Defaults: `--src-dir src`, `--out-dir public`. `--append` merges with the library manifest in `node_modules`.

```sh
pieui self-upgrade [--pm <bun|pnpm|yarn|npm>]   # upgrade the global CLI
```

### Auth

```sh
pieui login   # browser auth; writes .pie/config.json and PIE_* keys into .env
```

### Pages (`pieui page …`)

```sh
pieui page add <path>                         # create app/<path>/page.tsx from the Pie page template
pieui page view <path>                        # print the page source
pieui page ajax <path> <add|remove> <handler> # add/remove an AJAX handler (delegates to the backend)
```

`add` normalizes the path under `app/`, derives a `PascalCasePage` component name, and rejects traversal outside `app/`.

### Cards (`pieui card …`)

```sh
pieui card add [<type>] <Name> [--io] [--ajax] [--input] [--from <ref>]
```

Creates `piecomponents/<Name>/` (`index.ts`, `types/index.ts`, `ui/<Name>.tsx`) and registers it in `registry.ts`. `<type>` is one of `simple`, `complex`, `simple-container`, `complex-container` (default). Flags:

- `--io` — add real-time support fields (`use_*_support`) to the data interface.
- `--ajax` — add AJAX fields (`pathname`, `deps_names`, `kwargs`).
- `--input` — generate the `InputPie…ComponentProps` variant with a typed `stored` prop.
- `--from <ref>` — port from backend Python metadata (a `.py`/JSON path, a card name, or auto-detected from the configured `backendComponentsDir`).

```sh
pieui card list [<filter>] [--src-dir <dir>]   # list cards (filter: all|simple|complex|simple-container|complex-container)
pieui card view <Name>                          # print a card's props, ajax, io, and events
pieui card remove <Name>                        # delete a card directory
pieui card list-events <Name>                   # list a card's methods (event handlers)
pieui card add-event <Name> <EventName>         # add a method to a card
pieui card pull <ref>                           # restore a card from a URL, local JSON file, or remote name
```

Metadata & Storybook:

```sh
pieui card dump-metadata <Name> [--out <file.json>]  # emit full PieMetadata JSON (props/events/imports/ajax/io)
pieui card check-sync <Name>                          # compare TypeScript ↔ Python metadata, report mismatches
pieui card add-story <Name> [--force]                 # generate <Name>.stories.tsx wired to PieCard methods
pieui card generate-preview <Name> [--out <file.png>] # render the story via storycap to a PNG
```

### Remote card storage (`pieui card remote …`)

```sh
pieui card remote list [--user <id>] [--project <slug>]
pieui card remote push <Name>
pieui card remote pull <Name>[@rev]
pieui card remote remove <Name>
pieui card remote history <Name> [--page <n>] [--per-page <n>] [--from <r>] [--to <r>]
pieui card remote public <Name>     # make readable as r/<user>/<Name>
pieui card remote private <Name>    # revert to private
```

### Registry preview harness (`pieui registry …`)

```sh
pieui registry dev [--port <n>] [--api-server <url>]   # run the PiePreviewRoot harness (default port 3210)
pieui registry build [--out <dir>]                     # static-export the harness (default .pie/registry/out)
```

### Configuration & environment

`.pie/config.json` (written by `login` / `init`) holds `user_id`, `project`, `api_key`, and optional `backendPagesDir` / `backendComponentsDir`. Notable env vars: `PIE_USER_ID`, `PIE_PROJECT`/`PIE_PROJECT_SLUG`, `PIE_API_KEY`; `PIEUI_CREATE_NEXT_APP_SPEC`, `PIEUI_CREATE_PACKAGE_SPEC`, `PIEUI_CREATE_BUN_BIN`, `PIEUI_CREATE_SKIP_STORYBOOK`; `PIEUI_LOGIN_CONNECT_BASE`, `PIEUI_LOGIN_CREDENTIALS_API`. Add `--help`/`-h` to any command for scoped help.

---

## API reference

### Runtime exports (`@swarm.ing/pieui`)

| Export | Description |
| ------ | ----------- |
| `UI` | Renders a `UIConfigType` by resolving `uiConfig.card` from the registry (Suspense for lazy cards; passes `data`, `content`, `setUiAjaxConfiguration`). |
| `UILoading` | Renders a cached/placeholder shell while a screen loads. |
| `UIRendererContext` | Context carrying renderer props (`UIRendererProps`). |
| `PieRoot` / `PieBaseRoot` / `PiePreviewRoot` | Root components (see [Root components](#root-components)). |
| `PieCard` | Wires a card into Socket.IO / Centrifuge / Mitt messaging. |
| `registerPieComponent` & registry helpers | See [Registry API](#registry-api). |
| `trackLazy` | Named `React.lazy` wrapper. |
| `useAjaxSubmit` / `readAjaxKey` / `readAjaxKeyAsync` / `parseDepName` | AJAX submit + dep-name resolution. |
| `usePieEmit` / `getEmitter` / `MittContext` | Mitt event emission. |
| `SocketIOContext` / `CentrifugeIOContext` / `FallbackContext` / `PieConfigContext` | PieUI contexts. |
| `cn` / `sx2radium` / `pieName` / `submitGlobalForm` / `PIEBREAK` | Utilities. |

### Type exports

`PieComponentProps`, `PieSimpleComponentProps`, `PieComplexComponentProps`, `PieContainerComponentProps`, `PieComplexContainerComponentProps`, and their `InputPie…` variants; `PieConfig`, `UIConfigType`, `SetUiAjaxConfigurationType`, `PieQueryOptions`, `RetryPolicy`, `DepSource`. Telegram/MAX entries export their respective `WebApp`/init-data types; the `/native` entry adds `PieRootProps`, `PieBaseRootProps`, and the `NativeClientConfig`/adapter types.

---

## License

MIT
