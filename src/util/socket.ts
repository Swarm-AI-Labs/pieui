'use client'

import { io, Socket } from 'socket.io-client'
import { createContext } from 'react'

const socketCache = new Map<string, Socket>()

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

const SocketIOContext = createContext<Socket | null>(null)

export default SocketIOContext
