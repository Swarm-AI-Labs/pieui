# PieCard Event Coalescing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop high-frequency realtime events (e.g. price ticks) from triggering one React render per message. When opted in, `PieCard` buffers incoming events and flushes them once per animation frame, so a burst of N events in one frame collapses into a single batched render — **without dropping any event** (all buffered payloads are delivered, in order).

**Architecture:** A pure, scheduler-injectable coalescer collects items and flushes them in one callback. `PieCard` gains an opt-in `coalesceEvents` prop (driven by the backend `UIConfig`, default `false` = current synchronous behaviour). When enabled, the Socket.IO / Centrifuge / Mitt handlers push `{ methodName, payload }` into one per-card coalescer instead of calling the handler directly; the flush replays them in arrival order, so React 18 auto-batches the resulting state updates into a single render.

**Tech Stack:** React 19, TypeScript, `bun test`.

## Global Constraints

- React/React-DOM peer floor: `>=19`.
- Run the suite with `bun test`; type-check with `bun run typecheck`.
- **No event loss:** coalescing batches rendering, it must NOT drop or merge intermediate payloads — every pushed item is delivered. (Consistency with the recovery feature, which exists to avoid losing events.)
- Opt-in only: `coalesceEvents` defaults to `false`; default `PieCard` behaviour is byte-for-byte unchanged (handlers called synchronously on each event). The backend `UIConfig` enables it per card.
- No public API removed; `coalesceEvents` is a new optional prop. CLI symmetry unaffected.

---

### Task 1: Scheduler-injectable frame coalescer

**Files:**
- Create: `src/util/eventCoalescer.ts`
- Test: `src/tests/eventCoalescer.test.ts`

**Interfaces:**
- Produces:
  - `type Scheduler = (flush: () => void) => () => void` — schedules `flush` and returns a cancel function (default: `requestAnimationFrame`, falling back to `setTimeout(…, 0)`).
  - `interface Coalescer<T> { push(item: T): void; cancel(): void }`
  - `createCoalescer<T>(deliver: (items: T[]) => void, schedule?: Scheduler): Coalescer<T>` — buffers `push`ed items; on the first push schedules a flush; the flush passes all buffered items (in push order) to `deliver` and clears the buffer. `cancel()` cancels any pending flush and drops the buffer.

- [ ] **Step 1: Write the failing test (manual scheduler)**

```ts
import { describe, expect, test } from 'bun:test'
import { createCoalescer } from '../util/eventCoalescer'

// Manual scheduler: capture the flush, fire it on demand.
function manualScheduler() {
    let pending: (() => void) | null = null
    const schedule = (flush: () => void) => {
        pending = flush
        return () => {
            pending = null
        }
    }
    const tick = () => {
        const f = pending
        pending = null
        f?.()
    }
    return { schedule, tick, get hasPending() { return pending !== null } }
}

describe('createCoalescer', () => {
    test('batches multiple pushes into one delivery, preserving order', () => {
        const s = manualScheduler()
        const batches: number[][] = []
        const c = createCoalescer<number>((items) => batches.push(items), s.schedule)
        c.push(1)
        c.push(2)
        c.push(3)
        expect(batches).toEqual([]) // nothing delivered yet
        s.tick()
        expect(batches).toEqual([[1, 2, 3]]) // one batch, in order
    })

    test('schedules again after a flush for the next burst', () => {
        const s = manualScheduler()
        const batches: number[][] = []
        const c = createCoalescer<number>((items) => batches.push(items), s.schedule)
        c.push(1)
        s.tick()
        c.push(2)
        s.tick()
        expect(batches).toEqual([[1], [2]])
    })

    test('cancel drops the pending buffer and prevents delivery', () => {
        const s = manualScheduler()
        const batches: number[][] = []
        const c = createCoalescer<number>((items) => batches.push(items), s.schedule)
        c.push(1)
        c.cancel()
        s.tick()
        expect(batches).toEqual([])
        expect(s.hasPending).toBe(false)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/tests/eventCoalescer.test.ts`
Expected: FAIL with "Cannot find module '../util/eventCoalescer'".

- [ ] **Step 3: Implement the coalescer**

