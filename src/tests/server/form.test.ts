import { describe, expect, test } from 'bun:test'
import { form2dict, aggregate } from '../../server/form'

describe('form parsing', () => {
    test('repeated keys become arrays, singles stay scalar', () => {
        expect(form2dict({ a: '1', b: ['x', 'y'] })).toEqual({
            a: '1',
            b: ['x', 'y'],
        })
    })
    test('single-element arrays collapse to scalar', () => {
        expect(form2dict({ a: ['1'] })).toEqual({ a: '1' })
    })
    test('by_underscore nests double-underscore keys', () => {
        expect(
            aggregate(
                { name: 'J', addr__city: 'NY', addr__zip: '1' },
                'by_underscore'
            )
        ).toEqual({ name: 'J', addr: { city: 'NY', zip: '1' } })
    })
    test('no rule returns data unchanged', () => {
        expect(aggregate({ a: 1 })).toEqual({ a: 1 })
    })
})
