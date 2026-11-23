# Realtime message recovery

PieUI uses Centrifuge for server→client card updates. To guarantee no event
loss across a flaky connection there are two layers.

## 1. Exact replay (server history)

`PieCard` creates each Centrifuge subscription with `{ recoverable: true,
positioned: true }`, so on reconnect the client asks the server to replay the
publications it missed. centrifuge-js delivers those recovered publications, in
order, through the normal `publication` handler — no per-message client code is
needed.

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

## Link signals: `onLinkLost` / `onLinkRestored` / `onUnauthorized`

The realtime Init providers report the state of the link through `PieConfig`:

```tsx
<PieRoot
    config={{
        apiServer,
        centrifugeServer,
        onLinkLost: (source, detail) => showOfflineBanner(detail),
        onLinkRestored: () => hideOfflineBanner(),
        // The realtime token was refused (gen_token → 401/403): renew the
        // session and say whether it worked.
        onUnauthorized: async () => (await refreshSession()).ok,
    }}
/>
```

- **Drop.** The transport left the connected state → `onLinkLost(source,
  transportContext)`; it reconnects by itself → `onLinkRestored(source)`.
  Neither fires on the initial connect.
- **Backend down at page load.** `api/support/{centrifuge|socketIO}` got no
  answer (network error, non-2xx, not JSON). It is asked again after 3, 5,
  10, 20 s and then every 30 s until it answers, and meanwhile
  `onLinkLost(source, { reason: 'support' })` reports the link down. Answered
  `true` → the transport connects, and its first `connected` fires
  `onLinkRestored`. Answered `false` → the transport is off on this backend,
  and `onLinkRestored` closes the loss.
- **Token refused.** `gen_token` answered 401/403, so centrifuge-js stops for
  good (`disconnected`, code 1, reason `unauthorized`). PieUI asks
  `onUnauthorized('centrifuge')`, at most once per 30 s: `true` → the client
  connects again with a fresh token; `false`, a throw or no callback → it stays
  stopped and `onLinkLost('centrifuge', { code: 1, reason: 'unauthorized' })`
  fires (even while already lost), so the app can offer a reload or a sign-in.

Track the signals per `source` if you use more than one transport.
