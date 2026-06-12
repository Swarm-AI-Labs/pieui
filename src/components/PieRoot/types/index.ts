import { ReactNode } from 'react'
import { PieConfig, UIConfigType } from '../../../types'
import { QueryClient, UseQueryOptions } from '@tanstack/react-query'
import { AxiosError } from 'axios'

/**
 * Extra options merged into the internal `useQuery` call that fetches the
 * UI configuration. `queryKey`, `queryFn` and `enabled` are managed by
 * PieRoot itself and cannot be overridden.
 */
export type PieQueryOptions = Omit<
    UseQueryOptions<UIConfigType, AxiosError>,
    'queryKey' | 'queryFn' | 'enabled'
>

/**
 * Props common to every `Pie*Root` component.
 */
export interface PieRootProps {
    /**
     * Current route, typically forwarded from the host router
     * (`window.location`, Next.js `usePathname`, React Router `useLocation`,
     * etc.). Used to build the `api/content{pathname}{search}` request and
     * as part of the react-query key.
     */
    location: {
        pathname: string
        search: string
    }
    /**
     * Fallback node rendered while the UI configuration is loading or when
     * the fetch fails. Overridden per-pathname by {@link piecache}.
     */
    fallback?: ReactNode
    /**
     * Optional snapshot of known `UIConfigType`s keyed by pathname. When a
     * cache entry exists for the current route the cached shell is rendered
     * via `UILoading` instead of the plain `fallback`.
     */
    piecache?: Record<string, UIConfigType>
    /**
     * Invoked on a render-blocking error: either the UI-configuration request
     * throws, or a lazy (code-split) card's chunk fails to load after the
     * internal boundary's retries. The triggering error is passed when
     * available. Use it to recover from a stale deploy — e.g. reload the page
     * once so the fresh asset manifest is fetched. Without it, a fetch failure
     * shows the `fallback` and a permanently-failing chunk shows the card's
     * skeleton.
     */
    onError?: (error?: unknown) => void
    /**
     * Navigation handler forwarded through `NavigateContext` so PieUI
     * components can route via the host application (Next.js router,
     * React Router, Telegram navigation, …) instead of reloading the page.
     */
    onNavigate?: (url: string) => void
    /** Runtime configuration (API URLs, logging, page processor, …). */
    config: PieConfig
    /** Optional react-query overrides; see {@link PieQueryOptions}. */
    queryOptions?: PieQueryOptions
    /**
     * Optional host-supplied react-query `QueryClient`. Pass a stable
     * (module-singleton) client so the fetched UI-config cache survives a
     * remount of the root — otherwise a fresh client is created per mount and
     * every cached page config is discarded (causing a refetch/flash). When
     * omitted, a per-mount client is used (previous behaviour).
     */
    queryClient?: QueryClient
    /**
     * When `true`, the implicit `<form id="piedata_global_form">` wrapper is
     * not rendered. Use this when the host application owns its own form
     * element or when PieUI is embedded inside another form and a nested
     * `<form>` would be invalid HTML.
     */
    disableGlobalForm?: boolean
}
