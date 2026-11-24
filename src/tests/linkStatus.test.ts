import { describe, expect, test } from 'bun:test'
import { nextLink } from '../util/linkStatus'

describe('nextLink', () => {
    test('first connect (initial → up) emits nothing', () => {
        expect(nextLink('initial', 'up')).toEqual({ state: 'up', signal: null })
    })
    test('drop (up → down) emits lost', () => {
        expect(nextLink('up', 'down')).toEqual({
            state: 'down',
            signal: 'lost',
        })
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
    test('down before ever up (initial → down) emits nothing and stays initial', () => {
        expect(nextLink('initial', 'down')).toEqual({
            state: 'initial',
            signal: null,
        })
    })
    test('first connect reporting connecting first: no restored', () => {
        const a = nextLink('initial', 'down')
        expect(nextLink(a.state, 'up')).toEqual({ state: 'up', signal: null })
    })
})

describe('nextLink: stuck / off', () => {
    test('stuck before the first connect emits lost', () => {
        expect(nextLink('initial', 'stuck')).toEqual({
            state: 'down',
            signal: 'lost',
        })
    })
    test('stuck while already down emits lost again (new reason)', () => {
        expect(nextLink('down', 'stuck')).toEqual({
            state: 'down',
            signal: 'lost',
        })
    })
    test('first up after stuck emits restored', () => {
        const a = nextLink('initial', 'stuck')
        const b = nextLink(a.state, 'down')
        expect(nextLink(b.state, 'up')).toEqual({
            state: 'up',
            signal: 'restored',
        })
    })
    test('off after stuck closes the loss', () => {
        expect(nextLink('down', 'off')).toEqual({
            state: 'initial',
            signal: 'restored',
        })
    })
    test('off without a loss emits nothing', () => {
        expect(nextLink('initial', 'off')).toEqual({
            state: 'initial',
            signal: null,
        })
    })
})
