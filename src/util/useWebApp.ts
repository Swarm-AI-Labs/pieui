'use client'

import { useEffect, useState } from 'react'
import { getPageProcessor } from './pieConfig'
import { InitData, InitDataUnsafe, WebApp } from '../types'

export const useWebApp = (): WebApp | null => {
    const [webApp, setWebApp] = useState<WebApp | null>(null)
    const pageProcessor = getPageProcessor()

    useEffect(() => {
        if (typeof window === 'undefined') return

        const wApp = window.Telegram.WebApp
        wApp.ready()

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
