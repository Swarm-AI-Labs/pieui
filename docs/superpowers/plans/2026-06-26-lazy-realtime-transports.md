# Lazy Real-time Transports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `socket.io-client` and `centrifuge` out of the host app's initial bundle by loading them via dynamic `import()` only when a configured server is present, and defer establishing the WebSocket connections until after first paint.

**Architecture:** Today `getSocket`/`getCentrifuge` are synchronous and statically import their libraries, so both clients are in the static module graph of every PieRoot. We convert both getters to async dynamic imports, introduce one shared `useTransports` hook that resolves them into React state (null while loading — the contexts already accept `null`), and swap all five roots onto it. Connection establishment already lives in the Init providers' effects; we additionally schedule `connect()` on idle so it never competes with the critical first render.

**Tech Stack:** React 19, TypeScript, `@tanstack/react-query`, `socket.io-client`, `centrifuge`, `bun test`, `bun build`.

## Global Constraints

- React/React-DOM peer floor: `>=19` (do not use APIs below this floor) — copied from `package.json` peerDependencies.
- Library build externalizes deps (`--packages=external`); the win is realized in the **host** bundler's chunk splitting, not in pieui's own dist. Do not add `socket.io-client`/`centrifuge` to any static top-level import after this change.
- Run the full suite with `bun test`; type-check with `tsc --noEmit` (`bun run typecheck`).
- `getSocket`/`getCentrifuge` are internal utils (consumed only inside `src/` and tests) — changing them to async is an allowed internal breaking change; no public API surface or CLI symmetry is affected.

---

### Task 1: Make `getSocket` load `socket.io-client` lazily

**Files:**
- Modify: `src/util/socket.ts`
- Test: `src/tests/socket-cache.test.ts`

**Interfaces:**
- Produces: `getSocket(apiServer: string): Promise<Socket>` — async; still returns the same cached instance for the same `apiServer`. The default export `SocketIOContext` (a `React.Context<Socket | null>`) is unchanged.

- [ ] **Step 1: Update the existing test to the async contract**

Replace the first two tests in `src/tests/socket-cache.test.ts` with:

```ts
test('getSocket returns same instance for same URL', async () => {
    const a = await getSocket('http://test-cache-1:3000')
    const b = await getSocket('http://test-cache-1:3000')
    expect(a).toBe(b)
})

test('getSocket returns different instances for different URLs', async () => {
    const a = await getSocket('http://test-cache-2:3000')
    const b = await getSocket('http://test-cache-3:4000')
    expect(a).not.toBe(b)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/tests/socket-cache.test.ts`
Expected: FAIL — `getSocket(...)` currently returns a `Socket`, so `await` yields the socket and `a.then`/promise-identity expectations differ; with the sync impl `a` and `b` are sockets but the test now awaits a non-thenable. Confirm red before continuing.

- [ ] **Step 3: Convert `getSocket` to a dynamic import**

In `src/util/socket.ts` replace the static import and getter:

```ts
'use client'

import { createContext } from 'react'
import type { Socket } from 'socket.io-client'
import { globalSingleton } from './globalSingleton'

const socketCache = globalSingleton(
    '@swarm.ing/pieui:socket-cache',
    () => new Map<string, Socket>()
)

/**
 * Returns a cached Socket.IO client for the given PieUI API server, creating
 * one on first access. The `socket.io-client` module is loaded via a dynamic
 * `import()` so it is split into its own chunk by the host bundler and never
 * lands in the initial bundle of pages that do not use it.
 *
 * Configured with `autoConnect: false`; the `SocketIOInitProvider` connects
 * after the handshake. Only the `websocket` transport is enabled.
 */
export const getSocket = async (apiServer: string): Promise<Socket> => {
    const existing = socketCache.get(apiServer)
    if (existing) return existing

    const { io } = await import('socket.io-client')
    // Re-check after the await: a concurrent caller may have created it.
    const raced = socketCache.get(apiServer)
    if (raced) return raced

    const socket = io(apiServer, {
        autoConnect: false,
        transports: ['websocket'],
    })
    socketCache.set(apiServer, socket)
    return socket
}

const SocketIOContext = globalSingleton(
    '@swarm.ing/pieui:context:socket',
    () => createContext<Socket | null>(null)
)

export default SocketIOContext
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/tests/socket-cache.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/util/socket.ts src/tests/socket-cache.test.ts
git commit -m "perf(socket): load socket.io-client via dynamic import"
```

