let sidPromise: Promise<void> | null = null
let sidResolve: (() => void) | null = null

/**
 * Должно вызываться из SocketIOInitProvider сразу после того, как
 * window.sid был проставлен. Резолвит любые ожидающие waitForSidAvailable().
 */
export function markSidAvailable() {
    sidResolve?.()
}

/**
 * Возвращает промис, который резолвится, когда window.sid появится.
 * Один промис-синглтон на все вызовы — никакого polling'а.
 */
export default function waitForSidAvailable(): Promise<void> {
    if (typeof window === 'undefined') {
        return Promise.resolve()
    }
    if (typeof window.sid !== 'undefined') {
        return Promise.resolve()
    }
    if (!sidPromise) {
        sidPromise = new Promise<void>((resolve) => {
            sidResolve = () => {
                resolve()
            }
        })
    }
    return sidPromise
}