/**
 * Subset of the Centrifuge `subscribed` event context relevant to message
 * recovery. Mirrors the fields centrifuge-js v5 sets on resubscribe
 * (see `SubscribedContext` in `centrifuge/build/types.d.ts`).
 */
export interface RecoveryContext {
    /** subscription is recoverable – server has history for this channel. */
    recoverable?: boolean
    /** true when this `subscribed` followed a recovery attempt (a reconnect). */
    wasRecovering?: boolean
    /** whether the recovery attempt restored the full missed stream. */
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
