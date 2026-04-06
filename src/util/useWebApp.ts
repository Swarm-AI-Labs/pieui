'use client'

import { useEffect, useState } from 'react'
import { usePageProcessor } from './pieConfig'
import { InitData, InitDataUnsafe, WebApp } from '../types'

export const useWebApp = ({
    onError,
}: { onError?: () => void } = {}): WebApp | null => {
    const [webApp, setWebApp] = useState<WebApp | null>(null)
    const pageProcessor = usePageProcessor()

    useEffect(() => {
        if (typeof window === 'undefined') return

        const wApp = window.Telegram?.WebApp
        if (!wApp) return

        try {
            wApp.ready?.()
        } catch (e) {
            onError?.()
        }

        if (
            pageProcessor === 'telegram_expanded' &&
            (wApp.platform === 'ios' || wApp.platform === 'android')
        ) {
            wApp.expand()
        }

        setWebApp(wApp)
    }, [])

    return webApp
}

export const useInitData = (): readonly [
    InitDataUnsafe | undefined,
    InitData | undefined,
] => {
    const webApp = useWebApp()

    return [webApp?.initDataUnsafe, webApp?.initData] as const
}
