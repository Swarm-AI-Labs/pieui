import { ComponentType } from 'react'

export type ShowPopupOptions = {
    title?: string
    message: string
    buttons?: Array<{
        id?: string
        type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'
        text?: string
    }>
}

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

export type ThemeParams = {
    bg_color?: string
    text_color?: string
    hint_color?: string
    link_color?: string
    button_color?: string
    button_text_color?: string
    secondary_bg_color?: string
    header_bg_color?: string
    bottom_bar_bg_color?: string
    accent_text_color?: string
    section_bg_color?: string
    section_header_text_color?: string
    section_separator_color?: string
    subtitle_text_color?: string
    destructive_text_color?: string
}

export type SafeAreaInset = {
    top: number
    bottom: number
    left: number
    right: number
}

export type ContentSafeAreaInset = {
    top: number
    bottom: number
    left: number
    right: number
}

export type SettingsButtonType = {
    isVisible: boolean
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
    show: () => void
    hide: () => void
}

export type HapticFeedbackType = {
    impactOccurred: (
        style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
    ) => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
}

export type CloudStorageType = {
    setItem: (
        key: string,
        value: string,
        callback?: (error: Error | null, success?: boolean) => void
    ) => void
    getItem: (
        key: string,
        callback: (error: Error | null, value?: string) => void
    ) => void
    getItems: (
        keys: string[],
        callback: (error: Error | null, values?: Record<string, string>) => void
    ) => void
    removeItem: (
        key: string,
        callback?: (error: Error | null, success?: boolean) => void
    ) => void
    removeItems: (
        keys: string[],
        callback?: (error: Error | null, success?: boolean) => void
    ) => void
    getKeys: (callback: (error: Error | null, keys?: string[]) => void) => void
}

export type BiometricManagerType = {
    isInited: boolean
    isBiometricAvailable: boolean
    biometricType: string
    isAccessRequested: boolean
    isAccessGranted: boolean
    isBiometricTokenSaved: boolean
    deviceId: string
    init: (callback?: () => void) => void
    requestAccess: (
        params: { reason?: string },
        callback?: (granted: boolean) => void
    ) => void
    authenticate: (
        params: { reason?: string },
        callback?: (success: boolean, token?: string) => void
    ) => void
    updateBiometricToken: (
        token: string,
        callback?: (updated: boolean) => void
    ) => void
    openSettings: () => void
}

export type AccelerometerType = {
    isStarted: boolean
    x: number
    y: number
    z: number
    start: (params?: { refresh_rate?: number }, callback?: () => void) => void
    stop: (callback?: () => void) => void
}

export type DeviceOrientationType = {
    isStarted: boolean
    absolute: boolean
    alpha: number
    beta: number
    gamma: number
    start: (
        params?: { refresh_rate?: number; need_absolute?: boolean },
        callback?: () => void
    ) => void
    stop: (callback?: () => void) => void
}

export type GyroscopeType = {
    isStarted: boolean
    x: number
    y: number
    z: number
    start: (params?: { refresh_rate?: number }, callback?: () => void) => void
    stop: (callback?: () => void) => void
}

export type LocationManagerType = {
    isInited: boolean
    isLocationAvailable: boolean
    isAccessRequested: boolean
    isAccessGranted: boolean
    init: (callback?: () => void) => void
    getLocation: (
        callback: (
            location: {
                latitude: number
                longitude: number
                altitude?: number
                course?: number
                speed?: number
                horizontal_accuracy?: number
                vertical_accuracy?: number
                course_accuracy?: number
                speed_accuracy?: number
            } | null
        ) => void
    ) => void
    openSettings: () => void
}

export type DeviceStorageType = {
    setItem: (
        key: string,
        value: string,
        callback?: (error: Error | null, success?: boolean) => void
    ) => void
    getItem: (
        key: string,
        callback: (error: Error | null, value?: string) => void
    ) => void
    removeItem: (
        key: string,
        callback?: (error: Error | null, success?: boolean) => void
    ) => void
    clear: (callback?: (error: Error | null, success?: boolean) => void) => void
}

export type SecureStorageType = {
    setItem: (
        key: string,
        value: string,
        callback?: (error: Error | null, success?: boolean) => void
    ) => void
    getItem: (
        key: string,
        callback: (error: Error | null, value?: string) => void
    ) => void
    removeItem: (
        key: string,
        callback?: (error: Error | null, success?: boolean) => void
    ) => void
}

export type PopupParams = {
    title?: string
    message: string
    buttons?: Array<{
        id?: string
        type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'
        text?: string
    }>
}

export type ScanQrPopupParams = {
    text?: string
}

export type StoryShareParams = {
    text?: string
    widget_link?: {
        url: string
        name?: string
    }
}

export type EmojiStatusParams = {
    duration?: number
}

export type DownloadFileParams = {
    url: string
    file_name: string
}

