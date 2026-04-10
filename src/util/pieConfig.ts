'use client'

import { createContext, useContext } from 'react'
import { PieConfig } from '../types'

/**
 * React context that carries the {@link PieConfig} object supplied to a
 * PieRoot. All runtime configuration (API server URL, Centrifuge URL,
 * logging flag, page processor mode) flows through this context so that
 * utilities can be plain hooks instead of reading from `process.env`.
 */
export const PieConfigContext = createContext<PieConfig | null>(null)

/**
 * Returns the current {@link PieConfig} from {@link PieConfigContext}.
 *
 * @throws Error When called outside of a PieRoot — the context will be
 *               `null` and no sensible default exists.
 * @returns The config object provided to the enclosing PieRoot.
 */
export const usePieConfig = () => {
    const context = useContext(PieConfigContext)
    if (!context) {
        throw new Error('usePieConfig must be used within PieConfigProvider')
    }
    return context
}

/**
 * Convenience hook returning the `apiServer` field from the current
 * {@link PieConfig}. Must be called inside a PieRoot.
 */
export const useApiServer = () => {
    const { apiServer } = usePieConfig()
    return apiServer
}

/** @deprecated Use useApiServer() instead */
export const getApiServer = useApiServer

/**
 * Convenience hook returning the `centrifugeServer` field from the current
 * {@link PieConfig}. Returns `undefined` when Centrifuge is not configured.
 */
export const useCentrifugeServer = () => {
    const { centrifugeServer } = usePieConfig()
    return centrifugeServer
}

/** @deprecated Use useCentrifugeServer() instead */
export const getCentrifugeServer = useCentrifugeServer

/**
 * Convenience hook returning the `enableRenderingLog` flag from the current
 * {@link PieConfig}. Used by internal components to gate verbose logging.
 */
export const useIsRenderingLogEnabled = () => {
    const { enableRenderingLog } = usePieConfig()
    return enableRenderingLog
}

/** @deprecated Use useIsRenderingLogEnabled() instead */
export const isRenderingLogEnabled = useIsRenderingLogEnabled

/**
 * Convenience hook returning the `pageProcessor` field from the current
 * {@link PieConfig}. Used by root components to decide how the page should
 * be initialized (for example, whether to auto-expand Telegram WebApp).
 */
export const usePageProcessor = () => {
    const { pageProcessor } = usePieConfig()
    return pageProcessor
}

/** @deprecated Use usePageProcessor() instead */
export const getPageProcessor = usePageProcessor

/**
 * Separator token used by {@link pieName} to build nested component names
 * of the form `parent{PIEBREAK}child`. Keeping it in one place ensures the
 * UI configuration generator and the runtime agree on the delimiter.
 */
export const PIEBREAK = '__piedemo__'
