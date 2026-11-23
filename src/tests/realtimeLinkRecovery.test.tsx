/**
 * Realtime link recovery, end to end through `CentrifugeIOInitProvider`, on the
 * real centrifuge-js client that `getCentrifuge` builds (only its WebSocket and
 * `fetch` are fakes).
 *
 * - SPRK-2035: a page opened while the backend is down got no answer from
 *   `api/support/centrifuge`, never connected and reported nothing.
 * - SPRK-2033: a realtime token refused with 401 stopped centrifuge-js for
 *   good; nothing brought it back.
 */

import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test'
import { act, createElement, type ReactNode } from 'react'
import { Window } from 'happy-dom'
import { State, type Centrifuge } from 'centrifuge'
import CentrifugeIOInitProvider from '../providers/CentrifugeIOInitProvider'
import CentrifugeIOContext, { getCentrifuge } from '../util/centrifuge'
import { PieConfigContext } from '../util/pieConfig'
import {
    SUPPORT_RETRY_DELAYS_MS,
    __resetSupportCacheForTest,
} from '../util/useIsSupported'
import { UNAUTHORIZED_RETRY_EVERY_MS } from '../util/centrifugeUnauthorized'
import type { PieConfig } from '../types'

// react-dom probes `document` once, as it loads; the suite-wide shim
// (tests/setup.ts) is too thin for that, so it sees a happy-dom one meanwhile.
const shimDocument = globalThis.document
;(globalThis as any).document = new Window().document
// No @types/react-dom here: the two calls used are typed by hand.
interface Root {
    render(node: ReactNode): void
    unmount(): void
}
const { createRoot } = (await import('react-dom/client' as string)) as {
    createRoot: (container: Element) => Root
}
;(globalThis as any).document = shimDocument

const API = 'https://api.test/'
const WS = 'wss://rt.test/connection/websocket'

// ---------------------------------------------------------------- backend fake

type Answer = 'down' | number | boolean

const backend = {
    /** `api/support/centrifuge`: 'down' rejects, a number is that status. */
    support: true as Answer,
    /** `gen_token`: true → 200 with a token, a number → that status. */
    token: true as Answer,
    /** Whether the WebSocket server accepts connections. */
    wsUp: true,
    /**
     * Tokens are issued per server generation; a restart (a deploy) bumps it,
     * and a connect with an older token is answered "token expired" — as
     * Centrifugo does once the 60 s token outlived the outage.
     */
    generation: 0,
    supportCalls: 0,
    tokenCalls: 0,
    sockets: [] as FakeSocket[],
}

const fakeFetch = async (input: RequestInfo | URL) => {
    const url = String(input)
    const reply = (answer: Answer, body: unknown) => {
        if (answer === 'down') throw new TypeError('Failed to fetch')
        if (typeof answer === 'number')
            return new Response('nope', { status: answer })
        return new Response(JSON.stringify(body), { status: 200 })
    }
    if (url === API + 'api/support/centrifuge') {
        backend.supportCalls += 1
        return reply(backend.support, backend.support)
    }
    if (url === API + 'api/centrifuge/gen_token') {
        backend.tokenCalls += 1
        return reply(backend.token, { token: `jwt-${backend.generation}` })
    }
    throw new Error(`unexpected fetch ${url}`)
}

/** Speaks just enough of the Centrifugo JSON protocol to connect. */
class FakeSocket {
    onopen?: () => void
    onclose?: (e: { code: number; reason: string }) => void
    onerror?: (e: unknown) => void
    onmessage?: (e: { data: string }) => void
    readyState = 0
    constructor() {
        backend.sockets.push(this)
        setTimeout(() => {
            if (!backend.wsUp) return this.drop()
            this.readyState = 1
            this.onopen?.()
        }, 0)
    }
    send(data: string) {
        for (const line of data.split('\n').filter(Boolean)) {
            const cmd = JSON.parse(line)
            if (cmd.connect) {
                const fresh = cmd.connect.token === `jwt-${backend.generation}`
                const reply = fresh
                    ? { id: cmd.id, connect: { client: 'c1', version: 'test' } }
                    : {
                          id: cmd.id,
                          error: { code: 109, message: 'token expired' },
                      }
                setTimeout(
                    () => this.onmessage?.({ data: JSON.stringify(reply) }),
                    0
                )
            }
        }
    }
    close() {
        this.readyState = 3
    }
    /** The server closed the connection. */
    drop() {
        this.readyState = 3
        this.onclose?.({ code: 1006, reason: '' })
    }
}

// -------------------------------------------------------------------- harness