---

### Task 2: Make `getCentrifuge` load `centrifuge` lazily

**Files:**
- Modify: `src/util/centrifuge.ts`
- Test: `src/tests/socket-cache.test.ts`

**Interfaces:**
- Produces: `getCentrifuge(apiServer: string, centrifugeServer?: string): Promise<Centrifuge | null>` — async; returns `null` (resolved) when no `centrifugeServer`; same cached instance for the same pair otherwise.

- [ ] **Step 1: Update the existing centrifuge tests to async**

Replace the three `getCentrifuge` tests in `src/tests/socket-cache.test.ts` with:

```ts
test('getCentrifuge resolves null when no centrifugeServer', async () => {
    expect(await getCentrifuge('http://api.test')).toBeNull()
    expect(await getCentrifuge('http://api.test', undefined)).toBeNull()
})

test('getCentrifuge returns same instance for same params', async () => {
    const a = await getCentrifuge('http://api.test/', 'ws://cf.test/connection/websocket')
    const b = await getCentrifuge('http://api.test/', 'ws://cf.test/connection/websocket')
    expect(a).toBe(b)
})

test('getCentrifuge returns different instances for different params', async () => {
    const a = await getCentrifuge('http://api.test/', 'ws://cf-a.test/connection/websocket')
    const b = await getCentrifuge('http://api.test/', 'ws://cf-b.test/connection/websocket')
    expect(a).not.toBe(b)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/tests/socket-cache.test.ts`
Expected: FAIL — current `getCentrifuge` is sync, so `await getCentrifuge(...)` on the `null` case passes by luck but the instance-identity tests now await non-thenables and the `import` is still static. Confirm the new async tests are red.

- [ ] **Step 3: Convert `getCentrifuge` to a dynamic import**

In `src/util/centrifuge.ts` change the static import to `import type` and the getter to async. Keep the `getToken`/403 logic identical:

```ts
'use client'

import { createContext } from 'react'
import type { Centrifuge as CentrifugeType } from 'centrifuge'
import { globalSingleton } from './globalSingleton'

const centrifugeCache = globalSingleton(
    '@swarm.ing/pieui:centrifuge-cache',
    () => new Map<string, CentrifugeType>()
)

export const getCentrifuge = async (
    apiServer: string,
    centrifugeServer?: string
): Promise<CentrifugeType | null> => {
    if (!centrifugeServer) return null

    const cacheKey = `${apiServer}::${centrifugeServer}`
    const existing = centrifugeCache.get(cacheKey)
    if (existing) return existing

    const { Centrifuge } = await import('centrifuge')

    const raced = centrifugeCache.get(cacheKey)
    if (raced) return raced

    async function getToken() {
        const res = await fetch(apiServer + 'api/centrifuge/gen_token', {
            credentials: 'include',
        })
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                throw new Centrifuge.UnauthorizedError('Backend is not answering')
            }
            throw new Error(`Unexpected status code ${res.status}`)
        }
        const data = await res.json()
        return data.token
    }

    const instance = new Centrifuge(centrifugeServer, { getToken })
    centrifugeCache.set(cacheKey, instance)
    return instance
}

const CentrifugeIOContext = globalSingleton(
    '@swarm.ing/pieui:context:centrifuge',
    () => createContext<CentrifugeType | null>(null)
)
export default CentrifugeIOContext
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/tests/socket-cache.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/util/centrifuge.ts src/tests/socket-cache.test.ts
git commit -m "perf(centrifuge): load centrifuge via dynamic import"
```

