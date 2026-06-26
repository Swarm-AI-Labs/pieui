import { ReactNode } from 'react'

/**
 * Data object backing a single {@link PieCard}.
 *
 * The `name` field is mandatory because it is used to build realtime event
 * channel names (`pie{methodName}_{name}`). Any other fields are treated as
 * free-form props passed to the underlying card component.
 */
export interface PieCardData {
    /** Unique identifier of the card within the UI tree. */
    name: string
    /** Arbitrary, card-specific props. */
    [key: string]: any
}

/**
 * Props accepted by {@link PieCard}.
 *
 * `TStored` is the type of the `stored` prop. Defaults to `unknown` so the
 * default usage (`<PieCard …/>` without `stored`) stays loose; cards built
 * with `InputPie*ComponentProps<TData, TStored>` thread their `TStored`
 * through so `JSON.stringify(stored)` operates on a known shape.
 */
export interface PieCardProps<TStored = unknown> {
    /** Registered name of the card component to render. */
    card: string
    /** Card data; must include a `name` used for event routing. */
    data: PieCardData
    /**
     * Rendered children. PieCard does not mount any UI of its own. Optional
     * because input-only cards (`<PieCard stored={…}/>`) often have no
     * visible children — only the hidden form input.
     */
    children?: ReactNode
    /**
     * Subscribe the card's `methods` to Socket.IO events of the form
     * `pie{methodName}_{data.name}`.
     */
    useSocketioSupport?: boolean
    /**
     * Subscribe the card's `methods` to Centrifuge channels of the form
     * `pie{methodName}_{data.name}_{centrifugeChannel}`. Requires
     * {@link centrifugeChannel}.
     */
    useCentrifugeSupport?: boolean
    /**
     * Subscribe the card's `methods` to Mitt events of the form
     * `pie{methodName}_{data.name}`. Used for in-process notifications
     * dispatched via `usePieEmit`.
     */
    useMittSupport?: boolean
    /** Channel suffix appended to Centrifuge subscriptions. */
    centrifugeChannel?: string
    /**
     * When `true`, Centrifuge subscriptions are created as
     * `{ recoverable: true, positioned: true }` so the server replays
     * publications missed during a disconnect. Defaults to `false`, which
     * preserves the prior behaviour (plain subscription, no recovery).
     * Recovery additionally requires history on the server namespace — see
     * `docs/realtime-recovery.md`. Driven by the backend `UIConfig`, like the
     * other realtime flags.
     */
    centrifugeRecoverable?: boolean
    /**
     * Map of method name → handler. Keys become part of the realtime event
     * names the card listens for; the handler receives the event payload.
     * Handlers are accessed via a ref so updating the map between renders
     * does not trigger re-subscription.
     */
    methods?: Record<string, (data: any) => void>
    /**
     * When provided, renders a hidden input alongside `children` with
     * `name={data.name}` and `value={JSON.stringify(stored)}` so the value
     * can be submitted as part of a surrounding form.
     */
    stored?: TStored
    /**
     * Invoked when a Centrifuge subscription reconnects but cannot recover
     * the full stream of missed publications (the disconnect outlived the
     * server history buffer, or the channel has no history). The card should
     * respond by refetching its current state so the UI does not stay stale.
     * `reason` is `'gap'` for a failed recovery. No-op by default.
     */
    onResync?: (info: { channel: string; reason: 'gap' }) => void
}
