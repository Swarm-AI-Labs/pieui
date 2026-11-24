'use client'

import { useEffect, useState } from 'react'

/**
 * What the backend said about a feature: `true`/`false` once answered, `null`
 * while the first request is out, `'stalled'` while it is being asked again
 * after a refused or unanswered request.
 */
export type SupportStatus = boolean | null | 'stalled'

/**
 * Pauses between tries of a support request that got no answer (network
 * error, non-2xx, a body that is not JSON): quick at first, then every 30 s
 * until the backend answers.
 */
export const SUPPORT_RETRY_DELAYS_MS = [3_000, 5_000, 10_000, 20_000, 30_000]

interface Stall {
    stalled: boolean
    listeners: Set<() => void>
}

interface Inflight {
    promise: Promise<boolean>
    stall: Stall
}

// Module-level cache: results live for the whole session, so the same
// feature is never re-fetched.
const resultCache = new Map<string, boolean>()
const inflightCache = new Map<string, Inflight>()

async function askUntilAnswered(url: string, stall: Stall): Promise<boolean> {
    for (let attempt = 0; ; attempt += 1) {
        try {
            const res = await fetch(url, { method: 'GET' })
            if (res.ok) return (await res.json()) as boolean
        } catch {
            // Not answered (backend down mid-deploy, CORS-less 404 page):
            // asked again below.
        }
        if (!stall.stalled) {
            stall.stalled = true
            stall.listeners.forEach((listener) => listener())
        }
        const pause =
            SUPPORT_RETRY_DELAYS_MS[
                Math.min(attempt, SUPPORT_RETRY_DELAYS_MS.length - 1)
            ]
        await new Promise((resolve) => setTimeout(resolve, pause))
    }
}

/**
 * React hook that asks the PieUI backend whether a named feature/component is
 * supported for the current user (`GET {apiServer}api/support/{name}`).
 *
 * The hook maintains two module-level caches:
 * - `resultCache` stores resolved answers for the rest of the session, so
 *   only the first caller actually hits the network;
 * - `inflightCache` deduplicates concurrent requests for the same
 *   `(apiServer, name)` pair, so multiple components mounting in the same
 *   tick share one fetch.
 *
 * A request that gets no answer is not final: a page opened while the backend
 * is down (a deploy) would otherwise never start its realtime transports. It
 * is sent again with {@link SUPPORT_RETRY_DELAYS_MS} pauses until the backend
 * answers, and the hook reports `'stalled'` meanwhile, so the realtime
 * providers can tell the app that the link is down.
 *
 * @param apiServer Base URL of the PieUI API server. Empty → nothing is asked.
 * @param name      Feature/component identifier passed as `api/support/{name}`.
 * @returns The {@link SupportStatus}.
 */
export function useIsSupported(apiServer: string, name: string): SupportStatus {
    const key = `${apiServer}::${name}`
    const cached = apiServer ? resultCache.get(key) : undefined
    const [status, setStatus] = useState<SupportStatus>(cached ?? null)

    useEffect(() => {
        if (!apiServer) return

        // Уже есть готовый результат — сразу ставим, fetch не нужен.
        if (resultCache.has(key)) {
            setStatus(resultCache.get(key)!)
            return
        }

        let entry = inflightCache.get(key)
        if (!entry) {
            const stall: Stall = { stalled: false, listeners: new Set() }
            const promise = askUntilAnswered(
                apiServer + `api/support/${name}`,
                stall
            ).then((result) => {
                resultCache.set(key, result)
                inflightCache.delete(key)
                return result
            })
            entry = { promise, stall }
            inflightCache.set(key, entry)
        }

        let cancelled = false
        const onStall = () => {
            if (!cancelled) setStatus('stalled')
        }
        const { promise, stall } = entry
        if (stall.stalled) onStall()
        stall.listeners.add(onStall)
        promise.then((res) => {
            if (!cancelled) setStatus(res)
        })

        return () => {
            cancelled = true
            stall.listeners.delete(onStall)
        }
    }, [apiServer, name, key])

    return status
}

/** Tests only: forget every answer and drop the requests in flight. */
export function __resetSupportCacheForTest(): void {
    resultCache.clear()
    inflightCache.clear()
}
