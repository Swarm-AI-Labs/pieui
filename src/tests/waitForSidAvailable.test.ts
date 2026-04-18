/**
 * Unit tests for `waitForSidAvailable` and `markSidAvailable` from
 * `util/waitForSidAvailable.ts`.
 *
 * These utilities coordinate the moment when a Socket.IO session ID (`sid`)
 * becomes available on `window.sid` after the WebSocket handshake completes.
 * Instead of polling, the module exposes a Promise singleton that resolves
 * exactly once when `markSidAvailable()` is called by `SocketIOInitProvider`.
 *
 * Testing strategy:
 *   - When `window.sid` is already defined the function must resolve immediately.
 *   - `markSidAvailable` must resolve any in-flight promise.
 *   - The function must return a Promise (not throw synchronously).
 *   - Both exports must be callable without crashing.
 *
 * Important: the module stores its promise singleton at module scope, so tests
 * that set `window.sid` clean up after themselves to avoid leaking state.
 */

import { describe, test, expect } from 'bun:test'
import waitForSidAvailable, { markSidAvailable } from '../util/waitForSidAvailable'

describe('waitForSidAvailable()', () => {
    // When the sid is already on window the returned promise should resolve
    // immediately without waiting for markSidAvailable() to be called.
    test('resolves immediately when window.sid is already defined', async () => {
        // Set sid before calling the function
        ;(globalThis as any).window.sid = 'pre-existing-sid'

        try {
            const result = await Promise.race([
                waitForSidAvailable(),
                // A 100 ms timeout — if it does not resolve immediately the
                // race winner will be the timeout signal instead.
                new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 100)),
            ])
            expect(result).not.toBe('timeout')
        } finally {
            // Clean up so other tests do not inherit the pre-set sid.
            delete (globalThis as any).window.sid
        }
    })

    // The return type must be a Promise regardless of the current sid state.
    test('always returns a Promise object', () => {
        const result = waitForSidAvailable()
        expect(result).toBeInstanceOf(Promise)
    })
})

describe('markSidAvailable()', () => {
    // markSidAvailable must be callable without throwing — even if
    // waitForSidAvailable has not been called yet (no pending promise exists).
    test('can be called without throwing when no promise is pending', () => {
        expect(() => markSidAvailable()).not.toThrow()
    })

    // After markSidAvailable() is called, any in-flight waitForSidAvailable()
    // promise must resolve.  We set a short race timeout to avoid hanging the
    // test suite if the resolve mechanism is broken.
    test('resolves a pending waitForSidAvailable promise', async () => {
        // Ensure window.sid is NOT set so the function creates a real pending promise.
        const previousSid = (globalThis as any).window.sid
        delete (globalThis as any).window.sid

        try {
            const pending = waitForSidAvailable()

            // Signal that the sid is now available.
            markSidAvailable()

            const result = await Promise.race([
                pending.then(() => 'resolved'),
                new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 500)),
            ])

            expect(result).toBe('resolved')
        } finally {
            // Restore original state.
            if (previousSid !== undefined) {
                ;(globalThis as any).window.sid = previousSid
            }
        }
    })
})
