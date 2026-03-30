import { ReactNode } from 'react'
import { PieConfig } from '../../../types'

export interface PieExpoRootProps {
    location: {
        pathname: string
        search: string
    }
    authToken?: string
    fallback?: ReactNode
    onError?: () => void
    onNavigate?: (url: string) => void
    config: PieConfig
    initializePie: () => void
}