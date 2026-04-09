import { ReactNode } from 'react'
import { PieConfig, UIConfigType } from '../../../types'
import { UseQueryOptions } from '@tanstack/react-query'
import { AxiosError } from 'axios'

export type PieQueryOptions = Omit<
    UseQueryOptions<UIConfigType, AxiosError>,
    'queryKey' | 'queryFn' | 'enabled'
>

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
    queryOptions?: PieQueryOptions
}
