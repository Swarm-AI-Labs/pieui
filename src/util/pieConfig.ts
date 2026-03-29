'use client'

import { createContext, useContext } from 'react'
import { PieConfig } from '../types'

export const PieConfigContext = createContext<PieConfig | null>(null)

export const usePieConfig = () => {
    const context = useContext(PieConfigContext)
    if (!context) {
        throw new Error('usePieConfig must be used within PieConfigProvider')
    }
    return context
}

export const useApiServer = () => {
    const { apiServer } = usePieConfig()
    return apiServer
}

/** @deprecated Use useApiServer() instead */
export const getApiServer = useApiServer

export const useCentrifugeServer = () => {
    const { centrifugeServer } = usePieConfig()
    return centrifugeServer
}

/** @deprecated Use useCentrifugeServer() instead */
export const getCentrifugeServer = useCentrifugeServer

export const useIsRenderingLogEnabled = () => {
    const { enableRenderingLog } = usePieConfig()
    return enableRenderingLog
}

/** @deprecated Use useIsRenderingLogEnabled() instead */
export const isRenderingLogEnabled = useIsRenderingLogEnabled

export const usePageProcessor = () => {
    const { pageProcessor } = usePieConfig()
    return pageProcessor
}

/** @deprecated Use usePageProcessor() instead */
export const getPageProcessor = usePageProcessor

export const PIEBREAK = '__piedemo__'
