/**
 * Unit tests for the React Native `ClientSources` implementation
 * (`platform/clientSources.native.ts`) and its host wiring
 * (`platform/nativeConfig.ts`).
 *
 * The native implementation pulls no native modules — it reads from sources a
 * host registers via `configureNativeClientSources`, with graceful empty
 * defaults when unconfigured. These tests run in plain bun (no Metro / native
 * runtime) by importing the `.native` module directly.
 */

import { describe, test, expect, afterEach } from 'bun:test'
import nativeClientSources from '../platform/clientSources.native'
import {
    configureNativeClientSources,
    resetNativeClientSources,
} from '../platform/nativeConfig'
import {
    setNativeField,
    resetNativeFields,
} from '../platform/nativeFormStore'

afterEach(() => {
    resetNativeClientSources()
    resetNativeFields()
})

describe('native clientSources — defaults when unconfigured', () => {
    test('isClient is always true', () => {
        expect(nativeClientSources.isClient()).toBe(true)
    })

    test('storage/cookie/input return null, url returns []', () => {
        expect(nativeClientSources.readWebStorage('local', 'k')).toBeNull()
        expect(nativeClientSources.readWebStorage('session', 'k')).toBeNull()
        expect(nativeClientSources.readCookie('c')).toBeNull()
        expect(nativeClientSources.readDomInput('field')).toBeNull()
        expect(nativeClientSources.readUrlParams('p')).toEqual([])
    })

    test('submitGlobalForm is a no-op when unconfigured', () => {
        expect(() => nativeClientSources.submitGlobalForm()).not.toThrow()
    })
})

describe('native clientSources — injected sources', () => {
    test('readWebStorage reads injected local/session adapters', () => {
        configureNativeClientSources({
            storage: { getItem: (k) => (k === 'token' ? 'abc' : null) },
            sessionStorage: { getItem: (k) => (k === 'foo' ? 'bar' : null) },
        })
        expect(nativeClientSources.readWebStorage('local', 'token')).toBe('abc')
        expect(nativeClientSources.readWebStorage('session', 'foo')).toBe('bar')
        expect(nativeClientSources.readWebStorage('local', 'nope')).toBeNull()
    })

    test('readUrlParams reads injected route params', () => {
        configureNativeClientSources({
            getRouteParams: (k) => (k === 'ref' ? ['one', 'two'] : []),
        })
        expect(nativeClientSources.readUrlParams('ref')).toEqual(['one', 'two'])
    })

    test('readDomInput reads the injected form-state getter', () => {
        configureNativeClientSources({
            getInput: (name) => (name === 'email' ? ['a@b.c'] : null),
        })
        expect(nativeClientSources.readDomInput('email')).toEqual(['a@b.c'])
        expect(nativeClientSources.readDomInput('missing')).toBeNull()
    })

    test('submitGlobalForm calls the injected submit handler', () => {
        let called = 0
        configureNativeClientSources({ submitForm: () => (called += 1) })
        nativeClientSources.submitGlobalForm()
        expect(called).toBe(1)
    })

    test('configure shallow-merges over previous config', () => {
        configureNativeClientSources({
            storage: { getItem: () => 'first' },
        })
        configureNativeClientSources({
            getRouteParams: () => ['r'],
        })
        expect(nativeClientSources.readWebStorage('local', 'x')).toBe('first')
        expect(nativeClientSources.readUrlParams('y')).toEqual(['r'])
    })
})

describe('native clientSources — sid', () => {
    test('setSid stores the value and readSid returns it', () => {
        nativeClientSources.setSid('native-sid')
        expect(nativeClientSources.readSid()).toBe('native-sid')
    })
})

describe('native clientSources — built-in form store', () => {
    test('readDomInput falls back to the native form store', () => {
        setNativeField('email', ['a@b.c'])
        expect(nativeClientSources.readDomInput('email')).toEqual(['a@b.c'])
        expect(nativeClientSources.readDomInput('missing')).toBeNull()
    })

    test('an explicit getInput overrides the form store', () => {
        setNativeField('email', ['from-store'])
        configureNativeClientSources({ getInput: () => ['from-getter'] })
        expect(nativeClientSources.readDomInput('email')).toEqual(['from-getter'])
    })
})

describe('native clientSources — async storage', () => {
    test('readWebStorageAsync reads an injected async adapter', async () => {
        configureNativeClientSources({
            asyncStorage: {
                getItem: async (k) => (k === 'token' ? 'async-abc' : null),
            },
        })
        expect(await nativeClientSources.readWebStorageAsync!('local', 'token')).toBe('async-abc')
        expect(await nativeClientSources.readWebStorageAsync!('local', 'nope')).toBeNull()
    })

    test('readWebStorageAsync falls back to the sync adapter', async () => {
        configureNativeClientSources({
            sessionStorage: { getItem: (k) => (k === 'foo' ? 'sync-bar' : null) },
        })
        expect(await nativeClientSources.readWebStorageAsync!('session', 'foo')).toBe('sync-bar')
    })
})
