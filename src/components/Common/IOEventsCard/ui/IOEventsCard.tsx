import { Bounce, Slide, Zoom, Flip } from 'react-toastify'
import { toast, ToastContainer, ToastOptions } from 'react-toastify'
import PieCard from '../../../PieCard'
import { IOEventData, IOEventsCardProps } from '../types'
import { useContext, useMemo, useRef } from 'react'
import NavigateContext from '../../../../util/navigate.ts'

const TRANSITIONS: Record<string, typeof Bounce> = {
    bounce: Bounce,
    slide: Slide,
    zoom: Zoom,
    flip: Flip,
}

const onAlertEvent = (event: IOEventData) => {
    const options: ToastOptions = {
        ...event,
        type: event.alertType as ToastOptions['type'],
        transition: event.transition ? TRANSITIONS[event.transition] : undefined,
        position: event.position ?? 'bottom-right',
        autoClose: event.autoClose ?? 3000,
        style: {
            backgroundColor: 'black',
            ...event.sx,
        },
    }
    toast(event.message, options)
}

const onLogEvent = (event: string) => {
    console.log('Log event', event)
}

const onPushEvent = (event: {
    title: string
    subtitle?: string
    message?: string
    icon?: string
    vibrate?: boolean
    silent?: boolean
    duration?: number
    theme?: string
}) => {
    if (typeof window === 'undefined' || !window.Notification) {
        console.warn('[IOEventsCard] Notifications API is not available')
        return
    }

    const show = () => {
        try {
            new window.Notification(event.title, {
                body: event.message ?? event.subtitle,
                icon: event.icon,
                silent: event.silent,
            })
        } catch (error) {
            console.error('[IOEventsCard] Failed to show notification', error)
        }
    }

    const permission = window.Notification.permission

    if (permission === 'granted') {
        show()
        return
    }

    if (permission === 'denied') {
        console.warn('[IOEventsCard] Notification permission denied')
        return
    }

    window.Notification.requestPermission().then((result) => {
        if (result === 'granted') {
            show()
        }
    })
}

const IOEventsCard = ({ data }: IOEventsCardProps) => {
    const {
        useCentrifugeSupport,
        useSocketioSupport,
        useMittSupport,
        centrifugeChannel,
    } = data
    const navigate = useContext(NavigateContext)
    const navigateRef = useRef(navigate)
    navigateRef.current = navigate

    const methods = useMemo(
        () => ({
            alert: onAlertEvent,
            log: onLogEvent,
            push: onPushEvent,
            redirect: (event: { to?: string }) => {
                if (event.to) {
                    const url = event.to
                    const isExternal = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(
                        url
                    )
                    if (isExternal) {
                        window.location.href = url
                    } else {
                        navigateRef.current?.(url)
                    }
                } else {
                    window.location.reload()
                }
            },
            reload: (event: { to?: string; forceReload?: boolean }) => {
                if (event.to) {
                    const url = event.to
                    const isExternal = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(
                        url
                    )
                    if (isExternal) {
                        window.location.href = url
                    } else {
                        navigateRef.current?.(url)
                    }
                } else {
                    window.location.reload()
                }
            },
        }),
        []
    )

    return (
        <>
            <PieCard
                card={'IOEventsCard'}
                data={data}
                useCentrifugeSupport={useCentrifugeSupport}
                useSocketioSupport={useSocketioSupport}
                useMittSupport={useMittSupport}
                centrifugeChannel={centrifugeChannel}
                methods={methods}
            >
                <ToastContainer />
            </PieCard>
        </>
    )
}

export default IOEventsCard