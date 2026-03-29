import { ComponentType, ReactNode } from 'react'
import { ShowPopupOptions } from '@telegram-apps/sdk'

export type WebAppUser = {
    id: string
    username: string
    photo_url: string
}

export type MainButtonType = {
    show: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
    setText: (text: string) => void
    hide: () => void
}

export type BackButtonType = {
    show: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
    hide: () => void
}

export type WebAppInitData = {
    user: WebAppUser
    start_param?: string
    chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel'
    chat_instance?: string
    auth_date: number
    hash: string
}

export type WebApp = {
    sendData: (data: string) => void
    showAlert: (message: string) => void
    showPopup: (options: ShowPopupOptions) => void
    MainButton: MainButtonType
    BackButton: BackButtonType
    initDataUnsafe: WebAppInitData
    initData: string
    ready: () => void
    close: () => void
    openLink: (link: string, option: string) => void
    platform: 'ios' | 'android' | 'web'
    expand: () => void
}

export type Telegram = {
    WebApp: WebApp
}

export type InitDataUnsafe = {
    user?: WebAppUser
}

export type InitData = string

export interface UIConfigType {
    card: string
    data: any
    content: UIConfigType | Array<UIConfigType>
}

export interface UIEventType {
    name: string
    data: Record<any, any>
}

export type SetUiAjaxConfigurationType =
    | ((content: UIConfigType | null) => void)
    | ((events: Array<UIEventType> | null) => void)

export interface PieEvent {
    cardName: string
    name: string
    eventName: string
    data: any
}

export type PieEventEmitter = (event: PieEvent) => void

// MAX Bridge types

export type MaxWebAppUser = {
    id: number
    first_name: string
    last_name?: string
    username?: string
    language_code?: string
    photo_url?: string
}

export type MaxWebAppChat = {
    id: number
    type: string
}

export type MaxWebAppStartParam = string

export type MaxWebAppData = {
    query_id?: string
    auth_date: number
    hash: string
    start_param?: MaxWebAppStartParam
    user?: MaxWebAppUser
    chat?: MaxWebAppChat
}

export type MaxBackButton = {
    isVisible: boolean
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
    show: () => void
    hide: () => void
}

export type MaxScreenCapture = {
    isScreenCaptureEnabled: boolean
    enableScreenCapture: () => void
    disableScreenCapture: () => void
}

export type MaxHapticImpactStyle =
    | 'soft'
    | 'light'
    | 'medium'
    | 'heavy'
    | 'rigid'
export type MaxHapticNotificationType = 'error' | 'success' | 'warning'

export type MaxHapticFeedback = {
    impactOccurred: (
        style: MaxHapticImpactStyle,
        disableVibrationFallback?: boolean
    ) => void
    notificationOccurred: (
        type: MaxHapticNotificationType,
        disableVibrationFallback?: boolean
    ) => void
    selectionChanged: (disableVibrationFallback?: boolean) => void
}

export type MaxDeviceStorage = {
    setItem: (key: string, value: string) => void
    getItem: (key: string) => void
    removeItem: (key: string) => void
    clear: () => void
}

export type MaxSecureStorage = {
    setItem: (key: string, value: string) => void
    getItem: (key: string) => void
    removeItem: (key: string) => void
}

export type MaxBiometricManager = {
    isInited: boolean
    init: () => void
    isBiometricAvailable: boolean
    biometricType: string[]
    deviceId: string | null
    isAccessRequested: boolean
    isAccessGranted: boolean
    isBiometricTokenSaved: boolean
    requestAccess: () => void
    authenticate: () => void
    updateBiometricToken: (token: string) => void
    openSettings: () => void
}

export type MaxShareTextContent = {
    text?: string
    link?: string
}

export type MaxShareMediaContent = {
    mid: string
    chatType: 'DIALOG' | 'CHAT'
}

export type MaxWebApp = {
    initData: string
    initDataUnsafe: MaxWebAppData
    platform: 'ios' | 'android' | 'desktop' | 'web'
    version: string
    onEvent: (eventName: string, callback: (...args: any[]) => void) => void
    offEvent: (eventName: string, callback: (...args: any[]) => void) => void
    ready: () => void
    close: () => void
    requestContact: () => void
    BackButton: MaxBackButton
    ScreenCapture: MaxScreenCapture
    HapticFeedback: MaxHapticFeedback
    DeviceStorage: MaxDeviceStorage
    SecureStorage: MaxSecureStorage
    BiometricManager: MaxBiometricManager
    enableClosingConfirmation: () => void
    disableClosingConfirmation: () => void
    openLink: (url: string) => void
    openMaxLink: (url: string) => void
    shareContent: (text: string, link: string) => void
    shareMaxContent: (
        content: MaxShareTextContent | MaxShareMediaContent
    ) => void
    downloadFile: (url: string, fileName: string) => void
    requestScreenMaxBrightness: () => void
    restoreScreenBrightness: () => void
    openCodeReader: (fileSelect?: boolean) => void
}

declare global {
    interface Window {
        sid: string
        Telegram: Telegram
        WebApp?: MaxWebApp
    }
}

export interface ComponentMetadata {
    author?: string
    version?: string
    description?: string
    tags?: string[]
}

export interface PieComplexContainerComponentProps<TData = unknown> {
    data: TData
    content: Array<UIConfigType>
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType
}

export interface PieContainerComponentProps<TData = unknown> {
    data: TData
    content: UIConfigType
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType
}

export interface PieComplexComponentProps<TData = unknown> {
    data: TData
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType
}

export interface PieSimpleComponentProps<TData = unknown> {
    data: TData
}

export type PieComponentProps<TData = unknown> =
    | PieSimpleComponentProps<TData>
    | PieContainerComponentProps<TData>
    | PieComplexContainerComponentProps<TData>

export interface ComponentRegistration<TProps> {
    name: string
    component?: ComponentType<TProps>
    fallback?: ReactNode
    loader?: () => Promise<{ default: ComponentType<TProps> }>
    metadata?: ComponentMetadata
    isLazy?: boolean
}

export interface PieConfig {
    apiServer: string
    centrifugeServer?: string
    enableRenderingLog?: boolean
    pageProcessor?: string
}
