import { ComponentMetadata, ComponentRegistration } from '../types'
import { trackLazy, preloadComponent as preloadModule } from './lazy'
import { ComponentType } from 'react'

/**
 * Central in-memory registry of PieUI components keyed by their name. Every
 * call to {@link registerPieComponent} writes into this `Map`, and the
 * dynamic UI renderer reads from it at render time to resolve a `card` name
 * to a concrete React component.
 *
 * The `Map` is stashed on `globalThis` under a shared `Symbol.for` key so that
 * every copy of this module resolves to the SAME instance. `registry.ts` gets
 * inlined into each pre-bundled entry point (main, `/components`, `/telegram`,
 * `/max`, `/agent`), and without a shared backing store each bundle would own a
 * separate `Map`. A component registered via one entry
 * (`import "@swarm.ing/pieui/components"`) would then be invisible to a renderer
 * loaded from another (`PieTelegramRoot` from `@swarm.ing/pieui/telegram`),
 * surfacing as "[UI] Component not found in registry".
 */
const REGISTRY_KEY = Symbol.for('@swarm.ing/pieui:component-registry')

type RegistryMap = Map<string, ComponentRegistration<any>>

const globalScope = globalThis as unknown as Record<
    symbol,
    RegistryMap | undefined
>

export const registry: RegistryMap =
    globalScope[REGISTRY_KEY] ?? (globalScope[REGISTRY_KEY] = new Map())

const normalizeRegistration = <TProps>(
    registration: ComponentRegistration<TProps>
): ComponentRegistration<TProps> => {
    if (!registration.name) {
        throw new Error('Component registration requires a name')
    }

    if (!registration.component && !registration.loader) {
        throw new Error(
            `Component "${registration.name}" requires component or loader`
        )
    }

    const entry: ComponentRegistration<TProps> = {
        name: registration.name,
        component: registration.component,
        loader: registration.loader,
        metadata: registration.metadata,
        fallback: registration.fallback,
        isLazy: false,
    }

    if (!entry.component && entry.loader) {
        entry.component = trackLazy(
            entry.loader,
            registration.name
        ) as ComponentType<TProps>
        // Keep the original `loader` on the entry (do NOT null it) so the chunk
        // can be warmed by name later — see {@link preloadComponent} /
        // {@link prefetchLazyComponents}. The renderer resolves lazy cards via
        // `entry.component` (the React.lazy) + `isLazy`, so retaining `loader`
        // has no effect on rendering.
        entry.isLazy = true
    }

    return entry
}

/**
 * Registers a PieUI component so it can be rendered by name from a dynamic
 * UI configuration.
 *
 * The registration must provide at least a `name` and either a `component`
 * or a `loader` (for code-split modules). When only `loader` is given, the
 * helper wraps it in {@link trackLazy} automatically and the resulting
 * `React.lazy` component is what gets stored.
 *
 * @param registration Shape describing the component, its metadata, and how
 *                     to load it.
 * @returns The concrete (possibly lazy) component that was stored.
 * @throws  Error When `name` is missing or neither `component` nor `loader`
 *                was supplied.
 */
export function registerPieComponent<TProps>(
    registration: ComponentRegistration<TProps>
): ComponentType<TProps> | undefined {
    const entry = normalizeRegistration(registration)
    registry.set(entry.name, entry)
    return entry.component
}

/**
 * Convenience wrapper that calls {@link registerPieComponent} for each item
 * in the provided array. Useful when a package exports a catalogue of cards
 * that should all be registered at once.
 */
export const registerMultipleComponents = (
    components: ComponentRegistration<any>[]
) => {
    components.forEach((component) => registerPieComponent(component))
}

/**
 * Removes a previously registered component from the registry. Subsequent
 * renders of that name will fall back to the default "unknown component"
 * behaviour of the dynamic renderer.
 */
export const unregisterComponent = (name: string) => {
    registry.delete(name)
}

/**
 * Returns `true` when a component with the given name has been registered.
 */
export const hasComponent = (name: string) => {
    return registry.has(name)
}

/**
 * Returns the `metadata` object supplied at registration time, or
 * `undefined` when the component was not registered or had no metadata.
 */
export const getComponentMeta = (
    name: string
): ComponentMetadata | undefined => {
    return registry.get(name)?.metadata
}

/**
 * Returns the full {@link ComponentRegistration} entry for the given name,
 * including any `fallback` node and the normalized component reference.
 */
export const getRegistryEntry = (
    name: string
): ComponentRegistration<any> | undefined => {
    return registry.get(name)
}

/**
 * Returns the list of names of every currently-registered PieUI component.
 * Handy for debugging and for the `pieui postbuild` CLI manifest generator.
 */
export const getAllRegisteredComponents = (): string[] => {
    return Array.from(registry.keys())
}

/**
 * Returns the number of components currently in the registry.
 */
export const getRegistrySize = (): number => {
    return registry.size
}

/**
 * Names of every registered code-split (lazy) component — those registered
 * with a `loader`. Handy for driving a prefetch pass.
 */
export const getLazyComponentNames = (): string[] =>
    Array.from(registry.values())
        .filter((e) => e.isLazy && typeof e.loader === 'function')
        .map((e) => e.name)

/**
 * Warm a single lazy component's chunk by name, so a later render resolves
 * synchronously (no Suspense fallback flash). No-op for unknown names or
 * eager components. Shares the same module cache as the render-time
 * `React.lazy`, so the import runs at most once.
 *
 * @returns The in-flight module promise, or `undefined` when there's nothing
 *          to preload.
 */
export const preloadComponent = (name: string): Promise<unknown> | undefined => {
    const entry = registry.get(name)
    if (!entry?.isLazy || typeof entry.loader !== 'function') return undefined
    return preloadModule(name, entry.loader)
}

let prefetchStarted = false

/**
 * Background-warm every registered lazy chunk so the first navigation to each
 * screen resolves its card from cache instead of waiting on the network.
 * Idempotent (only the first call does anything). Browser-only and
 * connection-aware: it yields to idle time, warms one chunk at a time so it
 * never competes with what the user is waiting on, and skips entirely on
 * metered / very slow connections. Errors are swallowed — a failed warm-up
 * just means the chunk loads on demand later.
 *
 * Call this once after the first screen has settled (e.g. in an effect on the
 * landing screen).
 */
export const prefetchLazyComponents = (): void => {
    if (prefetchStarted || typeof window === 'undefined') return
    prefetchStarted = true

    const conn = (
        navigator as Navigator & {
            connection?: { saveData?: boolean; effectiveType?: string }
        }
    ).connection
    if (conn?.saveData) return
    if (conn?.effectiveType && ['slow-2g', '2g'].includes(conn.effectiveType)) {
        return
    }

    const names = getLazyComponentNames()
    const onIdle: (cb: () => void) => void =
        'requestIdleCallback' in window
            ? (cb) =>
                  (
                      window as Window & {
                          requestIdleCallback: (
                              cb: () => void,
                              opts?: { timeout: number }
                          ) => number
                      }
                  ).requestIdleCallback(cb, { timeout: 2000 })
            : (cb) => window.setTimeout(cb, 300)

    const warmNext = (i: number) => {
        if (i >= names.length) return
        onIdle(() => {
            Promise.resolve()
                .then(() => preloadComponent(names[i]))
                .catch(() => {})
                .finally(() => warmNext(i + 1))
        })
    }
    warmNext(0)
}
