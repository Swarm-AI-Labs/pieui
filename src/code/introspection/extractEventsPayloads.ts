/**
 * Recover the TS type of each event handler's first parameter, then
 * produce `eventsPropsCode` (source text) and `eventsPropsSchema` (JSON
 * Schema) for use in PieMetadata.
 *
 * Event handlers can be declared in three forms — all are handled here:
 *
 *   1. Inline arrow / function expression:
 *        methods={{ click: (e: ClickEvt) => doIt(e) }}
 *
 *   2. Shorthand property whose name matches a variable in scope:
 *        const click = (e: ClickEvt) => doIt(e)
 *        methods={{ click }}
 *
 *   3. Method declaration:
 *        methods={{ click(e: ClickEvt) { doIt(e) } }}
 *
 * In all three the parameter's type annotation is the source of truth.
 */

import { ts } from '../ts'
import { IntrospectionError, errorOptsFromNode } from './errors'
import { buildSchemaForType, type SchemaContext } from './schemaContext'
import { typeToSchema } from './typeToSchema'
import type { JSONSchema } from '../types'

const PIE_CARD_TAG = 'PieCard'
const COMPONENT_EXTS = ['.ts', '.tsx']

/**
 * Follow a JSX shorthand or identifier reference back to the function
 * declaration and return its first parameter node.
 *
 * ASSUMES: `identifier` is an AST `Identifier` node.
 *
 * RETURNS: the `Parameter` AST node, or `null` if:
 *   - the symbol can't be resolved by the checker.
 *   - the declaration isn't a function-like form we recognize.
 *
 * RESOLVES:
 *   - `FunctionDeclaration` — `function foo(p) {}`
 *   - `VariableDeclaration` initializer = ArrowFunction/FunctionExpr
 *     — `const foo = (p) => …`
 *   - `MethodDeclaration` / `MethodSignature`
 *   - Alias symbols (re-exports) are unwrapped via `getAliasedSymbol`.
 *
 * KNOWN GAPS: `useCallback(fn)`, type-asserted (`fn as F`), wrapped in
 * `useMemo` etc. — these reach a non-recognized declaration and return
 * `null`. The event still appears in `events[]` but its schema/code
 * stays empty.
 */
export const followIdentifierToFunction = (
    ctx: SchemaContext,
    identifier: any
): any | null => {
    const symbol = ctx.checker.getSymbolAtLocation(identifier)
    if (!symbol) return null
    const realSymbol =
        symbol.flags & ts.SymbolFlags.Alias
            ? ctx.checker.getAliasedSymbol(symbol)
            : symbol
    const decls = realSymbol.declarations
    if (!decls || decls.length === 0) return null
    for (const decl of decls) {
        if (ts.isFunctionDeclaration(decl) && decl.parameters.length > 0) {
            return decl.parameters[0]
        }
        if (ts.isVariableDeclaration(decl) && decl.initializer) {
            if (
                ts.isArrowFunction(decl.initializer) ||
                ts.isFunctionExpression(decl.initializer)
            ) {
                if (decl.initializer.parameters.length > 0) {
                    return decl.initializer.parameters[0]
                }
            }
        }
        if (
            (ts.isMethodDeclaration(decl) ||
                ts.isMethodSignature(decl)) &&
            decl.parameters.length > 0
        ) {
            return decl.parameters[0]
        }
        if (ts.isParameter(decl) && decl.type) {
            return decl
        }
    }
    return null
}

/**
 * Render a function parameter as `{ code, schema }`.
 *
 * ASSUMES: `parameter` is an AST `Parameter` node; `sourceFile` is the
 * `SourceFile` containing it (for `getText` to return original text).
 *
 * RETURNS:
 *   - `code`: the explicit type annotation if present (e.g.
 *     `"{ tab: string }"`), or the checker-inferred type as a string
 *     when the parameter is untyped.
 *   - `schema`: JSON Schema. Strategy:
 *       1. If annotation is a `TypeReferenceNode` (`Foo`) — try
 *          `buildSchemaForType(ctx, "Foo")` (via typescript-json-schema).
 *       2. Otherwise — fall back to `typeToSchema(checker.getTypeAtLocation(typeNode))`
 *          which walks the TS Type directly (handles inline literals).
 *   - `null` schema when neither path produces a result.
 */
export const schemaForParameter = (
    ctx: SchemaContext,
    parameter: any,
    sourceFile: any
): { code: string; schema: JSONSchema | null } => {
    const typeNode = parameter.type
    if (!typeNode) {
        const inferred = ctx.checker.getTypeAtLocation(parameter)
        return {
            code: ctx.checker.typeToString(inferred),
            schema: null,
        }
    }
    const code = typeNode.getText(sourceFile)
    let schema: JSONSchema | null = null
    if (
        ts.isTypeReferenceNode(typeNode) &&
        ts.isIdentifier(typeNode.typeName)
    ) {
        schema = buildSchemaForType(ctx, typeNode.typeName.text)
    }
    if (!schema) {
        const t = ctx.checker.getTypeAtLocation(typeNode)
        schema = typeToSchema(t, ctx.checker)
    }
    return { code, schema }
}

