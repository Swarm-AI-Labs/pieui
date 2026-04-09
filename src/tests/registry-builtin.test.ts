import { describe, test, expect } from 'bun:test'
import { getAllRegisteredComponents, hasComponent } from '../util/registry'

// Side-effect import — triggers all self-registrations via components/index.ts
import '../components'

const EXPECTED_COMPONENTS = [
    'SequenceCard',
    'BoxCard',
    'UnionCard',
    'AjaxGroupCard',
    'HiddenCard',
    'AutoRedirectCard',
    'HTMLEmbedCard',
    'IOEventsCard',
]

describe('Built-in component registration', () => {
    for (const name of EXPECTED_COMPONENTS) {
        test(`${name} is registered`, () => {
            expect(hasComponent(name)).toBe(true)
        })
    }

    test('registry contains at least all expected components', () => {
        const registered = getAllRegisteredComponents()
        expect(registered.length).toBeGreaterThanOrEqual(
            EXPECTED_COMPONENTS.length
        )
    })
})
