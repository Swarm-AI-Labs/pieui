import { useContext, useEffect, useRef } from 'react'
import { isRenderingLogEnabled } from '../../util/pieConfig'
import CentrifugeIOContext from '../../util/centrifuge'
import SocketIOContext from '../../util/socket'
import MittContext from '../../util/mitt'
import { PieCardProps } from './types'

const PieCard = ({
    card,
    data,
    children,
    useSocketioSupport = false,
    useCentrifugeSupport = false,
    useMittSupport = false,
    centrifugeChannel = undefined,
    methods = undefined,
}: PieCardProps) => {
    const renderingLogEnabled = isRenderingLogEnabled()
    const methodsRef = useRef(methods)

    useEffect(() => {
        methodsRef.current = methods
    }, [methods])

    // const name = data.name;
    if (renderingLogEnabled) {
        console.log('[PieCard] Rendering card:', card)
        console.log('[PieCard] Card data:', data)
        console.log('[PieCard] Component name:', data?.name)
        console.log('[PieCard] Real-time support:', {
            socketio: useSocketioSupport,
            centrifuge: useCentrifugeSupport,
            mitt: useMittSupport,
            centrifugeChannel,
        })
        console.log(
            '[PieCard] Methods:',
            methods ? Object.keys(methods) : 'none'
        )
        console.log('[PieCard] Has children:', !!children)
    }

    const socket = useContext(SocketIOContext)
    const centrifuge = useContext(CentrifugeIOContext)
    const mitt = useContext(MittContext)

    useEffect(() => {
        if (
            !socket ||
            !useSocketioSupport ||
            !methodsRef.current ||
            !data.name
        ) {
            if (renderingLogEnabled && useSocketioSupport) {
                console.log('[PieCard] Socket.IO setup skipped:', {
                    hasSocket: !!socket,
                    useSocketioSupport,
                    hasMethods: !!methodsRef.current,
                    hasDataName: !!data?.name,
                })
            }
            return
        }

        const methodNames = Object.keys(methodsRef.current ?? {})

        methodNames.forEach((methodName) => {
            const eventName = `pie${methodName}_${data.name}`
            if (renderingLogEnabled) {
                console.log(
                    `[PieCard] Socket.IO registering event: ${eventName}`
                )
            }
            socket.on(eventName, (payload) => {
                methodsRef.current?.[methodName]?.(payload)
            })
        })

        return () => {
            methodNames.forEach((methodName) => {
                const eventName = `pie${methodName}_${data.name}`
                if (renderingLogEnabled) {
                    console.log(
                        `[PieCard] Socket.IO unregistering event: ${eventName}`
                    )
                }
                socket.off(eventName)
            })
        }
    }, [socket, data.name, useSocketioSupport])

    useEffect(() => {
        if (
            !centrifuge ||
            !useCentrifugeSupport ||
            !centrifugeChannel ||
            !data.name
        ) {
            if (renderingLogEnabled && useCentrifugeSupport) {
                console.log('[PieCard] Centrifuge setup skipped:', {
                    hasCentrifuge: !!centrifuge,
                    useCentrifugeSupport,
                    hasCentrifugeChannel: !!centrifugeChannel,
                    hasMethods: !!methodsRef.current,
                    hasDataName: !!data?.name,
                })
            }
            return
        }

        const methodNames = Object.keys(methodsRef.current ?? {})

        const subscriptions = methodNames.map((methodName) => {
            const channelName = `pie${methodName}_${data.name}_${centrifugeChannel}`
            if (renderingLogEnabled) {
                console.log(
                    `[PieCard] Centrifuge subscribing to channel: ${channelName}`
                )
            }
            const subscription = centrifuge.newSubscription(channelName)

            subscription.on('publication', (ctx) => {
                if (renderingLogEnabled) {
                    console.log(
                        `[PieCard] Centrifuge received data on ${channelName}:`,
                        ctx.data
                    )
                }
                methodsRef.current?.[methodName]?.(ctx.data)
            })

            subscription.subscribe()
            return subscription
        })

        return () => {
            subscriptions.forEach((subscription) => {
                if (renderingLogEnabled) {
                    console.log(
                        `[PieCard] Centrifuge unsubscribing from channel`
                    )
                }
                subscription.unsubscribe()
                centrifuge.removeSubscription(subscription)
            })
        }
    }, [centrifuge, centrifugeChannel, data.name, useCentrifugeSupport])

    useEffect(() => {
        if (!mitt || !useMittSupport || !data.name) {
            if (renderingLogEnabled && useMittSupport) {
                console.log('[PieCard] Mitt setup skipped:', {
                    hasMitt: !!mitt,
                    useMittSupport,
                    hasMethods: !!methodsRef.current,
                    hasDataName: !!data?.name,
                })
            }
            return
        }

        const methodNames = Object.keys(methodsRef.current ?? {})

        const listeners: Record<string, (payload: any) => void> = {}

        methodNames.forEach((methodName) => {
            const eventName = `pie${methodName}_${data.name}`

            const listener = (payload: any) => {
                if (renderingLogEnabled) {
                    console.log(
                        `[PieCard] Mitt registering event: ${eventName}`
                    )
                }
                methodsRef.current?.[methodName]?.(payload)
            }

            listeners[eventName] = listener
            mitt.on(eventName, listener)
        })

        return () => {
            Object.entries(listeners).forEach(([eventName, listener]) => {
                if (renderingLogEnabled) {
                    console.log(
                        `[PieCard] Mitt unregistering event: ${eventName}`
                    )
                }
                mitt.off(eventName, listener)
            })
        }
    }, [mitt, data.name, useMittSupport])

    if (renderingLogEnabled) {
        console.log('[PieCard] Rendering complete, returning children')
    }

    return children
}

export { PieCard }
