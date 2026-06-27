# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Cross-repo CLI symmetry (pieui ↔ pie)

PieUI ships a TypeScript CLI (`pieui …`). The backend project at `../pie` ships a Python CLI (`pie …`). **The pie CLI is the authoritative reference for command structure** — subcommand names, positional args, and flags must mirror it.

When you edit any of these files in this repo:

- `src/cli.ts` — top-level dispatch
- `src/code/args.ts`, `src/code/types.ts` — argument parsing & shape
- `src/code/commands/**` — command handlers

…a PostToolUse hook (`.claude/hooks/cli-symmetry-check.sh`) prints a reminder asking you to verify the change against `../pie`. Treat it as a hard ask:

1. **New / renamed / removed command, flag, or positional?** Mirror it in `../pie` (`pie/__main__.py` + relevant handler in `pie/code/`).
2. **Pure implementation change (no surface change)?** No action — symmetry is unaffected.
3. **Feature has no semantic frontend analog (e.g., AJAX handlers live server-side)?** Expose the symmetric subcommand anyway and delegate to the backend via subprocess (see `src/code/commands/pageAjax.ts`).

Quick parity check:

```bash
diff <(node ./dist/cli.js --help | grep -E '^  [a-z]') \
     <(cd ../pie && /Users/kaspar_george/pie/.venv/bin/python -m pie --help | grep -E '^    [a-z]')
```

The hook is advisory — it never blocks tool execution. Ignore the nudge only if you are certain symmetry is preserved or intentionally diverging (document the divergence in this section if so).

## Project Overview

PieUI is a React component library that provides a dynamic UI rendering system with real-time communication support through WebSockets (Socket.IO), Centrifuge, and event emitters (Mitt). The library enables building server-driven UIs where components can be dynamically loaded and configured based on API responses.

## Key Commands

### Build Commands

- `bun run build` - Full build process: cleans dist, builds ESM/CJS/types/CLI, and creates package
- `bun run build:esm` - Build ES module format for browsers
- `bun run build:cjs` - Build CommonJS format for Node.js
- `bun run build:types` - Generate TypeScript declaration files
- `bun run build:cli` - Build the CLI tool

### Development Commands

- `bun run dev` - Run development mode
- `bun run typecheck` - Type check without emitting files
- `bun run lint` - Currently not configured (placeholder)

### CLI Commands

- `pieui postbuild` - Scans project for registerPieComponent calls and generates pieui.components.json
    - Options: `--out-dir <dir>` (default: dist), `--src-dir <dir>` (default: src)

## Architecture Overview

### Core Component System

The library uses a registry-based component system where components are registered with names and can be dynamically loaded:

1. **Component Registry** (`src/util/registry.ts`): Central registry for all PieUI components
    - Components register using `registerPieComponent({ name, component/loader })`
    - Supports both sync and lazy-loaded components
    - Registry entries include metadata and fallback components

2. **Dynamic UI Rendering**: The UI is driven by a UIConfigType structure:

    ```typescript
    interface UIConfigType {
        card: string // Component name to render
        data: any // Props passed to component
        content: UIConfigType | Array<UIConfigType> // Nested components
    }
    ```

3. **Component Types**:
    - Simple components: Receive only `data` prop
    - Container components: Receive `data` and single `content` child
    - Complex container components: Receive `data` and array of `content` children

### Root Components

- **PieRoot**: Main entry point that fetches UI configuration from API
    - Fetches from `/api/content{pathname}{search}`
    - Provides all context providers (QueryClient, Mitt, Socket.IO, Centrifuge)
    - Requires `PIE_API_SERVER` and `PIE_CENTRIFUGE_SERVER` environment variables

- **PieStaticRoot**: For static UI configurations (no API fetch)
- **PieBaseRoot**: Base implementation shared by other roots

### Express Backend (`@swarm.ing/pieui/server`)

The `src/server` entry is a TypeScript/Express mirror of the Python `pie`
FastAPI runtime — it produces the UIConfig the frontend roots fetch. Pages
extend `AsyncPage` and expose `getContent`/`process`; `Card.generate()` matches
pie's wire format (own props that are `instanceof Card` become children, the
rest become camelCased `data`, `card` defaults to the class name). `Web` exposes
the same routes as pie (`/api/content`, `/api/process`, `/api/ajax_content`,
`/api/support`, `/api/centrifuge/gen_token`) and wires Centrifuge publishing.
See `docs/express-backend.md`, including the documented v1 divergences from pie
(non-string `process` returns 204; typed-page per-field parsing and static
serving are follow-ups). This is a runtime, not a CLI surface — cross-repo CLI
symmetry is unaffected.