```ts
export type Scheduler = (flush: () => void) => () => void

export interface Coalescer<T> {
    push(item: T): void
    cancel(): void
}

const defaultScheduler: Scheduler = (flush) => {
    const raf = (globalThis as any).requestAnimationFrame as
        | ((cb: () => void) => number)
        | undefined
    if (typeof raf === 'function') {
        const id = raf(flush)
        const caf = (globalThis as any).cancelAnimationFrame as
            | ((id: number) => void)
            | undefined
        return () => caf?.(id)
    }
    const id = setTimeout(flush, 0)
    return () => clearTimeout(id)
}

/**
 * Collects items pushed within a frame and delivers them as one ordered batch,
 * so a burst of events collapses into a single downstream call (and, when the
 * delivery calls setState, a single React render). Never drops items.
 */
export function createCoalescer<T>(
    deliver: (items: T[]) => void,
    schedule: Scheduler = defaultScheduler
): Coalescer<T> {
    let buffer: T[] = []
    let cancelScheduled: (() => void) | null = null

    const flush = () => {
        cancelScheduled = null
        if (buffer.length === 0) return
        const items = buffer
        buffer = []
        deliver(items)
    }

    return {
        push(item: T) {
            buffer.push(item)
            if (!cancelScheduled) {
                cancelScheduled = schedule(flush)
            }
        },
        cancel() {
            cancelScheduled?.()
            cancelScheduled = null
            buffer = []
        },
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/tests/eventCoalescer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/util/eventCoalescer.ts src/tests/eventCoalescer.test.ts
git commit -m "feat(events): add scheduler-injectable frame coalescer"
```

---

### Task 2: Add the `coalesceEvents` prop

**Files:**
- Modify: `src/components/PieCard/types/index.ts`

**Interfaces:**
- Produces: `PieCardProps.coalesceEvents?: boolean` — when `true`, realtime events are batched per animation frame before invoking `methods`. Default `false`.

- [ ] **Step 1: Add the prop with documentation**

In `src/components/PieCard/types/index.ts`, after the `centrifugeChannel` prop, add:

```ts
    /**
     * When `true`, realtime events (Socket.IO / Centrifuge / Mitt) are buffered
     * and delivered to `methods` in one batch per animation frame, collapsing a
     * burst of high-frequency events into a single React render. No events are
     * dropped — all payloads are delivered in arrival order. Defaults to
     * `false`, which delivers each event synchronously (prior behaviour).
     * Intended for high-frequency cards (e.g. price ticks); driven by the
     * backend `UIConfig`.
     */
    coalesceEvents?: boolean
```

- [ ] **Step 2: Type-check**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/PieCard/types/index.ts
git commit -m "feat(piecard): add coalesceEvents prop"
```

---

### Task 3: Wire coalescing into PieCard's transport handlers

**Files:**
- Modify: `src/components/PieCard/index.tsx`

**Interfaces:**
- Consumes: `createCoalescer` (Task 1); `coalesceEvents` prop (Task 2).

- [ ] **Step 1: Import the coalescer and set up a per-card dispatch**

In `src/components/PieCard/index.tsx`, add the import:

```ts
import { createCoalescer } from '../../util/eventCoalescer'
```

Destructure the new prop (next to `centrifugeChannel`):

```ts
    centrifugeChannel = undefined,
    coalesceEvents = false,
```

After `methodsRef` is set up, add a stable per-card dispatcher that either calls
the method directly or routes through a frame coalescer. Place this below the
`onResyncRef`/`methodsRef` refs:

```ts
    // Stable dispatcher: deliver an event to its method, optionally batched.
    const coalescerRef = useRef<ReturnType<
        typeof createCoalescer<{ methodName: string; payload: any }>
    > | null>(null)

    if (coalesceEvents && !coalescerRef.current) {
        coalescerRef.current = createCoalescer<{
            methodName: string
            payload: any
        }>((items) => {
            // Replayed in arrival order; React batches these state updates.
            for (const { methodName, payload } of items) {
                methodsRef.current?.[methodName]?.(payload)
            }
        })
    }

    const dispatch = (methodName: string, payload: any) => {
        if (coalesceEvents && coalescerRef.current) {
            coalescerRef.current.push({ methodName, payload })
        } else {
            methodsRef.current?.[methodName]?.(payload)
        }
    }
    const dispatchRef = useRef(dispatch)
    dispatchRef.current = dispatch

    useEffect(
        () => () => {
            coalescerRef.current?.cancel()
        },
        []
    )
