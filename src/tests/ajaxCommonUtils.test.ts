/**
 * Unit tests for `getAjaxSubmit` from `util/ajaxCommonUtils.ts`.
 *
 * `getAjaxSubmit` is a plain factory function (no React hooks) that builds
 * the async submit callback used by `AjaxGroupCard` and similar containers.
 * It contains several guard clauses that short-circuit execution when required
 * arguments are absent — each of those is tested here so regressions in the
 * guard logic surface immediately without needing a full render tree.
 *
 * Tests that require actual HTTP calls or DOM form collection belong in an
 * integration layer; this file focuses on the observable API surface of the
 * factory itself.
 */

import { describe, test, expect, mock, afterEach } from 'bun:test'
import {
    getAjaxSubmit,
    parseDepName,
    readAjaxKey,
    readAjaxKeyAsync,
} from '../util/ajaxCommonUtils'

// A minimal no-op setter that satisfies the SetUiAjaxConfigurationType shape.
const makeSetUi = () => mock((_content: any) => {})

describe('getAjaxSubmit() — factory return value', () => {
    // The factory must always return a function — even when all arguments are
    // omitted — so that call sites can invoke it unconditionally.
    test('returns a function when called with no arguments', () => {
        const submit = getAjaxSubmit()
        expect(typeof submit).toBe('function')
    })

    // The returned function must be async (returns a Promise).
    test('the returned function is async (returns a Promise)', () => {
        const submit = getAjaxSubmit()
        const result = submit()
        expect(result).toBeInstanceOf(Promise)
        // Ensure unhandled rejection does not escape the test
        result.catch(() => {})
    })
})

describe('getAjaxSubmit() — guard clause: missing apiServer', () => {
    // When `apiServer` is not provided the factory should produce a no-op.
    // Calling it must resolve (not reject) and must not invoke the setter.
    test('no-ops and resolves when apiServer is absent', async () => {
        const setUi = makeSetUi()
        const submit = getAjaxSubmit(setUi, {}, [], '/some-path', {
            apiServer: undefined,
        })

        await expect(submit()).resolves.toBeUndefined()
        expect(setUi).not.toHaveBeenCalled()
    })

    // An explicit null apiServer is treated the same as absent.
    test('no-ops when apiServer is null', async () => {
        const setUi = makeSetUi()
        const submit = getAjaxSubmit(setUi, {}, [], '/some-path', {
            apiServer: null,
        })

        await expect(submit()).resolves.toBeUndefined()
        expect(setUi).not.toHaveBeenCalled()
    })
})

describe('getAjaxSubmit() — guard clause: missing pathname', () => {
    // Without a pathname there is no URL to POST to; the submit function must
    // be a no-op.
    test('no-ops and resolves when pathname is undefined', async () => {
        const setUi = makeSetUi()
        const submit = getAjaxSubmit(setUi, {}, [], undefined, {
            apiServer: 'http://api.example.com/',
        })

        await expect(submit()).resolves.toBeUndefined()
        expect(setUi).not.toHaveBeenCalled()
    })
})

describe('getAjaxSubmit() — guard clause: missing setUiAjaxConfiguration', () => {
    // Without a setter there is nowhere to deliver the response, so the
    // factory should return a no-op that silently resolves.
    test('no-ops and resolves when setUiAjaxConfiguration is undefined', async () => {
        const submit = getAjaxSubmit(undefined, {}, [], '/path', {
            apiServer: 'http://api.example.com/',
        })

        await expect(submit()).resolves.toBeUndefined()
    })
})

describe('getAjaxSubmit() — renderingLogEnabled flag', () => {
    // When renderingLogEnabled is true the factory logs registration details
    // to console at construction time.  We verify the flag is respected by
    // capturing console.log calls — without asserting exact message text so
    // the test stays robust against minor log wording changes.
    test('logs to console.log during factory call when renderingLogEnabled is true', () => {
        const originalLog = console.log
        const calls: any[][] = []
        console.log = (...args: any[]) => calls.push(args)

        try {
            getAjaxSubmit(makeSetUi(), { key: 'val' }, ['dep1'], '/route', {
                apiServer: 'http://api.example.com/',
                renderingLogEnabled: true,
            })
            // At least one log call must have occurred during construction.
            expect(calls.length).toBeGreaterThan(0)
        } finally {
            console.log = originalLog
        }
    })

    // When renderingLogEnabled is false (or omitted) no logs should be emitted.
    test('does not log to console when renderingLogEnabled is false', () => {
        const originalLog = console.log
        const calls: any[][] = []
        console.log = (...args: any[]) => calls.push(args)

        try {
            getAjaxSubmit(makeSetUi(), {}, [], '/route', {
                apiServer: 'http://api.example.com/',
                renderingLogEnabled: false,
            })
            expect(calls.length).toBe(0)
        } finally {
            console.log = originalLog
        }
    })
})

