# PieUI Native — Platform Abstraction Seam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every browser-API access in the AJAX/form layer (`window`, `document`, storage, cookies, URL params, the global form) through a single `ClientSources` platform module, so React Native can later supply its own implementation — with zero change to existing web behavior.

**Architecture:** Introduce `src/platform/` exposing a `ClientSources` interface, a default web implementation (`clientSources.ts`, used by the existing bun/browser builds and bun tests), and a React Native stub (`clientSources.native.ts`, which Metro auto-resolves on native via the `.native.ts` extension). `ajaxCommonUtils.ts` and `globalForm.ts` stop touching `window`/`document` directly and call the platform module instead. This is a pure, behavior-preserving refactor: the web implementation is the current code moved verbatim, and the existing test suite is the regression gate.

**Tech Stack:** TypeScript, React 19, `bun:test` (preloaded DOM shim at `src/tests/setup.ts`), bun build (`--target browser`/`--target node`).

## Global Constraints

- Peer deps: `react >=19`, `react-dom >=19` (copied verbatim from `package.json`). Do not add new runtime dependencies in this plan — the native impl is a stub, not a real RN integration.
- Every file that runs client-side keeps its `'use client'` first-line directive (the build's `build:banner` step and existing files rely on it).
- Tests run with `bun test`; the DOM shim is preloaded via `bunfig.toml` `[test] preload = ["./src/tests/setup.ts"]`. New tests live in `src/tests/` and import from `../platform/...` or `../util/...`.
- This is an internal frontend refactor with no CLI surface change (no edits to `src/cli.ts`, `src/code/args.ts`, `src/code/types.ts`, or `src/code/commands/**`). Cross-repo CLI symmetry with `../pie` is therefore unaffected — do not touch the pie repo.
- Web behavior must be byte-identical. The factory's existing console warnings (gated on `renderingLogEnabled`) and their exact trigger conditions must be preserved. Logging/warning logic stays in `ajaxCommonUtils.ts`; platform methods are pure data accessors with no logging.

---

### Task 1: Platform interface + web implementation + native stub

Create the `ClientSources` seam: a shared interface, the web implementation (current DOM code moved verbatim), and a native stub that throws until a later plan fleshes it out.

**Files:**
- Create: `src/platform/types.ts`
- Create: `src/platform/clientSources.ts` (web/default implementation)
- Create: `src/platform/clientSources.native.ts` (React Native stub)
- Test: `src/tests/clientSources.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `interface ClientSources` with methods:
    - `isClient(): boolean`
    - `readSid(): string | undefined`
    - `readWebStorage(kind: 'local' | 'session', key: string): string | null` (may throw; caller handles)
    - `readCookie(name: string): string | null`
    - `readUrlParams(key: string): string[]`
    - `readDomInput(name: string): Array<string | File> | null` (`null` ⇒ no element with that name found)
    - `submitGlobalForm(): void`
  - `class PlatformNotImplementedError extends Error`
  - default export `clientSources: ClientSources` from both `clientSources.ts` and `clientSources.native.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/tests/clientSources.test.ts
import { describe, test, expect, mock, afterEach } from 'bun:test'
import clientSources from '../platform/clientSources'

const w = globalThis as any

describe('clientSources (web) — storage', () => {
    afterEach(() => {
        delete w.localStorage
        delete w.sessionStorage
    })

    test('readWebStorage reads local storage by key', () => {
        w.localStorage = { getItem: (k: string) => (k === 'token' ? 'abc' : null) }
        expect(clientSources.readWebStorage('local', 'token')).toBe('abc')
    })

    test('readWebStorage returns null for a missing session key', () => {
        w.sessionStorage = { getItem: () => null }
        expect(clientSources.readWebStorage('session', 'nope')).toBeNull()
    })
})

describe('clientSources (web) — cookie', () => {
    afterEach(() => {
        if (w.document) delete w.document.cookie
    })

    test('readCookie reads and URL-decodes a value', () => {
        w.document.cookie = 'a=1; sid=hello%20world; b=2'
        expect(clientSources.readCookie('sid')).toBe('hello world')
    })

    test('readCookie returns null when absent', () => {
        w.document.cookie = 'a=1'
        expect(clientSources.readCookie('missing')).toBeNull()
    })
})

describe('clientSources (web) — url params', () => {
    afterEach(() => {
        if (w.location) delete w.location.search
    })

    test('readUrlParams returns repeated params', () => {
        w.location = { search: '?ref=one&ref=two&x=3' }
        expect(clientSources.readUrlParams('ref')).toEqual(['one', 'two'])
    })
})

describe('clientSources (web) — sid', () => {
    afterEach(() => {
        delete w.sid
    })

    test('readSid returns window.sid', () => {
        w.sid = 'session-123'
        expect(clientSources.readSid()).toBe('session-123')
    })

    test('readSid returns undefined when unset', () => {
        delete w.sid
        expect(clientSources.readSid()).toBeUndefined()
    })
})

describe('clientSources (web) — dom input', () => {
    afterEach(() => {
        if (w.document) delete w.document.getElementsByName
    })

    test('readDomInput returns null when no element is found', () => {
        w.document.getElementsByName = () => []
        expect(clientSources.readDomInput('email')).toBeNull()
    })
})

describe('clientSources (web) — global form', () => {
    test('submitGlobalForm submits the mounted form', () => {
        const mockSubmit = mock(() => {})
        const form = document.createElement('form')
        form.id = 'piedata_global_form'
        form.submit = mockSubmit
        document.body.appendChild(form)

        clientSources.submitGlobalForm()
        expect(mockSubmit).toHaveBeenCalledTimes(1)

        document.body.removeChild(form)
    })

    test('submitGlobalForm does not throw when form is absent', () => {
        expect(() => clientSources.submitGlobalForm()).not.toThrow()
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/tests/clientSources.test.ts`
Expected: FAIL — `Cannot find module '../platform/clientSources'`.

- [ ] **Step 3: Write the shared interface**

```typescript
// src/platform/types.ts

/**
 * The set of client-side capabilities the AJAX/form layer depends on. The web
 * build supplies a DOM-backed implementation; React Native supplies its own.
 * Methods are pure accessors — all logging/warning lives in the callers so the
 * platform layer stays environment-agnostic.
 */
export interface ClientSources {
    /** True only when client-side APIs are usable (mirrors the SSR guard). */
    isClient(): boolean
    /** SocketIO session id, or undefined when not yet initialized. */
    readSid(): string | undefined
    /**
     * Reads a value from local/session storage. May throw (e.g. blocked in
     * private mode); the caller is responsible for catching.
     */
    readWebStorage(kind: 'local' | 'session', key: string): string | null
    /** Reads and URL-decodes a single cookie; null when absent. */
    readCookie(name: string): string | null
    /** Reads every value for a repeated URL query param. */
    readUrlParams(key: string): string[]
    /**
     * Reads DOM input(s) by name. Returns `null` when no element has that name
     * (so the caller can warn), the selected `File`s for a file input, the
     * `.value` for other inputs/textareas, or `[]` for an unsupported element.
     */
    readDomInput(name: string): Array<string | File> | null
    /** Submits the hidden global form (`#piedata_global_form`). No-op if unmounted. */
    submitGlobalForm(): void
}

/** Thrown by platform stubs for capabilities not yet implemented on a target. */
export class PlatformNotImplementedError extends Error {
    constructor(method: string) {
        super(`ClientSources.${method} is not implemented on this platform`)
        this.name = 'PlatformNotImplementedError'
    }
}
```

- [ ] **Step 4: Write the web implementation**

```typescript
// src/platform/clientSources.ts
'use client'

import '../types' // ambient `window.sid` / `window.Telegram` augmentation
import { ClientSources } from './types'

const readCookie = (name: string): string | null => {
    const cookies = document.cookie ? document.cookie.split(';') : []
    for (const cookie of cookies) {
        const eq = cookie.indexOf('=')
        const cookieName = (eq === -1 ? cookie : cookie.slice(0, eq)).trim()
        if (cookieName === name) {
            const raw = eq === -1 ? '' : cookie.slice(eq + 1).trim()
            try {
                return decodeURIComponent(raw)
            } catch {
                return raw
            }
        }
    }
    return null
}

const clientSources: ClientSources = {
    isClient() {
        return typeof window !== 'undefined' && typeof document !== 'undefined'
    },
    readSid() {
        return typeof window === 'undefined' ? undefined : window.sid
    },
    readWebStorage(kind, key) {
        const store = kind === 'local' ? window.localStorage : window.sessionStorage
        return store.getItem(key)
    },
    readCookie,
    readUrlParams(key) {
        return new URLSearchParams(window.location.search).getAll(key)
    },
    readDomInput(name) {
        const inputs = document.getElementsByName(name)
        if (!inputs.length) return null
        const input = inputs[0]
        if (input instanceof HTMLInputElement) {
            if (input.type === 'file' && input.files) {
                return Array.from(input.files)
            }
            return [input.value]
        }
        if (input instanceof HTMLTextAreaElement) {
            return [input.value]
        }
        return []
    },
    submitGlobalForm() {
        if (typeof document === 'undefined') return
        const formElement = document.getElementById(
            'piedata_global_form'
        ) as HTMLFormElement
        formElement && formElement.submit()
    },
}

export default clientSources
```

- [ ] **Step 5: Write the React Native stub**

```typescript
// src/platform/clientSources.native.ts

import { ClientSources, PlatformNotImplementedError } from './types'

/**
 * Placeholder React Native implementation. A later plan wires real native
 * sources (MMKV for sync storage, navigation params for url, an in-memory form
 * store, a sid context). Until then every accessor that has no safe default
 * throws, so an incomplete native integration fails loudly rather than silently
 * submitting empty data.
 */
const clientSources: ClientSources = {
    isClient() {
        return true
    },
    readSid() {
        return undefined
    },
    readWebStorage() {
        throw new PlatformNotImplementedError('readWebStorage')
    },
    readCookie() {
        throw new PlatformNotImplementedError('readCookie')
    },
    readUrlParams() {
        throw new PlatformNotImplementedError('readUrlParams')
    },
    readDomInput() {
        throw new PlatformNotImplementedError('readDomInput')
    },
    submitGlobalForm() {
        throw new PlatformNotImplementedError('submitGlobalForm')
    },
}

export default clientSources
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test src/tests/clientSources.test.ts`
Expected: PASS — all assertions green (the native stub is not imported by this test, so it does not execute).

- [ ] **Step 7: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/platform/types.ts src/platform/clientSources.ts src/platform/clientSources.native.ts src/tests/clientSources.test.ts
git commit -m "feat(platform): add ClientSources seam with web impl and RN stub"
```

---

### Task 2: Route `readAjaxKey`/`readCookie` through the platform

Replace direct `window`/`document` access in `ajaxCommonUtils.ts`'s synchronous read path with `clientSources` calls. Behavior — including every `renderingLogEnabled` warning and its trigger — stays identical, proven by the existing `ajaxCommonUtils.test.ts`.

**Files:**
- Modify: `src/util/ajaxCommonUtils.ts` (`readAjaxKey` body lines 123-203; delete the private `readCookie` at lines 209-224)
- Test: `src/tests/ajaxCommonUtils.test.ts` (existing — regression gate, unchanged)

**Interfaces:**
- Consumes: `clientSources` (`readSid`, `readWebStorage`, `readCookie`, `readUrlParams`, `readDomInput`) from `../platform/clientSources`.
- Produces: no signature changes — `readAjaxKey(depName, renderingLogEnabled?)` keeps its `Array<string | File>` return and `throw` on uninitialized sid.

- [ ] **Step 1: Run the existing tests to confirm the baseline passes**

Run: `bun test src/tests/ajaxCommonUtils.test.ts`
Expected: PASS (this is the unchanged regression gate; it must stay green after the refactor).

- [ ] **Step 2: Add the platform import**

At the top of `src/util/ajaxCommonUtils.ts`, below the existing imports (after line 7 `import { useMemo } from 'react'`), add:

```typescript
import clientSources from '../platform/clientSources'
```

- [ ] **Step 3: Replace the body of `readAjaxKey`**

Replace the function body (currently lines 127-202, from `const { source, key } = parseDepName(depName)` through the final `return []`) with:

```typescript
    const { source, key } = parseDepName(depName)

    if (source === 'sid') {
        const sid = clientSources.readSid()
        if (!sid) throw new Error("SocketIO isn't initialized properly")
        return [sid]
    }

    if (source === 'localStorage' || source === 'sessionStorage') {
        try {
            const value = clientSources.readWebStorage(
                source === 'localStorage' ? 'local' : 'session',
                key
            )
            if (value === null) {
                if (renderingLogEnabled) {
                    console.warn(`No ${source} value found for key ${key}`)
                }
                return []
            }
            return [value]
        } catch (err) {
            if (renderingLogEnabled) {
                console.warn(`Failed to read ${source} key ${key}:`, err)
            }
            return []
        }
    }

    if (source === 'cookie') {
        const value = clientSources.readCookie(key)
        if (value === null) {
            if (renderingLogEnabled) {
                console.warn(`No cookie found for key ${key}`)
            }
            return []
        }
        return [value]
    }

    if (source === 'url') {
        const values = clientSources.readUrlParams(key)
        if (!values.length && renderingLogEnabled) {
            console.warn(`No URL query param found for key ${key}`)
        }
        return values
    }

    if (ASYNC_DEP_SOURCES.has(source)) {
        if (renderingLogEnabled) {
            console.warn(
                `Source ${source} is async; use readAjaxKeyAsync (readAjaxKey returns [])`
            )
        }
        return []
    }

    const values = clientSources.readDomInput(key)
    if (values === null) {
        if (renderingLogEnabled) {
            console.warn(`No input found with name ${key}`)
        }
        return []
    }
    return values
```

- [ ] **Step 4: Delete the now-unused private `readCookie` helper**

Remove the entire `readCookie` function (currently lines 205-224, the JSDoc block plus `const readCookie = (name: string): string | null => { ... }`). Its logic now lives in `clientSources.readCookie`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test src/tests/ajaxCommonUtils.test.ts`
Expected: PASS — all `readAjaxKey() — client sources` and `readAjaxKeyAsync()` cases stay green (they stub `globalThis.localStorage`, `document.cookie`, `location.search`, which the web `clientSources` reads).

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: no errors (in particular, no "readCookie is declared but never used").

- [ ] **Step 7: Commit**

```bash
git add src/util/ajaxCommonUtils.ts
git commit -m "refactor(ajax): read client sources through ClientSources platform"
```

---

### Task 3: Route the global form and the SSR guard through the platform

Make `globalForm.ts` delegate to `clientSources.submitGlobalForm()`, and replace the inline `typeof window/document` SSR guard inside `getAjaxSubmit`'s returned function with `clientSources.isClient()`.

**Files:**
- Modify: `src/util/globalForm.ts` (entire `submitGlobalForm` body, lines 11-18)
- Modify: `src/util/ajaxCommonUtils.ts` (the guard at lines 351-358 inside the returned submit function)
- Test: `src/tests/globalForm.test.ts` (existing — regression gate, unchanged)

**Interfaces:**
- Consumes: `clientSources.submitGlobalForm`, `clientSources.isClient` from `../platform/clientSources`.
- Produces: `submitGlobalForm()` keeps its `() => void` signature and no-op-when-unmounted behavior.

- [ ] **Step 1: Run the existing global-form test to confirm the baseline passes**

Run: `bun test src/tests/globalForm.test.ts`
Expected: PASS (unchanged regression gate).

- [ ] **Step 2: Rewrite `globalForm.ts` to delegate**

Replace the full contents of `src/util/globalForm.ts` with:

```typescript
'use client'

import clientSources from '../platform/clientSources'

/**
 * Submits the hidden global PieUI form (`#piedata_global_form`) that is
 * rendered by every PieRoot variant. Delegates to the active platform's
 * `ClientSources` implementation, which no-ops when the form is not mounted
 * (and on the server). On React Native there is no HTML form; the native
 * implementation supplies its own submission strategy.
 */
export const submitGlobalForm = () => {
    clientSources.submitGlobalForm()
}
```

- [ ] **Step 3: Replace the SSR guard inside `getAjaxSubmit`**

In `src/util/ajaxCommonUtils.ts`, inside the returned `async (extraKwargs ...)` function, replace the guard (currently lines 351-358):

```typescript
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            if (renderingLogEnabled) {
                console.warn(
                    'getAjaxSubmit called on server, skipping DOM-dependent logic'
                )
            }
            return
        }
```

with:

```typescript
        if (!clientSources.isClient()) {
            if (renderingLogEnabled) {
                console.warn(
                    'getAjaxSubmit called on server, skipping DOM-dependent logic'
                )
            }
            return
        }
```

- [ ] **Step 4: Run the global-form test to verify it passes**

Run: `bun test src/tests/globalForm.test.ts`
Expected: PASS — `submitGlobalForm()` still submits the mounted form and is a no-op when absent (the web `clientSources.submitGlobalForm` carries the original `getElementById('piedata_global_form')` logic).

- [ ] **Step 5: Run the AJAX factory tests to verify the guard still short-circuits correctly**

Run: `bun test src/tests/ajaxCommonUtils.test.ts`
Expected: PASS — the guard-clause suites still pass; the `field names sent to the backend` test still reaches `fetch` because `clientSources.isClient()` returns true under the test DOM shim (`window` and `document` are both defined by `src/tests/setup.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/util/globalForm.ts src/util/ajaxCommonUtils.ts
git commit -m "refactor(form): submit global form and gate SSR via ClientSources"
```

---

### Task 4: Full-suite verification

Confirm the whole refactor is green across the entire test suite and typechecker — no regression anywhere in the package, and no stray direct browser-API access left in the refactored files.

**Files:**
- No source changes (verification only).

**Interfaces:**
- Consumes: everything above.
- Produces: a clean baseline for follow-up native plans.

- [ ] **Step 1: Run the entire test suite**

Run: `bun test`
Expected: PASS — all suites in `src/tests/` green, including `ajaxCommonUtils.test.ts`, `globalForm.test.ts`, `clientSources.test.ts`, `waitForSidAvailable.test.ts`.

- [ ] **Step 2: Typecheck the whole project**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 3: Confirm no direct browser-API access remains in the refactored files**

Run: `grep -nE 'document\.|window\.' src/util/ajaxCommonUtils.ts src/util/globalForm.ts`
Expected: only matches inside string literals/comments (e.g. the `'use client'`-adjacent JSDoc) — no live `document.getElementById`, `document.cookie`, `document.getElementsByName`, `window.localStorage`, `window.sessionStorage`, `window.location`, or `window.sid` reads. If any live read remains, route it through `clientSources` before proceeding.

- [ ] **Step 4: Verify the build still produces the browser bundle**

Run: `bun run build:esm`
Expected: writes `dist/index.esm.js` with no errors (confirms the new `src/platform/*` modules resolve and bundle under `--target browser`).

- [ ] **Step 5: Commit any verification-driven fixes (if Step 3 found leftovers); otherwise tag the milestone**

```bash
git commit --allow-empty -m "chore(platform): verify ClientSources seam — full suite + typecheck green"
```

---

## Completed in this branch (beyond the seam)

The follow-up slices were implemented in the same branch after the seam landed:

1. **Native `ClientSources` implementation** — ✅ `clientSources.native.ts` is a real, dependency-free implementation backed by host-injected sources via `configureNativeClientSources` (`src/platform/nativeConfig.ts`): sync `storage`/`sessionStorage` adapters (e.g. MMKV), `getRouteParams` for `url:`, `getInput` for form fields, `submitForm` for the global submit. Unconfigured sources degrade to the web "missing value" semantics (`null`/`[]`).
2. **Session id on native** — ✅ `setSid` is now part of the `ClientSources` contract (web → `window.sid`; native → module scope). `waitForSidAvailable.ts` and `SocketIOInitProvider.tsx` read/write the sid through the platform, so SocketIO sid works without a `window`.
3. **Native root + packaging** — ✅ `src/native/index.ts` (curated barrel: agnostic core + `PieNativeRoot`, **excluding** DOM container/leaf cards so `react-toastify`/`html-react-parser` never enter the native graph), `PieNativeRoot` (wraps `PieBaseRoot` with `disableGlobalForm`), `./native` subpath in `exports` (with a `react-native` condition), and `build:native:*` scripts.

### Platform-selection decision (changed from the original plan)

The seam was originally designed around Metro's `.native.ts` extension resolution. That only works when a package ships **unbundled** source — but PieUI pre-bundles each entry with bun, which collapses `clientSources.ts`/`clientSources.native.ts` into one file (bun picks the web one). So the published `dist` cannot rely on Metro `.native` resolution.

**Resolution:** a small runtime resolver (`src/platform/clientSources.ts`) selects the implementation at load time via `navigator.product === 'ReactNative'`, dispatching to `clientSources.web.ts` or `clientSources.native.ts`. Both are dependency-free of each other and of native modules, so bundling both into either entry is harmless — only the selected one executes. Each impl remains independently unit-testable by importing its file directly.

### Verified with /tmp consumer projects

- **Web** (`/tmp/pieui-web-test`): installs the packed tgz, renders a nested server-driven `UIConfig` through `PieBaseRoot` + `UI` via `renderToStaticMarkup`. ALL PASS.
- **Native path** (`/tmp/pieui-native-logic`): sets `navigator.product = 'ReactNative'` before load; proves the resolver selects the native impl and injected sources resolve with **no** `document`/`window`. ALL PASS.
- **Real Expo app** (`/tmp/pieui-expo-test`, Expo SDK 56 / RN 0.85): `expo export --platform ios` → Metro bundles 648 modules into a 2 MB Hermes bundle; PieUI strings present in the bundle; `tsc --noEmit` against `@swarm.ing/pieui/native` exits 0.

### Completed (the two follow-ups that were "open")

4. **First-party React Native card variants** — ✅ `src/native/components/` provides RN variants registered under their canonical names, pulled in by the native barrel: `BoxCard`/`SequenceCard`/`OneOfCard` (`<div>`→`<View>`/`Pressable` + `Linking`/`NavigateContext`); `HiddenCard`/`DeviceStorageCard`/`SessionStorageCard` (write to the native form store + storage adapter instead of a hidden `<input>`); `IOEventsCard` (`Alert`/`Linking` instead of `react-toastify`); `HTMLEmbedCard` (stripped `<Text>` instead of `html-react-parser`, no WebRTC/AI); `AutoRedirectCard` (`Linking`/`NavigateContext`). `UnionCard`/`AjaxGroupCard` are already agnostic and reused as-is. `react-native` is an **optional peer** (+ dev for types). The CLI `list-events` scanner excludes `src/native/**` so RN variants don't double-count the canonical event contract. Verified: all 11 register at runtime and bundle in a real Expo dev + production (Hermes) build.
5. **Async storage** — ✅ `ClientSources` gained optional `readWebStorageAsync`; `readAjaxKeyAsync` prefers it for `localStorage:`/`sessionStorage:` deps (falls back to the sync adapter, and to sync `readAjaxKey` on web), so `@react-native-async-storage/async-storage` works. `NativeStorageAdapter` also gained optional `setItem`/`removeItem` for the storage cards; `nativeFormStore` backs the hidden/storage cards by field name.

### Still open (genuinely later)

- **`prefetchLazyComponents()`** — left as-is; its `typeof window === 'undefined'` guard makes it an effective no-op on bare native. Revisit if a native runtime defines a partial `window`.
- **Gotcha for consumers** — when relinking a locally-packed tgz, bump/rename it or clear the lockfile + bun cache; a pinned integrity will serve a stale native bundle (cost us a debugging cycle).
