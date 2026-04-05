'use client'

import React, { useEffect, useMemo, useState } from 'react'
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
    PieConfigContext, useApiServer, useCentrifugeServer, useIsRenderingLogEnabled,
} from '../../util/pieConfig'
import {
    initializePieComponents,
    isPieComponentsInitialized,
} from '../../util/initializeComponents.ts'
import NavigateContext from '../../util/navigate.ts'
import { resolvePieCacheFallback } from '../../util/piecache'

const PieElectronRootContent: React.FC<PieRootProps> = ({
    location,
    fallback,
    piecache,
    onError,
    initializePie,
    queryOptions,
}) => {
    const apiServer = useApiServer()
    const centrifugeServer = useCentrifugeServer()
    const renderingLogEnabled = useIsRenderingLogEnabled()
    const [componentsReady, setComponentsReady] = useState(
        isPieComponentsInitialized()
    )

    useEffect(() => {
        if (!isPieComponentsInitialized()) {
            initializePieComponents()
            initializePie()
        }
        if (!componentsReady) {
            setComponentsReady(true)
        }
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
            componentsReady,
            apiServer,
        ],
        enabled: componentsReady && !!apiServer,
        queryFn: async () => {
            const params = new URLSearchParams(location.search)
            params.set('__pieroot', 'electron')
            const apiEndpoint =
                '/api/content' + location.pathname + '?' + params.toString()
            if (renderingLogEnabled) {
                console.log(
                    '[PieElectronRoot] Fetching UI configuration from:',
                    apiEndpoint
                )
            }
            const response = await axiosInstance.get(apiEndpoint, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods':
                        'GET,PUT,POST,DELETE,PATCH,OPTIONS',
                    'Content-type': 'application/json',
                },
                withCredentials: true,
            })
            if (renderingLogEnabled) {
                console.log(
                    '[PieElectronRoot] Received UI configuration:',
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
        ...queryOptions,
    })

    const resolvedFallback = resolvePieCacheFallback(
        location.pathname,
        piecache,
        fallback
    )

    if (!apiServer) {
        return resolvedFallback ?? null
    }

    if (renderingLogEnabled) {
        console.log('[PieElectronRoot] Rendering with location:', location)
        console.log('[PieElectronRoot] API_SERVER:', apiServer)
        console.log('[PieElectronRoot] CENTRIFUGE_SERVER:', centrifugeServer)
        console.log('[PieElectronRoot] Fallback provided:', !!fallback)
        console.log('[PieElectronRoot] Piecache provided:', !!piecache)
    }

    if (error) {
        if (renderingLogEnabled) {
            console.error(
                '[PieElectronRoot] Error fetching UI configuration:',
                error
            )
            console.error('[PieElectronRoot] Error details:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
            })
        }
        onError?.()
        return resolvedFallback
    }

    if (isLoading || !uiConfiguration) {
        if (renderingLogEnabled) {
            console.log('[PieElectronRoot] Loading state:', {
                isLoading,
                hasUiConfiguration: !!uiConfiguration,
            })
        }
        return resolvedFallback
    }

    if (renderingLogEnabled) {
        console.log(
            '[PieElectronRoot] UI configuration loaded successfully:',
            uiConfiguration
        )
        console.log('[PieElectronRoot] Rendering UI with configuration')
    }

    return (
        <MittContext.Provider value={emitter}>
            <SocketIOContext.Provider value={socket}>
                <CentrifugeIOContext.Provider value={centrifuge}>
                    <FallbackContext.Provider value={fallback ?? <></>}>
                        <SocketIOInitProvider>
                            <CentrifugeIOInitProvider>
                                <form
                                    id="piedata_global_form"
                                    action={
                                        apiServer +
                                        'api/process' +
                                        location.pathname
                                    }
                                    method="post"
                                    encType="multipart/form-data"
                                >
                                    <UI uiConfig={uiConfiguration} />
                                </form>
                            </CentrifugeIOInitProvider>
                        </SocketIOInitProvider>
                    </FallbackContext.Provider>
                </CentrifugeIOContext.Provider>
            </SocketIOContext.Provider>
        </MittContext.Provider>
    )
}

const PieElectronRoot: React.FC<PieRootProps> = (props) => {
    const queryClient = useMemo(() => new QueryClient(), [])

    return (
        <NavigateContext.Provider value={props.onNavigate}>
            <PieConfigContext.Provider value={props.config}>
                <QueryClientProvider client={queryClient}>
                    <PieElectronRootContent {...props} />
                </QueryClientProvider>
            </PieConfigContext.Provider>
        </NavigateContext.Provider>
    )
}

export default PieElectronRoot
