import { describe, expect, test } from 'bun:test'
import { nextLink } from '../util/linkStatus'

describe('nextLink', () => {
    test('first connect (initial → up) emits nothing', () => {
        expect(nextLink('initial', 'up')).toEqual({ state: 'up', signal: null })
    })
    test('drop (up → down) emits lost', () => {
        expect(nextLink('up', 'down')).toEqual({ state: 'down', signal: 'lost' })
    })
    test('reconnect (down → up) emits restored', () => {
        expect(nextLink('down', 'up')).toEqual({
            state: 'up',
            signal: 'restored',
        })
    })
    test('repeated down (down → down) is idempotent — no double lost', () => {
        expect(nextLink('down', 'down')).toEqual({
            state: 'down',
            signal: null,
        })
    })
    test('repeated up (up → up) emits nothing', () => {
        expect(nextLink('up', 'up')).toEqual({ state: 'up', signal: null })
    })
    test('down before ever up (initial → down) emits nothing', () => {
        expect(nextLink('initial', 'down')).toEqual({
            state: 'down',
            signal: null,
        })
    })
})
