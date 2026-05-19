/**
 * Concatenate human-written descriptions from a component's source so the
 * dump-metadata consumer (model, doc tool, etc.) gets the same context a
 * human reader would see from the code.
 *
 * Sections are gathered in this order and joined with `\n\n`:
 *
 *   1. Leading comment on the `<Name>Data` / `I<Name>Data` / `<Name>Props`
 *      declaration — the props-contract description.
 *   2. Leading comment on the React component declaration
 *      (`function <Name>`, `const <Name>: React.FC<…>`, etc.).
 *   3. Leading comment on each member of the data type (per-prop docs).
 *   4. Leading comment on each event handler reachable from
 *      `<PieCard methods={…}>` — taken from the property in-place AND,
 *      for shorthand / identifier references, from the resolved function
 *      declaration.
 *
 * Comment delimiters (`/**`, `*​/`, leading `*`, `//`) are stripped.
 */

import { ts } from '../ts'
import type { SchemaContext } from './schemaContext'

const PIE_CARD_TAG = 'PieCard'
const METHODS_PROP = 'methods'

/**
 * Strip comment delimiters from a raw comment slice, preserving the
 * inner prose. Handles `/** … *​/`, `/* … *​/`, and `// …` (one or more
 * consecutive single-line comments).
 */
const stripCommentMarkers = (raw: string): string => {
    const trimmed = raw.trim()
    if (trimmed.startsWith('/*')) {
        let inner = trimmed.startsWith('/**')
            ? trimmed.slice(3)
            : trimmed.slice(2)
        if (inner.endsWith('*/')) inner = inner.slice(0, -2)
        return inner
            .split('\n')
            .map((line) => line.replace(/^\s*\*\s?/, '').trimEnd())
            .join('\n')
            .trim()
    }
    return trimmed
        .split('\n')
        .map((line) => line.replace(/^\s*\/\/\s?/, '').trimEnd())
        .join('\n')
        .trim()
}

/**
 * Concatenate all leading comments attached to a node (one or more
 * block / line comments that immediately precede it).
 */
const leadingComment = (node: any): string | null => {
    const sf = node.getSourceFile?.()
    if (!sf) return null
    const ranges = ts.getLeadingCommentRanges(sf.text, node.getFullStart())
    if (!ranges || ranges.length === 0) return null
    const cleaned = ranges
        .map((r: any) => stripCommentMarkers(sf.text.slice(r.pos, r.end)))
        .filter((s: string) => s.length > 0)
        .join('\n\n')
    return cleaned || null
}

/**
 * Match top-level declarations that introduce the React component:
 *   - `function <Name>(…) {…}` (with or without `export` / `default`)
 *   - `const <Name>[: …] = …` — comment lives on the VariableStatement
 */
const findComponentDeclarationNode = (
    sourceFile: any,
    name: string
): any | null => {
    let hit: any | null = null
    const visit = (node: any): void => {
        if (hit) return
        if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
            hit = node
            return
        }
        if (ts.isVariableStatement(node)) {
            for (const decl of node.declarationList.declarations) {
                if (ts.isIdentifier(decl.name) && decl.name.text === name) {
                    hit = node
                    return
                }
            }
        }
        ts.forEachChild(node, visit)
    }
    visit(sourceFile)
    return hit
}

/**
 * Members iterable for an interface or a type-alias-of-type-literal.
 * Returns `[]` for union / intersection / other shapes — matches the
 * conservative behavior of `extractAjaxList`.
 */
const typeMembers = (declaration: any): readonly any[] => {
    if (!declaration) return []
    if (ts.isInterfaceDeclaration(declaration)) {
        return declaration.members as readonly any[]
    }
    if (ts.isTypeAliasDeclaration(declaration)) {
        const t = declaration.type
        if (ts.isTypeLiteralNode(t)) return t.members as readonly any[]
    }
    return []
}

/**
 * Resolve a handler identifier (shorthand or reference) to its
 * declaring function / variable declaration so we can read its leading
 * comment. Mirrors the resolution strategy of
 * `followIdentifierToFunction` but returns the *declaration* node
 * (FunctionDeclaration / VariableStatement / MethodDeclaration) whose
 * leading comments are the user-authored docs.
 */
