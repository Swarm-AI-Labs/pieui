# PieUI

PieUI is a React component library for rendering server-driven UI "cards" with optional real-time and AJAX updates. It provides a component registry, root wrappers that set up providers, and helpers for styling and class name management.

**Install**

```sh
bun add @piedata/pieui
npm install @piedata/pieui
```

React and React DOM `>=19` are peer dependencies.

**Quick Start**

```tsx
import { PieRoot, initializePieComponents } from '@piedata/pieui'

initializePieComponents()

export function App() {
    return (
        <PieRoot
            location={{
                pathname: window.location.pathname,
                search: window.location.search,
            }}
            fallback={<>Loading...</>}
            onError={() => console.error('Failed to load UI')}
            onNavigate={(url) => {
                window.location.href = url
            }}
            config={{
                apiServer: 'https://api.example.com/',
                centrifugeServer:
                    'wss://realtime.example.com/connection/websocket',
                enableRenderingLog: false,
            }}
            initializePie={() => {
                // Register custom components here if needed.
            }}
        />
    )
}
```

If you are embedding PieUI inside a Telegram WebApp, use `PieTelegramRoot` instead of `PieRoot`.

**Register Custom Components**

```tsx
import { registerPieComponent } from '@piedata/pieui'
import MyCard from './MyCard'

registerPieComponent({
    name: 'MyCard',
    component: MyCard,
    metadata: {
        author: 'You',
        description: 'Custom card',
    },
})
```

**Exports**
Runtime exports:

- `UI`: Renders a `UIConfigType` by looking up `uiConfig.card` in the registry. Supports lazy components via `Suspense` and passes `data`, `content`, and `setUiAjaxConfiguration` into the rendered component.
- `PieRoot`: Fetches UI configuration from `config.apiServer + "/api/content"` using the current `location` and renders `UI` inside PieUI providers (React Query, Socket.IO, Centrifuge, Mitt, Radium). Calls `initializePieComponents()` and your `initializePie` callback once.
- `PieTelegramRoot`: Same as `PieRoot`, but adds Telegram WebApp `initData` to the request query string via `useWebApp`. Throws if `apiServer` is missing.
- `PieBaseRoot`: Provider wrapper without fetching UI configuration. Renders `children` inside the same PieUI provider stack and form shell.
- `PieCard`: Wrapper for card components that wires optional Socket.IO, Centrifuge, or Mitt event handlers based on `methods` and `data.name`. Returns `children` unchanged.
- `registerPieComponent`: Registers a component (or lazy loader) into the PieUI registry, with optional metadata and fallback.
- `initializePieComponents`: Registers the built-in card components once (SequenceCard, BoxCard, UnionCard, AjaxGroupCard, AjaxButtonCard, RedirectButtonCard, ChatCard, HiddenCard, AutoRedirectCard, HTMLEmbedCard, IOEventsCard, OpenAIVoiceAgentCard, TableCard).
- `isPieComponentsInitialized`: Returns `true` if `initializePieComponents` has already been called.
- `useAjaxSubmit`: Hook that returns a function to `POST` to `api/ajax_content` and updates UI state via `setUiAjaxConfiguration`. Supports streamed JSON line events.
- `sx2radium`: Converts a style object to Radium-friendly `CSSProperties`, including converting object `animationName` into Radium keyframes.
- `cn`: Class name merge helper using `clsx` and `tailwind-merge`.
- `PIEBREAK`: String delimiter (`__piedemo__`) used internally to build form field names.

Type exports:

- `PieComponentProps`: Union type of the supported Pie component prop shapes.
- `PieSimpleComponentProps`: `{ data }` props for simple components.
- `PieComplexComponentProps`: `{ data, setUiAjaxConfiguration? }` props for components that trigger AJAX or updates.
- `PieContainerComponentProps`: `{ data, content, setUiAjaxConfiguration? }` props for components that render a single nested `UIConfigType`.
- `PieComplexContainerComponentProps`: `{ data, content: UIConfigType[], setUiAjaxConfiguration? }` props for components that render an array of nested configs.
- `PieConfig`: Configuration object for Pie roots. Includes `apiServer` and optional `centrifugeServer`, `enableRenderingLog`, `pageProcessor`.
- `UIConfigType`: Server-driven UI configuration with `card`, `data`, and `content` (nested `UIConfigType` or array).
- `SetUiAjaxConfigurationType`: Setter type for updating the UI configuration or streaming UI events.

## CLI Template Scaffolding

Create a blank Next.js web app template with PieUI CLI:

```sh
bunx pieui create-pie-app my-pie-app
```

This command:

- runs `bun create next-app@latest my-pie-app --yes`
- copies a standard `_shared` folder into the new app (sourced from `ai-exchange-bot`)
- rewrites `dev/build/start` scripts to `bun --bun next ...`
- appends a TODO marker in `app/page.tsx` for future backend (Python Unicorn) linking

If the `_shared` source cannot be found automatically, set:

```sh
PIEUI_SHARED_TEMPLATE_DIR=/absolute/path/to/_shared bunx pieui create-pie-app my-pie-app
```

Planned create flow target:

```sh
bun create pieui@latest my-pie-app
```
