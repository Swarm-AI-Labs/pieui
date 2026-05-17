/**
 * Convert a TypeScript `ts.Type` to a JSON Schema fragment.
 *
 * Use case: inline anonymous types where `typescript-json-schema` can't
 * be invoked by name. Specifically — event handler parameter types
 * like `(event: { tab: string }) => void` need a schema for `{ tab: string }`
 * but the type isn't bound to a named declaration.
 *
 * Supported subset:
 *   - primitives: string, number, boolean, bigint (→ integer), null,
 *     undefined (→ null)
 *   - literal types: string/number/boolean (→ const)
 *   - unions and intersections (→ anyOf / allOf, with string-union →
 *     enum optimization)
 *   - arrays (`X[]`, `Array<X>`)
 *   - tuples (fixed-length array)
 *   - object types with `properties` walked via checker
 *   - Date → string + `format: date-time`
 *
 * Not supported: generics with TypeVars (returns `{}`), conditional
 * types, mapped types beyond shape inspection.
 */

import { ts } from '../ts'
import { IntrospectionError } from './errors'
import type { JSONSchema } from '../types'

const MAX_DEPTH = 12

const isOptionalProperty = (sym: any): boolean => {
    return (sym.getFlags?.() & ts.SymbolFlags.Optional) !== 0
}

/**
 * Convert a `ts.Type` to a JSON Schema fragment.
 *
 * ASSUMES:
 *   - `type` is a `ts.Type` from `checker.getTypeAtLocation(node)`.
 *   - `checker` is a TypeScript program type-checker.
 *
 * RETURNS: best-effort JSON Schema. Empty `{}` means "unknown / any".
 *
 * SAFETY: `depth` and `visited` together prevent infinite recursion on
 * cyclic types (e.g. `interface Node { children: Node[] }`).
 * MAX_DEPTH = 12 caps deeply-nested generics.
 */
export const typeToSchema = (
    type: any,
    checker: any,
    depth: number = 0,
    visited: Set<any> = new Set()
): JSONSchema => {
    if (depth > MAX_DEPTH) return {}
    if (!type) return {}
    if (visited.has(type)) return {}
    visited.add(type)

    const flags = type.flags ?? 0
    const F = ts.TypeFlags

    if (flags & F.Any) return {}
    if (flags & F.Unknown) return {}
    if (flags & F.Void) return { type: 'null' }
    if (flags & F.Never) return {}
    if (flags & F.Null) return { type: 'null' }
    if (flags & F.Undefined) return { type: 'null' }
    if (flags & F.StringLiteral) return { const: type.value }
    if (flags & F.NumberLiteral) return { const: type.value }
    if (flags & F.BooleanLiteral)
        return { const: (type as any).intrinsicName === 'true' }
    if (flags & F.String) return { type: 'string' }
    if (flags & F.Number) return { type: 'number' }
    if (flags & F.Boolean) return { type: 'boolean' }
    if (flags & F.BigInt) return { type: 'integer' }
    if (flags & F.EnumLiteral) {
        const symbol = type.getSymbol?.()
        if (symbol && (type as any).value !== undefined) {
            return { const: (type as any).value }
        }
    }

    if (type.isUnion?.()) {
        const variants = (type.types ?? []).map((t: any) =>
            typeToSchema(t, checker, depth + 1, visited)
        )
        const stringLiterals = variants.filter((v: any) => v.const !== undefined)
        if (
            stringLiterals.length === variants.length &&
            variants.every((v: any) => typeof v.const === 'string')
        ) {
            return {
                type: 'string',
                enum: variants.map((v: any) => v.const),
            }
        }
        return { anyOf: variants }
    }

    if (type.isIntersection?.()) {
        return {
            allOf: (type.types ?? []).map((t: any) =>
                typeToSchema(t, checker, depth + 1, visited)
            ),
        }
    }

    const sym = type.getSymbol?.()
    const name = sym?.getName?.()
    if (name === 'Date') return { type: 'string', format: 'date-time' }

    if (checker.isArrayType?.(type)) {
        const elem = checker.getTypeArguments?.(type)?.[0]
        return {
            type: 'array',
            items: elem ? typeToSchema(elem, checker, depth + 1, visited) : {},
        }
    }

    if (checker.isTupleType?.(type)) {
        const items = (checker.getTypeArguments?.(type) ?? []).map((t: any) =>
            typeToSchema(t, checker, depth + 1, visited)
        )
        return { type: 'array', items, minItems: items.length }
    }

    if (sym?.getName?.() === '__type' || (flags & F.Object) !== 0) {
        // Detect function types BEFORE generic object handling.
        const callSignatures = checker.getSignaturesOfType?.(
            type,
            ts.SignatureKind.Call
        )
        const constructSignatures = checker.getSignaturesOfType?.(
            type,
            ts.SignatureKind.Construct
        )
        if (
            (callSignatures?.length ?? 0) > 0 ||
            (constructSignatures?.length ?? 0) > 0
        ) {
            const typeStr = checker.typeToString?.(type) ?? '<function>'
            throw new IntrospectionError(
                `function/callable type "${typeStr}" is not JSON-serializable`,
                {
                    hint:
                        'function values cannot appear in a card payload. ' +
                        'Use a JSON-shaped param type for event handlers.',
                }
            )
        }
        if (flags & F.ESSymbol) {
            throw new IntrospectionError(
                'symbol type is not JSON-serializable',
                {
                    hint:
                        'symbols cannot be serialized. Use string or number ' +
                        'identifiers instead.',
                }
            )
        }
        const props = checker.getPropertiesOfType?.(type) ?? []
        if (props.length === 0) {
            const indexInfos = checker.getIndexInfosOfType?.(type) ?? []
            if (indexInfos.length > 0) {
                const info = indexInfos[0]
                return {
                    type: 'object',
                    additionalProperties: typeToSchema(
                        info.type,
                        checker,
                        depth + 1,
                        visited
                    ),
                }
            }
            return { type: 'object', additionalProperties: true }
        }
        const properties: Record<string, JSONSchema> = {}
        const required: string[] = []
        for (const p of props) {
            const decl = p.valueDeclaration ?? p.declarations?.[0]
            if (!decl) continue
            const pType = checker.getTypeOfSymbolAtLocation(p, decl)
            properties[p.getName()] = typeToSchema(
                pType,
                checker,
                depth + 1,
                visited
            )
            if (!isOptionalProperty(p)) required.push(p.getName())
        }
        const out: JSONSchema = {
            type: 'object',
            properties,
            additionalProperties: false,
        }
        if (required.length > 0) out.required = required
        return out
    }

    return {}
}