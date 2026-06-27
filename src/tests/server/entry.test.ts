import { expect, test } from 'bun:test'
import * as server from '../../server'

test('server entry exports core building blocks', () => {
    expect(typeof server.Web).toBe('function')
    expect(typeof server.AsyncPage).toBe('function')
    expect(typeof server.Card).toBe('function')
    expect(typeof server.InputCard).toBe('function')
    expect(typeof server.publishToCentrifuge).toBe('function')
})
