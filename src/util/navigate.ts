'use client'

import { createContext } from 'react'

/**
 * Signature of the navigation callback supplied to a PieRoot via its
 * `onNavigate` prop. Implementations typically forward the url to the host
 * router (Next.js, React Router, Telegram Mini App navigation, …).
 */
export type NavigateFunction = (_: string) => void

/**
 * React context that exposes the host application's navigation function to
 * any PieUI component that needs to change routes (e.g. `AutoRedirectCard`,
 * anchor components). `undefined` means no handler was provided — consumers
 * should fall back to a native `window.location` assignment in that case.
 */
const NavigateContext = createContext<NavigateFunction | undefined>(undefined)

export default NavigateContext
