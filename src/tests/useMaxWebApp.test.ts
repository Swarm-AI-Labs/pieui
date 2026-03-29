import { describe, test, expect, mock } from 'bun:test'
import type { MaxWebApp, MaxWebAppData } from '../types'

function createMockMaxWebApp(overrides: Partial<MaxWebApp> = {}): MaxWebApp {
    return {
        initData: 'hash=abc&auth_date=123',
        initDataUnsafe: {
            auth_date: 123,
            hash: 'abc',
            user: { id: 1, first_name: 'Test' },
        },
        platform: 'web',
        version: '25.9.16',
        onEvent: mock(() => {}),
        offEvent: mock(() => {}),
        ready: mock(() => {}),
        close: mock(() => {}),
        requestContact: mock(() => {}),
        BackButton: {
            isVisible: false,
            onClick: mock(() => {}),
            offClick: mock(() => {}),
            show: mock(() => {}),
            hide: mock(() => {}),
        },
        ScreenCapture: {
            isScreenCaptureEnabled: false,
            enableScreenCapture: mock(() => {}),
            disableScreenCapture: mock(() => {}),
        },
        HapticFeedback: {
            impactOccurred: mock(() => {}),
            notificationOccurred: mock(() => {}),
            selectionChanged: mock(() => {}),
        },
        DeviceStorage: {
            setItem: mock(() => {}),
            getItem: mock(() => {}),
            removeItem: mock(() => {}),
            clear: mock(() => {}),
        },
        SecureStorage: {
            setItem: mock(() => {}),
            getItem: mock(() => {}),
            removeItem: mock(() => {}),
        },
        BiometricManager: {
            isInited: false,
            init: mock(() => {}),
            isBiometricAvailable: false,
            biometricType: [],
            deviceId: null,
            isAccessRequested: false,
            isAccessGranted: false,
            isBiometricTokenSaved: false,
            requestAccess: mock(() => {}),
            authenticate: mock(() => {}),
            updateBiometricToken: mock(() => {}),
            openSettings: mock(() => {}),
        },
        enableClosingConfirmation: mock(() => {}),
        disableClosingConfirmation: mock(() => {}),
        openLink: mock(() => {}),
        openMaxLink: mock(() => {}),
        shareContent: mock(() => {}),
        shareMaxContent: mock(() => {}),
        downloadFile: mock(() => {}),
        requestScreenMaxBrightness: mock(() => {}),
        restoreScreenBrightness: mock(() => {}),
        openCodeReader: mock(() => {}),
        ...overrides,
    }
}

describe('MaxWebApp mock type conformance', () => {
    test('createMockMaxWebApp produces a valid MaxWebApp', () => {
        const app = createMockMaxWebApp()
        expect(app.platform).toBe('web')
        expect(app.version).toBe('25.9.16')
        expect(typeof app.ready).toBe('function')
        expect(typeof app.close).toBe('function')
        expect(typeof app.openLink).toBe('function')
        expect(typeof app.openMaxLink).toBe('function')
        expect(typeof app.shareContent).toBe('function')
        expect(typeof app.downloadFile).toBe('function')
        expect(typeof app.openCodeReader).toBe('function')
    })

    test('initDataUnsafe contains user data', () => {
        const app = createMockMaxWebApp()
        expect(app.initDataUnsafe.user?.id).toBe(1)
        expect(app.initDataUnsafe.user?.first_name).toBe('Test')
        expect(app.initDataUnsafe.auth_date).toBe(123)
    })

    test('BackButton has correct interface', () => {
        const app = createMockMaxWebApp()
        expect(app.BackButton.isVisible).toBe(false)
        expect(typeof app.BackButton.onClick).toBe('function')
        expect(typeof app.BackButton.offClick).toBe('function')
        expect(typeof app.BackButton.show).toBe('function')
        expect(typeof app.BackButton.hide).toBe('function')
    })

    test('HapticFeedback has correct interface', () => {
        const app = createMockMaxWebApp()
        expect(typeof app.HapticFeedback.impactOccurred).toBe('function')
        expect(typeof app.HapticFeedback.notificationOccurred).toBe('function')
        expect(typeof app.HapticFeedback.selectionChanged).toBe('function')
    })

    test('window.WebApp can be set and read', () => {
        const app = createMockMaxWebApp()
        ;(globalThis as any).window.WebApp = app

        expect((globalThis as any).window.WebApp).toBe(app)
        expect((globalThis as any).window.WebApp.platform).toBe('web')

        app.ready()
        expect(app.ready).toHaveBeenCalledTimes(1)

        delete (globalThis as any).window.WebApp
    })

    test('overrides work correctly', () => {
        const app = createMockMaxWebApp({ platform: 'ios', version: '25.10.0' })
        expect(app.platform).toBe('ios')
        expect(app.version).toBe('25.10.0')
    })
})
