import { ReactNode } from 'react'
import { PieConfig, UIConfigType } from '../../../types'

export interface PieRootProps {
    location: {
        pathname: string
        search: string
    }
    fallback?: ReactNode
    piecache?: Record<string, UIConfigType>
    onError?: () => void
    onNavigate?: (url: string) => void
    config: PieConfig
    initializePie: () => void
}
