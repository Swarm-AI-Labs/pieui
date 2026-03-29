import { describe, test, expect, beforeEach } from 'bun:test'
import {
    registerPieComponent,
    hasComponent,
    getRegistryEntry,
    getAllRegisteredComponents,
    getRegistrySize,
    unregisterComponent,
    getComponentMeta,
} from '../util/registry'

const DummyComponent = () => null

beforeEach(() => {
    // Clean up any registered components between tests
    getAllRegisteredComponents().forEach((name) => unregisterComponent(name))
})

describe('Component Registry', () => {
    test('registers a sync component', () => {
        registerPieComponent({
            name: 'TestCard',
            component: DummyComponent,
        })

        expect(hasComponent('TestCard')).toBe(true)
        expect(getRegistrySize()).toBe(1)
    })

    test('returns the component from getRegistryEntry', () => {
        registerPieComponent({
            name: 'TestCard',
            component: DummyComponent,
        })

        const entry = getRegistryEntry('TestCard')
        expect(entry).toBeDefined()
        expect(entry!.name).toBe('TestCard')
        expect(entry!.component).toBe(DummyComponent)
        expect(entry!.isLazy).toBe(false)
    })

    test('registers a lazy component via loader', () => {
        registerPieComponent({
            name: 'LazyCard',
            loader: () => Promise.resolve({ default: DummyComponent }),
        })

        const entry = getRegistryEntry('LazyCard')
        expect(entry).toBeDefined()
        expect(entry!.isLazy).toBe(true)
        expect(entry!.component).toBeDefined()
    })

    test('stores metadata', () => {
        registerPieComponent({
            name: 'MetaCard',
            component: DummyComponent,
            metadata: { version: '2.0.0', author: 'test' },
        })

        const meta = getComponentMeta('MetaCard')
        expect(meta).toEqual({ version: '2.0.0', author: 'test' })
    })

    test('unregisters a component', () => {
        registerPieComponent({
            name: 'Temp',
            component: DummyComponent,
        })
        expect(hasComponent('Temp')).toBe(true)

        unregisterComponent('Temp')
        expect(hasComponent('Temp')).toBe(false)
    })

    test('getAllRegisteredComponents returns all names', () => {
        registerPieComponent({ name: 'A', component: DummyComponent })
        registerPieComponent({ name: 'B', component: DummyComponent })
        registerPieComponent({ name: 'C', component: DummyComponent })

        const names = getAllRegisteredComponents()
        expect(names).toContain('A')
        expect(names).toContain('B')
        expect(names).toContain('C')
        expect(names.length).toBe(3)
    })

    test('throws if name is missing', () => {
        expect(() =>
            registerPieComponent({
                name: '',
                component: DummyComponent,
            })
        ).toThrow('requires a name')
    })

    test('throws if neither component nor loader provided', () => {
        expect(() =>
            registerPieComponent({
                name: 'Broken',
            } as any)
        ).toThrow('requires component or loader')
    })

    test('overwrites existing registration with same name', () => {
        const Other = () => 'other' as any
        registerPieComponent({ name: 'X', component: DummyComponent })
        registerPieComponent({ name: 'X', component: Other })

        expect(getRegistryEntry('X')!.component).toBe(Other)
        expect(getRegistrySize()).toBe(1)
    })
})
