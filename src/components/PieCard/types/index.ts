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
 */
export interface PieCardProps {
    /** Registered name of the card component to render. */
    card: string
    /** Card data; must include a `name` used for event routing. */
    data: PieCardData
    /** Rendered children. PieCard does not mount any UI of its own. */
    children: ReactNode
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
     * Map of method name → handler. Keys become part of the realtime event
     * names the card listens for; the handler receives the event payload.
     * Handlers are accessed via a ref so updating the map between renders
     * does not trigger re-subscription.
     */
    methods?: Record<string, (data: any) => void>
}
