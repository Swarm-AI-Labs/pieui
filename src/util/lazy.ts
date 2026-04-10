import { lazy, ComponentType, LazyExoticComponent } from 'react'

const moduleCache = new Map<string, any>()

/**
 * `React.lazy()` wrapper that dedupes identical dynamic imports by name.
 *
 * Calling `trackLazy(loader, 'Foo')` multiple times — for example from a
 * registered component and from a manual preload — will share a single
 * module promise, so the underlying `import()` only runs once even if the
 * component mounts and unmounts several times.
 *
 * @param loader A dynamic `import()` factory returning a module with a
 *               default export.
 * @param name   Stable cache key; typically the registered component name.
 * @returns A memoized `LazyExoticComponent` suitable for use with Suspense.
 */
export function trackLazy<T extends ComponentType<any>>(
    loader: () => Promise<{ default: T }>,
    name: string
): LazyExoticComponent<T> {
    return lazy(() => {
        if (moduleCache.has(name)) {
            return moduleCache.get(name)!
        }
        const promise = loader().then((mod) => mod)
        moduleCache.set(name, promise)
        return promise
    })
}

/**
 * Eagerly kicks off a dynamic import and stores its promise in the same
 * cache used by {@link trackLazy}, so that a later `React.lazy` render of
 * the same `name` resolves synchronously once the module has loaded.
 *
 * Safe to call when the `loader` is `undefined` (no-op) or when the module
 * has already been preloaded (returns the cached promise).
 *
 * @param name   Stable cache key; must match the name used by `trackLazy`.
 * @param loader Optional dynamic `import()` factory.
 * @returns The cached module promise, or `undefined` when no loader was provided.
 */
export const preloadComponent = async (
    name: string,
    loader?: () => Promise<any>
) => {
    if (!loader) return
    if (moduleCache.has(name)) return moduleCache.get(name)
    const promise = loader().then((mod) => mod)
    moduleCache.set(name, promise)
    return promise
}
