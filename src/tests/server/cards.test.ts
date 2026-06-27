import { describe, expect, test } from 'bun:test'
import { HiddenCard, UnionCard } from '../../server/cards'
import { Card } from '../../server/card'

/** Minimal realtime-enabled card for exercising base Card.createEvent. */
class ChatCard extends Card<{ name: string }> {
    useCentrifugeSupport = true
}

describe('built-in cards', () => {
    test('HiddenCard generates name+value', () => {
        expect(new HiddenCard({ name: 'email', value: 'x' }).generate()).toEqual(
            {
                card: 'HiddenCard',
                data: {
                    name: 'email',
                    value: 'x',
                },
            }
        )
    })
    test('UnionCard nests content', () => {
        const u = new UnionCard({
            content: [new HiddenCard({ name: 'a', value: '1' })],
        })
        const out = u.generate() as { card: string; content: any[] }
        expect(out.card).toBe('UnionCard')
        expect(out.content[0].data.name).toBe('a')
    })
    test('createEvent builds pie{method}_{name}', () => {
        const c = new ChatCard({ name: 'chat' })
        expect(c.createEvent('update', { x: 1 })).toEqual({
            name: 'pieupdate_chat',
            data: { x: 1 },
        })
    })
    test('createEvent throws without IO support', () => {
        const c = new UnionCard({ name: 'chat', content: [] })
        expect(() => c.createEvent('update', {})).toThrow()
    })
})
