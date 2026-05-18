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
 * React hooks that take a function as their first argument and return
 * the same function reference (just memoized). Their first arg is the
 * actual handler.
 */
const FUNCTION_WRAPPER_HOOKS = new Set([
    'useCallback',
    'useEvent',
    'useEventCallback',
    'useMemoizedFn',
    'useStableCallback',
])

/**
 * Strip wrappers that don't change the function shape and return the
 * underlying ArrowFunction / FunctionExpression — or `null` if the
 * expression doesn't reduce to one.
 *
 * Unwraps:
 *   - `(expr)`                                  ParenthesizedExpression
 *   - `expr as T`                               AsExpression
 *   - `expr satisfies T`                        SatisfiesExpression
 *   - `<T>expr`                                 TypeAssertionExpression
 *   - `useCallback(expr, deps)` / `useEvent(expr)` / ... — CallExpression
 *     whose callee is a known wrapper hook
 *
 * Returns null when the expression isn't a function-shaped thing we can
 * peel back to an Arrow / Function expression statically.
 */
const unwrapToFunctionExpression = (expr: any): any | null => {
    let current = expr
    while (current) {
        if (
            ts.isArrowFunction(current) ||
            ts.isFunctionExpression(current)
        ) {
            return current
        }
        if (ts.isParenthesizedExpression(current)) {
            current = current.expression
            continue
        }
        if (ts.isAsExpression(current)) {
            current = current.expression
            continue
        }
        // `satisfies` lives on SatisfiesExpression in TS 4.9+
        if (
            (ts as any).isSatisfiesExpression &&
            (ts as any).isSatisfiesExpression(current)
        ) {
            current = current.expression
            continue
        }
        if (ts.isTypeAssertionExpression(current)) {
            current = current.expression
            continue
        }
        if (ts.isCallExpression(current)) {
            const callee = current.expression
            const calleeName = ts.isIdentifier(callee)
                ? callee.text
                : ts.isPropertyAccessExpression(callee) &&
                    ts.isIdentifier(callee.name)
                  ? callee.name.text
                  : null
            if (calleeName && FUNCTION_WRAPPER_HOOKS.has(calleeName)) {
                if (current.arguments.length === 0) return null
                current = current.arguments[0]
                continue
            }
            return null
        }
        return null
    }
    return null
}

/**
 * Follow a JSX shorthand or identifier reference back to the function
 * declaration and return its first parameter node.
 *
 * ASSUMES: `identifier` is an AST `Identifier` node.
 *
 * RETURNS: the `Parameter` AST node, or `null` if:
 *   - the symbol can't be resolved by the checker.
 *   - the declaration isn't a function-like form we recognize even
 *     after unwrapping known wrappers.
 *
 * RESOLVES:
 *   - `FunctionDeclaration` — `function foo(p) {}`
 *   - `VariableDeclaration` initializer reducible to ArrowFunction /
 *     FunctionExpr via `unwrapToFunctionExpression`. That covers:
 *       const f = (e) => ...
 *       const f = useCallback((e) => ..., [])
 *       const f = ((e) => ...) as Handler
 *       const f = ((e) => ...) satisfies Handler
 *       const f = (<Handler>((e) => ...))
 *   - `MethodDeclaration` / `MethodSignature`
 *   - Alias symbols (re-exports) are unwrapped via `getAliasedSymbol`.
 */
/**
 * Result of resolving a handler reference to its declared function shape.
 *
 *  - `{ kind: 'parameter', node }` — function has at least one parameter;
 *    `node` is the first one (we use its type as the event payload type).
 *  - `{ kind: 'no-payload' }` — function takes zero parameters; the event
 *    is legitimate but has no payload (schema = empty object).
 *  - `null` — couldn't resolve the reference back to a function shape
 *    we recognize (the caller decides whether to error).
 */
export type HandlerResolution =
    | { kind: 'parameter'; node: any }
    | { kind: 'no-payload' }
    | null

const fromFunctionLike = (fn: any): HandlerResolution => {
    if (fn.parameters.length === 0) return { kind: 'no-payload' }
    return { kind: 'parameter', node: fn.parameters[0] }
}

/**
 * Follow an identifier (shorthand or initializer reference) back to the
 * declaring function and report its handler shape.
 *
 * `shorthandParent` should be the `ShorthandPropertyAssignment` itself
 * when the identifier comes from a `{ name }` shorthand — required for
 * `getShorthandAssignmentValueSymbol` to resolve the variable.
 */
export const followIdentifierToFunction = (
    ctx: SchemaContext,
    identifier: any,
    shorthandParent: any = null
): HandlerResolution => {
    let symbol: any = null
    if (shorthandParent) {
        symbol = ctx.checker.getShorthandAssignmentValueSymbol(shorthandParent)
    }
    if (!symbol) {
        symbol = ctx.checker.getSymbolAtLocation(identifier)
    }
    if (!symbol) return null
    const realSymbol =
        symbol.flags & ts.SymbolFlags.Alias
            ? ctx.checker.getAliasedSymbol(symbol)
            : symbol
    const decls = realSymbol.declarations
    if (!decls || decls.length === 0) return null
    for (const decl of decls) {
        if (ts.isFunctionDeclaration(decl)) {
            return fromFunctionLike(decl)
        }
        if (ts.isVariableDeclaration(decl) && decl.initializer) {
            const unwrapped = unwrapToFunctionExpression(decl.initializer)
            if (unwrapped) return fromFunctionLike(unwrapped)
        }
        if (
            ts.isMethodDeclaration(decl) ||
            ts.isMethodSignature(decl)
        ) {
            return fromFunctionLike(decl)
        }
        if (ts.isParameter(decl) && decl.type) {
            return { kind: 'parameter', node: decl }
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
                            let resolution: HandlerResolution = null
                            if (ts.isPropertyAssignment(prop)) {
                                const init = prop.initializer
                                if (ts.isIdentifier(init)) {
                                    resolution = followIdentifierToFunction(
                                        ctx,
                                        init
                                    )
                                } else {
                                    const unwrapped =
                                        unwrapToFunctionExpression(init)
                                    if (unwrapped) {
                                        resolution =
                                            unwrapped.parameters.length === 0
                                                ? { kind: 'no-payload' }
                                                : {
                                                      kind: 'parameter',
                                                      node: unwrapped
                                                          .parameters[0],
                                                  }
                                    }
                                }
                            } else if (ts.isShorthandPropertyAssignment(prop)) {
                                resolution = followIdentifierToFunction(
                                    ctx,
                                    prop.name,
                                    prop
                                )
                            } else if (ts.isMethodDeclaration(prop)) {
                                resolution =
                                    prop.parameters.length === 0
                                        ? { kind: 'no-payload' }
                                        : {
                                              kind: 'parameter',
                                              node: prop.parameters[0],
                                          }
                            }
                            if (!resolution) {
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
                                            'same module. Destructured-' +
                                            'from-hook handlers and ' +
                                            'object-method references are ' +
                                            'not supported.',
                                    }
                                )
                            }
                            if (resolution.kind === 'no-payload') {
                                codeMap[key] = 'void'
                                schemaMap[key] = {
                                    type: 'object',
                                    properties: {},
                                    additionalProperties: false,
                                }
                            } else {
                                const { code, schema } = schemaForParameter(
                                    ctx,
                                    resolution.node,
                                    sourceFile
                                )
                                codeMap[key] = code
                                if (schema) schemaMap[key] = schema
                            }
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