const CACHE = Symbol.for('@swarm.ing/pieui:centrifuge-cache')
const realFetch = globalThis.fetch
const realWebSocket = globalThis.WebSocket

let root: Root | undefined
let client: Centrifuge
const lost: Array<[string, unknown]> = []
const restored: string[] = []

const flush = async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve()
}

/**
 * Moves the fake clock in small steps, letting promises settle and React
 * commit (each step is its own `act`) in between.
 */
const advance = async (ms: number, step = 10) => {
    for (let t = 0; t < ms; t += step) {
        await act(async () => {
            jest.advanceTimersByTime(Math.min(step, ms - t))
            await flush()
        })
    }
}

const render = async (extra: Partial<PieConfig> = {}) => {
    const config: PieConfig = {
        apiServer: API,
        centrifugeServer: WS,
        onLinkLost: (source, detail) => lost.push([source, detail]),
        onLinkRestored: (source) => restored.push(source),
        ...extra,
    }
    client = getCentrifuge(API, WS)!
    const container = new Window().document.createElement('div')
    root = createRoot(container as unknown as Element)
    const tree = (children: ReactNode) =>
        createElement(
            PieConfigContext.Provider,
            { value: config },
            createElement(
                CentrifugeIOContext.Provider,
                { value: client },
                createElement(CentrifugeIOInitProvider, null, children)
            )
        )
    await act(async () => {
        root!.render(tree(null))
        await flush()
    })
}

beforeEach(() => {
    jest.useFakeTimers()
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    globalThis.fetch = fakeFetch as typeof fetch
    ;(globalThis as any).WebSocket = FakeSocket
    Object.assign(backend, {
        support: true,
        token: true,
        wsUp: true,
        generation: 0,
        supportCalls: 0,
        tokenCalls: 0,
        sockets: [],
    })
    lost.length = 0
    restored.length = 0
    __resetSupportCacheForTest()
    ;(globalThis as any)[CACHE]?.clear()
})

afterEach(async () => {
    await act(async () => root?.unmount())
    root = undefined
    globalThis.fetch = realFetch
    ;(globalThis as any).WebSocket = realWebSocket
    ;(globalThis as any)[CACHE]?.clear()
    jest.useRealTimers()
})

// ---------------------------------------------------------------------- tests

describe('support request (SPRK-2035)', () => {
    test('asked again until answered; the link is lost meanwhile and restored on connect', async () => {
        backend.support = 'down'
        await render()

        expect(backend.supportCalls).toBe(1)
        expect(lost).toEqual([['centrifuge', { reason: 'support' }]])
        expect(backend.sockets).toHaveLength(0)

        // 3 s, then 5 s, 10 s, 20 s, 30 s, 30 s …
        await advance(SUPPORT_RETRY_DELAYS_MS[0])
        expect(backend.supportCalls).toBe(2)
        await advance(SUPPORT_RETRY_DELAYS_MS[1])
        expect(backend.supportCalls).toBe(3)
        await advance(10_000 + 20_000 + 30_000 + 30_000)
        expect(backend.supportCalls).toBe(7)
        // Still one loss: a stall is reported once.
        expect(lost).toHaveLength(1)
        expect(restored).toEqual([])

        // The backend is back: the next try is answered and the client connects.
        backend.support = true
        await advance(30_000 + 100)
        expect(backend.supportCalls).toBe(8)
        expect(client.state).toBe(State.Connected)
        expect(restored).toEqual(['centrifuge'])
        expect(lost).toHaveLength(1)
    })

    test('a non-2xx answer is not an answer', async () => {
        backend.support = 404
        await render()
        expect(lost).toEqual([['centrifuge', { reason: 'support' }]])
        backend.support = true
        await advance(SUPPORT_RETRY_DELAYS_MS[0] + 100)
        expect(client.state).toBe(State.Connected)
        expect(restored).toEqual(['centrifuge'])
    })

    test('answered "off" after a stall: the loss is closed, nothing connects', async () => {
        backend.support = 503
        await render()
        backend.support = false
        await advance(SUPPORT_RETRY_DELAYS_MS[0])
        expect(restored).toEqual(['centrifuge'])
        expect(backend.sockets).toHaveLength(0)
        expect(client.state).toBe(State.Disconnected)
        // And no more asking.
        await advance(120_000, 1_000)
        expect(backend.supportCalls).toBe(2)
    })

    test('answered at once: no loss reported', async () => {
        await render()
        await advance(100)
        expect(client.state).toBe(State.Connected)
        expect(lost).toEqual([])
        expect(restored).toEqual([])
    })
})

