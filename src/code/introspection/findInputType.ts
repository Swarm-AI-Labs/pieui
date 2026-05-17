/**
 * Locate the type passed to `<PieCard stored={X} />` in JSX.
 *
 * Policy decision (per Policy C in the spec discussion): the TS side
 * recognises an Input variant ONLY through the `stored` prop. No
 * naming-convention fallback. If the card uses a hidden `<input>` element
 * instead of `stored`, that's intentional and the metadata reports no
 * input shape.
 */

import { ts } from '../ts'
import { IntrospectionError, errorOptsFromNode } from './errors'
import type { SchemaContext } from './schemaContext'

const PIE_CARD_TAG = 'PieCard'
const COMPONENT_EXTS = ['.ts', '.tsx']

/**
 * Walk JSX `<PieCard stored={X}/>` attributes and recover the type of `X`.
 *
 * ASSUMES:
 *   - `ctx` was built with files that include `<PieCard>` JSX usage.
 *   - `files` is the list of files to scan (typically the component's
 *     own source files).
 *
 * RETURNS:
 *   - `{ typeName, declaration }` of the type alias / interface that
 *     types the `stored` expression, on first hit.
 *   - `null` if no `<PieCard stored=…>` is found in any file, or if the
 *     stored expression has no resolvable named type.
 *
 * ALGORITHM:
 *   1. For each JSX `<PieCard>` element, look at attribute `stored`.
 *   2. If its initializer is `{expr}`, ask the checker for `expr`'s
 *      type, then for that type's alias symbol or value symbol.
 *   3. Take the first declaration that's an Interface/TypeAlias.
 *
 * EDGE CASES:
 *   - `<PieCard stored={anonymousObject}/>` where the inline object has
 *     no named type → returns `null`. Use a named interface or
 *     `as InputXxx` for the metadata to pick it up.
 *   - PieCard imported as a different name (`import { PieCard as Foo }`)
 *     → not detected. The tag-name check is strict on `"PieCard"`.
 */
export const findStoredAttributeType = (
    ctx: SchemaContext,
    files: string[]
): { typeName: string; declaration: any } | null => {
    for (const file of files) {
        if (!COMPONENT_EXTS.some((e) => file.endsWith(e))) continue
        const sourceFile = ctx.program.getSourceFile(file)
        if (!sourceFile) continue
        let found: { typeName: string; declaration: any } | null = null
        const visit = (node: any): void => {
            if (found) return
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
                        attr.name.text === 'stored' &&
                        attr.initializer &&
                        ts.isJsxExpression(attr.initializer) &&
                        attr.initializer.expression
                    ) {
                        const expr = attr.initializer.expression
                        const type = ctx.checker.getTypeAtLocation(expr)
                        const symbol = type.aliasSymbol ?? type.getSymbol()
                        if (
                            symbol &&
                            symbol.declarations &&
                            symbol.declarations.length > 0
                        ) {
                            const d = symbol.declarations[0]
                            if (
                                ts.isInterfaceDeclaration(d) ||
                                ts.isTypeAliasDeclaration(d)
                            ) {
                                found = {
                                    typeName: symbol.getName(),
                                    declaration: d,
                                }
                                return
                            }
                        }
                        throw new IntrospectionError(
                            '<PieCard stored={...}> expression has no ' +
                                'resolvable named type',
                            {
                                ...errorOptsFromNode(sourceFile, expr),
                                hint:
                                    'cast the expression as a named ' +
                                    'interface (`stored={value as InputXxx}`) ' +
                                    'or assign through a typed const',
                            }
                        )
                    }
                }
            }
            ts.forEachChild(node, visit)
        }
        visit(sourceFile)
        if (found) return found
    }
    return null
}
