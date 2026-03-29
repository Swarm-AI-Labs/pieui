import { useEffect, useState } from 'react'
import { MaxWebApp, MaxWebAppData } from '../types'

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

export const useMaxInitData = (): readonly [
    MaxWebAppData | undefined,
    string | undefined,
] => {
    const webApp = useMaxWebApp()

    return [webApp?.initDataUnsafe, webApp?.initData] as const
}

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

export const useMaxHapticFeedback = (): MaxWebApp['HapticFeedback'] | null => {
    const webApp = useMaxWebApp()
    return webApp?.HapticFeedback ?? null
}