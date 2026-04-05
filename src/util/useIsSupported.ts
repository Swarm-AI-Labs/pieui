'use client'

import { useEffect, useState } from 'react'

// Модульный кэш: один inflight-запрос на ключ, результаты живут всю сессию.
const supportCache = new Map<string, Promise<boolean>>()

export function useIsSupported(
    apiServer: string,
    name: string
): boolean | null {
    const [isSupported, setIsSupported] = useState<boolean | null>(null)

    useEffect(() => {
        if (!apiServer) return

        const key = `${apiServer}::${name}`
        let promise = supportCache.get(key)
        if (!promise) {
            promise = fetch(apiServer + `api/support/${name}`, {
                method: 'GET',
            })
                .then((res) => res.json() as Promise<boolean>)
                .catch((err) => {
                    // При ошибке очищаем кэш, чтобы следующий маунт попробовал снова.
                    supportCache.delete(key)
                    throw err
                })
            supportCache.set(key, promise)
        }

        let cancelled = false
        promise
            .then((res) => {
                if (!cancelled) setIsSupported(res)
            })
            .catch(() => {
                /* ignore, уже обработано выше */
            })

        return () => {
            cancelled = true
        }
    }, [apiServer, name])

    return isSupported
}