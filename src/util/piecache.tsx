import { ReactNode } from 'react'
import { UIConfigType } from '../types'
import UILoading from '../components/UILoading'

export function resolvePieCacheFallback(
    pathname: string,
    piecache: Record<string, UIConfigType> | undefined,
    fallback: ReactNode | undefined
): ReactNode | undefined {
    if (!piecache) return fallback

    const cacheKey = pathname.replace(/^\//, '')
    const cachedConfig = piecache[cacheKey]
    if (!cachedConfig) return fallback

    return <UILoading uiConfig={cachedConfig} />
}