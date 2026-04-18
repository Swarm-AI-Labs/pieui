/**
 * Unit tests for `trackLazy` and `preloadComponent` from `util/lazy.ts`.
 *
 * These utilities wrap React.lazy with a shared module-promise cache keyed by
 * component name.  The cache prevents redundant network requests when the same
 * lazy component mounts, unmounts, and remounts — or when a manual preload
 * races an initial render.
 *
 * Note: React.lazy components can only be *rendered* inside a Suspense
 * boundary, so these tests verify the caching contract and API shape rather
 * than the rendered output.
 */

import { describe, test, expect } from 'bun:test'
import { trackLazy, preloadComponent } from '../util/lazy'

// A minimal module-shape used as the resolved value in every loader below.
const makeDummyLoader = () =>
    Promise.resolve({ default: () => null as any })

describe('trackLazy()', () => {
    // The return value must be a React.lazy component — Bun does not provide a
    // Suspense renderer, but we can confirm the object carries the React lazy
    // $$typeof symbol and is non-null.
    test('returns a truthy React.lazy component', () => {
        const Lazy = trackLazy(makeDummyLoader, 'LazyTestCard_1')
        expect(Lazy).toBeDefined()
        expect(typeof Lazy).toBe('object')
        // React.lazy sets $$typeof to REACT_LAZY_TYPE
        expect((Lazy as any).$$typeof).toBeDefined()
    })

    // trackLazy wraps each call in a fresh React.lazy() call — it deduplicates
    // the *module-loading promise* (via the shared moduleCache), not the
    // React.lazy wrapper object.  The real deduplication contract lives on
    // the loader side: two trackLazy calls with the same name must cause the
    // underlying loader to run only once.  We verify that through
    // preloadComponent (which shares the same cache) in the section below.
    // Here we just confirm distinct lazy wrappers are returned per call.
    test('returns distinct React.lazy wrappers for separate calls with the same name', () => {
        const a = trackLazy(makeDummyLoader, 'LazyTestCard_2')
        const b = trackLazy(makeDummyLoader, 'LazyTestCard_2')
        // Each trackLazy call wraps the cached promise in a new lazy() object.
        expect(a).not.toBe(b)
        // Both must still be valid React.lazy components.
        expect((a as any).$$typeof).toBeDefined()
        expect((b as any).$$typeof).toBeDefined()
    })

    // Two calls with different names must produce distinct components even when
    // the loader factory is identical.
    test('returns different components for different names', () => {
        const a = trackLazy(makeDummyLoader, 'LazyTestCard_3a')
        const b = trackLazy(makeDummyLoader, 'LazyTestCard_3b')
        expect(a).not.toBe(b)
    })
})

describe('preloadComponent()', () => {
    // Calling without a loader should be a no-op — it must not throw and must
    // return undefined so callers do not need to null-check the result.
    test('returns undefined when loader is not provided', async () => {
        const result = await preloadComponent('PreloadNoLoader')
        expect(result).toBeUndefined()
    })

    // Calling with undefined loader explicitly also returns undefined.
    test('returns undefined when loader is explicitly undefined', async () => {
        const result = await preloadComponent('PreloadExplicitUndefined', undefined)
        expect(result).toBeUndefined()
    })

    // A provided loader should be invoked, and the result should be a Promise
    // that resolves to the module object.
    test('invokes the loader and resolves to the module', async () => {
        const module = { default: () => null as any }
        const loader = () => Promise.resolve(module)

        const result = await preloadComponent('PreloadWithLoader', loader)
        expect(result).toBe(module)
    })

    // The module-level cache means a second call with the same name must NOT
    // invoke the loader again — confirming that preloading is idempotent.
    test('does not invoke the loader a second time for the same name (cache hit)', async () => {
        let callCount = 0
        const loader = () => {
            callCount++
            return Promise.resolve({ default: () => null as any })
        }

        // Use a unique name to avoid interference from other tests.
        await preloadComponent('PreloadCacheHit_unique', loader)
        await preloadComponent('PreloadCacheHit_unique', loader)

        // Loader must have been called exactly once despite two preload calls.
        expect(callCount).toBe(1)
    })

    // Preloading a component and then calling trackLazy with the same name
    // should share the same cached promise — ensuring the lazy render resolves
    // from the preloaded module rather than triggering a second network request.
    test('shares the cache with trackLazy when the same name is used', async () => {
        let loaderCallCount = 0
        const loader = () => {
            loaderCallCount++
            return Promise.resolve({ default: () => null as any })
        }

        // Preload first, then create the lazy component.
        await preloadComponent('PreloadThenLazy_unique', loader)
        trackLazy(loader, 'PreloadThenLazy_unique')

        // The loader should still have been called only once across both calls.
        expect(loaderCallCount).toBe(1)
    })
})
