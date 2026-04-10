import { ComponentMetadata, ComponentRegistration } from '../types'
import { trackLazy } from './lazy'
import { ComponentType } from 'react'

/**
 * Central in-memory registry of PieUI components keyed by their name. Every
 * call to {@link registerPieComponent} writes into this `Map`, and the
 * dynamic UI renderer reads from it at render time to resolve a `card` name
 * to a concrete React component.
 */
export const registry = new Map<string, ComponentRegistration<any>>()

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
        entry.loader = undefined
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
