'use client'

import { tool } from '@openai/agents'
import { useContext, useMemo } from 'react'
import type { Emitter } from 'mitt'
import MittContext, { getEmitter, type MittEvents } from './mitt'

/**
 * Matches PieUI mitt events of the form `pie{methodName}_{cardName}` where
 * `methodName` is the key of the `methods` map passed to a `PieCard` and
 * `cardName` is the value of `data.name` on that card. The first capture is
 * non-greedy so the shortest valid method name wins, leaving the remainder
 * (which may itself contain underscores) as the card name.
 */
const MITT_EVENT_RE = /^pie(.+?)_(.+)$/

/**
 * Descriptor passed to the customization callbacks on
 * {@link MittAgentToolsOptions}.
 */
export type MittAgentToolDescriptor = {
    /** Method key originally registered on the `PieCard.methods` map. */
    methodName: string
    /** Value of `data.name` on the target `PieCard`. */
    cardName: string
    /** Raw mitt event name (`pie{methodName}_{cardName}`). */
    eventName: string
}

/**
 * Options accepted by {@link getMittAgentTools} and
 * {@link usePieMittAgentTools}.
 */
export type MittAgentToolsOptions = {
    /**
     * Optional predicate invoked for each discovered PieCard method. Return
     * `false` to omit the event from the generated tool list. Defaults to
     * accepting everything.
     */
    filter?: (descriptor: MittAgentToolDescriptor) => boolean
    /**
     * Optional override for the tool description surfaced to the model.
     * Defaults to a generic string mentioning the card and method.
     */
    describe?: (descriptor: MittAgentToolDescriptor) => string
    /**
     * Optional override for the public tool name. Defaults to
     * `{cardName}_{methodName}`. The returned value must be unique within the
     * final tool set.
     */
    nameFor?: (descriptor: MittAgentToolDescriptor) => string
}

/**
 * Return type of {@link getMittAgentTools}. We intentionally keep this loose
 * rather than importing the deeply-parameterized `FunctionTool` generic from
 * `@openai/agents-core` — callers typically feed the result directly into
 * `new Agent({ tools: [...] })` which accepts any tool-shaped value.
 */
export type MittAgentTool = ReturnType<typeof tool>

/**
 * Scans a mitt emitter for all currently-registered PieCard methods (events
 * matching `pie{methodName}_{cardName}`) and wraps each one as an
 * `@openai/agents` function tool.
 *
 * Calling a returned tool re-emits the matching mitt event with the
 * `payload` argument supplied by the model. Because mitt listeners run
 * synchronously in-process, the tool executes entirely locally with no
 * network hop.
 *
 * This takes a *snapshot* of the emitter at the moment it is called — cards
 * that mount afterwards will not be represented until the function is called
 * again. Prefer {@link usePieMittAgentTools} from inside React components so
 * the snapshot refreshes whenever the surrounding tree re-renders.
 *
 * @param emitter The mitt emitter to scan. Defaults to the global PieUI
 *                singleton returned by {@link getEmitter}.
 * @param options See {@link MittAgentToolsOptions}.
 * @returns An array of `@openai/agents` function tools, one per discovered
 *          PieCard method.
 */
export function getMittAgentTools(
    emitter: Emitter<MittEvents> = getEmitter(),
    options: MittAgentToolsOptions = {}
): MittAgentTool[] {
    const tools: MittAgentTool[] = []
    const seen = new Set<string>()

    for (const eventKey of emitter.all.keys()) {
        if (typeof eventKey !== 'string') continue
        const match = eventKey.match(MITT_EVENT_RE)
        if (!match) continue
        const [, methodName, cardName] = match
        const descriptor: MittAgentToolDescriptor = {
            methodName,
            cardName,
            eventName: eventKey,
        }

        if (options.filter && !options.filter(descriptor)) continue

        const toolName =
            options.nameFor?.(descriptor) ?? `${cardName}_${methodName}`
        if (seen.has(toolName)) continue
        seen.add(toolName)

        const description =
            options.describe?.(descriptor) ??
            `Invokes the "${methodName}" method on the PieCard "${cardName}" by emitting the in-process mitt event "${eventKey}". The optional "payload" argument is forwarded verbatim to the card's handler.`

        tools.push(
            tool({
                name: toolName,
                description,
                strict: false,
                parameters: {
                    type: 'object',
                    properties: {
                        payload: {
                            description:
                                'Arbitrary JSON payload forwarded to the PieCard method handler. Omit for fire-and-forget calls.',
                        },
                    },
                    required: [],
                    additionalProperties: true,
                },
                execute: async (input) => {
                    const payload = (
                        input as { payload?: unknown } | undefined
                    )?.payload
                    emitter.emit(eventKey, payload)
                    return `Emitted "${eventKey}"`
                },
            })
        )
    }

    return tools
}

/**
 * React hook wrapper around {@link getMittAgentTools}. Reads the emitter from
 * {@link MittContext} — falling back to the global singleton returned by
 * {@link getEmitter} when used outside of a PieRoot — and memoizes the
 * resulting tool array by a sorted snapshot of registered event names so the
 * returned reference is stable across renders that don't add or remove
 * PieCard methods.
 *
 * Because mitt does not emit a "handler-added" notification, the hook only
 * refreshes its snapshot when the calling component re-renders. If you need
 * to react to cards mounting at arbitrary times, trigger a re-render from the
 * consumer or call {@link getMittAgentTools} imperatively right before you
 * build the `Agent`.
 *
 * @example
 * ```tsx
 * const tools = usePieMittAgentTools()
 * const agent = useMemo(() => new Agent({ name: 'UI', tools }), [tools])
 * ```
 */
export function usePieMittAgentTools(
    options: MittAgentToolsOptions = {}
): MittAgentTool[] {
    const contextEmitter = useContext(MittContext)
    const emitter = contextEmitter ?? getEmitter()

    // Snapshot of registered pie* event names; recomputed on every render
    // because mitt has no subscribe API. Map iteration is cheap.
    const eventNames: string[] = []
    for (const key of emitter.all.keys()) {
        if (typeof key === 'string' && MITT_EVENT_RE.test(key)) {
            eventNames.push(key)
        }
    }
    eventNames.sort()
    const snapshotKey = eventNames.join('|')

    const { filter, describe, nameFor } = options

    return useMemo(
        () => getMittAgentTools(emitter, { filter, describe, nameFor }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [emitter, snapshotKey, filter, describe, nameFor]
    )
}