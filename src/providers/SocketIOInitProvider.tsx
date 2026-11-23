'use client'

import { ReactNode, useContext, useEffect, useRef } from 'react'
import SocketIOContext from '../util/socket'
import { useIsSupported } from '../util/useIsSupported'
import { Socket } from 'socket.io-client'
import { getApiServer, useOnLinkLost, useOnLinkRestored } from '../util/pieConfig'
import { markSidAvailable } from '../util/waitForSidAvailable'
import clientSources from '../platform/clientSources'
import { nextLink, type LinkState } from '../util/linkStatus'

const SocketIOInitProvider = ({ children }: { children: ReactNode }) => {
    const socket: Socket | null = useContext(SocketIOContext)
    const apiServer = getApiServer()
    // Asked only when there is a socket to connect: an unanswered request is
    // asked again until the backend answers.
    const support = useIsSupported(socket ? apiServer : '', 'socketIO')

    // Callbacks live in refs so inline arrows passed in `config` do not re-run
    // the connect effect (which would thrash the shared socket).
    const onLinkLost = useOnLinkLost()
    const onLinkRestored = useOnLinkRestored()
    const onLinkLostRef = useRef(onLinkLost)
    onLinkLostRef.current = onLinkLost
    const onLinkRestoredRef = useRef(onLinkRestored)
    onLinkRestoredRef.current = onLinkRestored

    // Survives re-renders so the lost/restored transition is tracked across the
    // whole socket lifetime, not per render.
    const linkState = useRef<LinkState>('initial')

    const onPieInitEvent = (event: any) => {
        if (clientSources.isClient()) {
            clientSources.setSid(event.sid)
            markSidAvailable()
            console.log(`SocketIO initialized: ${clientSources.readSid()}`)
        }
    }

    // The backend has not answered whether Socket.IO is on: no connect, so
    // the link is down until it does. Answered "off" → nothing to wait for.
    useEffect(() => {
        if (!socket || (support !== 'stalled' && support !== false)) return
        const { state, signal } = nextLink(
            linkState.current,
            support === 'stalled' ? 'stuck' : 'off'
        )
        linkState.current = state
        if (signal === 'lost')
            onLinkLostRef.current?.('socketio', { reason: 'support' })
        if (signal === 'restored') onLinkRestoredRef.current?.('socketio')
    }, [socket, support])

    useEffect(() => {
        if (!socket || support !== true) {
            return
        }
        const onConnectEvent = () => {
            const { state, signal } = nextLink(linkState.current, 'up')
            linkState.current = state
            if (signal === 'restored') onLinkRestoredRef.current?.('socketio')
            console.log('SocketIO connected')
        }

        const onDisconnectEvent = (reason: Socket.DisconnectReason) => {
            console.log(`SocketIO disconnected: ${reason}`)
            socket.connect()
            // A client-initiated disconnect (e.g. teardown) is not a link loss.
            if (reason === 'io client disconnect') return
            const { state, signal } = nextLink(linkState.current, 'down')
            linkState.current = state
            if (signal === 'lost') onLinkLostRef.current?.('socketio', reason)
        }

        socket.on(`pieinit`, onPieInitEvent)
        socket.on('connect', onConnectEvent)
        socket.on('disconnect', onDisconnectEvent)
        socket.connect()
        return () => {
            socket.off(`pieinit`, onPieInitEvent)
            socket.off('connect', onConnectEvent)
            socket.off('disconnect', onDisconnectEvent)
            socket.disconnect()
        }
    }, [socket, support])

    return children
}

export default SocketIOInitProvider
