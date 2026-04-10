'use client'

import { io, Socket } from 'socket.io-client'
import { createContext } from 'react'

const socketCache = new Map<string, Socket>()

/**
 * Returns a cached Socket.IO client for the given PieUI API server, creating
 * one on first access.
 *
 * The client is configured with `autoConnect: false` so that the enclosing
 * `SocketIOInitProvider` is in charge of connecting after any necessary
 * handshake (e.g. token fetch, `window.sid` assignment). Only the
 * `websocket` transport is enabled — long-polling is explicitly disabled to
 * keep connection semantics predictable across hosts.
 *
 * Calling the function repeatedly with the same `apiServer` always returns
 * the same instance, which is important because PieCard subscriptions rely
 * on a shared socket.
 *
 * @param apiServer Base URL of the PieUI API server.
 * @returns A shared `Socket` instance for that server.
 */
export const getSocket = (apiServer: string): Socket => {
    const existing = socketCache.get(apiServer)
    if (existing) return existing

    const socket = io(apiServer, {
        autoConnect: false,
        transports: ['websocket'],
    })
    socketCache.set(apiServer, socket)
    return socket
}

/**
 * React context that exposes the active Socket.IO client to components
 * rendered inside a PieRoot. `PieCard` reads it to register `pie*` event
 * listeners corresponding to its `methods` map.
 */
const SocketIOContext = createContext<Socket | null>(null)

export default SocketIOContext
