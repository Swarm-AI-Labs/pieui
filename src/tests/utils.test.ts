import { describe, test, expect } from 'bun:test'
import { cn } from '../util/tailwindCommonUtils'
import { sx2radium } from '../util/sx2radium'

describe('cn() utility', () => {
    test('merges class names', () => {
        expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
    })

    test('deduplicates conflicting tailwind classes', () => {
        const result = cn('px-2', 'px-4')
        expect(result).toBe('px-4')
    })

    test('handles conditional classes', () => {
        const result = cn('base', false && 'hidden', 'visible')
        expect(result).toBe('base visible')
    })

    test('handles undefined/null gracefully', () => {
        expect(cn(undefined, null, 'ok')).toBe('ok')
    })

    test('returns empty string for no args', () => {
        expect(cn()).toBe('')
    })
})

describe('sx2radium()', () => {
    test('returns empty object for undefined', () => {
        expect(sx2radium(undefined)).toEqual({})
    })

    test('returns a copy of the input', () => {
        const input = { color: 'red', fontSize: 14 }
        const result = sx2radium(input)
        expect(result).toEqual({ color: 'red', fontSize: 14 })
        expect(result).not.toBe(input) // must be a copy
    })

    test('preserves all CSS properties', () => {
        const input = {
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#000',
            padding: '8px 16px',
        }
        expect(sx2radium(input)).toEqual(input)
    })
})
