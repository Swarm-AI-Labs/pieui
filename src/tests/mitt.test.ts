import { describe, test, expect } from 'bun:test'
import { getEmitter } from '../util/mitt'

describe('getEmitter()', () => {
    test('returns the same instance on multiple calls', () => {
        const a = getEmitter()
        const b = getEmitter()
        expect(a).toBe(b)
    })

    test('emitter can emit and receive events', () => {
        const emitter = getEmitter()
        const received: any[] = []

        emitter.on('test-event', (data) => received.push(data))
        emitter.emit('test-event', { value: 42 })

        expect(received).toEqual([{ value: 42 }])

        // cleanup
        emitter.off('test-event')
    })

    test('emitter off removes listener', () => {
        const emitter = getEmitter()
        const received: any[] = []
        const handler = (data: any) => received.push(data)

        emitter.on('off-test', handler)
        emitter.emit('off-test', 'first')
        emitter.off('off-test', handler)
        emitter.emit('off-test', 'second')

        expect(received).toEqual(['first'])
    })
})