describe('parseDepName()', () => {
    test('treats a plain name as a DOM source', () => {
        expect(parseDepName('email')).toEqual({ source: 'dom', key: 'email' })
    })

    test('keeps sid as its own source', () => {
        expect(parseDepName('sid')).toEqual({ source: 'sid', key: 'sid' })
    })

    test('splits each recognized client-source prefix', () => {
        expect(parseDepName('localStorage:token')).toEqual({
            source: 'localStorage',
            key: 'token',
        })
        expect(parseDepName('sessionStorage:foo')).toEqual({
            source: 'sessionStorage',
            key: 'foo',
        })
        expect(parseDepName('cookie:sid')).toEqual({
            source: 'cookie',
            key: 'sid',
        })
        expect(parseDepName('url:ref')).toEqual({ source: 'url', key: 'ref' })
    })

    test('splits the async Telegram storage prefixes', () => {
        expect(parseDepName('telegram:cloud:token')).toEqual({
            source: 'telegram:cloud',
            key: 'token',
        })
        expect(parseDepName('telegram:secure:pin')).toEqual({
            source: 'telegram:secure',
            key: 'pin',
        })
    })

    test('preserves colons in the key after the prefix', () => {
        expect(parseDepName('localStorage:ns:token')).toEqual({
            source: 'localStorage',
            key: 'ns:token',
        })
    })

    test('treats an unrecognized prefix as a DOM name', () => {
        expect(parseDepName('odd:name')).toEqual({
            source: 'dom',
            key: 'odd:name',
        })
    })
})

describe('readAjaxKey() — client sources', () => {
    const w = globalThis as any

    afterEach(() => {
        delete w.localStorage
        delete w.sessionStorage
        if (w.document) delete w.document.cookie
        if (w.location) delete w.location.search
    })

    const stubStorage = (entries: Record<string, string>): Storage =>
        ({
            getItem: (k: string) =>
                Object.prototype.hasOwnProperty.call(entries, k)
                    ? entries[k]
                    : null,
        }) as Storage

    test('reads a localStorage value under its bare key', () => {
        w.localStorage = stubStorage({ token: 'abc' })
        expect(readAjaxKey('localStorage:token')).toEqual(['abc'])
    })

    test('returns [] for a missing localStorage key', () => {
        w.localStorage = stubStorage({})
        expect(readAjaxKey('localStorage:nope')).toEqual([])
    })

    test('returns [] (no throw) when storage access throws', () => {
        w.localStorage = {
            getItem() {
                throw new Error('blocked')
            },
        }
        expect(readAjaxKey('localStorage:token')).toEqual([])
    })

    test('reads a sessionStorage value', () => {
        w.sessionStorage = stubStorage({ foo: 'bar' })
        expect(readAjaxKey('sessionStorage:foo')).toEqual(['bar'])
    })

    test('reads and decodes a cookie value', () => {
        w.document.cookie = 'a=1; sid=hello%20world; b=2'
        expect(readAjaxKey('cookie:sid')).toEqual(['hello world'])
    })

    test('returns [] for a missing cookie', () => {
        w.document.cookie = 'a=1'
        expect(readAjaxKey('cookie:missing')).toEqual([])
    })

    test('reads repeated URL query params', () => {
        w.location = { search: '?ref=one&ref=two&x=3' }
        expect(readAjaxKey('url:ref')).toEqual(['one', 'two'])
    })

    test('returns [] for a missing URL query param', () => {
        w.location = { search: '?x=3' }
        expect(readAjaxKey('url:ref')).toEqual([])
    })

    test('returns [] (no DOM fallback) for an async Telegram source', () => {
        // getElementsByName would throw on the minimal document shim; reaching
        // it would mean the async guard failed.
        expect(readAjaxKey('telegram:cloud:token')).toEqual([])
        expect(readAjaxKey('telegram:secure:token')).toEqual([])
    })
})

