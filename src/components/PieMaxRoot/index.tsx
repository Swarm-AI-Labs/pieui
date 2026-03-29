'use client'

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
import { useMaxWebApp } from '../../util/useMaxWebApp.ts'
import NavigateContext from '../../util/navigate.ts'

const PieMaxRootContent: React.FC<PieRootProps> = ({
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
                baseURL: apiServer,
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

    const webApp = useMaxWebApp()

    const {
        data: uiConfiguration,
        isLoading,
        error,
    } = useQuery<UIConfigType, AxiosError>({
        queryKey: [
            'uiConfig',
            location.pathname + location.search,
            webApp?.initData,
            isPieComponentsInitialized(),
        ],
        queryFn: async () => {
            if (!isPieComponentsInitialized()) {
                return
            }
            const params = new URLSearchParams(location.search)
            params.set('root', 'max')
            if (webApp?.initData) {
                params.set('initData', webApp.initData)
            }
            const apiEndpoint =
                '/api/content' + location.pathname + '?' + params.toString()

            if (renderingLogEnabled) {
                console.log(
                    '[PieRoot] Fetching UI configuration from:',
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
                    '[PieRoot] Received UI configuration:',
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
        throw Error('Set PIE_API_SERVER and PIE_CENTRIFUGE_SERVER')
    }

    if (error && renderingLogEnabled) {
        console.error('[PieRoot] Error fetching UI configuration:', error)
        console.error('[PieRoot] Error details:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
        })
        onError?.()
        return fallback
    }

    if (isLoading || !uiConfiguration) {
        if (renderingLogEnabled) {
            console.log('[PieRoot] Loading state:', {
                isLoading,
                hasUiConfiguration: !!uiConfiguration,
            })
        }
        return fallback
    }

    if (renderingLogEnabled) {
        console.log(
            '[PieRoot] UI configuration loaded successfully:',
            uiConfiguration
        )
        console.log('[PieRoot] Rendering UI with configuration')
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

const PieMaxRoot: React.FC<PieRootProps> = (props) => {
    const queryClient = useMemo(() => new QueryClient(), [])

    return (
        <NavigateContext.Provider value={props.onNavigate}>
            <PieConfigContext.Provider value={props.config}>
                <QueryClientProvider client={queryClient}>
                    <PieMaxRootContent {...props} />
                </QueryClientProvider>
            </PieConfigContext.Provider>
        </NavigateContext.Provider>
    )
}

export default PieMaxRoot
