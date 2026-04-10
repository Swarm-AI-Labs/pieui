'use client'

import { useEffect, useState } from 'react'
import { MaxWebApp, MaxWebAppData } from '../types'

/**
 * React hook that resolves the MAX (VK Messenger mini-app) WebApp object
 * from `window.WebApp` and calls `ready()` on first access. Returns `null`
 * on the server and when running outside of the MAX host, so callers can
 * gracefully degrade.
 */
export const useMaxWebApp = (): MaxWebApp | null => {
    const [webApp, setWebApp] = useState<MaxWebApp | null>(null)

    useEffect(() => {
        if (typeof window === 'undefined') return

        const wApp = window.WebApp
        if (!wApp) return

        wApp.ready()
        setWebApp(wApp)
    }, [])

    return webApp
}

/**
 * Convenience hook that returns `[initDataUnsafe, initData]` from the MAX
 * WebApp. Both values are `undefined` until the mini-app is ready or when
 * running outside of the MAX host.
 */
export const useMaxInitData = (): readonly [
    MaxWebAppData | undefined,
    string | undefined,
] => {
    const webApp = useMaxWebApp()

    return [webApp?.initDataUnsafe, webApp?.initData] as const
}

/**
 * Wires up the MAX native BackButton.
 *
 * When `onBack` is provided, the back button is shown and will invoke the
 * callback on press; the effect cleanly un-registers the listener and hides
 * the button on unmount or when `onBack` changes. When the WebApp is not
 * available (SSR or non-MAX host) the hook is a no-op and returns `null`.
 *
 * @param onBack Optional callback fired when the user taps the back button.
 * @returns The native `BackButton` controller, or `null` when unavailable.
 */
export const useMaxBackButton = (
    onBack?: () => void
): MaxWebApp['BackButton'] | null => {
    const webApp = useMaxWebApp()

    useEffect(() => {
        if (!webApp || !onBack) return

        webApp.BackButton.onClick(onBack)
        webApp.BackButton.show()

        return () => {
            webApp.BackButton.offClick(onBack)
            webApp.BackButton.hide()
        }
    }, [webApp, onBack])

    return webApp?.BackButton ?? null
}

/**
 * Returns the MAX `HapticFeedback` controller, or `null` when the WebApp is
 * not available. Use it to trigger vibration/impact feedback in response to
 * user interactions inside a MAX mini-app.
 */
export const useMaxHapticFeedback = (): MaxWebApp['HapticFeedback'] | null => {
    const webApp = useMaxWebApp()
    return webApp?.HapticFeedback ?? null
}
