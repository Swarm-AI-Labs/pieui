import { describe, expect, test } from 'bun:test'
import { Card } from '../../server/card'

class Leaf extends Card {
    constructor(
        public name: string,
        public value: unknown
    ) {
        super()
    }
}
class Box extends Card {
    constructor(
        public title: string,
        public child: Card
    ) {
        super()
    }
}
class ListBox extends Card {
    constructor(public content: Card[]) {
        super()
    }
}

describe('Card.generate', () => {
    test('scalars go to data, camelCased; card = class name', () => {
        expect(new Leaf('email', 1).generate()).toEqual({
            card: 'Leaf',
            data: { name: 'email', value: 1 },
        })
    })
    test('a Card-typed prop becomes a generated child under its camelCase key', () => {
        expect(new Box('t', new Leaf('n', 2)).generate()).toEqual({
            card: 'Box',
            data: { title: 't' },
            child: { card: 'Leaf', data: { name: 'n', value: 2 } },
        })
    })
    test('Card[] becomes an array of generated children', () => {
        expect(new ListBox([new Leaf('a', 1)]).generate()).toEqual({
            card: 'ListBox',
            data: {},
            content: [{ card: 'Leaf', data: { name: 'a', value: 1 } }],
        })
    })
})