describe('readAjaxKeyAsync() — Telegram storage', () => {
    const w = globalThis as any

    afterEach(() => {
        delete w.Telegram
    })

    const stubTelegram = (
        cloud: Record<string, string>,
        secure: Record<string, string> = {}
    ) => {
        const make = (entries: Record<string, string>) => ({
            getItem: (
                k: string,
                cb: (e: Error | null, v?: string) => void
            ) => cb(null, entries[k] ?? ''),
        })
        w.Telegram = {
            WebApp: { CloudStorage: make(cloud), SecureStorage: make(secure) },
        }
    }

    test('resolves a CloudStorage value', async () => {
        stubTelegram({ token: 'abc' })
        expect(await readAjaxKeyAsync('telegram:cloud:token')).toEqual(['abc'])
    })

    test('resolves a SecureStorage value', async () => {
        stubTelegram({}, { pin: '1234' })
        expect(await readAjaxKeyAsync('telegram:secure:pin')).toEqual(['1234'])
    })

    test('resolves [] for a missing key (empty string)', async () => {
        stubTelegram({})
        expect(await readAjaxKeyAsync('telegram:cloud:nope')).toEqual([])
    })

    test('resolves [] when WebApp storage is unavailable', async () => {
        expect(await readAjaxKeyAsync('telegram:cloud:token')).toEqual([])
    })

    test('resolves [] when getItem reports an error', async () => {
        w.Telegram = {
            WebApp: {
                CloudStorage: {
                    getItem: (
                        _k: string,
                        cb: (e: Error | null, v?: string) => void
                    ) => cb(new Error('nope')),
                },
            },
        }
        expect(await readAjaxKeyAsync('telegram:cloud:token')).toEqual([])
    })

    test('delegates synchronous sources to readAjaxKey', async () => {
        w.localStorage = {
            getItem: (k: string) => (k === 'token' ? 'sync' : null),
        }
        try {
            expect(await readAjaxKeyAsync('localStorage:token')).toEqual([
                'sync',
            ])
        } finally {
            delete w.localStorage
        }
    })
})

describe('getAjaxSubmit() — field names sent to the backend', () => {
    const w = globalThis as any

    afterEach(() => {
        delete w.localStorage
        delete w.fetch
    })

    test('submits a prefixed dep under its bare key', async () => {
        w.localStorage = {
            getItem: (k: string) => (k === 'token' ? 'abc' : null),
        }
        let captured: FormData | undefined
        w.fetch = mock(async (_url: string, init: any) => {
            captured = init.body as FormData
            return {
                ok: true,
                headers: { get: () => 'application/json' },
                json: async () => ({}),
            }
        })

        const submit = getAjaxSubmit(
            makeSetUi(),
            {},
            ['localStorage:token'],
            '/path',
            { apiServer: 'http://api.example.com/' }
        )
        await submit()

        expect(captured).toBeInstanceOf(FormData)
        expect(captured!.get('token')).toBe('abc')
        expect(captured!.get('localStorage:token')).toBeNull()
    })
})

describe('getAjaxSubmit() — RetryPolicy shape', () => {
    // Passing a retryPolicy object must not throw during factory construction.
    // The retry logic itself is exercised in integration tests with a real
    // HTTP server; here we just confirm the factory accepts the shape.
    test('accepts a retryPolicy without throwing', () => {
        expect(() =>
            getAjaxSubmit(makeSetUi(), {}, [], '/path', {
                apiServer: 'http://api.example.com/',
                retryPolicy: {
                    maxRetries: 3,
                    baseDelay: 500,
                    retryOn: [502, 503],
                },
            })
        ).not.toThrow()
    })

    // A timeout option must also be accepted without throwing.
    test('accepts a timeout option without throwing', () => {
        expect(() =>
            getAjaxSubmit(makeSetUi(), {}, [], '/path', {
                apiServer: 'http://api.example.com/',
                timeout: 5000,
            })
        ).not.toThrow()
    })
})
