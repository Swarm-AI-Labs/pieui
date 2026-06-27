/**
 * Pure state machine that turns raw realtime-transport transitions
 * (`up`/`down`) into user-facing link signals (`lost`/`restored`).
 *
 * Both Centrifuge and Socket.IO emit a transition on their very first
 * connect, which is *not* a recovery, and may emit repeated transitions in
 * the same direction (e.g. Centrifuge `connecting` then `disconnected`). This
 * reducer collapses that noise:
 *
 * - the first `up` (from `initial`) emits nothing — it is the initial connect,
 *   not a restore;
 * - `up → down` emits `lost` once; a second `down` is idempotent;
 * - `down → up` emits `restored`.
 *
 * Provider code holds the {@link LinkState} in a ref and feeds each transport
 * event through {@link nextLink}, invoking the PieConfig callbacks on a
 * non-null signal.
 */
export type LinkState = 'initial' | 'up' | 'down'

export type LinkSignal = 'lost' | 'restored' | null

export interface LinkTransition {
    state: LinkState
    signal: LinkSignal
}

/**
 * Compute the next {@link LinkState} and the signal (if any) to emit.
 *
 * @param prev  Previous link state (`'initial'` before the first event).
 * @param event Raw transport transition: `'up'` (connected) or `'down'`
 *              (connecting/disconnected/dropped).
 */
export function nextLink(prev: LinkState, event: 'up' | 'down'): LinkTransition {
    if (event === 'up') {
        return { state: 'up', signal: prev === 'down' ? 'restored' : null }
    }
    return { state: 'down', signal: prev === 'up' ? 'lost' : null }
}
