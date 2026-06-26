# Realtime message recovery

PieUI uses Centrifuge for server→client card updates. To guarantee no event
loss across a flaky connection there are two layers.

## 1. Exact replay (server history)

Recovery is **opt-in per card**, driven by the backend `UIConfig`: set
`centrifugeRecoverable` on the `PieCard` and its subscriptions are created with
`{ recoverable: true, positioned: true }`, so on reconnect the client asks the
server to replay the publications it missed. centrifuge-js delivers those
recovered publications, in order, through the normal `publication` handler — no
per-message client code is needed. When the flag is absent (default) PieCard
keeps its prior plain-subscription behaviour.

This only works if the Centrifugo namespace serving `pie*` channels **retains
history**. Required server namespace config:

```json
{
  "namespaces": [
    { "name": "pie", "history_size": 100, "history_ttl": "300s", "force_recovery": true }
  ]
}
```

Size the buffer (`history_size` / `history_ttl`) for your worst expected
disconnect. If a channel reports `recoverable: false` at runtime, `PieCard`
logs a warning — that means this config is missing and exact replay will not
happen.

## 2. Resync fallback (client)

When a reconnect cannot recover the full stream — the disconnect outlived
`history_ttl`/`history_size`, or no history is configured — `PieCard` calls the
card's `onResync({ channel, reason: 'gap' })` so it can refetch current state:

```tsx
<PieCard
    data={data}
    useCentrifugeSupport
    centrifugeChannel={channel}
    centrifugeRecoverable
    methods={methods}
    onResync={() => refetchCardState()}
/>
```

Always supply `onResync` on cards whose freshness matters, even when history is
configured — it is the safety net for gaps larger than the buffer.

## How it's detected

`src/util/centrifugeRecovery.ts` exposes the two pure predicates `PieCard` uses
on the `subscribed` event:

- `isUnrecoverableChannel(ctx)` → `recoverable === false` (warn: no server history).
- `shouldResync(ctx)` → `wasRecovering === true && recovered === false` (gap → resync).
