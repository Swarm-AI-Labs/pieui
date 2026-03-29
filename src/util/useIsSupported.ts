'use client'

import { useEffect, useState } from 'react'

export function useIsSupported(
    apiServer: string,
    name: string
): boolean | null {
    const [isSupported, setIsSupported] = useState<boolean | null>(null)
    const [supportIsRequested, setSupportIsRequested] = useState(false)
    useEffect(() => {
        if (!supportIsRequested) {
            setSupportIsRequested(true)
            fetch(apiServer + `api/support/${name}`, { method: 'GET' })
                .then((res) => res.json())
                .then((res) => {
                    setIsSupported(res)
                })
        }
    }, [])
    return isSupported
}
