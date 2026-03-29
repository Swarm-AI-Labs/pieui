'use client'

import { ReactNode, useContext, useEffect } from 'react'
import CentrifugeIOContext from '../util/centrifuge'
import { useIsSupported } from '../util/useIsSupported'
import { getApiServer } from '../util/pieConfig'

const CentrifugeIOInitProvider = ({ children }: { children: ReactNode }) => {
    const centrifuge = useContext(CentrifugeIOContext)
    const apiServer = getApiServer()

    const isCentrifugeSupported = useIsSupported(apiServer, 'centrifuge')

    useEffect(() => {
        if (!centrifuge) {
            return
        }

        const onConnectEvent = () => {
            console.log('Centrifuge connected')
        }

        const onDisconnectEvent = (event: any) => {
            console.log(`Centrifuge disconnected:`, event)
        }

        if (isCentrifugeSupported) {
            centrifuge.on('connected', onConnectEvent)
            centrifuge.on('disconnected', onDisconnectEvent)
            centrifuge.connect()
        }

        return () => {
            if (isCentrifugeSupported) {
                centrifuge.disconnect()
            }
        }
    }, [centrifuge, isCentrifugeSupported])

    return children
}

export default CentrifugeIOInitProvider