```

- [ ] **Step 2: Route the Socket.IO handler through dispatch**

In the Socket.IO effect, replace:

```ts
            const handler = (payload: any) => {
                methodsRef.current?.[methodName]?.(payload)
            }
```

with:

```ts
            const handler = (payload: any) => {
                dispatchRef.current(methodName, payload)
            }
```

- [ ] **Step 3: Route the Centrifuge handler through dispatch**

In the Centrifuge effect, replace the body of the `publication` handler:

```ts
                methodsRef.current?.[methodName]?.(ctx.data)
```

with:

```ts
                dispatchRef.current(methodName, ctx.data)
```

- [ ] **Step 4: Route the Mitt handler through dispatch**

In the Mitt effect, replace inside the `listener`:

```ts
                methodsRef.current?.[methodName]?.(payload)
```

with:

```ts
                dispatchRef.current(methodName, payload)
```

- [ ] **Step 5: Type-check and run the full suite**

Run: `bun run typecheck && bun test ./src/tests/eventCoalescer.test.ts ./src/tests/centrifugeRecovery.test.ts ./src/tests/socket-cache.test.ts`
Expected: PASS (the broader suite has pre-existing, unrelated PieStorageService/`card add-story` failures — verify those are the only failures via comparison to `main`).

- [ ] **Step 6: Add a behavioural test for the dispatch decision**

Create `src/tests/piecardDispatch.test.ts` covering the two delivery modes via the coalescer directly (PieCard's dispatch is a thin wrapper around it):

```ts
import { describe, expect, test } from 'bun:test'
import { createCoalescer } from '../util/eventCoalescer'

// Mirrors PieCard's coalesced delivery: push {methodName, payload}, flush calls
// each method in order.
describe('PieCard coalesced dispatch', () => {
    test('a burst delivers every payload once, in order', () => {
        let pending: (() => void) | null = null
        const schedule = (f: () => void) => {
            pending = f
            return () => {
                pending = null
            }
        }
        const calls: Array<[string, any]> = []
        const methods: Record<string, (p: any) => void> = {
            tick: (p) => calls.push(['tick', p]),
        }
        const c = createCoalescer<{ methodName: string; payload: any }>(
            (items) => {
                for (const { methodName, payload } of items) {
                    methods[methodName]?.(payload)
                }
            },
            schedule
        )
        c.push({ methodName: 'tick', payload: 1 })
        c.push({ methodName: 'tick', payload: 2 })
        expect(calls).toEqual([]) // batched, not yet delivered
        pending?.() // flush the frame
        expect(calls).toEqual([
            ['tick', 1],
            ['tick', 2],
        ]) // all events, in order, no drops
    })
})
```

- [ ] **Step 7: Run the new test**

Run: `bun test src/tests/piecardDispatch.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/PieCard/index.tsx src/tests/piecardDispatch.test.ts
git commit -m "feat(piecard): coalesce realtime events per frame when opted in"
```

---

## Self-Review

**Spec coverage:**
- "Collapse a burst into one render" → coalescer (Task 1) + per-frame flush wired into all three transports (Task 3).
- "No event loss" → flush delivers all buffered items in order (Task 1 Step 3; tested Task 1 Step 1 + Task 3 Step 6).
- "Opt-in, default unchanged" → `coalesceEvents` default `false` (Task 2) + `dispatch` falls back to synchronous call (Task 3 Step 1).
- "Cleanup" → `coalescerRef.current?.cancel()` on unmount (Task 3 Step 1).

**Placeholder scan:** None — every step has full code.

**Type consistency:** Coalescer item type `{ methodName: string; payload: any }` identical in Task 3 Steps 1 and 6. `createCoalescer<T>(deliver, schedule?)` signature consistent across Tasks 1 and 3. `Scheduler` returns a cancel function, used by `cancel()` (Task 1) and the unmount effect (Task 3).

**Risk note:** When `coalesceEvents` is true, events are delivered on the next frame rather than synchronously. Cards that read DOM/state synchronously right after an event must tolerate a one-frame delay — acceptable for the high-frequency display cards this targets, which is why it is opt-in. The `coalesceEvents` value is read at first render to create the coalescer; toggling it at runtime is not supported (documented limitation — backend sets it once per card).

**Out of scope (separate roadmap plans):** reconnect backoff, `pie:` namespace isolation for recovery, per-channel history sizing, cross-transport dedup, Redis engine.