/**
 * Walk `<PieCard methods={…}>` JSX literals in every file, restrict to
 * the previously-extracted `events` set, and recover each handler's
 * parameter type as `{ code, schema }`.
 *
 * ASSUMES:
 *   - `events` is the list of event-name strings already discovered by
 *     `extractEvents` (which itself enforces the inline-object-literal
 *     rule). This pass tolerates the same shape — anything else is
 *     skipped without throwing.
 *   - `ctx` includes all `files` (so `getSourceFile()` succeeds).
 *
 * RETURNS:
 *   - `code`: `{ eventName: typeText }`. May be empty for events whose
 *     handler can't be statically resolved (e.g. `useCallback`-wrapped).
 *   - `schema`: `{ eventName: JSONSchema }`. Same caveat.
 *
 * EDGE CASES:
 *   - Spread / variable `methods={…}` is silently skipped here
 *     (because `extractEvents` already strictly rejected those, the
 *     unreachable case is defensive).
 *   - Events listed in `events[]` but not present as keys in the JSX
 *     are absent from the result (no synthetic entry).
 */
export const extractEventsPayloads = (
    ctx: SchemaContext,
    files: string[],
    events: string[]
): { code: Record<string, string>; schema: Record<string, JSONSchema> } => {
    const codeMap: Record<string, string> = {}
    const schemaMap: Record<string, JSONSchema> = {}
    const eventSet = new Set(events)

    for (const file of files) {
        if (!COMPONENT_EXTS.some((e) => file.endsWith(e))) continue
        const sourceFile = ctx.program.getSourceFile(file)
        if (!sourceFile) continue

        const visit = (node: any): void => {
            const isPieCard =
                (ts.isJsxSelfClosingElement(node) ||
                    ts.isJsxOpeningElement(node)) &&
                ts.isIdentifier(node.tagName) &&
                node.tagName.text === PIE_CARD_TAG
            if (isPieCard && node.attributes && node.attributes.properties) {
                for (const attr of node.attributes.properties) {
                    if (
                        ts.isJsxAttribute(attr) &&
                        attr.name &&
                        ts.isIdentifier(attr.name) &&
                        attr.name.text === 'methods' &&
                        attr.initializer &&
                        ts.isJsxExpression(attr.initializer) &&
                        attr.initializer.expression &&
                        ts.isObjectLiteralExpression(
                            attr.initializer.expression
                        )
                    ) {
                        for (const prop of attr.initializer.expression
                            .properties) {
                            const nameNode = (prop as any).name
                            let key: string | null = null
                            if (nameNode && ts.isIdentifier(nameNode))
                                key = nameNode.text
                            else if (nameNode && ts.isStringLiteral(nameNode))
                                key = nameNode.text
                            if (!key || !eventSet.has(key)) continue
                            let parameter: any = null
                            if (ts.isPropertyAssignment(prop)) {
                                const init = prop.initializer
                                if (
                                    ts.isArrowFunction(init) ||
                                    ts.isFunctionExpression(init)
                                ) {
                                    parameter = init.parameters[0] ?? null
                                } else if (ts.isIdentifier(init)) {
                                    parameter = followIdentifierToFunction(
                                        ctx,
                                        init
                                    )
                                }
                            } else if (ts.isShorthandPropertyAssignment(prop)) {
                                parameter = followIdentifierToFunction(
                                    ctx,
                                    prop.name
                                )
                            } else if (ts.isMethodDeclaration(prop)) {
                                parameter = prop.parameters[0] ?? null
                            }
                            if (!parameter) {
                                throw new IntrospectionError(
                                    `event "${key}" handler is not a ` +
                                        'statically-resolvable function',
                                    {
                                        ...errorOptsFromNode(
                                            sourceFile,
                                            prop
                                        ),
                                        context: [`event "${key}"`],
                                        hint:
                                            'use an inline arrow with a ' +
                                            'typed parameter, a top-level ' +
                                            'function declaration, or a ' +
                                            'const = (e: T) => ... in the ' +
                                            'same module. useCallback-' +
                                            'wrapped, as-cast, satisfies, ' +
                                            'or object-method handlers are ' +
                                            'not supported.',
                                    }
                                )
                            }
                            const { code, schema } = schemaForParameter(
                                ctx,
                                parameter,
                                sourceFile
                            )
                            codeMap[key] = code
                            if (schema) schemaMap[key] = schema
                        }
                    }
                }
            }
            ts.forEachChild(node, visit)
        }
        visit(sourceFile)
    }
    return { code: codeMap, schema: schemaMap }
}
