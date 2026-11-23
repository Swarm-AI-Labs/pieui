'use client'

import { disconnectedCodes } from 'centrifuge'
import type { Centrifuge, DisconnectedContext } from 'centrifuge'
import type { PieConfig } from '../types'

/** `onUnauthorized` is asked at most this often, so a refusal cannot loop. */
export const UNAUTHORIZED_RETRY_EVERY_MS = 30_000

/**
 * Brings a Centrifuge client back from the stop a refused token leaves.
 *
 * `getToken` (util/centrifuge) turns a 401/403 from `gen_token` into
 * `UnauthorizedError`, and centrifuge-js then stays `disconnected` with no
 * attempts left: the session behind the token is gone, and retrying with it is
 * pointless. Only the app can get a new one, so it is asked via
 * `PieConfig.onUnauthorized`:
 *
 * - `true` → the session is live again: the client is connected again and asks
 *   for a fresh token;
 * - `false`, a throw, or no callback → the client stays stopped, as before, and
 *   `onGiveUp` lets the provider report the link lost with this reason.
 *
 * The callback runs at most once per {@link UNAUTHORIZED_RETRY_EVERY_MS}: a
 * refusal that comes sooner (the refreshed session was refused again) waits
 * for the rest of the window and is asked about then.
 *
 * @param client         The shared Centrifuge client.
 * @param onUnauthorized Read on each refusal, so the latest PieConfig callback
 *                       is used.
 * @param onGiveUp       Called with the `disconnected` context when the client
 *                       stays stopped.
 * @returns Detaches the listener and cancels a pending ask.
 */
export function recoverFromUnauthorized(
    client: Centrifuge,
    onUnauthorized: () => PieConfig['onUnauthorized'],
    onGiveUp: (ctx: DisconnectedContext) => void
): () => void {
    let askedAt = Number.NEGATIVE_INFINITY
    let timer: ReturnType<typeof setTimeout> | undefined
    let asking = false
    let detached = false

    const ask = async (ctx: DisconnectedContext) => {
        timer = undefined
        const callback = onUnauthorized()
        if (!callback) {
            onGiveUp(ctx)
            return
        }
        asking = true
        askedAt = Date.now()
        let renewed = false
        try {
            renewed = (await callback('centrifuge')) === true
        } catch (err) {
            console.warn('PieConfig.onUnauthorized failed:', err)
        }
        asking = false
        if (detached) return
        if (renewed) client.connect()
        else onGiveUp(ctx)
    }

    const onDisconnected = (ctx: DisconnectedContext) => {
        if (ctx.code !== disconnectedCodes.unauthorized) return
        if (asking || timer !== undefined) return
        const wait = askedAt + UNAUTHORIZED_RETRY_EVERY_MS - Date.now()
        if (wait <= 0) void ask(ctx)
        else timer = setTimeout(() => void ask(ctx), wait)
    }

    client.on('disconnected', onDisconnected)
    return () => {
        detached = true
        clearTimeout(timer)
        client.off('disconnected', onDisconnected)
    }
}
