import { describe, test, expect, mock, afterEach } from 'bun:test'
import clientSources from '../platform/clientSources'

const w = globalThis as any

describe('clientSources (web) — storage', () => {
    afterEach(() => {
        delete w.localStorage
        delete w.sessionStorage
    })

    test('readWebStorage reads local storage by key', () => {
        w.localStorage = { getItem: (k: string) => (k === 'token' ? 'abc' : null) }
        expect(clientSources.readWebStorage('local', 'token')).toBe('abc')
    })

    test('readWebStorage returns null for a missing session key', () => {
        w.sessionStorage = { getItem: () => null }
        expect(clientSources.readWebStorage('session', 'nope')).toBeNull()
    })
})

describe('clientSources (web) — cookie', () => {
    afterEach(() => {
        if (w.document) delete w.document.cookie
    })

    test('readCookie reads and URL-decodes a value', () => {
        w.document.cookie = 'a=1; sid=hello%20world; b=2'
        expect(clientSources.readCookie('sid')).toBe('hello world')
    })

    test('readCookie returns null when absent', () => {
        w.document.cookie = 'a=1'
        expect(clientSources.readCookie('missing')).toBeNull()
    })
})

describe('clientSources (web) — url params', () => {
    afterEach(() => {
        if (w.location) delete w.location.search
    })

    test('readUrlParams returns repeated params', () => {
        w.location = { search: '?ref=one&ref=two&x=3' }
        expect(clientSources.readUrlParams('ref')).toEqual(['one', 'two'])
    })
})

describe('clientSources (web) — sid', () => {
    afterEach(() => {
        delete w.sid
    })

    test('readSid returns window.sid', () => {
        w.sid = 'session-123'
        expect(clientSources.readSid()).toBe('session-123')
    })

    test('readSid returns undefined when unset', () => {
        delete w.sid
        expect(clientSources.readSid()).toBeUndefined()
    })
})

describe('clientSources (web) — dom input', () => {
    afterEach(() => {
        if (w.document) delete w.document.getElementsByName
    })

    test('readDomInput returns null when no element is found', () => {
        w.document.getElementsByName = () => []
        expect(clientSources.readDomInput('email')).toBeNull()
    })
})

describe('clientSources (web) — global form', () => {
    test('submitGlobalForm submits the mounted form', () => {
        const mockSubmit = mock(() => {})
        const form = document.createElement('form')
        form.id = 'piedata_global_form'
        form.submit = mockSubmit
        document.body.appendChild(form)

        clientSources.submitGlobalForm()
        expect(mockSubmit).toHaveBeenCalledTimes(1)

        document.body.removeChild(form)
    })

    test('submitGlobalForm does not throw when form is absent', () => {
        expect(() => clientSources.submitGlobalForm()).not.toThrow()
    })
})
