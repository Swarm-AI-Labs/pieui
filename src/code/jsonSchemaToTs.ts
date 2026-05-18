import type { JSONSchema } from './types'

const INDENT = '    '

const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v)

const asSchema = (v: unknown): JSONSchema | null =>
    isObj(v) ? (v as JSONSchema) : null

const renderType = (schema: JSONSchema | null, depth: number): string => {
    if (!schema) return 'unknown'

    if ('const' in schema) {
        return JSON.stringify(schema.const)
    }

    if (Array.isArray(schema.enum)) {
        if (schema.enum.length === 0) return 'never'
        return schema.enum.map((v) => JSON.stringify(v)).join(' | ')
    }

    if (Array.isArray(schema.anyOf)) {
        const parts = schema.anyOf
            .map((s) => renderType(asSchema(s), depth))
            .filter((s, i, arr) => arr.indexOf(s) === i)
        return parts.length ? parts.join(' | ') : 'unknown'
    }

    if (Array.isArray(schema.oneOf)) {
        return schema.oneOf
            .map((s) => renderType(asSchema(s), depth))
            .join(' | ')
    }

    if (Array.isArray(schema.allOf)) {
        return schema.allOf
            .map((s) => renderType(asSchema(s), depth))
            .join(' & ')
    }

    const type = schema.type
    if (type === 'string') return 'string'
    if (type === 'number' || type === 'integer') return 'number'
    if (type === 'boolean') return 'boolean'
    if (type === 'null') return 'null'

    if (type === 'array') {
        const items = renderType(asSchema(schema.items), depth)
        return /[\s|&]/.test(items) ? `Array<${items}>` : `${items}[]`
    }

    if (type === 'object') {
        const properties = isObj(schema.properties) ? schema.properties : null
        const required = new Set(
            Array.isArray(schema.required) ? (schema.required as string[]) : []
        )
        if (properties && Object.keys(properties).length > 0) {
            const pad = INDENT.repeat(depth + 1)
            const closingPad = INDENT.repeat(depth)
            const lines = Object.entries(properties)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => {
                    const prop = asSchema(value)
                    const optional = required.has(key) ? '' : '?'
                    const safeKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
                        ? key
                        : JSON.stringify(key)
                    return `${pad}${safeKey}${optional}: ${renderType(prop, depth + 1)}`
                })
            return `{\n${lines.join('\n')}\n${closingPad}}`
        }
        const additional = schema.additionalProperties
        if (additional === false) return 'Record<string, never>'
        if (additional === true || additional === undefined) {
            return 'Record<string, unknown>'
        }
        return `Record<string, ${renderType(asSchema(additional), depth)}>`
    }

    return 'unknown'
}

export const jsonSchemaToTsInterface = (
    schema: JSONSchema | null | undefined,
    interfaceName: string
): string => {
    const resolved = schema ?? null
    const inner = renderType(resolved, 0)
    if (inner.startsWith('{')) {
        return `export interface ${interfaceName} ${inner}`
    }
    return `export type ${interfaceName} = ${inner}`
}

export const jsonSchemaToTsType = (
    schema: JSONSchema | null | undefined
): string => renderType(asSchema(schema), 0)