describe('refused token (SPRK-2033)', () => {
    /** Connected, then the backend restarts and refuses the old session. */
    const connectThenRefuse = async (extra: Partial<PieConfig> = {}) => {
        await render(extra)
        await advance(100)
        expect(client.state).toBe(State.Connected)
        lost.length = 0
        restored.length = 0

        // Restarted (a deploy): the old token is no good, and the session
        // behind it is gone, so a new one is refused.
        backend.token = 401
        backend.generation += 1
        backend.sockets.at(-1)!.drop()
        await advance(100)
        // Dropped: Centrifuge retries by itself, the loss is reported once.
        expect(lost).toHaveLength(1)
        // Its reconnect asks for a token and is refused for good.
        await advance(30_000)
        expect(backend.tokenCalls).toBeGreaterThanOrEqual(2)
    }

    test('onUnauthorized renews the session → the client reconnects by itself', async () => {
        const onUnauthorized = jest.fn(async () => {
            backend.token = true
            return true
        })
        await connectThenRefuse({ onUnauthorized })

        expect(onUnauthorized).toHaveBeenCalledTimes(1)
        expect(onUnauthorized).toHaveBeenCalledWith('centrifuge')
        expect(client.state).toBe(State.Connected)
        expect(restored).toEqual(['centrifuge'])
        // No `unauthorized` loss: it was recovered.
        expect(lost).toHaveLength(1)
    })

    test('onUnauthorized says no → stopped, loss reported with reason unauthorized', async () => {
        const onUnauthorized = jest.fn(() => false)
        await connectThenRefuse({ onUnauthorized })

        expect(onUnauthorized).toHaveBeenCalledTimes(1)
        expect(client.state).toBe(State.Disconnected)
        expect(lost.at(-1)).toEqual([
            'centrifuge',
            { code: 1, reason: 'unauthorized' },
        ])
        const tokens = backend.tokenCalls
        await advance(120_000, 1_000)
        expect(backend.tokenCalls).toBe(tokens)
        expect(restored).toEqual([])
    })

    test('a throwing onUnauthorized counts as no', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        await connectThenRefuse({
            onUnauthorized: async () => {
                throw new Error('refresh failed')
            },
        })
        warn.mockRestore()
        expect(client.state).toBe(State.Disconnected)
        expect(lost.at(-1)?.[1]).toEqual({ code: 1, reason: 'unauthorized' })
    })

    test('without onUnauthorized: stopped as before, loss reported with reason unauthorized', async () => {
        await connectThenRefuse()
        expect(client.state).toBe(State.Disconnected)
        expect(lost.at(-1)?.[1]).toEqual({ code: 1, reason: 'unauthorized' })
    })

    test('asked at most once per 30 s while the token keeps being refused', async () => {
        // Says "renewed", but the backend keeps refusing.
        const onUnauthorized = jest.fn(() => true)
        await connectThenRefuse({ onUnauthorized })
        const first = onUnauthorized.mock.calls.length
        expect(first).toBe(1)

        await advance(UNAUTHORIZED_RETRY_EVERY_MS * 3 + 1_000, 1_000)
        // One ask per window, not a loop.
        expect(onUnauthorized.mock.calls.length).toBe(first + 3)
        expect(client.state).toBe(State.Disconnected)
        // Each refused connect asked for one token.
        expect(backend.tokenCalls).toBeLessThanOrEqual(2 + 4)

        // The backend accepts again: the next ask brings it back.
        backend.token = true
        await advance(UNAUTHORIZED_RETRY_EVERY_MS, 1_000)
        expect(client.state).toBe(State.Connected)
        expect(restored).toEqual(['centrifuge'])
    })

    test('refused on the first connect: renewed and connected', async () => {
        backend.token = 403
        const onUnauthorized = jest.fn(async () => {
            backend.token = true
            return true
        })
        await render({ onUnauthorized })
        await advance(500)
        expect(onUnauthorized).toHaveBeenCalledTimes(1)
        expect(client.state).toBe(State.Connected)
    })

    test('unmounted while asking: no reconnect afterwards', async () => {
        let answer: (ok: boolean) => void = () => {}
        const onUnauthorized = jest.fn(
            () => new Promise<boolean>((resolve) => (answer = resolve))
        )
        await connectThenRefuse({ onUnauthorized })
        expect(onUnauthorized).toHaveBeenCalledTimes(1)
        const sockets = backend.sockets.length

        await act(async () => root!.unmount())
        root = undefined
        backend.token = true
        answer(true)
        await advance(5_000)
        expect(backend.sockets.length).toBe(sockets)
        expect(client.state).toBe(State.Disconnected)
    })
})
