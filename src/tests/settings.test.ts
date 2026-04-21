import { describe, test, expect } from 'bun:test'
import { parseDotenv } from '../code/services/settings'

describe('parseDotenv', () => {
    test('parses KEY=value lines', () => {
        expect(parseDotenv('A=1\nB=two\n')).toEqual({ A: '1', B: 'two' })
    })

    test('strips matching double and single quotes', () => {
        expect(
            parseDotenv(`A="hello world"\nB='x y'\n`)
        ).toEqual({ A: 'hello world', B: 'x y' })
    })

    test('ignores blank lines and # comments', () => {
        expect(
            parseDotenv(`# comment\n\nA=1\n# another\nB=2\n`)
        ).toEqual({ A: '1', B: '2' })
    })

    test('ignores malformed lines without =', () => {
        expect(parseDotenv('JUSTAWORD\nA=ok\n')).toEqual({ A: 'ok' })
    })

    test('handles values that contain =', () => {
        expect(parseDotenv('A=x=y=z\n')).toEqual({ A: 'x=y=z' })
    })
})