---

### Task 3: Add a shared `useTransports` hook that resolves the lazy getters

**Files:**
- Create: `src/util/useTransports.ts`
- Test: `src/tests/useTransports.test.ts`

**Interfaces:**
- Consumes: `getSocket` (Task 1), `getCentrifuge` (Task 2).
- Produces: `useTransports(apiServer: string | undefined, centrifugeServer: string | undefined): { socket: Socket | null; centrifuge: Centrifuge | null }` — both start `null` and populate after the dynamic imports resolve; stable across re-renders for the same args.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'bun:test'
import { renderHook, waitFor } from '@testing-library/react'
import { useTransports } from '../util/useTransports'

describe('useTransports', () => {
    test('returns null transports when apiServer is undefined', () => {
        const { result } = renderHook(() => useTransports(undefined, undefined))
        expect(result.current.socket).toBeNull()
        expect(result.current.centrifuge).toBeNull()
    })

    test('resolves a socket once apiServer is provided', async () => {
        const { result } = renderHook(() =>
            useTransports('http://api.transports-test/', undefined)
        )
        await waitFor(() => expect(result.current.socket).not.toBeNull())
        expect(result.current.centrifuge).toBeNull()
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/tests/useTransports.test.ts`
Expected: FAIL with "Cannot find module '../util/useTransports'".

- [ ] **Step 3: Implement the hook**

```ts
'use client'

import { useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { Centrifuge } from 'centrifuge'
import { getSocket } from './socket'
import { getCentrifuge } from './centrifuge'

/**
 * Lazily resolves the Socket.IO and Centrifuge clients for the given servers.
 * Both values start `null` and update once their dynamic `import()` resolves,
 * so the heavy transport libraries stay out of the critical render path.
 */
export function useTransports(
    apiServer: string | undefined,
    centrifugeServer: string | undefined
): { socket: Socket | null; centrifuge: Centrifuge | null } {
    const [socket, setSocket] = useState<Socket | null>(null)
    const [centrifuge, setCentrifuge] = useState<Centrifuge | null>(null)

    useEffect(() => {
        let active = true
        if (!apiServer) {
            setSocket(null)
            return
        }
        getSocket(apiServer).then((s) => {
            if (active) setSocket(s)
        })
        return () => {
            active = false
        }
    }, [apiServer])

    useEffect(() => {
        let active = true
        if (!apiServer || !centrifugeServer) {
            setCentrifuge(null)
            return
        }
        getCentrifuge(apiServer, centrifugeServer).then((c) => {
            if (active) setCentrifuge(c)
        })
        return () => {
            active = false
        }
    }, [apiServer, centrifugeServer])

    return { socket, centrifuge }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/tests/useTransports.test.ts`
Expected: PASS. (If `@testing-library/react` is not present, add it as a dev dependency: `bun add -d @testing-library/react`, then re-run.)

- [ ] **Step 5: Commit**

```bash
git add src/util/useTransports.ts src/tests/useTransports.test.ts package.json
git commit -m "feat(transports): add useTransports hook for lazy socket/centrifuge"
```

---

### Task 4: Switch all five roots onto `useTransports`

**Files:**
- Modify: `src/components/PieRoot/index.tsx:53-61`
- Modify: `src/components/PieMaxRoot/index.tsx:53-61`
- Modify: `src/components/PieBaseRoot/index.tsx:33-40`
- Modify: `src/components/PieTelegramRoot/index.tsx:53-61`
- Test: `src/tests/socket-cache.test.ts` (already green — regression guard via `bun test`)

**Interfaces:**
- Consumes: `useTransports` (Task 3).

- [ ] **Step 1: Replace the sync getters in `PieRoot`**

In `src/components/PieRoot/index.tsx` remove the `getSocket`/`getCentrifuge` imports (lines 13-14 keep only the context default imports) and the two `useMemo` blocks (lines 54-61), and add the hook. The emitter `useMemo` (line 53) stays.

Change imports:

```ts
import SocketIOContext from '../../util/socket'
import CentrifugeIOContext from '../../util/centrifuge'
import { useTransports } from '../../util/useTransports'
```

Replace the socket/centrifuge memos with:

```ts
const emitter = useMemo(() => getEmitter(), [])
const { socket, centrifuge } = useTransports(apiServer, centrifugeServer)
```

The JSX providers already read `socket`/`centrifuge` variables (lines 160-161) — no change needed there.

- [ ] **Step 2: Repeat for the other three roots**

Apply the identical three edits (imports, delete the two memos, add the hook call) to:
- `src/components/PieMaxRoot/index.tsx`
- `src/components/PieBaseRoot/index.tsx`
- `src/components/PieTelegramRoot/index.tsx`

Each already binds `socket`/`centrifuge` into its providers, so only the resolution mechanism changes.

- [ ] **Step 3: Type-check and run the full suite**

Run: `bun run typecheck && bun test`
Expected: PASS — no type errors, all existing tests green. `getSocket`/`getCentrifuge` now have zero non-test callers (verify with `grep -rn "getSocket\|getCentrifuge" src` showing only `socket.ts`, `centrifuge.ts`, and the test file).

- [ ] **Step 4: Verify the libs left the static graph**

Run: `bun build src/components/PieRoot/index.tsx --outfile /tmp/pieroot-check.js --format esm --target browser --jsx=automatic --jsx-import-source=react --minify` (note: NO `--packages=external`, so deps inline) then `grep -c "engine.io\|socket.io" /tmp/pieroot-check.js` — expect the socket client to appear only behind a dynamic-import boundary (bun emits a separate chunk; the main file should not contain `engine.io-client` parser code inline). Document the before/after main-chunk byte size in the commit message.

- [ ] **Step 5: Commit**

```bash
git add src/components/PieRoot/index.tsx src/components/PieMaxRoot/index.tsx src/components/PieBaseRoot/index.tsx src/components/PieTelegramRoot/index.tsx
git commit -m "perf(roots): resolve transports lazily via useTransports"
```

---

### Task 5: Defer `connect()` to idle in the Init providers

**Files:**
- Modify: `src/providers/SocketIOInitProvider.tsx:24-51`
- Modify: `src/providers/CentrifugeIOInitProvider.tsx:14-38`
- Create: `src/util/onIdle.ts`
- Test: `src/tests/onIdle.test.ts`

**Interfaces:**
- Produces: `onIdle(cb: () => void): () => void` — runs `cb` via `requestIdleCallback` when available, else `setTimeout(cb, 0)`; returns a cancel function.

- [ ] **Step 1: Write the failing test for `onIdle`**

```ts
import { expect, test } from 'bun:test'
import { onIdle } from '../util/onIdle'

test('onIdle runs the callback', async () => {
    let ran = false
    onIdle(() => {
        ran = true
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(ran).toBe(true)
})

test('onIdle cancel prevents the callback', async () => {
    let ran = false
    const cancel = onIdle(() => {
        ran = true
    })
    cancel()
    await new Promise((r) => setTimeout(r, 10))
    expect(ran).toBe(false)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/tests/onIdle.test.ts`
Expected: FAIL with "Cannot find module '../util/onIdle'".

- [ ] **Step 3: Implement `onIdle`**

```ts
/**
 * Schedules `cb` to run when the browser is idle (or on the next tick in
 * environments without `requestIdleCallback`, e.g. Safari/tests). Returns a
 * cancel function. Used to keep WebSocket connection setup off the critical
 * first-paint path.
 */
export function onIdle(cb: () => void): () => void {
    const ric = (globalThis as any).requestIdleCallback as
        | ((c: () => void) => number)
        | undefined
    if (typeof ric === 'function') {
        const id = ric(cb)
        const cic = (globalThis as any).cancelIdleCallback as
            | ((id: number) => void)
            | undefined
        return () => cic?.(id)
    }
    const id = setTimeout(cb, 0)
    return () => clearTimeout(id)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/tests/onIdle.test.ts`
Expected: PASS.

- [ ] **Step 5: Wrap socket connect in `onIdle`**

In `src/providers/SocketIOInitProvider.tsx`, import `onIdle` and schedule the connect. Replace the `if (isSocketIOSupported) { ... socket.connect() }` block inside the effect so listeners attach synchronously but `connect()` defers:

```ts
import { onIdle } from '../util/onIdle'
// ...
        let cancelIdle: (() => void) | undefined
        if (isSocketIOSupported) {
            socket.on(`pieinit`, onPieInitEvent)
            socket.on('connect', onConnectEvent)
            socket.on('disconnect', onDisconnectEvent)
            cancelIdle = onIdle(() => socket.connect())
        }
        return () => {
            if (isSocketIOSupported) {
                cancelIdle?.()
                socket.off(`pieinit`, onPieInitEvent)
                socket.off('connect', onConnectEvent)
                socket.off('disconnect', onDisconnectEvent)
                socket.disconnect()
            }
        }
```

- [ ] **Step 6: Wrap centrifuge connect in `onIdle`**

In `src/providers/CentrifugeIOInitProvider.tsx`, import `onIdle` and apply the same pattern:

```ts
import { onIdle } from '../util/onIdle'
// ...
        let cancelIdle: (() => void) | undefined
        if (isCentrifugeSupported) {
            centrifuge.on('connected', onConnectEvent)
            centrifuge.on('disconnected', onDisconnectEvent)
            cancelIdle = onIdle(() => centrifuge.connect())
        }

        return () => {
            if (isCentrifugeSupported) {
                cancelIdle?.()
                centrifuge.disconnect()
            }
        }
```

- [ ] **Step 7: Type-check and run the full suite**

Run: `bun run typecheck && bun test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/util/onIdle.ts src/tests/onIdle.test.ts src/providers/SocketIOInitProvider.tsx src/providers/CentrifugeIOInitProvider.tsx
git commit -m "perf(realtime): defer socket/centrifuge connect to browser idle"
```

---

## Self-Review

**Spec coverage:**
- "Move socket.io-client/centrifuge out of the initial bundle" → Tasks 1, 2 (dynamic import + `import type`), Task 4 (remove sync callers), Task 4 Step 4 (verify).
- "Load only when a configured server is present" → Task 3 hook guards on `apiServer`/`centrifugeServer`.
- "Defer connection until after first paint" → Task 5.
- All five roots updated → Task 4 (PieRoot, PieMaxRoot, PieBaseRoot, PieTelegramRoot; note `PieStaticRoot` does not fetch/connect and is intentionally excluded — confirm it has no `getSocket` call, which the grep in Task 4 Step 3 verifies).

**Placeholder scan:** No TBD/TODO/"add error handling" — every code step shows full code.

**Type consistency:** `getSocket` → `Promise<Socket>` (Task 1) consumed as such in `useTransports` (Task 3) and roots (Task 4). `getCentrifuge` → `Promise<Centrifuge | null>` consistent across Tasks 2-4. `onIdle` signature `(cb) => () => void` consistent in Tasks 5 Steps 3/5/6.

**Risk note:** Making transports async means a one-tick window where `socket`/`centrifuge` contexts are `null`. `PieCard` already reads these as nullable (the contexts are typed `Socket | null` / `Centrifuge | null` today), so subscriptions simply attach once the value populates — verify `PieCard` guards on null before the final commit by reading `src/components/PieCard/index.tsx`.
