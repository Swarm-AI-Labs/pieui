/**
 * Locate the TypeScript `<Name>Data` declaration that defines a card's
 * props shape, and the `pathname*` field names within it (ajaxList).
 *
 * The pieui convention: a card named `Foo` has its props described by
 * `interface FooData { ... }`. Alternatives `IFooData` and `FooProps`
 * are also recognized to accommodate older conventions.
 */

import { ts } from '../ts'
import { IntrospectionError } from './errors'
import {
    findTypeDeclaration,
    type SchemaContext,
} from './schemaContext'

/**
 * Try to find the card's data type by naming convention.
 *
 * ASSUMES: `componentName` is the PascalCase card name (e.g. `BoxCard`).
 *
 * RETURNS: `{ typeName, declaration }` for the first match, or `null`.
 *
 * TYPE NAME CANDIDATES, in priority order:
 *   1. `<componentName>Data`   — canonical pattern
 *   2. `I<componentName>Data`  — Hungarian variant
 *   3. `<componentName>Props`  — older code uses this for the data shape
 *
 * USAGE: pass the returned `declaration` to `getText()` for `propsCode`
 * and `extractAjaxList()` for the `ajaxList` field.
 */
export const findComponentDataTypeForName = (
    ctx: SchemaContext,
    componentName: string
): { typeName: string; declaration: any } => {
    const guesses = [
        `${componentName}Data`,
        `I${componentName}Data`,
        `${componentName}Props`,
    ]
    for (const typeName of guesses) {
        const found = findTypeDeclaration(ctx.program, ctx.checker, typeName)
        if (found) return { typeName, declaration: found.declaration }
    }
    throw new IntrospectionError(
        `no data type found for component "${componentName}"`,
        {
            hint:
                `define an exported interface named ${componentName}Data ` +
                `(or I${componentName}Data, or ${componentName}Props) ` +
                'in the component directory',
        }
    )
}

/**
 * Extract ajax-pathname field names directly declared on the props
 * interface or type alias.
 *
 * ASSUMES: `declaration` is an `InterfaceDeclaration` or
 * `TypeAliasDeclaration` (typically the one returned by
 * `findComponentDataTypeForName`).
 *
 * RETURNS: sorted unique field names whose identifier starts with
 * `pathname`. Includes `pathname` itself plus camelCase variants
 * (`pathnameClick`, `pathnameDelete`, ...).
 *
 * EDGE CASE: NESTED property signatures are also walked via
 * `ts.forEachChild`. Future improvement could restrict to direct
 * children of the type body to avoid bleed-through from anonymous
 * inline types (cf. Python side which already limits to direct fields).
 */
/**
 * Direct members of the props type that start with `pathname`.
 *
 * Restricted to DIRECT members of the type body — nested object types
 * with their own `pathname*` keys are NOT included to avoid spurious
 * ajax fields bleeding from inner shapes.
 *
 * For interface declarations: walks `members`.
 * For type aliases of TypeLiteral: walks `members`.
 * For type aliases of union/intersection/other: returns []. To declare
 * ajax fields, the props type must have a literal object shape.
 */
export const extractAjaxList = (declaration: any): string[] => {
    if (!declaration) return []
    let members: readonly any[] | undefined
    if (ts.isInterfaceDeclaration(declaration)) {
        members = declaration.members as readonly any[]
    } else if (ts.isTypeAliasDeclaration(declaration)) {
        const t = declaration.type
        if (ts.isTypeLiteralNode(t)) {
            members = t.members as readonly any[]
        }
    }
    if (!members) return []
    const fields = new Set<string>()
    for (const m of members) {
        if (
            ts.isPropertySignature(m) &&
            m.name &&
            ts.isIdentifier(m.name) &&
            m.name.text.startsWith('pathname')
        ) {
            fields.add(m.name.text)
        }
    }
    return Array.from(fields).sort()
}
