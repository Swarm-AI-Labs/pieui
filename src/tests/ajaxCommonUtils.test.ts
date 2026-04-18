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

import { describe, test, expect, mock } from 'bun:test'
import { getAjaxSubmit } from '../util/ajaxCommonUtils'

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
