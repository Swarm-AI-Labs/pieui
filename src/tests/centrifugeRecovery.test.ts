import { describe, expect, test } from 'bun:test'
import { shouldResync, isUnrecoverableChannel } from '../util/centrifugeRecovery'

describe('shouldResync', () => {
    test('fresh subscribe (not recovering) → no resync', () => {
        expect(shouldResync({ wasRecovering: false, recovered: false })).toBe(false)
    })
    test('reconnect that recovered successfully → no resync', () => {
        expect(shouldResync({ wasRecovering: true, recovered: true })).toBe(false)
    })
    test('reconnect that failed to recover → resync', () => {
        expect(shouldResync({ wasRecovering: true, recovered: false })).toBe(true)
    })
    test('missing fields default to no resync', () => {
        expect(shouldResync({})).toBe(false)
    })
})

describe('isUnrecoverableChannel', () => {
    test('server marks channel recoverable → false', () => {
        expect(isUnrecoverableChannel({ recoverable: true })).toBe(false)
    })
    test('server marks channel non-recoverable → true', () => {
        expect(isUnrecoverableChannel({ recoverable: false })).toBe(true)
    })
    test('unknown recoverable flag → false (do not warn spuriously)', () => {
        expect(isUnrecoverableChannel({})).toBe(false)
    })
})
