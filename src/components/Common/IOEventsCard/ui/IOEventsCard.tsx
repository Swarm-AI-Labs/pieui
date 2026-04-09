import { Bounce, Slide, Zoom, Flip } from 'react-toastify'
import { toast, ToastContainer, ToastOptions } from 'react-toastify'
// import 'react-toastify/dist/ReactToastify.css'
// import addNotification from 'react-push-notification'
import PieCard from '../../../PieCard'
import { IOEventData, IOEventsCardProps, NotificationEvent } from '../types'
import { useContext } from 'react'
import NavigateContext from '../../../../util/navigate.ts'
import { ShowPopupOptions, StoryShareParams } from '../../../../types'

const createTransition = (name?: string) => {
    if (name === 'bounce') {
        return Bounce
    } else if (name === 'slide') {
        return Slide
    } else if (name === 'zoom') {
        return Zoom
    } else if (name === 'flip') {
        return Flip
    }
}

const IOEventsCard = ({ data }: IOEventsCardProps) => {
    const {
        useCentrifugeSupport,
        useSocketioSupport,
        useMittSupport,
        centrifugeChannel,
    } = data
    const navigate = useContext(NavigateContext)

    const onTgShowPopupEvent = (event: ShowPopupOptions) => {
        window.Telegram.WebApp.showPopup(event)
    }

    const onToastEvent = (event: IOEventData) => {
        const options: ToastOptions = {
            ...event,
            transition: createTransition(event.transition),
            position: event.position ?? 'bottom-right',
            autoClose: event.autoClose ?? 5000,
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

    const onNotifyEvent = (event: NotificationEvent) => {
        if (typeof window === 'undefined' || !window.Notification) {
            console.warn('[IOEventsCard] Notifications API is not available')
            return
        }

        const { title, ...options } = event

        const show = () => {
            try {
                new window.Notification(title, options)
            } catch (error) {
                console.error(
                    '[IOEventsCard] Failed to show notification',
                    error
                )
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

    const onTgShowAlertEvent = (event: { message: string }) => {
        window.Telegram.WebApp.showAlert(event.message)
    }

    const onTgShowConfirmEvent = (event: { message: string }) => {
        window.Telegram.WebApp.showConfirm(event.message)
    }

    const onTgOpenLinkEvent = (event: {
        url: string
        try_instant_view?: boolean
    }) => {
        window.Telegram.WebApp.openLink(event.url, {
            try_instant_view: event.try_instant_view,
        })
    }

    const onTgOpenTelegramLinkEvent = (event: { url: string }) => {
        window.Telegram.WebApp.openTelegramLink(event.url)
    }

    const onTgOpenInvoiceEvent = (event: { url: string }) => {
        window.Telegram.WebApp.openInvoice(event.url)
    }

    const onTgShareToStoryEvent = (event: {
        media_url: string
        params?: StoryShareParams
    }) => {
        window.Telegram.WebApp.shareToStory(event.media_url, event.params)
    }

    const onTgShareMessageEvent = (event: { msg_id: string }) => {
        window.Telegram.WebApp.shareMessage(event.msg_id)
    }

    const onTgSetEmojiStatusEvent = (event: { custom_emoji_id: string }) => {
        window.Telegram.WebApp.setEmojiStatus(event.custom_emoji_id)
    }

    const onTgRequestEmojiStatusAccessEvent = () => {
        window.Telegram.WebApp.requestEmojiStatusAccess()
    }

    const onTgDownloadFileEvent = (event: {
        url: string
        file_name: string
    }) => {
        window.Telegram.WebApp.downloadFile(event)
    }

    const onTgRequestWriteAccessEvent = () => {
        window.Telegram.WebApp.requestWriteAccess()
    }

    const onTgRequestContactEvent = () => {
        window.Telegram.WebApp.requestContact()
    }

    const onTgRequestChatEvent = (event: { req_id: string }) => {
        window.Telegram.WebApp.requestChat(event.req_id)
    }

    const onTgReadTextFromClipboardEvent = () => {
        window.Telegram.WebApp.readTextFromClipboard()
    }

    const onTgShowScanQrPopupEvent = (event: { text?: string }) => {
        window.Telegram.WebApp.showScanQrPopup({ text: event.text })
    }

    const onTgCloseScanQrPopupEvent = () => {
        window.Telegram.WebApp.closeScanQrPopup()
    }

    const onTgSwitchInlineQueryEvent = (event: {
        query: string
        choose_chat_types?: Array<'users' | 'bots' | 'groups' | 'channels'>
    }) => {
        window.Telegram.WebApp.switchInlineQuery(
            event.query,
            event.choose_chat_types
        )
    }

    const onTgSetHeaderColorEvent = (event: { color: string }) => {
        window.Telegram.WebApp.setHeaderColor(event.color)
    }

    const onTgSetBackgroundColorEvent = (event: { color: string }) => {
        window.Telegram.WebApp.setBackgroundColor(event.color)
    }

    const onTgSetBottomBarColorEvent = (event: { color: string }) => {
        window.Telegram.WebApp.setBottomBarColor(event.color)
    }

    const onTgEnableClosingConfirmationEvent = () => {
        window.Telegram.WebApp.enableClosingConfirmation()
    }

    const onTgDisableClosingConfirmationEvent = () => {
        window.Telegram.WebApp.disableClosingConfirmation()
    }

    const onTgRequestFullscreenEvent = () => {
        window.Telegram.WebApp.requestFullscreen()
    }

    const onTgExitFullscreenEvent = () => {
        window.Telegram.WebApp.exitFullscreen()
    }

    const onTgExpandEvent = () => {
        window.Telegram.WebApp.expand()
    }

    const onTgCloseEvent = () => {
        window.Telegram.WebApp.close()
    }

    const onTgAddToHomeScreenEvent = () => {
        window.Telegram.WebApp.addToHomeScreen()
    }

    const onTgHideKeyboardEvent = () => {
        window.Telegram.WebApp.hideKeyboard()
    }

    const onTgLockOrientationEvent = () => {
        window.Telegram.WebApp.lockOrientation()
    }

    const onTgUnlockOrientationEvent = () => {
        window.Telegram.WebApp.unlockOrientation()
    }

    const onTgEnableVerticalSwipesEvent = () => {
        window.Telegram.WebApp.enableVerticalSwipes()
    }

    const onTgDisableVerticalSwipesEvent = () => {
        window.Telegram.WebApp.disableVerticalSwipes()
    }

    const onRedirectEvent = (event: { to: string }) => {
        if (event.to) {
            const url = event.to

            const isExternal = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)
            if (isExternal) {
                window.location.href = url
            } else {
                navigate?.(url)
            }
        } else {
            window.location.reload()
        }
    }

    //
    // const onPushNotificationEvent = (event: any) => {
    //     console.log('Push notification event', event)
    //     addNotification({
    //         title: event.title,
    //         subtitle: event.subtitle,
    //         message: event.message,
    //         icon: event.icon,
    //         vibrate: event.vibrate,
    //         silent: event.silent,
    //         duration: event.duration,
    //         theme: event.theme,
    //         native: true,
    //     })
    // }

    return (
        <>
            <PieCard
                card={'IOEventsCard'}
                data={data}
                useCentrifugeSupport={useCentrifugeSupport}
                useSocketioSupport={useSocketioSupport}
                useMittSupport={useMittSupport}
                centrifugeChannel={centrifugeChannel}
                methods={{
                    toast: onToastEvent,
                    notify: onNotifyEvent,
                    log: onLogEvent,
                    redirect: onRedirectEvent,
                    // push: onPushNotificationEvent,
                    tgShowPopup: onTgShowPopupEvent,
                    tgShowAlert: onTgShowAlertEvent,
                    tgShowConfirm: onTgShowConfirmEvent,
                    tgOpenLink: onTgOpenLinkEvent,
                    tgOpenTelegramLink: onTgOpenTelegramLinkEvent,
                    tgOpenInvoice: onTgOpenInvoiceEvent,
                    tgShareToStory: onTgShareToStoryEvent,
                    tgShareMessage: onTgShareMessageEvent,
                    tgSetEmojiStatus: onTgSetEmojiStatusEvent,
                    tgRequestEmojiStatusAccess:
                        onTgRequestEmojiStatusAccessEvent,
                    tgDownloadFile: onTgDownloadFileEvent,
                    tgRequestWriteAccess: onTgRequestWriteAccessEvent,
                    tgRequestContact: onTgRequestContactEvent,
                    tgRequestChat: onTgRequestChatEvent,
                    tgReadTextFromClipboard: onTgReadTextFromClipboardEvent,
                    tgShowScanQrPopup: onTgShowScanQrPopupEvent,
                    tgCloseScanQrPopup: onTgCloseScanQrPopupEvent,
                    tgSwitchInlineQuery: onTgSwitchInlineQueryEvent,
                    tgSetHeaderColor: onTgSetHeaderColorEvent,
                    tgSetBackgroundColor: onTgSetBackgroundColorEvent,
                    tgSetBottomBarColor: onTgSetBottomBarColorEvent,
                    tgEnableClosingConfirmation:
                        onTgEnableClosingConfirmationEvent,
                    tgDisableClosingConfirmation:
                        onTgDisableClosingConfirmationEvent,
                    tgRequestFullscreen: onTgRequestFullscreenEvent,
                    tgExitFullscreen: onTgExitFullscreenEvent,
                    tgExpand: onTgExpandEvent,
                    tgClose: onTgCloseEvent,
                    tgAddToHomeScreen: onTgAddToHomeScreenEvent,
                    tgHideKeyboard: onTgHideKeyboardEvent,
                    tgLockOrientation: onTgLockOrientationEvent,
                    tgUnlockOrientation: onTgUnlockOrientationEvent,
                    tgEnableVerticalSwipes: onTgEnableVerticalSwipesEvent,
                    tgDisableVerticalSwipes: onTgDisableVerticalSwipesEvent,
                }}
            >
                <ToastContainer />
            </PieCard>
        </>
    )
}

export default IOEventsCard
