'use client'

import { createContext } from 'react'
import { Centrifuge } from 'centrifuge'
import { globalSingleton } from './globalSingleton'

const centrifugeCache = globalSingleton(
    '@swarm.ing/pieui:centrifuge-cache',
    () => new Map<string, Centrifuge>()
)

/**
 * Returns a cached {@link Centrifuge} client for the given API/Centrifuge
 * server pair, creating one on first access. Tokens are fetched on demand
 * from `{apiServer}api/centrifuge/gen_token`; a 403 response throws a
 * `Centrifuge.UnauthorizedError` so the client treats it as an auth failure
 * and does not retry indefinitely.
 *
 * The cache is keyed by `"${apiServer}::${centrifugeServer}"`, so repeated
 * calls with the same arguments always return the same instance — which is
 * important because `Centrifuge` holds a live WebSocket connection.
 *
 * @param apiServer        Base URL of the PieUI API server (must end with `/`).
 * @param centrifugeServer WebSocket URL of the Centrifuge server. When
 *                         omitted, the function returns `null` and the
 *                         feature is disabled.
 * @returns A shared Centrifuge instance, or `null` if no server was provided.
 */
export const getCentrifuge = (
    apiServer: string,
    centrifugeServer?: string
): Centrifuge | null => {
    if (!centrifugeServer) return null

    const cacheKey = `${apiServer}::${centrifugeServer}`
    const existing = centrifugeCache.get(cacheKey)
    if (existing) return existing

    async function getToken() {
        // credentials: 'include' is required: apiServer is a different origin
        // than the page (e.g. api.* vs web.*), so without it the browser does
        // not send the auth_token cookie and gen_token responds 401/403.
        const res = await fetch(apiServer + 'api/centrifuge/gen_token', {
            credentials: 'include',
        })
        if (!res.ok) {
            // Backend returns 401 for an absent/invalid identity (and 403 in
            // some setups); both mean "not authorized" -> surface as an auth
            // error so Centrifuge stops retrying instead of looping.
            if (res.status === 401 || res.status === 403) {
                throw new Centrifuge.UnauthorizedError(
                    'Backend is not answering'
                )
            }
            throw new Error(`Unexpected status code ${res.status}`)
        }
        const data = await res.json()
        return data.token
    }

    const instance = new Centrifuge(centrifugeServer, { getToken })
    centrifugeCache.set(cacheKey, instance)
    return instance
}

/**
 * React context that exposes the current {@link Centrifuge} client to the
 * component tree. Populated by PieRoot variants; consumers read it to create
 * subscriptions scoped to a specific `PieCard`.
 */
const CentrifugeIOContext = globalSingleton(
    '@swarm.ing/pieui:context:centrifuge',
    () => createContext<Centrifuge | null>(null)
)
export default CentrifugeIOContext
