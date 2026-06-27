import { describe, expect, test } from 'bun:test'
import { HiddenCard, UnionCard, IOCard } from '../../server/cards'

describe('built-in cards', () => {
    test('HiddenCard generates name+value+flags', () => {
        expect(new HiddenCard('email', 'x').generate()).toEqual({
            card: 'HiddenCard',
            data: {
                name: 'email',
                value: 'x',
                useSocketioSupport: false,
                useCentrifugeSupport: false,
                centrifugeChannel: null,
            },
        })
    })
    test('UnionCard nests content', () => {
        const u = new UnionCard([new HiddenCard('a', 1)])
        const out = u.generate() as { card: string; content: any[] }
        expect(out.card).toBe('UnionCard')
        expect(out.content[0].data.name).toBe('a')
    })
    test('createEvent builds pie{method}_{name}', () => {
        const c = new IOCard('chat', { useCentrifugeSupport: true })
        expect(c.createEvent('update', { x: 1 })).toEqual({
            name: 'pieupdate_chat',
            data: { x: 1 },
        })
    })
    test('createEvent throws without IO support', () => {
        const c = new IOCard('chat')
        expect(() => c.createEvent('update', {})).toThrow()
    })
})
