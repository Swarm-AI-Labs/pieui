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
 *   not a restore; a `down` before it (the first connect's own `connecting`,
 *   or a first connect that failed) keeps the state `initial`;
 * - `up → down` emits `lost` once; a second `down` is idempotent;
 * - `down → up` emits `restored`.
 *
 * Two more events come from PieUI itself rather than from the transport:
 *
 * - `stuck`: the link will not come back by itself (the backend did not answer
 *   `api/support/*`, or refused the realtime token for good). It emits `lost`
 *   from any state, even while already down: the app learns the new reason
 *   (`detail`) and may offer a way out, such as a reload;
 * - `off`: the backend answered that the transport is turned off. Nothing is
 *   down any more, so a `lost` reported before is closed with `restored`.
 *
 * Provider code holds the {@link LinkState} in a ref and feeds each transport
 * event through {@link nextLink}, invoking the PieConfig callbacks on a
 * non-null signal.
 */
export type LinkState = 'initial' | 'up' | 'down'

export type LinkEvent = 'up' | 'down' | 'stuck' | 'off'

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
 *              (connecting/disconnected/dropped); or `'stuck'`/`'off'` (see
 *              above).
 */
export function nextLink(prev: LinkState, event: LinkEvent): LinkTransition {
    switch (event) {
        case 'up':
            return { state: 'up', signal: prev === 'down' ? 'restored' : null }
        case 'down':
            // Before the first connect there is no link to lose: Centrifuge
            // reports `connecting` on its very first `connect()`, and that
            // must not turn the first `up` into a `restored`.
            if (prev === 'initial') return { state: 'initial', signal: null }
            return { state: 'down', signal: prev === 'up' ? 'lost' : null }
        case 'stuck':
            return { state: 'down', signal: 'lost' }
        case 'off':
            return {
                state: 'initial',
                signal: prev === 'down' ? 'restored' : null,
            }
    }
}
