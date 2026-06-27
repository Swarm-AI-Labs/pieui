'use client'

import { ReactNode, useContext, useEffect, useRef } from 'react'
import CentrifugeIOContext from '../util/centrifuge'
import { useIsSupported } from '../util/useIsSupported'
import { getApiServer, useOnLinkLost, useOnLinkRestored } from '../util/pieConfig'
import { nextLink, type LinkState } from '../util/linkStatus'

const CentrifugeIOInitProvider = ({ children }: { children: ReactNode }) => {
    const centrifuge = useContext(CentrifugeIOContext)
    const apiServer = getApiServer()
    const isCentrifugeSupported = useIsSupported(apiServer, 'centrifuge')

    // Callbacks live in refs so a consumer passing inline arrows in `config`
    // does not re-run the connect effect (which would thrash the shared
    // WebSocket); the effect deps stay limited to the connection itself.
    const onLinkLost = useOnLinkLost()
    const onLinkRestored = useOnLinkRestored()
    const onLinkLostRef = useRef(onLinkLost)
    onLinkLostRef.current = onLinkLost
    const onLinkRestoredRef = useRef(onLinkRestored)
    onLinkRestoredRef.current = onLinkRestored

    // Held in a ref so transition handling survives re-renders without
    // re-subscribing; mirrors the Socket.IO provider.
    const linkState = useRef<LinkState>('initial')

    useEffect(() => {
        if (!centrifuge || !isCentrifugeSupported) {
            return
        }

        // 'connecting' is the real "link dropped" signal (Centrifuge left the
        // connected state and is retrying); 'disconnected' is terminal. Both
        // map to `down` — the reducer collapses the pair to a single `lost`.
        const down = (event: { code?: number; reason?: string }) => {
            const { state, signal } = nextLink(linkState.current, 'down')
            linkState.current = state
            if (signal === 'lost') onLinkLostRef.current?.('centrifuge', event)
        }
        const up = () => {
            const { state, signal } = nextLink(linkState.current, 'up')
            linkState.current = state
            if (signal === 'restored') onLinkRestoredRef.current?.('centrifuge')
            console.log('Centrifuge connected')
        }
        const onDisconnect = (event: unknown) => {
            console.log('Centrifuge disconnected:', event)
            down(event as { code?: number; reason?: string })
        }

        centrifuge.on('connecting', down)
        centrifuge.on('connected', up)
        centrifuge.on('disconnected', onDisconnect)
        centrifuge.connect()

        return () => {
            // Detach before disconnecting so our own teardown disconnect does
            // not surface as a spurious `lost` to the consumer.
            centrifuge.off('connecting', down)
            centrifuge.off('connected', up)
            centrifuge.off('disconnected', onDisconnect)
            centrifuge.disconnect()
        }
    }, [centrifuge, isCentrifugeSupported])

    return children
}

export default CentrifugeIOInitProvider
