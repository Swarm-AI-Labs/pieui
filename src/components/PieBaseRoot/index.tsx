'use client'

import { useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import MittContext, { getEmitter } from '../../util/mitt'
import SocketIOContext, { getSocket } from '../../util/socket'
import CentrifugeIOContext, { getCentrifuge } from '../../util/centrifuge'

import SocketIOInitProvider from '../../providers/SocketIOInitProvider'
import CentrifugeIOInitProvider from '../../providers/CentrifugeIOInitProvider'
import FallbackContext from '../../util/fallback'
import {
    PieConfigContext,
    useApiServer,
    useCentrifugeServer,
    useIsRenderingLogEnabled,
} from '../../util/pieConfig'
import NavigateContext from '../../util/navigate.ts'
import { PieBaseRootProps } from './types'

const PieBaseRootContent = ({
    location,
    fallback,
    children,
}: PieBaseRootProps) => {
    const apiServer = useApiServer()
    const centrifugeServer = useCentrifugeServer()
    const renderingLogEnabled = useIsRenderingLogEnabled()

    const emitter = useMemo(() => getEmitter(), [])
    const socket = useMemo(
        () => (apiServer ? getSocket(apiServer) : null),
        [apiServer]
    )
    const centrifuge = useMemo(
        () => (apiServer ? getCentrifuge(apiServer, centrifugeServer) : null),
        [apiServer, centrifugeServer]
    )

    if (renderingLogEnabled) {
        console.log('[PieRoot] Rendering with location:', location)
        console.log('[PieRoot] API_SERVER:', apiServer)
        console.log('[PieRoot] CENTRIFUGE_SERVER:', centrifugeServer)
        console.log('[PieRoot] Fallback provided:', !!fallback)
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
                                    {children}
                                </form>
                            </CentrifugeIOInitProvider>
                        </SocketIOInitProvider>
                    </FallbackContext.Provider>
                </CentrifugeIOContext.Provider>
            </SocketIOContext.Provider>
        </MittContext.Provider>
    )
}

/**
 * Base PieUI root that sets up every context required by PieUI components
 * (QueryClient, Mitt emitter, Socket.IO, Centrifuge, Fallback, Navigate,
 * PieConfig) around its `children`.
 *
 * Unlike {@link PieRoot}, `PieBaseRoot` does not fetch a UI configuration
 * from the server — callers render whatever they want inside and can use
 * the PieUI utilities (`usePieEmit`, `PieCard`, Ajax helpers, …) within
 * that tree. Use this when you want full control over what is rendered or
 * when combining a PieUI widget with a non-PieUI application shell.
 */
const PieBaseRoot = (props: PieBaseRootProps) => {
    const [queryClient] = useState(() => new QueryClient())

    return (
        <NavigateContext.Provider value={props.onNavigate}>
            <PieConfigContext.Provider value={props.config}>
                <QueryClientProvider client={queryClient}>
                    <PieBaseRootContent {...props} />
                </QueryClientProvider>
            </PieConfigContext.Provider>
        </NavigateContext.Provider>
    )
}

export default PieBaseRoot
