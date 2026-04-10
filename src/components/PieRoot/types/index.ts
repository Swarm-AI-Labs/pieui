import { ReactNode } from 'react'
import { PieConfig, UIConfigType } from '../../../types'
import { UseQueryOptions } from '@tanstack/react-query'
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
    /** Invoked when the UI configuration request throws. */
    onError?: () => void
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
}
