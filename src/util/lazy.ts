import { lazy, ComponentType, LazyExoticComponent } from 'react'

const moduleCache = new Map<string, any>()

/**
 * Cache a module-load promise under `name`, but evict it if it rejects — a
 * cached *rejected* promise would otherwise permanently break the component
 * for the session (every later render/preload would re-throw the same error),
 * making a transient chunk-load failure (flaky network, stale deploy)
 * unrecoverable without a full reload. Evicting lets the next render/preload
 * retry the import.
 */
function cachePromise(name: string, promise: Promise<any>): Promise<any> {
    promise.catch(() => {
        // Only evict if this exact promise is still the cached one (a newer
        // successful attempt may have replaced it in the meantime).
        if (moduleCache.get(name) === promise) {
            moduleCache.delete(name)
        }
    })
    moduleCache.set(name, promise)
    return promise
}

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
        return cachePromise(name, loader().then((mod) => mod))
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
    return cachePromise(name, loader().then((mod) => mod))
}
