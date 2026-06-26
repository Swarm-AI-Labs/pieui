# Centrifuge Message Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the WebSocket connection drops and recovers, `PieCard` Centrifuge subscriptions must not silently lose events: missed publications are replayed exactly (via Centrifugo history recovery), and when recovery is impossible (no history, or gap larger than the history buffer) the card triggers a full state resync instead of staying stale.

**Architecture:** Centrifuge-js already auto-reconnects and, for channels the server marks recoverable, auto-recovers missed publications through the existing `publication` handler — so exact replay needs no per-message client code, only correct consumption. We add a `subscribed` handler that inspects the recovery outcome (`recoverable`, `wasRecovering`, `recovered`) and, on a detected gap, invokes a new `onResync` callback so the card refetches current state. The recovery-decision logic is extracted into pure, unit-testable helpers; the React wiring stays thin.

**Tech Stack:** React 19, TypeScript, `centrifuge@5.5.3`, `bun test`.

## Global Constraints

- React/React-DOM peer floor: `>=19`.
- Run the suite with `bun test`; type-check with `bun run typecheck`.
- **Hard prerequisite for exact replay (server-side):** the Centrifugo namespace serving `pie*` channels MUST have history retention and recovery enabled, e.g.:
  ```json
  { "namespaces": [ { "name": "pie", "history_size": 100, "history_ttl": "300s", "force_recovery": true } ] }
  ```
  Without this the client cannot replay missed publications — only the resync fallback (Task 2-3) applies. Task 4 documents this and the code warns at runtime when a channel reports `recoverable: false`.
- No public API is removed; `onResync` is a new **optional** prop on `PieCardProps` — backward compatible. CLI symmetry is unaffected (no CLI surface touched).

---

### Task 1: Pure recovery-decision helpers

**Files:**
- Create: `src/util/centrifugeRecovery.ts`
- Test: `src/tests/centrifugeRecovery.test.ts`

**Interfaces:**
- Produces:
  - `interface RecoveryContext { recoverable?: boolean; wasRecovering?: boolean; recovered?: boolean }`
  - `shouldResync(ctx: RecoveryContext): boolean` — `true` iff a resubscribe attempted recovery and it failed (`wasRecovering === true && recovered === false`).
  - `isUnrecoverableChannel(ctx: RecoveryContext): boolean` — `true` iff the server reports the channel as non-recoverable (`recoverable === false`), meaning exact replay is impossible.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'bun:test'
import { shouldResync, isUnrecoverableChannel } from '../util/centrifugeRecovery'

describe('shouldResync', () => {
    test('fresh subscribe (not recovering) → no resync', () => {
        expect(shouldResync({ wasRecovering: false, recovered: false })).toBe(false)
    })
    test('reconnect that recovered successfully → no resync', () => {
        expect(shouldResync({ wasRecovering: true, recovered: true })).toBe(false)
    })
    test('reconnect that failed to recover → resync', () => {
        expect(shouldResync({ wasRecovering: true, recovered: false })).toBe(true)
    })
    test('missing fields default to no resync', () => {
        expect(shouldResync({})).toBe(false)
    })
})

