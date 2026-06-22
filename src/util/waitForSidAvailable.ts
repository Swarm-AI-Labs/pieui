import { globalSingleton } from './globalSingleton'
import clientSources from '../platform/clientSources'

type SidState = {
    promise: Promise<void> | null
    resolve: (() => void) | null
}

// Stashed on globalThis so the provider that calls `markSidAvailable()` and the
// waiter that calls `waitForSidAvailable()` share one promise even when they are
// loaded from different pre-bundled entry points.
const state = globalSingleton<SidState>(
    '@swarm.ing/pieui:sid-state',
    () => ({ promise: null, resolve: null })
)

/**
 * Должно вызываться из SocketIOInitProvider сразу после того, как
 * window.sid был проставлен. Резолвит любые ожидающие waitForSidAvailable().
 */
export function markSidAvailable() {
    state.resolve?.()
}

/**
 * Возвращает промис, который резолвится, когда window.sid появится.
 * Один промис-синглтон на все вызовы — никакого polling'а.
 */
export default function waitForSidAvailable(): Promise<void> {
    if (!clientSources.isClient()) {
        return Promise.resolve()
    }
    if (clientSources.readSid() !== undefined) {
        return Promise.resolve()
    }
    if (!state.promise) {
        state.promise = new Promise<void>((resolve) => {
            state.resolve = () => {
                resolve()
            }
        })
    }
    return state.promise
}
