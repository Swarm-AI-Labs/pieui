import { ReactNode } from 'react'
import { UIConfigType } from '../types'
import UILoading from '../components/UILoading'

/**
 * Picks the appropriate "loading" view for a PieRoot based on the provided
 * `piecache`.
 *
 * If a cached `UIConfigType` exists for the current pathname (the leading
 * slash is stripped before lookup), the helper returns a `<UILoading>`
 * component rendering that cached configuration — this lets users see the
 * last known shell of a page instantly on navigation. When no cache entry
 * matches, the caller's own `fallback` node is returned instead.
 *
 * @param pathname Current route pathname (with or without a leading `/`).
 * @param piecache Optional map of `pathname → cached UIConfig`.
 * @param fallback Caller-provided fallback node used when the cache misses.
 * @returns The cached loading UI, the original fallback, or `undefined`.
 */
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
