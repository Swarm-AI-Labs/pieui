import React, { useEffect, useMemo } from 'react'
import {
    QueryClient,
    QueryClientProvider,
    useQuery,
} from '@tanstack/react-query'

import { PieRootProps } from '../PieRoot/types'

import MittContext, { getEmitter } from '../../util/mitt'
import SocketIOContext, { getSocket } from '../../util/socket'
import CentrifugeIOContext, { getCentrifuge } from '../../util/centrifuge'

import SocketIOInitProvider from '../../providers/SocketIOInitProvider'
import CentrifugeIOInitProvider from '../../providers/CentrifugeIOInitProvider'
import FallbackContext from '../../util/fallback'
import { UIConfigType } from '../../types'
import { AxiosError } from 'axios'
import UI from '../UI'
import { createAxiosDateTransformer } from 'axios-date-transformer'
import {
    getApiServer,
    isRenderingLogEnabled,
    getCentrifugeServer,
    PieConfigContext,
} from '../../util/pieConfig'
import {
    initializePieComponents,
    isPieComponentsInitialized,
} from '../../util/initializeComponents.ts'
import NavigateContext from '../../util/navigate.ts'

const PieExpoRootContent: React.FC<PieRootProps> = ({
    location,
    fallback,
    onError,
    initializePie,
}) => {
    const apiServer = getApiServer()
    const centrifugeServer = getCentrifugeServer()
    const renderingLogEnabled = isRenderingLogEnabled()

    useEffect(() => {
        if (isPieComponentsInitialized()) {
            return
        }
        initializePieComponents()
        initializePie()
    }, [])

    const axiosInstance = useMemo(
        () =>
            createAxiosDateTransformer({
                baseURL: apiServer || '',
            }),
        [apiServer]
    )

    const emitter = useMemo(() => getEmitter(), [])
    const socket = useMemo(
        () => (apiServer ? getSocket(apiServer) : null),
        [apiServer]
    )
    const centrifuge = useMemo(
        () => (apiServer ? getCentrifuge(apiServer, centrifugeServer) : null),
        [apiServer, centrifugeServer]
    )

    const {
        data: uiConfiguration,
        isLoading,
        error,
    } = useQuery<UIConfigType, AxiosError>({
        queryKey: [
            'uiConfig',
            location.pathname + location.search,
            isPieComponentsInitialized(),
            apiServer,
        ],
        enabled: isPieComponentsInitialized() && !!apiServer,
        queryFn: async () => {
            const params = new URLSearchParams(location.search)
            params.set('__pieroot', 'expo')
            const apiEndpoint =
                '/api/content' + location.pathname + '?' + params.toString()
            if (renderingLogEnabled) {
                console.log(
                    '[PieExpoRoot] Fetching UI configuration from:',
                    apiEndpoint
                )
            }
            const response = await axiosInstance.get(apiEndpoint, {
                headers: {
                    'Content-type': 'application/json',
                },
            })
            if (renderingLogEnabled) {
                console.log(
                    '[PieExpoRoot] Received UI configuration:',
                    response.data
                )
            }
            return response.data
        },
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        retry: true,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
    })

    if (!apiServer) {
        return fallback ?? null
    }

    if (renderingLogEnabled) {
        console.log('[PieExpoRoot] Rendering with location:', location)
        console.log('[PieExpoRoot] API_SERVER:', apiServer)
        console.log('[PieExpoRoot] CENTRIFUGE_SERVER:', centrifugeServer)
        console.log('[PieExpoRoot] Fallback provided:', !!fallback)
    }

    if (error) {
        if (renderingLogEnabled) {
            console.error(
                '[PieExpoRoot] Error fetching UI configuration:',
                error
            )
            console.error('[PieExpoRoot] Error details:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
            })
        }
        onError?.()
        return fallback
    }

    if (isLoading || !uiConfiguration) {
        if (renderingLogEnabled) {
            console.log('[PieExpoRoot] Loading state:', {
                isLoading,
                hasUiConfiguration: !!uiConfiguration,
            })
        }
        return fallback
    }

    if (renderingLogEnabled) {
        console.log(
            '[PieExpoRoot] UI configuration loaded successfully:',
            uiConfiguration
        )
        console.log('[PieExpoRoot] Rendering UI with configuration')
    }

    return (
        <MittContext.Provider value={emitter}>
            <SocketIOContext.Provider value={socket}>
                <CentrifugeIOContext.Provider value={centrifuge}>
                    <FallbackContext.Provider value={fallback ?? <></>}>
                        <SocketIOInitProvider>
                            <CentrifugeIOInitProvider>
                                <UI uiConfig={uiConfiguration} />
                            </CentrifugeIOInitProvider>
                        </SocketIOInitProvider>
                    </FallbackContext.Provider>
                </CentrifugeIOContext.Provider>
            </SocketIOContext.Provider>
        </MittContext.Provider>
    )
}

const PieExpoRoot: React.FC<PieRootProps> = (props) => {
    const queryClient = useMemo(() => new QueryClient(), [])

    return (
        <NavigateContext.Provider value={props.onNavigate}>
            <PieConfigContext.Provider value={props.config}>
                <QueryClientProvider client={queryClient}>
                    <PieExpoRootContent {...props} />
                </QueryClientProvider>
            </PieConfigContext.Provider>
        </NavigateContext.Provider>
    )
}

export default PieExpoRoot
