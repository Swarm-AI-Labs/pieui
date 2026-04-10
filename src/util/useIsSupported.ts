'use client'

import { useEffect, useState } from 'react'

// Module-level cache: results live for the whole session, so the same
// feature is never re-fetched.
const resultCache = new Map<string, boolean>()
const inflightCache = new Map<string, Promise<boolean>>()

/**
 * React hook that asks the PieUI backend whether a named feature/component is
 * supported for the current user, and returns the boolean answer.
 *
 * The hook maintains two module-level caches:
 * - `resultCache` stores resolved answers for the rest of the session, so
 *   only the first caller actually hits the network;
 * - `inflightCache` deduplicates concurrent requests for the same
 *   `(apiServer, name)` pair, so multiple components mounting in the same
 *   tick share one fetch.
 *
 * While the answer is being fetched the hook returns `null`, which callers
 * can use to show a neutral/loading state.
 *
 * @param apiServer Base URL of the PieUI API server.
 * @param name      Feature/component identifier passed as `api/support/{name}`.
 * @returns `true`/`false` once known, or `null` while loading.
 */
export function useIsSupported(
    apiServer: string,
    name: string
): boolean | null {
    const key = `${apiServer}::${name}`
    const cached = apiServer ? resultCache.get(key) : undefined
    const [isSupported, setIsSupported] = useState<boolean | null>(
        cached ?? null
    )

    useEffect(() => {
        if (!apiServer) return

        // Уже есть готовый результат — сразу ставим, fetch не нужен.
        if (resultCache.has(key)) {
            setIsSupported(resultCache.get(key)!)
            return
        }

        let promise = inflightCache.get(key)
        if (!promise) {
            promise = fetch(apiServer + `api/support/${name}`, {
                method: 'GET',
            })
                .then((res) => res.json() as Promise<boolean>)
                .then((result) => {
                    resultCache.set(key, result)
                    inflightCache.delete(key)
                    return result
                })
                .catch((err) => {
                    inflightCache.delete(key)
                    throw err
                })
            inflightCache.set(key, promise)
        }

        let cancelled = false
        promise
            .then((res) => {
                if (!cancelled) setIsSupported(res)
            })
            .catch(() => {
                /* ignore */
            })

        return () => {
            cancelled = true
        }
    }, [apiServer, name, key])

    return isSupported
}
