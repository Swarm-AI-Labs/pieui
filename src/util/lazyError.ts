'use client'

import { createContext } from 'react'
import { globalSingleton } from './globalSingleton'

/**
 * Optional callback invoked when a lazy card's chunk fails to load (after the
 * boundary's own retries). Provided by a Pie*Root via its `onError` prop.
 * Hosts typically use it to recover from a stale deploy (e.g. reload the page
 * once so the fresh asset manifest is fetched). Default is `undefined` (no-op).
 */
const LazyErrorContext = globalSingleton(
    '@swarm.ing/pieui:context:lazyError',
    () => createContext<((error: unknown) => void) | undefined>(undefined)
)

export default LazyErrorContext
