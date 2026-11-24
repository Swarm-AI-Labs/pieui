'use client'

import { ReactNode, useContext, useEffect, useRef } from 'react'
import CentrifugeIOContext from '../util/centrifuge'
import { recoverFromUnauthorized } from '../util/centrifugeUnauthorized'
import { useIsSupported } from '../util/useIsSupported'
import {
    getApiServer,
    useOnLinkLost,
    useOnLinkRestored,
    useOnUnauthorized,
} from '../util/pieConfig'
import { nextLink, type LinkEvent, type LinkState } from '../util/linkStatus'

const CentrifugeIOInitProvider = ({ children }: { children: ReactNode }) => {
    const centrifuge = useContext(CentrifugeIOContext)
    const apiServer = getApiServer()
    // Asked only when there is a client to connect: an unanswered request is
    // asked again until the backend answers.
    const support = useIsSupported(centrifuge ? apiServer : '', 'centrifuge')

    // Callbacks live in refs so a consumer passing inline arrows in `config`
    // does not re-run the connect effect (which would thrash the shared
    // WebSocket); the effect deps stay limited to the connection itself.
    const onLinkLost = useOnLinkLost()
    const onLinkRestored = useOnLinkRestored()
    const onUnauthorized = useOnUnauthorized()
    const onLinkLostRef = useRef(onLinkLost)
    onLinkLostRef.current = onLinkLost
    const onLinkRestoredRef = useRef(onLinkRestored)
    onLinkRestoredRef.current = onLinkRestored
    const onUnauthorizedRef = useRef(onUnauthorized)
    onUnauthorizedRef.current = onUnauthorized

    // Held in a ref so transition handling survives re-renders without
    // re-subscribing; mirrors the Socket.IO provider.
    const linkState = useRef<LinkState>('initial')
    const link = useRef((event: LinkEvent, detail?: unknown) => {
        const { state, signal } = nextLink(linkState.current, event)
        linkState.current = state
        if (signal === 'lost') onLinkLostRef.current?.('centrifuge', detail)
        if (signal === 'restored') onLinkRestoredRef.current?.('centrifuge')
    }).current

    // The backend has not answered whether Centrifuge is on: no connect, so
    // the link is down until it does. Answered "off" → nothing to wait for.
    useEffect(() => {
        if (!centrifuge) return
        if (support === 'stalled') link('stuck', { reason: 'support' })
        else if (support === false) link('off')
    }, [centrifuge, support])

    useEffect(() => {
        if (!centrifuge || support !== true) {
            return
        }

        // 'connecting' is the real "link dropped" signal (Centrifuge left the
        // connected state and is retrying); 'disconnected' is terminal. Both
        // map to `down` — the reducer collapses the pair to a single `lost`.
        const down = (event: { code?: number; reason?: string }) =>
            link('down', event)
        const up = () => {
            link('up')
            console.log('Centrifuge connected')
        }
        const onDisconnect = (event: unknown) => {
            console.log('Centrifuge disconnected:', event)
            down(event as { code?: number; reason?: string })
        }

        centrifuge.on('connecting', down)
        centrifuge.on('connected', up)
        centrifuge.on('disconnected', onDisconnect)
        // A refused token stops the client for good: the app may renew the
        // session (PieConfig.onUnauthorized) and the client reconnects.
        const stopRecovery = recoverFromUnauthorized(
            centrifuge,
            () => onUnauthorizedRef.current,
            (ctx) => link('stuck', ctx)
        )
        centrifuge.connect()

        return () => {
            // Detach before disconnecting so our own teardown disconnect does
            // not surface as a spurious `lost` to the consumer.
            stopRecovery()
            centrifuge.off('connecting', down)
            centrifuge.off('connected', up)
            centrifuge.off('disconnected', onDisconnect)
            centrifuge.disconnect()
        }
    }, [centrifuge, support])

    return children
}

export default CentrifugeIOInitProvider
