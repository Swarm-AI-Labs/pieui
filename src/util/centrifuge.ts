'use client'

import { createContext } from 'react'
import { Centrifuge } from 'centrifuge'

const centrifugeCache = new Map<string, Centrifuge>()

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
        const res = await fetch(apiServer + 'api/centrifuge/gen_token')
        if (!res.ok) {
            if (res.status === 403) {
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
const CentrifugeIOContext = createContext<Centrifuge | null>(null)
export default CentrifugeIOContext
