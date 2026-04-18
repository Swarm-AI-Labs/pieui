/**
 * Unit tests for the `pieName` utility.
 *
 * `pieName(name, child)` builds a composite component identifier using the
 * PieUI-internal separator constant (PIEBREAK = '__piedemo__').  This naming
 * convention is shared between the runtime renderer and server-side UI-config
 * generators, so any drift in the output format would cause silent mismatches
 * in production.  These tests pin the exact output so regressions surface
 * immediately.
 */

import { describe, test, expect } from 'bun:test'
import { pieName } from '../util/pieName'
import { PIEBREAK } from '../util/pieConfig'

describe('pieName()', () => {
    // The separator used by pieName must match the exported PIEBREAK constant
    // so that runtime lookups and config generators always agree.
    test('joins name and child with the PIEBREAK separator', () => {
        const result = pieName('OrderForm', 'amount')
        expect(result).toBe(`OrderForm${PIEBREAK}amount`)
    })

    // Standard use case: parent component name + a specific field or sub-card.
    test('produces the correct string for typical component/field pairs', () => {
        expect(pieName('UserCard', 'email')).toBe(`UserCard${PIEBREAK}email`)
        expect(pieName('PaymentForm', 'cardNumber')).toBe(
            `PaymentForm${PIEBREAK}cardNumber`
        )
    })

    // Empty strings are edge cases — the function should not throw and should
    // still return a predictable value (separator between two empty strings).
    test('handles empty name and empty child without throwing', () => {
        expect(() => pieName('', '')).not.toThrow()
        expect(pieName('', '')).toBe(PIEBREAK)
    })

    // An empty child produces a trailing separator — verify the contract is
    // stable even if this is not a recommended usage pattern.
    test('handles empty child gracefully', () => {
        const result = pieName('SomeCard', '')
        expect(result).toBe(`SomeCard${PIEBREAK}`)
    })

    // An empty name produces a leading separator — same stability contract.
    test('handles empty name gracefully', () => {
        const result = pieName('', 'fieldName')
        expect(result).toBe(`${PIEBREAK}fieldName`)
    })

    // The separator must appear exactly once between name and child.
    test('contains the separator exactly once', () => {
        const result = pieName('ParentCard', 'childField')
        const occurrences = result.split(PIEBREAK).length - 1
        expect(occurrences).toBe(1)
    })

    // The name part must be recoverable by splitting on PIEBREAK.
    test('parts are recoverable by splitting on PIEBREAK', () => {
        const name = 'InvoiceCard'
        const child = 'totalAmount'
        const composed = pieName(name, child)
        const [recoveredName, recoveredChild] = composed.split(PIEBREAK)
        expect(recoveredName).toBe(name)
        expect(recoveredChild).toBe(child)
    })
})