const resolveHandlerDeclaration = (
    ctx: SchemaContext,
    identifier: any,
    shorthandParent: any = null
): any | null => {
    let symbol: any = null
    if (shorthandParent) {
        symbol = ctx.checker.getShorthandAssignmentValueSymbol(shorthandParent)
    }
    if (!symbol) symbol = ctx.checker.getSymbolAtLocation(identifier)
    if (!symbol) return null
    const realSymbol =
        symbol.flags & ts.SymbolFlags.Alias
            ? ctx.checker.getAliasedSymbol(symbol)
            : symbol
    const decls = realSymbol.declarations
    if (!decls || decls.length === 0) return null
    for (const decl of decls) {
        if (ts.isFunctionDeclaration(decl)) return decl
        if (ts.isVariableDeclaration(decl)) {
            // Comment lives on the surrounding VariableStatement.
            let n: any = decl.parent
            while (n && !ts.isVariableStatement(n)) n = n.parent
            if (n) return n
            return decl
        }
        if (ts.isMethodDeclaration(decl) || ts.isMethodSignature(decl)) {
            return decl
        }
    }
    return null
}

/**
 * Walk every `<PieCard methods={…}>` literal across the files; for each
 * known event yield the (sorted, deduped) leading-comment strings from
 * the in-place property AND, for shorthand / identifier references, the
 * resolved declaration.
 */
const collectHandlerComments = (
    ctx: SchemaContext,
    files: string[],
    events: string[]
): string[] => {
    const eventSet = new Set(events)
    const perEvent: Map<string, string[]> = new Map()
    const push = (key: string, c: string | null): void => {
        if (!c) return
        const arr = perEvent.get(key) ?? []
        if (!arr.includes(c)) arr.push(c)
        perEvent.set(key, arr)
    }

    for (const file of files) {
        const sourceFile = ctx.program.getSourceFile(file)
        if (!sourceFile) continue
        const visit = (node: any): void => {
            const isPieCard =
                (ts.isJsxSelfClosingElement(node) ||
                    ts.isJsxOpeningElement(node)) &&
                ts.isIdentifier(node.tagName) &&
                node.tagName.text === PIE_CARD_TAG
            if (isPieCard && node.attributes?.properties) {
                for (const attr of node.attributes.properties) {
                    if (
                        ts.isJsxAttribute(attr) &&
                        attr.name &&
                        ts.isIdentifier(attr.name) &&
                        attr.name.text === METHODS_PROP &&
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
                            push(key, leadingComment(prop))
                            if (
                                ts.isPropertyAssignment(prop) &&
                                ts.isIdentifier(prop.initializer)
                            ) {
                                const decl = resolveHandlerDeclaration(
                                    ctx,
                                    prop.initializer
                                )
                                if (decl) push(key, leadingComment(decl))
                            } else if (ts.isShorthandPropertyAssignment(prop)) {
                                const decl = resolveHandlerDeclaration(
                                    ctx,
                                    prop.name,
                                    prop
                                )
                                if (decl) push(key, leadingComment(decl))
                            }
                        }
                    }
                }
            }
            ts.forEachChild(node, visit)
        }
        visit(sourceFile)
    }

    const out: string[] = []
    for (const ev of [...events].sort()) {
        const comments = perEvent.get(ev)
        if (!comments) continue
        for (const c of comments) out.push(c)
    }
    return out
}

/**
 * Concatenate the four description sections (data-type doc, component
 * doc, per-field docs, per-handler docs) into a single string. Empty
 * sections are skipped; the result is `""` if no comments exist.
 *
 * ASSUMES:
 *   - `dataDeclaration` is the AST node returned by
 *     `findComponentDataTypeForName` (its leading comment is the
 *     props-contract description).
 *   - `events` is the already-extracted event-name list (used to filter
 *     `methods={…}` properties to the ones that actually count).
 */
export const extractDescription = (
    ctx: SchemaContext,
    componentName: string,
    files: string[],
    dataDeclaration: any,
    events: string[]
): string => {
    const parts: string[] = []

    const dataDoc = leadingComment(dataDeclaration)
    if (dataDoc) parts.push(dataDoc)

    for (const file of files) {
        const sf = ctx.program.getSourceFile(file)
        if (!sf) continue
        const node = findComponentDeclarationNode(sf, componentName)
        if (!node) continue
        const c = leadingComment(node)
        if (c) {
            parts.push(c)
            break
        }
    }

    for (const m of typeMembers(dataDeclaration)) {
        const c = leadingComment(m)
        if (c) parts.push(c)
    }

    for (const c of collectHandlerComments(ctx, files, events)) {
        parts.push(c)
    }

    return parts.join('\n\n')
}
