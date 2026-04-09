'use client'

import { useEffect, useState } from 'react'

// Модульный кэш: результаты живут всю сессию, повторный fetch не делается.
const resultCache = new Map<string, boolean>()
const inflightCache = new Map<string, Promise<boolean>>()

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
