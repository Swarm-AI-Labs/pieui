import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import type { ComponentType, PieMetadata, JSONSchema } from '../types'
import { jsonSchemaToTsInterface, jsonSchemaToTsType } from '../jsonSchemaToTs'
import { resolveRegistryPath } from '../registryPath'
import { baseInterfaceFor, componentIndexTemplate } from '../templates'
import { cardAddRequirements, printRequirements } from '../printRequirements'

const PIE_CONFIG_PATH = '.pie/config.json'

type BackendConfig = {
    backendPagesDir?: string
    backendComponentsDir?: string
}

type ResolvedSource =
    | { kind: 'json-file'; path: string }
    | { kind: 'py-file'; backendRoot: string; cardName: string }
    | { kind: 'name'; backendRoot: string; cardName: string }

const readBackendConfig = (): BackendConfig | null => {
    const configPath = path.join(process.cwd(), PIE_CONFIG_PATH)
    if (!fs.existsSync(configPath)) return null
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(configPath, 'utf8'))
        if (typeof parsed !== 'object' || parsed === null) return null
        return parsed as BackendConfig
    } catch {
        return null
    }
}

const classFilenameToCardName = (filename: string): string => {
    const base = filename.replace(/\.py$/, '')
    return base
        .split('_')
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join('')
}

const cardNameToClassFilename = (name: string): string => {
    const snake = name
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toLowerCase()
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
    return snake.endsWith('_card') ? `${snake}.py` : `${snake}_card.py`
}

const resolveSource = (
    fromRaw: string | undefined,
    cardName: string,
    cfg: BackendConfig | null
): ResolvedSource => {
    if (fromRaw && fs.existsSync(fromRaw)) {
        const stat = fs.statSync(fromRaw)
        const abs = path.resolve(fromRaw)
        if (stat.isFile() && abs.endsWith('.json')) {
            return { kind: 'json-file', path: abs }
        }
        if (stat.isFile() && abs.endsWith('.py')) {
            const componentsDir = path.dirname(abs)
            const backendRoot = path.dirname(componentsDir)
            const inferred = classFilenameToCardName(path.basename(abs))
            return {
                kind: 'py-file',
                backendRoot,
                cardName: inferred || cardName,
            }
        }
        if (stat.isDirectory()) {
            const backendRoot = path.dirname(abs)
            return { kind: 'name', backendRoot, cardName }
        }
        throw new Error(`--from path is not a recognized source: ${fromRaw}`)
    }

    if (fromRaw) {
        if (!cfg?.backendComponentsDir) {
            throw new Error(
                `--from "${fromRaw}" is not an existing path and no backendComponentsDir is configured in ${PIE_CONFIG_PATH}`
            )
        }
        const componentsDir = path.resolve(cfg.backendComponentsDir)
        const backendRoot = path.dirname(componentsDir)
        return { kind: 'name', backendRoot, cardName: fromRaw }
    }

    if (!cfg?.backendComponentsDir) {
        throw new Error(
            `No --from provided and no backendComponentsDir configured in ${PIE_CONFIG_PATH}`
        )
    }
    const componentsDir = path.resolve(cfg.backendComponentsDir)
    const backendRoot = path.dirname(componentsDir)
    return { kind: 'name', backendRoot, cardName }
}

/** Strictly unwrap a `{typescript: {...}}` envelope. Throws when the
 * envelope is absent or wrong-keyed. TS reads only TS-shaped data. */
const unwrapTypescriptEnvelope = (parsed: unknown): unknown => {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(
            'dump-metadata payload is not a JSON object — expected ' +
                '{"typescript": {...}}'
        )
    }
    const obj = parsed as Record<string, unknown>
    const inner = obj.typescript
    if (!inner || typeof inner !== 'object' || Array.isArray(inner)) {
        const keys = Object.keys(obj).join(', ')
        throw new Error(
            `dump-metadata payload is missing the "typescript" envelope ` +
                `(top-level keys: ${keys || '(none)'})`
        )
    }
    return inner
}

const fetchMetadata = (source: ResolvedSource): PieMetadata => {
    if (source.kind === 'json-file') {
        const raw = fs.readFileSync(source.path, 'utf8')
        return unwrapTypescriptEnvelope(JSON.parse(raw)) as PieMetadata
    }
    console.log(
        `[pieui] Invoking: pie card dump-metadata ${source.cardName} (cwd: ${source.backendRoot})`
    )
    const result = spawnSync(
        'pie',
        ['card', 'dump-metadata', source.cardName],
        {
            cwd: source.backendRoot,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: process.env,
        }
    )
    if (result.error) {
        throw new Error(
            `Failed to invoke \`pie\` in ${source.backendRoot}: ${result.error.message}`
        )
    }
    if (result.status !== 0) {
        const stderr = result.stderr ? result.stderr.toString() : ''
        throw new Error(
            `pie card dump-metadata exited with status ${result.status}: ${stderr.trim()}`
        )
    }
    const stdout = result.stdout ? result.stdout.toString() : ''
    return unwrapTypescriptEnvelope(JSON.parse(stdout)) as PieMetadata
}

