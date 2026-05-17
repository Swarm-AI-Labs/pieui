import fs from 'node:fs'
import path from 'node:path'
import { glob } from 'glob'
import { extractEvents } from '../introspection/extractEvents'
import {
    createSchemaContext,
} from '../introspection/schemaContext'
import { extractEventsPayloads } from '../introspection/extractEventsPayloads'
import { loadSettings } from '../services/settings'
import type { JSONSchema } from '../types'
import {
    cardAddStoryRequirements,
    printRequirements,
} from '../printRequirements'

const COMPONENT_EXTS = ['.ts', '.tsx']

const collectComponentFiles = (componentDir: string): string[] => {
    const patterns = [
        `${componentDir}/**/*.ts`,
        `${componentDir}/**/*.tsx`,
    ]
    const ignore = [
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.stories.ts',
        '**/*.stories.tsx',
    ]
    const out = new Set<string>()
    for (const p of patterns) {
        for (const f of glob.sync(p, { ignore })) {
            out.add(path.resolve(f))
        }
    }
    return Array.from(out).sort()
}

const samplePayloadFromSchema = (
    schema: JSONSchema | undefined
): unknown => {
    if (!schema || typeof schema !== 'object') return null
    const properties = (schema as { properties?: Record<string, unknown> })
        .properties
    if (!properties || typeof properties !== 'object') return null
    const out: Record<string, unknown> = {}
    for (const [key, raw] of Object.entries(properties)) {
        if (!raw || typeof raw !== 'object') continue
        const t = (raw as { type?: string }).type
        if (t === 'string') out[key] = ''
        else if (t === 'number' || t === 'integer') out[key] = 0
        else if (t === 'boolean') out[key] = false
        else if (t === 'array') out[key] = []
        else if (t === 'object') out[key] = {}
        else out[key] = null
    }
    return out
}

const renderStoryFile = (
    componentName: string,
    events: string[],
    payloads: { code: Record<string, string>; schema: Record<string, JSONSchema> }
): string => {
    const methodsJson: Array<{
        name: string
        payloadSchema: JSONSchema | null
        payloadCode: string | null
        samplePayload: unknown
    }> = events.map((ev) => ({
        name: ev,
        payloadSchema: payloads.schema[ev] ?? null,
        payloadCode: payloads.code[ev] ?? null,
        samplePayload: samplePayloadFromSchema(payloads.schema[ev]),
    }))
    const methodsLiteral = JSON.stringify(methodsJson, null, 4)
        .split('\n')
        .map((line, i) => (i === 0 ? line : '    ' + line))
        .join('\n')

    return `import type { Meta, StoryObj } from '@storybook/react'
import { withPieCard } from '@swarm.ing/pieui/storybook'
import ${componentName} from './${componentName}'

const meta: Meta<typeof ${componentName}> = {
    component: ${componentName},
    decorators: [withPieCard],
    parameters: {
        piecard: {
            card: '${componentName}',
            methods: ${methodsLiteral},
        },
    },
}
export default meta

type Story = StoryObj<typeof ${componentName}>

export const Default: Story = {
    args: {
        data: {
            // Storybook addon fires mitt events; PieCard subscribes only when
            // useMittSupport === true. Leave this on for the in-storybook play.
            // @ts-expect-error — base props vary by component type.
            name: '${componentName}',
            useMittSupport: true,
        },
    },
}
`
}

export const cardAddStoryCommand = (componentName: string): void => {
    if (!componentName) {
        throw new Error('Component name is required')
    }
    if (!/^[A-Z][a-zA-Z0-9]+$/.test(componentName)) {
        throw new Error(
            'Component name must start with uppercase letter and contain only letters and numbers'
        )
    }

    const settings = loadSettings()
    const componentDir = path.join(settings.componentsDir, componentName)
    if (!fs.existsSync(componentDir)) {
        throw new Error(`Component directory not found: ${componentDir}`)
    }

    const tsFiles = collectComponentFiles(componentDir).filter((f) =>
        COMPONENT_EXTS.some((e) => f.endsWith(e))
    )
    let events: string[] = []
    let payloads = {
        code: {} as Record<string, string>,
        schema: {} as Record<string, JSONSchema>,
    }
    if (tsFiles.length > 0) {
        try {
            events = extractEvents(tsFiles)
        } catch (e) {
            console.warn(
                `[pieui] Warning: extractEvents failed (${e instanceof Error ? e.message : String(e)}). Generating story without method scaffolds.`
            )
        }
        if (events.length > 0) {
            try {
                const ctx = createSchemaContext(tsFiles)
                payloads = extractEventsPayloads(ctx, tsFiles, events)
            } catch (e) {
                console.warn(
                    `[pieui] Warning: extractEventsPayloads failed (${e instanceof Error ? e.message : String(e)}). Payload schemas will be empty.`
                )
            }
        }
    }

    const storyPath = path.join(
        componentDir,
        'ui',
        `${componentName}.stories.tsx`
    )
    if (fs.existsSync(storyPath)) {
        throw new Error(`Story file already exists: ${storyPath}`)
    }
    fs.mkdirSync(path.dirname(storyPath), { recursive: true })
    fs.writeFileSync(
        storyPath,
        renderStoryFile(componentName, events, payloads),
        'utf8'
    )

    console.log(`[pieui] Story created: ${storyPath}`)
    if (events.length > 0) {
        console.log(`[pieui] Methods wired: ${events.join(', ')}`)
    } else {
        console.log(
            `[pieui] No <PieCard methods={{…}}/> found — story has no method triggers yet.`
        )
    }

    printRequirements(cardAddStoryRequirements(componentName))
}
