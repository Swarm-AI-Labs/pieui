import { describe, expect, test } from 'bun:test'
import { shouldResync, isUnrecoverableChannel } from '../util/centrifugeRecovery'

// Mirrors the branch logic in PieCard's `subscribed` handler so a refactor
// that changes the trigger conditions is caught here.
function decide(ctx: {
    recoverable?: boolean
    wasRecovering?: boolean
    recovered?: boolean
}) {
    return {
        warn: isUnrecoverableChannel(ctx),
        resync: shouldResync(ctx),
    }
}

describe('PieCard recovery decision', () => {
    test('first subscribe on a recoverable channel: no warn, no resync', () => {
        expect(decide({ recoverable: true, wasRecovering: false })).toEqual({
            warn: false,
            resync: false,
        })
    })
    test('reconnect, recovered: no resync', () => {
        expect(
            decide({ recoverable: true, wasRecovering: true, recovered: true })
        ).toEqual({ warn: false, resync: false })
    })
    test('reconnect, gap: resync fires', () => {
        expect(
            decide({ recoverable: true, wasRecovering: true, recovered: false })
        ).toEqual({ warn: false, resync: true })
    })
    test('non-recoverable channel: warn fires', () => {
        expect(decide({ recoverable: false }).warn).toBe(true)
    })
})
