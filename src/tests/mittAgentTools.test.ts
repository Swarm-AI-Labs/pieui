import { describe, test, expect } from 'bun:test'
import mitt from 'mitt'
import { getMittAgentTools } from '../util/mittAgentTools'
import type { MittEvents } from '../util/mitt'

/**
 * Drives the scan/emit lifecycle against a fresh emitter so tests stay
 * isolated from the PieUI singleton. `run` uses the underscore-named helper
 * on FunctionTool (`invoke`) to exercise the registered executor.
 */
async function runTool(
    t: ReturnType<typeof getMittAgentTools>[number],
    input: unknown
): Promise<string> {
    // The @openai/agents runtime passes a serialized JSON string into
    // `invoke`; we mimic that here. The RunContext argument is unused by our
    // generated tools so a minimal stub suffices.
    const result = await (t as any).invoke({} as any, JSON.stringify(input))
    return result as string
}

describe('getMittAgentTools()', () => {
    test('generates one tool per registered pie*_* event', () => {
        const emitter = mitt<MittEvents>()
        emitter.on('piechangeContent_sequenceA', () => {})
        emitter.on('pieappendItem_sequenceA', () => {})
        emitter.on('piechangeContent_sequenceB', () => {})

        const tools = getMittAgentTools(emitter)

        expect(tools.map((t) => t.name).sort()).toEqual([
            'sequenceA_appendItem',
            'sequenceA_changeContent',
            'sequenceB_changeContent',
        ])
    })

    test('ignores events that do not match the pie{method}_{card} convention', () => {
        const emitter = mitt<MittEvents>()
        emitter.on('arbitrary-event', () => {})
        emitter.on('noPrefix_foo', () => {})
        emitter.on('piefoo_bar', () => {})

        const tools = getMittAgentTools(emitter)

        expect(tools.map((t) => t.name)).toEqual(['bar_foo'])
    })

    test('tool execution emits the original mitt event with the payload', async () => {
        const emitter = mitt<MittEvents>()
        const received: any[] = []
        emitter.on('piechangeContent_card1', (payload) =>
            received.push(payload)
        )

        const [t] = getMittAgentTools(emitter)
        expect(t).toBeDefined()

        const result = await runTool(t, { payload: { value: 42 } })

        expect(received).toEqual([{ value: 42 }])
        expect(result).toContain('piechangeContent_card1')
    })

    test('tool execution tolerates missing payload', async () => {
        const emitter = mitt<MittEvents>()
        const received: any[] = []
        emitter.on('pieping_card1', (payload) => received.push(payload))

        const [t] = getMittAgentTools(emitter)
        await runTool(t, {})

        expect(received).toEqual([undefined])
    })

    test('filter option omits non-matching descriptors', () => {
        const emitter = mitt<MittEvents>()
        emitter.on('piechangeContent_cardA', () => {})
        emitter.on('piedelete_cardA', () => {})

        const tools = getMittAgentTools(emitter, {
            filter: ({ methodName }) => methodName !== 'delete',
        })

        expect(tools.map((t) => t.name)).toEqual(['cardA_changeContent'])
    })

    test('nameFor and describe overrides are respected', () => {
        const emitter = mitt<MittEvents>()
        emitter.on('piechangeContent_cardA', () => {})

        const [t] = getMittAgentTools(emitter, {
            nameFor: ({ cardName, methodName }) =>
                `pie__${cardName}__${methodName}`,
            describe: ({ eventName }) => `custom: ${eventName}`,
        })

        expect(t.name).toBe('pie__cardA__changeContent')
        expect(t.description).toBe('custom: piechangeContent_cardA')
    })

    test('deduplicates tools that collide on the generated name', () => {
        const emitter = mitt<MittEvents>()
        emitter.on('piechangeContent_cardA', () => {})
        emitter.on('piechange_Content_cardA', () => {})

        const tools = getMittAgentTools(emitter, {
            nameFor: () => 'same_name',
        })

        expect(tools).toHaveLength(1)
    })
})
