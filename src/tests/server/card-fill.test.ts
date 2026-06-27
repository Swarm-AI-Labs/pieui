import { describe, expect, test } from 'bun:test'
import { Card, InputCard } from '../../server/card'

class Hidden extends InputCard {
    constructor(
        public name: string,
        public value: unknown = null
    ) {
        super()
    }
}
class Group extends Card {
    constructor(public content: Card[]) {
        super()
    }
}

describe('InputCard discovery & fill', () => {
    test('inputChildLoc finds named InputCards in the tree', () => {
        const g = new Group([new Hidden('email'), new Hidden('token')])
        expect(Object.keys(g.inputChildLoc()).sort()).toEqual(['email', 'token'])
    })
    test('fill assigns values by name and generates', () => {
        const g = new Group([new Hidden('email')])
        const out = g.fill({ email: 'a@b.c' }) as { content: unknown[] }
        expect(out.content[0]).toEqual({
            card: 'Hidden',
            data: { name: 'email', value: 'a@b.c' },
        })
    })
})