export type WebApp = {
    /** A string with raw data transferred to the Mini App, convenient for validating data. WARNING: Validate data from this field before using it on the bot's server. */
    initData: string
    /** An object with input data transferred to the Mini App. WARNING: Data from this field should not be trusted. You should only use data from initData on the bot's server and only after it has been validated. */
    initDataUnsafe: WebAppInitData
    /** The version of the Bot API available in the user's Telegram app. */
    version: string
    /** The name of the platform of the user's Telegram app. */
    platform: string
    /** The color scheme currently used in the Telegram app. Either "light" or "dark". */
    colorScheme: 'light' | 'dark'
    /** An object containing the current theme settings used in the Telegram app. */
    themeParams: ThemeParams
    /** Bot API 8.0+. True, if the Mini App is currently active. False, if the Mini App is minimized. */
    isActive: boolean
    /** True, if the Mini App is expanded to the maximum available height. */
    isExpanded: boolean
    /** The current height of the visible area of the Mini App. */
    viewportHeight: number
    /** The height of the visible area of the Mini App in its last stable state. */
    viewportStableHeight: number
    /** Current header color in the #RRGGBB format. */
    headerColor: string
    /** Current background color in the #RRGGBB format. */
    backgroundColor: string
    /** Current bottom bar color in the #RRGGBB format. */
    bottomBarColor: string
    /** True, if the confirmation dialog is enabled while the user is trying to close the Mini App. */
    isClosingConfirmationEnabled: boolean
    /** True, if vertical swipes to close or minimize the Mini App are enabled. */
    isVerticalSwipesEnabled: boolean
    /** True, if the Mini App is currently being displayed in fullscreen mode. */
    isFullscreen: boolean
    /** True, if the Mini App's orientation is currently locked. */
    isOrientationLocked: boolean
    /** An object representing the device's safe area insets, accounting for system UI elements like notches or navigation bars. */
    safeAreaInset: SafeAreaInset
    /** An object representing the safe area for displaying content within the app, free from overlapping Telegram UI elements. */
    contentSafeAreaInset: ContentSafeAreaInset
    /** An object for controlling the back button which can be displayed in the header of the Mini App in the Telegram interface. */
    BackButton: BackButtonType
    /** An object for controlling the main button, which is displayed at the bottom of the Mini App in the Telegram interface. */
    MainButton: MainButtonType
    /** An object for controlling the secondary button, which is displayed at the bottom of the Mini App in the Telegram interface. */
    SecondaryButton: MainButtonType
    /** An object for controlling the Settings item in the context menu of the Mini App in the Telegram interface. */
    SettingsButton: SettingsButtonType
    /** An object for controlling haptic feedback. */
    HapticFeedback: HapticFeedbackType
    /** An object for controlling cloud storage. */
    CloudStorage: CloudStorageType
    /** An object for controlling biometrics on the device. */
    BiometricManager: BiometricManagerType
    /** Bot API 8.0+. An object for accessing accelerometer data on the device. */
    Accelerometer: AccelerometerType
    /** Bot API 8.0+. An object for accessing device orientation data on the device. */
    DeviceOrientation: DeviceOrientationType
    /** Bot API 8.0+. An object for accessing gyroscope data on the device. */
    Gyroscope: GyroscopeType
    /** Bot API 8.0+. An object for controlling location on the device. */
    LocationManager: LocationManagerType
    /** Bot API 8.0+. An object for storing and retrieving data from the device's local storage. */
    DeviceStorage: DeviceStorageType
    /** Bot API 8.0+. An object for storing and retrieving data from the device's secure storage. */
    SecureStorage: SecureStorageType
    /** Returns true if the user's app supports a version of the Bot API that is equal to or higher than the version passed as the parameter. */
    isVersionAtLeast: (version: string) => boolean
    /** Bot API 6.1+. A method that sets the app header color in the #RRGGBB format. You can also use keywords bg_color and secondary_bg_color. */
    setHeaderColor: (color: string) => void
    /** Bot API 6.1+. A method that sets the app background color in the #RRGGBB format. You can also use keywords bg_color and secondary_bg_color. */
    setBackgroundColor: (color: string) => void
    /** Bot API 7.10+. A method that sets the app's bottom bar color in the #RRGGBB format. You can also use the keywords bg_color, secondary_bg_color, and bottom_bar_bg_color. */
    setBottomBarColor: (color: string) => void
    /** Bot API 6.2+. A method that enables a confirmation dialog while the user is trying to close the Mini App. */
    enableClosingConfirmation: () => void
    /** Bot API 6.2+. A method that disables the confirmation dialog while the user is trying to close the Mini App. */
    disableClosingConfirmation: () => void
    /** Bot API 7.7+. A method that enables vertical swipes to close or minimize the Mini App. */
    enableVerticalSwipes: () => void
    /** Bot API 7.7+. A method that disables vertical swipes to close or minimize the Mini App. */
    disableVerticalSwipes: () => void
    /** Bot API 8.0+. A method that requests opening the Mini App in fullscreen mode. */
    requestFullscreen: () => void
    /** Bot API 8.0+. A method that requests exiting fullscreen mode. */
    exitFullscreen: () => void
    /** Bot API 8.0+. A method that locks the Mini App's orientation to its current mode (either portrait or landscape). */
    lockOrientation: () => void
    /** Bot API 8.0+. A method that unlocks the Mini App's orientation, allowing it to follow the device's rotation freely. */
    unlockOrientation: () => void
    /** Bot API 8.0+. A method that prompts the user to add the Mini App to the home screen. */
    addToHomeScreen: () => void
    /** Bot API 8.0+. A method that checks if adding to the home screen is supported and if the Mini App has already been added. */
    checkHomeScreenStatus: (
        callback?: (
            status: 'unsupported' | 'unknown' | 'added' | 'missed'
        ) => void
    ) => void
    /** A method that sets the app event handler. */
    onEvent: (eventType: string, eventHandler: (...args: any[]) => void) => void
    /** A method that deletes a previously set event handler. */
    offEvent: (
        eventType: string,
        eventHandler: (...args: any[]) => void
    ) => void
    /** A method used to send data to the bot. When this method is called, a service message is sent to the bot containing the data of the length up to 4096 bytes, and the Mini App is closed. */
    sendData: (data: string) => void
    /** Bot API 6.7+. A method that inserts the bot's username and the specified inline query in the current chat's input field. */
    switchInlineQuery: (
        query: string,
        choose_chat_types?: Array<'users' | 'bots' | 'groups' | 'channels'>
    ) => void
    /** A method that opens a link in an external browser. The Mini App will not be closed. Bot API 6.4+: supports options with try_instant_view. */
    openLink: (url: string, options?: { try_instant_view?: boolean }) => void
    /** A method that opens a telegram link inside the Telegram app. The Mini App will not be closed after this method is called. */
    openTelegramLink: (url: string) => void
    /** Bot API 6.1+. A method that opens an invoice using the link url. */
    openInvoice: (url: string, callback?: (status: string) => void) => void
    /** Bot API 7.8+. A method that opens the native story editor with the media specified in the media_url parameter as an HTTPS URL. */
    shareToStory: (media_url: string, params?: StoryShareParams) => void
    /** Bot API 8.0+. A method that opens a dialog allowing the user to share a message provided by the bot. */
    shareMessage: (
        msg_id: string,
        callback?: (success: boolean) => void
    ) => void
    /** Bot API 8.0+. A method that opens a dialog allowing the user to set the specified custom emoji as their status. */
    setEmojiStatus: (
        custom_emoji_id: string,
        params?: EmojiStatusParams,
        callback?: (success: boolean) => void
    ) => void
    /** Bot API 8.0+. A method that shows a native popup requesting permission for the bot to manage user's emoji status. */
    requestEmojiStatusAccess: (callback?: (granted: boolean) => void) => void
    /** Bot API 8.0+. A method that displays a native popup prompting the user to download a file. */
    downloadFile: (
        params: DownloadFileParams,
        callback?: (accepted: boolean) => void
    ) => void
    /** Bot API 9.1+. A method that hides the on-screen keyboard, if it is currently visible. */
    hideKeyboard: () => void
    /** Bot API 6.2+. A method that shows a native popup described by the params argument of the type PopupParams. */
    showPopup: (
        params: PopupParams,
        callback?: (buttonId: string) => void
    ) => void
    /** Bot API 6.2+. A method that shows message in a simple alert with a 'Close' button. */
    showAlert: (message: string, callback?: () => void) => void
    /** Bot API 6.2+. A method that shows message in a simple confirmation window with 'OK' and 'Cancel' buttons. */
    showConfirm: (
        message: string,
        callback?: (confirmed: boolean) => void
    ) => void
    /** Bot API 6.4+. A method that shows a native popup for scanning a QR code. */
    showScanQrPopup: (
        params: ScanQrPopupParams,
        callback?: (text: string) => boolean | void
    ) => void
    /** Bot API 6.4+. A method that closes the native popup for scanning a QR code opened with the showScanQrPopup method. */
    closeScanQrPopup: () => void
    /** Bot API 6.4+. A method that requests text from the clipboard. */
    readTextFromClipboard: (callback?: (text: string) => void) => void
    /** Bot API 6.9+. A method that shows a native popup requesting permission for the bot to send messages to the user. */
    requestWriteAccess: (callback?: (granted: boolean) => void) => void
    /** Bot API 6.9+. A method that shows a native popup prompting the user for their phone number. */
    requestContact: (callback?: (shared: boolean) => void) => void
    /** Bot API 9.6+. A method that opens a dialog allowing the user to select an existing chat or create a new one. */
    requestChat: (req_id: string, callback?: (success: boolean) => void) => void
    /** A method that informs the Telegram app that the Mini App is ready to be displayed. It is recommended to call this method as early as possible, as soon as all essential interface elements are loaded. */
    ready: () => void
    /** A method that expands the Mini App to the maximum available height. */
    expand: () => void
    /** A method that closes the Mini App. */
    close: () => void
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
    fallback?: ComponentType<{}>
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
