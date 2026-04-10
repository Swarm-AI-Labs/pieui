'use client'

import { useEffect, useState } from 'react'
import { usePageProcessor } from './pieConfig'
import { InitData, InitDataUnsafe, WebApp } from '../types'

/**
 * React hook that resolves the Telegram `WebApp` object from
 * `window.Telegram.WebApp`, calls `ready()`, and optionally expands the
 * viewport on iOS/Android when the current `pageProcessor` is
 * `'telegram_expanded'`.
 *
 * When Telegram is not present (SSR, regular browsers, embedded previews)
 * the hook silently returns `null`. Any error thrown by `ready()` is
 * swallowed and forwarded to the caller-provided `onError` callback so
 * that a failed init does not crash the tree.
 *
 * Accepts a single options object with an optional `onError` handler that
 * fires when `wApp.ready()` throws.
 *
 * @returns The Telegram WebApp instance, or `null` when unavailable.
 */
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

/**
 * Convenience hook returning the Telegram WebApp init payload as a tuple of
 * `[initDataUnsafe, initData]`. Both values are `undefined` on the server
 * and while Telegram is still initializing.
 */
export const useInitData = (): readonly [
    InitDataUnsafe | undefined,
    InitData | undefined,
] => {
    const webApp = useWebApp()

    return [webApp?.initDataUnsafe, webApp?.initData] as const
}
