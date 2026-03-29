'use client'

import { createContext } from 'react'
import { Centrifuge } from 'centrifuge'

const centrifugeCache = new Map<string, Centrifuge>()

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

const CentrifugeIOContext = createContext<Centrifuge | null>(null)
export default CentrifugeIOContext
