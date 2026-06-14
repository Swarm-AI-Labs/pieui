'use client'

import { useMemo, type ReactNode } from 'react'

import PieRoot from '../PieRoot'
import type { PieConfig } from '../../types'

/**
 * Props for {@link PiePreviewRoot}.
 */
export interface PiePreviewRootProps {
    /**
     * Base URL of the PieUI backend (must end with `/`). Defaults to
     * `process.env.PIE_API_SERVER`. When used with `pie card show` /
     * `pieui card show`, the dev server is launched with this pointed at the
     * ephemeral preview backend.
     */
    apiServer?: string
    /** Route fetched from the backend. The preview backend serves at `/`. */
    pathname?: string
    /** Query string for the fetch / react-query key. */
    search?: string
    /** Optional Centrifuge URL (preview works without real-time). */
    centrifugeServer?: string
    /** Node shown while the card config loads or on fetch error. */
    fallback?: ReactNode
    /** Enable PieUI's verbose `[PieRoot]` console logging. */
    enableRenderingLog?: boolean
}

const DEFAULT_FALLBACK = (
    <div
        style={{
            padding: 16,
            fontFamily: 'system-ui, sans-serif',
            color: '#888',
        }}
    >
        Loading card…
    </div>
)

/**
 * Ungated, host-chrome-free root for previewing a single card.
 *
 * Wraps {@link PieRoot} (the plain web root — `pageProcessor: "web"`, no
 * Telegram/MAX host integration) with preview-friendly defaults: it fetches
 * the card config from `{apiServer}api/content{pathname}` and renders it with
 * none of an application's auth/lock/boot providers. Drop it into a dedicated
 * route (e.g. `app/__pieshow__/page.tsx`) — after importing the app's card
 * registry — so `pie card show` / `pieui card show` can render an arbitrary
 * card without the app's gating screens taking over.
 */
const PiePreviewRoot = ({
    apiServer,
    pathname = '/',
    search = '',
    centrifugeServer,
    fallback,
    enableRenderingLog = false,
}: PiePreviewRootProps) => {
    const resolvedApiServer =
        apiServer ??
        (typeof process !== 'undefined'
            ? process.env.PIE_API_SERVER
            : undefined) ??
        ''

    const config: PieConfig = useMemo(
        () => ({
            apiServer: resolvedApiServer,
            centrifugeServer,
            enableRenderingLog,
            pageProcessor: 'web',
        }),
        [resolvedApiServer, centrifugeServer, enableRenderingLog]
    )

    const onNavigate = (url: string) => {
        if (typeof window !== 'undefined') {
            window.history.pushState(null, '', url)
        }
    }

    return (
        <PieRoot
            location={{ pathname, search }}
            config={config}
            fallback={fallback ?? DEFAULT_FALLBACK}
            onNavigate={onNavigate}
        />
    )
}

export default PiePreviewRoot
