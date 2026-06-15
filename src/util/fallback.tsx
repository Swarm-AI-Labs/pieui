'use client'

import { createContext, ReactNode } from 'react'
import { globalSingleton } from './globalSingleton'

/**
 * React context that carries the "loading / missing data" fallback node used
 * by PieUI. PieRoot variants populate it from their `fallback` prop, and
 * dynamic components (lazy-loaded cards, deferred UI regions) read from this
 * context so that every empty state in a tree shares the same visual.
 */
const FallbackContext = globalSingleton(
    '@swarm.ing/pieui:context:fallback',
    () => createContext<ReactNode>(<></>)
)

export default FallbackContext
