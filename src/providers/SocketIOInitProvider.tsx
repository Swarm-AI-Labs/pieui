'use client'

import { ReactNode, useContext, useEffect } from 'react'
import SocketIOContext from '../util/socket'
import { useIsSupported } from '../util/useIsSupported'
import { Socket } from 'socket.io-client'
import { getApiServer } from '../util/pieConfig'

const SocketIOInitProvider = ({ children }: { children: ReactNode }) => {
    const socket: Socket | null = useContext(SocketIOContext)
    const apiServer = getApiServer()
    const isSocketIOSupported = useIsSupported(apiServer, 'socketIO')

    const onPieInitEvent = (event: any) => {
        if (typeof window !== 'undefined') {
            window.sid = event.sid
            console.log(`SocketIO initialized: ${window.sid}`)
        }
    }

    useEffect(() => {
        if (!socket) {
            return
        }
        const onConnectEvent = () => {
            console.log('SocketIO connected')
        }

        const onDisconnectEvent = (event: any) => {
            console.log(`SocketIO disconnected: ${event}`)
            socket.connect()
        }

        if (isSocketIOSupported) {
            socket.on(`pieinit`, onPieInitEvent)
            socket.on('connect', onConnectEvent)
            socket.on('disconnect', onDisconnectEvent)
            socket.connect()
        }
        return () => {
            if (isSocketIOSupported) {
                socket.off(`pieinit`, onPieInitEvent)
                socket.off('connect', onConnectEvent)
                socket.off('disconnect', onDisconnectEvent)
                socket.disconnect()
            }
        }
    }, [socket, isSocketIOSupported])

    return children
}

export default SocketIOInitProvider
