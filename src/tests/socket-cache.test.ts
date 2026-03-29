import { describe, test, expect } from 'bun:test'
import { getSocket } from '../util/socket'
import { getCentrifuge } from '../util/centrifuge'

describe('Socket caching', () => {
    test('getSocket returns same instance for same URL', () => {
        const a = getSocket('http://test-cache-1:3000')
        const b = getSocket('http://test-cache-1:3000')
        expect(a).toBe(b)
    })

    test('getSocket returns different instances for different URLs', () => {
        const a = getSocket('http://test-cache-2:3000')
        const b = getSocket('http://test-cache-3:4000')
        expect(a).not.toBe(b)
    })
})

describe('Centrifuge caching', () => {
    test('getCentrifuge returns null when no centrifugeServer', () => {
        expect(getCentrifuge('http://api.test')).toBeNull()
        expect(getCentrifuge('http://api.test', undefined)).toBeNull()
    })

    test('getCentrifuge returns same instance for same params', () => {
        const a = getCentrifuge(
            'http://api-cache-1.test',
            'ws://cf-cache-1.test'
        )
        const b = getCentrifuge(
            'http://api-cache-1.test',
            'ws://cf-cache-1.test'
        )
        expect(a).toBe(b)
    })

    test('getCentrifuge returns different instances for different params', () => {
        const a = getCentrifuge(
            'http://api-cache-2.test',
            'ws://cf-cache-2.test'
        )
        const b = getCentrifuge(
            'http://api-cache-3.test',
            'ws://cf-cache-3.test'
        )
        expect(a).not.toBe(b)
    })
})
