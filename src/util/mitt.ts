'use client'

import mitt, { Emitter } from 'mitt'
import { createContext, useCallback, useContext } from 'react'

/**
 * Event map used by the PieUI Mitt emitter. Event names follow the convention
 * `pie{methodName}_{componentName}` and the payload is an arbitrary value
 * forwarded verbatim to registered handlers.
 */
export type MittEvents = {
    [key: string]: any
}

let _emitter: Emitter<MittEvents> | null = null

/**
 * Returns the lazily-initialized singleton Mitt emitter used for cross-component
 * PieUI messaging outside of any React context.
 *
 * Prefer {@link usePieEmit} from within React components — it honours the
 * provider-supplied emitter from `MittContext` when one is available.
 *
 * @returns The process-wide Mitt emitter instance.
 */
export function getEmitter(): Emitter<MittEvents> {
    if (!_emitter) {
        _emitter = mitt<MittEvents>()
    }
    return _emitter
}

/**
 * React context carrying the Mitt emitter injected by a PieRoot provider.
 * Consumers that need to emit from within a component tree should read from
 * this context (directly or via {@link usePieEmit}) so that events flow
 * through the same emitter the surrounding roots use.
 */
const MittContext = createContext<Emitter<MittEvents> | null>(null)

/**
 * React hook that returns a stable emitter function bound to a specific
 * `PieCard` name. The returned callback accepts `(methodName, payload?)` and
 * dispatches through `MittContext` when available, falling back to the global
 * singleton returned by {@link getEmitter} when used outside of a PieRoot.
 *
 * @example
 * ```tsx
 * const emit = usePieEmit('mySequence')
 * emit('changeContent', { content: newConfig })
 * ```
 *
 * @param name The `data.name` of the target `PieCard` — must match the card
 *             that was rendered with `useMittSupport={true}`.
 * @returns A memoized `(methodName: string, payload?: any) => void` function.
 */
export function usePieEmit(name: string) {
    const emitter = useContext(MittContext)
    return useCallback(
        (methodName: string, payload?: any) => {
            ;(emitter ?? getEmitter()).emit(
                `pie${methodName}_${name}`,
                payload
            )
        },
        [name, emitter]
    )
}

export default MittContext