const extractTypeName = (code: string | null | undefined): string | null => {
    if (!code) return null
    const tsMatch = code.match(/\b(?:interface|type)\s+([A-Z][A-Za-z0-9_]*)/)
    if (tsMatch) return tsMatch[1]
    const pyMatch = code.match(/\bclass\s+([A-Z][A-Za-z0-9_]*)/)
    if (pyMatch) return pyMatch[1]
    return null
}

const renderTypes = (
    componentName: string,
    componentType: ComponentType,
    meta: PieMetadata,
    dataInterfaceName: string,
    inputInterfaceName: string | null
): string => {
    const hasInput = !!(inputInterfaceName && meta.inputPropsSchema)
    const baseInterface = baseInterfaceFor(componentType, { input: hasInput })
    const dataIface = jsonSchemaToTsInterface(
        meta.propsSchema,
        dataInterfaceName
    )
    const inputIface = hasInput
        ? jsonSchemaToTsInterface(meta.inputPropsSchema!, inputInterfaceName!)
        : null
    const blocks = [
        `import { ${baseInterface} } from '@swarm.ing/pieui'`,
        '',
        dataIface,
    ]
    if (inputIface) {
        blocks.push('', inputIface)
    }
    const propsAlias = hasInput
        ? `export type ${componentName}Props = ${baseInterface}<${dataInterfaceName}, ${inputInterfaceName}>`
        : `export type ${componentName}Props = ${baseInterface}<${dataInterfaceName}>`
    blocks.push('', propsAlias)
    return blocks.join('\n') + '\n'
}

const eventPayloadAliasName = (
    componentName: string,
    event: string
): string => {
    const cap = event[0].toUpperCase() + event.slice(1)
    return `${componentName}${cap}Payload`
}

type EventDef = { name: string; payloadType: string; aliasName: string | null }

const collectEvents = (
    componentName: string,
    meta: PieMetadata
): EventDef[] => {
    if (!meta.events) return []
    return meta.events.map((event) => {
        const schema = meta.eventsPropsSchema?.[event]
        const inlineType = schema
            ? jsonSchemaToTsType(schema as JSONSchema)
            : 'unknown'
        const isMultiline = inlineType.includes('\n')
        if (isMultiline) {
            return {
                name: event,
                payloadType: eventPayloadAliasName(componentName, event),
                aliasName: eventPayloadAliasName(componentName, event),
            }
        }
        return {
            name: event,
            payloadType: inlineType,
            aliasName: null,
        }
    })
}

const renderUI = (
    componentName: string,
    meta: PieMetadata,
    inputInterfaceName: string | null
): string => {
    const events = collectEvents(componentName, meta)
    const aliases = events.filter((e) => e.aliasName !== null)

    const lines: string[] = ["'use client'", '']
    lines.push("import { PieCard } from '@swarm.ing/pieui'")
    const typeImports = [`${componentName}Props`]
    if (inputInterfaceName) typeImports.push(inputInterfaceName)
    lines.push(`import type { ${typeImports.join(', ')} } from '../types'`)
    lines.push('')

    if (aliases.length > 0) {
        for (const event of aliases) {
            const schema = meta.eventsPropsSchema?.[event.name]
            const body = schema
                ? jsonSchemaToTsType(schema as JSONSchema)
                : 'unknown'
            lines.push(`type ${event.aliasName} = ${body}`)
        }
        lines.push('')
    }

    const hasInput = !!inputInterfaceName
    const cardLabel = JSON.stringify(componentName)

    const destructure = hasInput
        ? `{ data: _data, stored }`
        : `{ data: _data }`
    let body = `const ${componentName} = (${destructure}: ${componentName}Props) => {\n`
    body += '    return (\n'
    body += `        <PieCard\n`
    body += `            card={${cardLabel}}\n`
    if (hasInput) body += `            stored={stored}\n`
    if (events.length > 0) {
        body += `            methods={{\n`
        for (const event of events) {
            body += `                ${event.name}: (payload: ${event.payloadType}) => {\n`
            body += `                    console.log('[${componentName}:${event.name}]', payload)\n`
            body += `                },\n`
        }
        body += `            }}\n`
    }
    body += `        />\n`
    body += `    )\n`
    body += `}\n\n`
    body += `export default ${componentName}\n`

    lines.push(body)
    return lines.join('\n')
}

