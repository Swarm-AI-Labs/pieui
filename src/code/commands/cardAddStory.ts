import fs from 'node:fs'
import path from 'node:path'
import { glob } from 'glob'
import { extractEvents } from '../introspection/extractEvents'
import { createSchemaContext } from '../introspection/schemaContext'
import { extractEventsPayloads } from '../introspection/extractEventsPayloads'
import { loadSettings } from '../services/settings'
import type { JSONSchema } from '../types'
import {
    cardAddStoryRequirements,
    printRequirements,
} from '../printRequirements'
import {
    detectCardIsIO,
    patchPieCardForwarding,
} from '../patchPieCardForwarding'

const COMPONENT_EXTS = ['.ts', '.tsx']

const collectComponentFiles = (componentDir: string): string[] => {
    const patterns = [`${componentDir}/**/*.ts`, `${componentDir}/**/*.tsx`]
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

const sampleValueFor = (schema: unknown): unknown => {
    if (!schema || typeof schema !== 'object') return null
    const s = schema as Record<string, unknown>
    if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0]
    if ('const' in s) return s.const
    const t = s.type
    if (t === 'string') return ''
    if (t === 'number' || t === 'integer') return 0
    if (t === 'boolean') return false
    if (t === 'array') return []
    if (t === 'object') return {}
    if (Array.isArray(s.anyOf) && s.anyOf.length > 0) {
        return sampleValueFor(s.anyOf[0])
    }
    if (Array.isArray(s.oneOf) && s.oneOf.length > 0) {
        return sampleValueFor(s.oneOf[0])
    }
    return null
}

const samplePayloadFromSchema = (schema: JSONSchema | undefined): unknown => {
    if (!schema || typeof schema !== 'object') return null
    const properties = (schema as { properties?: Record<string, unknown> })
        .properties
    if (!properties || typeof properties !== 'object') return null
    const out: Record<string, unknown> = {}
    for (const [key, raw] of Object.entries(properties)) {
        out[key] = sampleValueFor(raw)
    }
    return out
}

const renderStoryFile = (
    componentName: string,
    events: string[],
    payloads: {
        code: Record<string, string>
        schema: Record<string, JSONSchema>
    },
    options: { io: boolean }
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

    const dataBody = options.io
        ? `            // Storybook addon fires mitt events; PieCard subscribes only when
            // useMittSupport === true. Leave this on for the in-storybook play.
            name: '${componentName}',
            useMittSupport: true,`
        : `            name: '${componentName}',`

    return `import type { Meta, StoryObj } from '@storybook/react'
import { withPieCard } from '@swarm.ing/pieui/storybook'
import ${componentName} from './ui/${componentName}'

const meta: Meta<typeof ${componentName}> = {
    title: 'PieComponents/${componentName}',
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
${dataBody}
        },
    },
}
`
}

export const cardAddStoryCommand = (
    componentName: string,
    options: { force?: boolean } = {}
): void => {
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

    const typesPath = path.join(componentDir, 'types', 'index.ts')
    const uiPath = path.join(componentDir, 'ui', `${componentName}.tsx`)
    const io = detectCardIsIO(typesPath)

    const storyPath = path.join(componentDir, `${componentName}.stories.tsx`)
    const storyExists = fs.existsSync(storyPath)
    if (storyExists && !options.force) {
        throw new Error(
            `Story file already exists: ${storyPath}\n` +
                `Pass --force to overwrite.`
        )
    }
    fs.writeFileSync(
        storyPath,
        renderStoryFile(componentName, events, payloads, { io }),
        'utf8'
    )

    console.log(
        `[pieui] Story ${storyExists ? 'overwritten' : 'created'}: ${storyPath}`
    )
    if (events.length > 0) {
        console.log(`[pieui] Methods wired: ${events.join(', ')}`)
    } else {
        console.log(
            `[pieui] No <PieCard methods={{…}}/> found — story has no method triggers yet.`
        )
    }

    // Patch the card's UI so its <PieCard> forwards the IO quartet when the
    // data interface opts into IO. Non-IO cards skip the patch entirely:
    // adding `useMittSupport={data.useMittSupport ?? false}` would tunnel a
    // field that doesn't exist on the data interface and break typechecking.
    const result = patchPieCardForwarding(uiPath, { io })
    if (result.patched) {
        const allAdded = Array.from(
            new Set(result.addedPerSite.flatMap((s) => s.added))
        )
        console.log(
            `[pieui] Forwarding props added to <PieCard> in ${uiPath}: ${allAdded.join(', ')}${io ? ' (IO card)' : ''}`
        )
    } else if (result.addedPerSite.length === 0) {
        console.log(
            `[pieui] <PieCard> forwarding already complete in ${uiPath}`
        )
    }

    printRequirements(cardAddStoryRequirements(componentName))
}
