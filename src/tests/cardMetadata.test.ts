import { describe, test, expect } from 'bun:test'
import { extractCardMetadata, serializeCardMetadata } from '../code/cardMetadata'

describe('extractCardMetadata', () => {
    test('plain scaffold → ajax=false, io=false', () => {
        const src = `export interface MyCardData { name: string }\nexport type MyCardProps = any\n`
        expect(extractCardMetadata('MyCard', src)).toEqual({
            component: 'MyCard',
            input: false,
            ajax: false,
            io: false,
        })
    })

    test('ajax scaffold → ajax=true', () => {
        const src = `
export interface MyCardData {
    name: string
    pathname?: string
    depsNames: string[]
    kwargs: Record<string, string | number | boolean>
}
`
        expect(extractCardMetadata('MyCard', src).ajax).toBe(true)
        expect(extractCardMetadata('MyCard', src).io).toBe(false)
    })

    test('io scaffold → io=true', () => {
        const src = `
export interface MyCardData {
    useSocketioSupport?: boolean
    useCentrifugeSupport?: boolean
    useMittSupport?: boolean
    centrifugeChannel?: string
}
`
        expect(extractCardMetadata('MyCard', src).io).toBe(true)
        expect(extractCardMetadata('MyCard', src).ajax).toBe(false)
    })

    test('combined scaffold → both true', () => {
        const src = `
interface D {
    useSocketioSupport?: boolean
    pathname?: string
    depsNames: string[]
    kwargs: Record<string, string>
}
`
        expect(extractCardMetadata('C', src)).toEqual({
            component: 'C',
            input: false,
            ajax: true,
            io: true,
        })
    })

    test('undefined source → both false', () => {
        expect(extractCardMetadata('X', undefined)).toEqual({
            component: 'X',
            input: false,
            ajax: false,
            io: false,
        })
    })
})

describe('serializeCardMetadata', () => {
    test('emits sorted keys with trailing newline', () => {
        const bytes = serializeCardMetadata({
            component: 'B',
            input: false,
            ajax: true,
            io: false,
        })
        const text = new TextDecoder().decode(bytes)
        expect(text).toBe('{"ajax":true,"component":"B","input":false,"io":false}\n')
    })
})