const updateRegistryFile = (
    componentsDir: string,
    componentName: string
): void => {
    const registryPath = resolveRegistryPath(componentsDir)
    if (!fs.existsSync(registryPath)) {
        throw new Error('registry.ts not found. Run "pieui init" first.')
    }
    let registryContent = fs.readFileSync(registryPath, 'utf8')
    const importRegex = new RegExp(`["']@/piecomponents/${componentName}["']`)
    if (importRegex.test(registryContent)) {
        throw new Error(
            `Component ${componentName} is already registered in registry.ts`
        )
    }
    const importLine = `import "@/piecomponents/${componentName}";`
    registryContent = registryContent.trimEnd() + '\n' + importLine + '\n'
    fs.writeFileSync(registryPath, registryContent, 'utf8')
}

export const hasBackendSourceFor = (componentName: string): boolean => {
    const cfg = readBackendConfig()
    if (!cfg?.backendComponentsDir) return false
    const componentsDir = path.resolve(cfg.backendComponentsDir)
    if (!fs.existsSync(componentsDir)) return false
    const candidate = path.join(
        componentsDir,
        cardNameToClassFilename(componentName)
    )
    return fs.existsSync(candidate)
}

export const cardAddFromMetaCommand = (
    componentName: string,
    componentType: ComponentType,
    fromRaw: string | undefined
): void => {
    if (!componentName) {
        throw new Error('Component name is required')
    }
    if (!/^[A-Z][a-zA-Z0-9]+$/.test(componentName)) {
        throw new Error(
            'Component name must start with uppercase letter and contain only letters and numbers'
        )
    }

    const cfg = readBackendConfig()
    const source = resolveSource(fromRaw, componentName, cfg)
    if (source.kind === 'name') {
        const candidate = path.join(
            source.backendRoot,
            path.basename(path.resolve(cfg!.backendComponentsDir!)),
            cardNameToClassFilename(source.cardName)
        )
        if (!fs.existsSync(candidate)) {
            console.warn(
                `[pieui] Note: expected backend file ${candidate} not found; relying on pie's resolution`
            )
        }
    }

    const meta = fetchMetadata(source)
    console.log(
        `[pieui] Loaded metadata for "${meta.name}" (${meta.events.length} events, input: ${meta.inputPropsCode ? 'yes' : 'no'})`
    )

    const dataInterfaceName =
        extractTypeName(meta.propsCode) || `${componentName}Data`
    const inputInterfaceName = meta.inputPropsCode
        ? extractTypeName(meta.inputPropsCode) || `${componentName}StoredInput`
        : null

    const pieComponentsDir = path.join(process.cwd(), 'piecomponents')
    if (!fs.existsSync(pieComponentsDir)) {
        throw new Error(
            'piecomponents directory not found. Run "pieui init" first.'
        )
    }
    const componentDir = path.join(pieComponentsDir, componentName)
    if (fs.existsSync(componentDir)) {
        throw new Error(`Component ${componentName} already exists`)
    }

    try {
        fs.mkdirSync(path.join(componentDir, 'ui'), { recursive: true })
        fs.mkdirSync(path.join(componentDir, 'types'), { recursive: true })

        fs.writeFileSync(
            path.join(componentDir, 'index.ts'),
            componentIndexTemplate(componentName),
            'utf8'
        )
        fs.writeFileSync(
            path.join(componentDir, 'types', 'index.ts'),
            renderTypes(
                componentName,
                componentType,
                meta,
                dataInterfaceName,
                inputInterfaceName
            ),
            'utf8'
        )
        fs.writeFileSync(
            path.join(componentDir, 'ui', `${componentName}.tsx`),
            renderUI(componentName, meta, inputInterfaceName),
            'utf8'
        )
        updateRegistryFile(pieComponentsDir, componentName)
    } catch (error) {
        fs.rmSync(componentDir, { recursive: true, force: true })
        throw error
    }

    console.log(
        `[pieui] Component ${componentName} ported from backend successfully`
    )
    console.log(`[pieui] Files created:`)
    console.log(`  - ${path.join(componentDir, 'index.ts')}`)
    console.log(`  - ${path.join(componentDir, 'types', 'index.ts')}`)
    console.log(`  - ${path.join(componentDir, 'ui', `${componentName}.tsx`)}`)
    console.log(`[pieui] Data interface: ${dataInterfaceName}`)
    if (inputInterfaceName) {
        console.log(`[pieui] Input interface: ${inputInterfaceName}`)
    }
    if (meta.events.length > 0) {
        console.log(`[pieui] Events scaffolded: ${meta.events.join(', ')}`)
    }

    printRequirements(cardAddRequirements(componentName, { ported: true }))
}