### Real-time Communication

PieCard component integrates three communication methods:

1. **Socket.IO**: WebSocket events in format `pie{methodName}_{componentName}`
2. **Centrifuge**: Pub/sub with channels `pie{methodName}_{componentName}_{channel}`
3. **Mitt**: Local event emitter with events `pie{methodName}_{componentName}`

### Environment Configuration

Required environment variables (supports multiple formats):

- `PIE_API_SERVER` / `VITE_PIE_API_SERVER` / `NEXT_PUBLIC_PIE_API_SERVER`
- `PIE_CENTRIFUGE_SERVER` / `VITE_PIE_CENTRIFUGE_SERVER` / `NEXT_PUBLIC_PIE_CENTRIFUGE_SERVER`

Optional:

- `PIE_ENABLE_RENDERING_LOG` - Enable debug logging
- `PIE_PAGE_PROCESSOR` - Page processing configuration

Use "auto-api" value to automatically derive from hostname.

### Component Registration Pattern

Components must be registered before use:

```typescript
import { registerPieComponent } from 'pieui'

registerPieComponent({
  name: 'MyComponent',
  component: MyComponent,
  // or for lazy loading:
  loader: () => import('./MyComponent'),
  fallback: <Loading />,
  metadata: { version: '1.0.0' }
})
```

The CLI tool `pieui postbuild` automatically discovers these registrations and creates a manifest file for runtime discovery.

### Ajax Components

Special components in `src/components/Containers/AjaxGroupCard` and `src/components/Buttons/AjaxButtonCard` handle dynamic content updates through the `setUiAjaxConfiguration` callback, enabling server-driven UI updates without page reloads.

#### Ajax submit variable sources (`depsNames`)

`getAjaxSubmit` / `useAjaxSubmit` (`src/util/ajaxCommonUtils.ts`) collect submit
variables from `kwargs`, runtime `extraKwargs`, and `depsNames`. Each entry in
`depsNames` is resolved by `readAjaxKeyAsync` according to a source prefix
(`parseDepName`); the value is submitted under the **bare key** (after the
prefix):

| `depsNames` entry        | Source                                              |
| ------------------------ | --------------------------------------------------- |
| `email` (no prefix)      | DOM input via `document.getElementsByName` (default)|
| `sid`                    | `window.sid` (SocketIO; awaits `waitForSidAvailable`)|
| `localStorage:<key>`     | `localStorage.getItem(key)`                         |
| `sessionStorage:<key>`   | `sessionStorage.getItem(key)`                       |
| `cookie:<name>`          | parsed `document.cookie` (URL-decoded)              |
| `url:<param>`            | `URLSearchParams(location.search).getAll(param)`    |
| `telegram:cloud:<key>`   | `window.Telegram.WebApp.CloudStorage.getItem` (async)|
| `telegram:secure:<key>`  | `window.Telegram.WebApp.SecureStorage.getItem` (async)|

A missing value contributes nothing (same as a missing DOM input). The storage
prefixes are the direct equivalents of wiring a storage card's hidden input into
`depsNames`: `localStorage:` ↔ `DeviceStorageCard`, `sessionStorage:` ↔
`SessionStorageCard`, `telegram:cloud:` ↔ `CloudStorageCard`, `telegram:secure:`
↔ `SecureStorageCard`.

Two source families differ in timing: the Telegram Cloud/Secure stores are
callback-based, so `readAjaxKey` (sync) returns `[]` for them and only
`readAjaxKeyAsync` resolves them — which is why the submit loop awaits it. The
Telegram-only cards (`CloudStorageCard` / `SecureStorageCard`) live under the
`@swarm.ing/pieui/telegram` entry (`src/telegram/components`).

`depsNames` values are supplied by the backend `UIConfig` at runtime, so this is
data interpreted by the frontend, not a CLI surface — cross-repo CLI symmetry is
unaffected.
