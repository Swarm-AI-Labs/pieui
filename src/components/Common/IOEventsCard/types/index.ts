import { PieSimpleComponentProps } from '../../../../types'
import { ToastOptions } from 'react-toastify'
import { CSSProperties } from 'react'

export interface IOEventsCardData {
    name: string
    useSocketioSupport?: boolean
    useCentrifugeSupport?: boolean
    useMittSupport?: boolean
    centrifugeChannel?: string
}

export interface IOEventData extends Omit<
    ToastOptions,
    'transition' | 'style' | 'className' | 'onClick' | 'onClose' | 'onOpen'
> {
    message: string
    alertType?: 'info' | 'error' | 'success' | 'warn'
    transition?: 'bounce' | 'slide' | 'zoom' | 'flip'
    sx?: CSSProperties
}

export interface NotificationEvent extends NotificationOptions {
    title: string
}

export interface IOEventsCardProps extends PieSimpleComponentProps<IOEventsCardData> {}
