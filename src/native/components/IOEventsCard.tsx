import { useContext, useMemo, useRef } from 'react'
import { Alert, Linking } from 'react-native'
import PieCard from '../../components/PieCard'
import NavigateContext from '../../util/navigate'

const isExternal = (url: string) =>
    /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)

/**
 * React Native variant of `IOEventsCard`. Maps server-driven IO events onto
 * native primitives: `alert` → `Alert.alert`, `redirect`/`reload` → `Linking`
 * (external) or `NavigateContext` (internal), `log` → console. There is no DOM
 * toast container, and web push notifications are not available; `push` warns.
 */
const IOEventsCard = ({ data }: { data: any }) => {
    const {
        useCentrifugeSupport,
        useSocketioSupport,
        useMittSupport,
        centrifugeChannel,
    } = data
    const navigate = useContext(NavigateContext)
    const navigateRef = useRef(navigate)
    navigateRef.current = navigate

    const methods = useMemo(() => {
        const goTo = (to?: string) => {
            if (!to) return
            if (isExternal(to)) Linking.openURL(to).catch(() => {})
            else navigateRef.current?.(to)
        }
        return {
            alert: (event: any) =>
                Alert.alert(String(event.title ?? ''), String(event.message ?? '')),
            log: (event: any) => console.log('Log event', event),
            push: (event: any) =>
                console.warn(
                    '[IOEventsCard] push notifications are not supported on native',
                    event?.title
                ),
            redirect: (event: { to?: string }) => goTo(event.to),
            reload: (event: { to?: string }) => goTo(event.to),
        }
    }, [])

    return (
        <PieCard
            card={'IOEventsCard'}
            data={data}
            useCentrifugeSupport={useCentrifugeSupport}
            useSocketioSupport={useSocketioSupport}
            useMittSupport={useMittSupport}
            centrifugeChannel={centrifugeChannel}
            methods={methods}
        />
    )
}

export default IOEventsCard