describe('isUnrecoverableChannel', () => {
    test('server marks channel recoverable → false', () => {
        expect(isUnrecoverableChannel({ recoverable: true })).toBe(false)
    })
    test('server marks channel non-recoverable → true', () => {
        expect(isUnrecoverableChannel({ recoverable: false })).toBe(true)
    })
    test('unknown recoverable flag → false (do not warn spuriously)', () => {
        expect(isUnrecoverableChannel({})).toBe(false)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/tests/centrifugeRecovery.test.ts`
Expected: FAIL with "Cannot find module '../util/centrifugeRecovery'".

- [ ] **Step 3: Implement the helpers**

```ts
/**
 * Subset of the Centrifuge `subscribed` event context relevant to message
 * recovery. Mirrors the fields centrifuge-js v5 sets on resubscribe.
 */
export interface RecoveryContext {
    /** Whether the server treats this channel as recoverable (has history). */
    recoverable?: boolean
    /** Whether this `subscribed` followed a recovery attempt (a reconnect). */
    wasRecovering?: boolean
    /** Whether the recovery attempt restored the full missed stream. */
    recovered?: boolean
}

/**
 * Returns true when a resubscribe tried to recover missed publications and
 * failed — i.e. there is a gap the client could not fill, so the consumer
 * must resync full state to avoid staying stale.
 */
export function shouldResync(ctx: RecoveryContext): boolean {
    return ctx.wasRecovering === true && ctx.recovered === false
}

/**
 * Returns true when the server explicitly reports the channel as
 * non-recoverable. In that case exact replay is impossible (no history
 * configured) and only the resync fallback can prevent event loss.
 */
export function isUnrecoverableChannel(ctx: RecoveryContext): boolean {
    return ctx.recoverable === false
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/tests/centrifugeRecovery.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/util/centrifugeRecovery.ts src/tests/centrifugeRecovery.test.ts
git commit -m "feat(centrifuge): add pure recovery-decision helpers"
```

---

### Task 2: Add the `onResync` prop to `PieCardProps`

**Files:**
- Modify: `src/components/PieCard/types/index.ts:61-67`

**Interfaces:**
- Produces: `PieCardProps.onResync?: (info: { channel: string; reason: 'gap' }) => void` — called when a subscription detects an unrecoverable gap after reconnect. The card uses it to refetch current state (e.g. re-run the relevant method against the server).

- [ ] **Step 1: Add the prop with documentation**

In `src/components/PieCard/types/index.ts`, after the `stored` prop (line 67, inside the interface), add:

```ts
    /**
     * Invoked when a Centrifuge subscription reconnects but cannot recover
     * the full stream of missed publications (the disconnect outlived the
     * server history buffer, or the channel has no history). The card should
     * respond by refetching its current state so the UI does not stay stale.
     * `reason` is `'gap'` for a failed recovery. No-op by default.
     */
    onResync?: (info: { channel: string; reason: 'gap' }) => void
```

- [ ] **Step 2: Type-check**

Run: `bun run typecheck`
Expected: PASS — the new optional prop does not break any existing `PieCard` usage.

- [ ] **Step 3: Commit**

```bash
git add src/components/PieCard/types/index.ts
git commit -m "feat(piecard): add onResync prop for unrecoverable gaps"
```

---

### Task 3: Wire the `subscribed` handler into the Centrifuge effect

**Files:**
- Modify: `src/components/PieCard/index.tsx` (imports near line 3-8; centrifuge effect lines 111-166)

**Interfaces:**
- Consumes: `shouldResync`, `isUnrecoverableChannel` (Task 1); `onResync` prop (Task 2).

- [ ] **Step 1: Import the helpers and destructure `onResync`**

In `src/components/PieCard/index.tsx`, add to the imports:

```ts
import { shouldResync, isUnrecoverableChannel } from '../../util/centrifugeRecovery'
```

Add `onResync` to the destructured props (alongside `stored = undefined` on line 37):

```ts
    stored = undefined,
    onResync = undefined,
```

Add a ref so the latest `onResync` is used without re-subscribing (next to `methodsRef`, line 40-41):

```ts
    const onResyncRef = useRef(onResync)
    onResyncRef.current = onResync
```

- [ ] **Step 2: Attach a `subscribed` listener per subscription**

Inside the centrifuge effect, in the `subscriptions = methodNames.map(...)` block (after the existing `subscription.on('publication', ...)` block, before `subscription.subscribe()` on line 151), add:

```ts
            subscription.on('subscribed', (ctx) => {
                if (isUnrecoverableChannel(ctx)) {
                    console.warn(
                        `[PieCard] Centrifuge channel ${channelName} is not ` +
                            `recoverable — enable history on the server namespace ` +
                            `for exact replay; relying on resync fallback only.`
                    )
                }
                if (shouldResync(ctx)) {
                    if (renderingLogEnabled) {
                        console.log(
                            `[PieCard] Centrifuge recovery gap on ${channelName}; ` +
                                `requesting resync`
                        )
                    }
                    onResyncRef.current?.({ channel: channelName, reason: 'gap' })
                }
            })
```

(The `publication` handler is unchanged: when recovery *succeeds*, centrifuge-js replays the missed publications through it in order, so exact replay needs no extra code.)

- [ ] **Step 3: Type-check and run the full suite**

Run: `bun run typecheck && bun test`
Expected: PASS — no type errors; existing PieCard behavior unchanged for the success path.

- [ ] **Step 4: Add a regression test for the effect wiring (decision boundary)**

Create `src/tests/piecardRecovery.test.ts` exercising the integration of helpers as PieCard uses them (the pure-helper composition that drives the resync call):

```ts
import { describe, expect, test } from 'bun:test'
import { shouldResync, isUnrecoverableChannel } from '../util/centrifugeRecovery'

// Mirrors the branch logic in PieCard's `subscribed` handler so a refactor
// that changes the trigger conditions is caught here.
function decide(ctx: {
    recoverable?: boolean
    wasRecovering?: boolean
    recovered?: boolean
}) {
    return {
        warn: isUnrecoverableChannel(ctx),
        resync: shouldResync(ctx),
    }
}

describe('PieCard recovery decision', () => {
    test('first subscribe on a recoverable channel: no warn, no resync', () => {
        expect(decide({ recoverable: true, wasRecovering: false })).toEqual({
            warn: false,
            resync: false,
        })
    })
    test('reconnect, recovered: no resync', () => {
        expect(
            decide({ recoverable: true, wasRecovering: true, recovered: true })
        ).toEqual({ warn: false, resync: false })
    })
    test('reconnect, gap: resync fires', () => {
        expect(
            decide({ recoverable: true, wasRecovering: true, recovered: false })
        ).toEqual({ warn: false, resync: true })
    })
    test('non-recoverable channel: warn fires', () => {
        expect(decide({ recoverable: false }).warn).toBe(true)
    })
})
```

- [ ] **Step 5: Run the new test**

Run: `bun test src/tests/piecardRecovery.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/PieCard/index.tsx src/tests/piecardRecovery.test.ts
git commit -m "feat(piecard): resync on unrecoverable centrifuge gap"
```

---

### Task 4: Document the server-side history requirement

**Files:**
- Create: `docs/realtime-recovery.md`
- Modify: `src/util/centrifuge.ts` (JSDoc on `getCentrifuge`, lines 12-28)

**Interfaces:** none (docs only).

- [ ] **Step 1: Write the recovery doc**

Create `docs/realtime-recovery.md`:

```markdown
# Realtime message recovery

PieUI uses Centrifuge for server→client card updates. To guarantee no event
loss across a flaky connection there are two layers:

1. **Exact replay (server history).** centrifuge-js automatically recovers
   missed publications on reconnect **if** the Centrifugo namespace serving
   `pie*` channels retains history. Required server namespace config:

   ```json
   {
     "namespaces": [
       { "name": "pie", "history_size": 100, "history_ttl": "300s", "force_recovery": true }
     ]
   }
   ```

   Size the buffer for your worst expected disconnect. If a channel reports
   `recoverable: false` at runtime, PieCard logs a warning — this config is
   missing and exact replay will not happen.

2. **Resync fallback (client).** When a reconnect cannot recover the full
   stream (disconnect outlived `history_ttl`/`history_size`, or no history),
   PieCard calls the card's `onResync({ channel, reason: 'gap' })` so it can
   refetch current state. Always supply `onResync` on cards whose freshness
   matters, even when history is configured — it is the safety net for gaps
   larger than the buffer.
```

- [ ] **Step 2: Cross-reference from the getCentrifuge JSDoc**

In `src/util/centrifuge.ts`, append to the `getCentrifuge` JSDoc block (before the `@param` lines):

```ts
 * Message recovery (exact replay of missed publications on reconnect)
 * requires history retention on the server namespace — see
 * `docs/realtime-recovery.md`. PieCard provides a resync fallback for gaps
 * the history buffer cannot cover.
```

- [ ] **Step 3: Commit**

```bash
git add docs/realtime-recovery.md src/util/centrifuge.ts
git commit -m "docs(realtime): document centrifuge history + resync fallback"
```

---

## Self-Review

**Spec coverage:**
- "Missed events replayed exactly" → relies on centrifuge-js auto-recovery through the unchanged `publication` handler; correctness gated on server history (Global Constraints + Task 4) and observed at runtime via `isUnrecoverableChannel` warning (Task 3 Step 2).
- "Don't stay stale when recovery is impossible" → `shouldResync` (Task 1) + `onResync` prop (Task 2) + wiring (Task 3).
- "Surface misconfiguration" → runtime warning when `recoverable === false` (Task 3) + docs (Task 4).

**Placeholder scan:** No TBD/TODO — every step shows full code/content.

**Type consistency:** `RecoveryContext` fields (`recoverable`/`wasRecovering`/`recovered`) used identically in Tasks 1 and 3. `onResync` signature `(info: { channel: string; reason: 'gap' }) => void` matches between Task 2 (declaration) and Task 3 (call site `{ channel: channelName, reason: 'gap' }`).

**Open verification before merge:** confirm centrifuge-js v5.5.3 names the field `wasRecovering` on the `subscribed` event context (read `node_modules/centrifuge/dist/centrifuge.d.ts` for the `SubscribedContext` type); if the installed typings name it differently, adjust `RecoveryContext` and the handler together. This is a typings check, not a logic change.

**Out of scope (separate plans):** Socket.IO event loss (Socket.IO has its own at-least-once semantics and no history), and update coalescing — tracked in the performance roadmap.
```

