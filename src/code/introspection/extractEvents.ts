/**
 * Strict extraction of event names from `<PieCard methods={…}>` JSX.
 *
 * The contract is intentionally STRICT (asymmetric to the lenient
 * Python side): `methods={…}` MUST be an inline object literal with
 * static keys. Spread, variable references, computed keys → throws.
 *
 * Rationale: TS authors who pass `methods={pieMethods}` (a hook return)
 * have no way for static analysis to know the event surface. We force
 * the call site to spell out the keys so the registry is observable.
 *
 * Use case: produces the `events` field of PieMetadata.
 */

import fs from 'node:fs'
import { ts } from '../ts'
import { IntrospectionError } from './errors'

const PIE_CARD_TAG = 'PieCard'
const METHODS_PROP = 'methods'

const isPieCardJsx = (node: any): boolean => {
    const tagName = ts.isJsxElement(node)
        ? node.openingElement.tagName
        : ts.isJsxSelfClosingElement(node)
          ? node.tagName
          : null
    if (!tagName) return false
    if (ts.isIdentifier(tagName)) return tagName.text === PIE_CARD_TAG
    return false
}

const findMethodsAttribute = (
    openingOrSelf: any,
    sourceFile: any
): any => {
    const attributes = openingOrSelf.attributes
    if (!attributes || !attributes.properties) return null
    for (const attr of attributes.properties) {
        if (ts.isJsxSpreadAttribute(attr)) {
            const start = ts.getLineAndCharacterOfPosition(
                sourceFile,
                attr.getStart()
            )
            throw new IntrospectionError(
                '<PieCard {...spread}> is not supported — `methods` might ' +
                    'be hidden inside the spread',
                {
                    sourceFile: sourceFile.fileName,
                    line: start.line + 1,
                    column: start.character + 1,
                    hint:
                        'spell out `methods={…}` as a top-level JSX ' +
                        'attribute so event names can be discovered',
                }
            )
        }
        if (
            ts.isJsxAttribute(attr) &&
            attr.name &&
            ts.isIdentifier(attr.name) &&
            attr.name.text === METHODS_PROP
        ) {
            return attr
        }
    }
    return null
}

const extractKeysFromObjectLiteral = (
    objLiteral: any,
    sourceFile: any
): string[] => {
    const keys: string[] = []
    for (const prop of objLiteral.properties) {
        if (ts.isSpreadAssignment(prop)) {
            const start = ts.getLineAndCharacterOfPosition(
                sourceFile,
                prop.getStart()
            )
            throw new Error(
                `${sourceFile.fileName}:${start.line + 1}: ` +
                    `<PieCard methods={…}> must be an inline object literal — ` +
                    `spread/rest is not allowed`
            )
        }
        if (
            ts.isPropertyAssignment(prop) ||
            ts.isShorthandPropertyAssignment(prop) ||
            ts.isMethodDeclaration(prop)
        ) {
            const name = prop.name
            if (ts.isIdentifier(name)) {
                keys.push(name.text)
            } else if (ts.isStringLiteral(name)) {
                keys.push(name.text)
            } else if (ts.isComputedPropertyName(name)) {
                const start = ts.getLineAndCharacterOfPosition(
                    sourceFile,
                    name.getStart()
                )
                throw new Error(
                    `${sourceFile.fileName}:${start.line + 1}: ` +
                        `<PieCard methods={…}> keys must be static identifiers ` +
                        `or string literals — computed keys are not allowed`
                )
            }
        }
    }
    return keys
}

/**
 * Extract the union of event names declared via `<PieCard methods={…}>`
 * across the given files.
 *
 * ASSUMES: `files` are absolute paths to `.ts`/`.tsx` source files.
 *
 * RETURNS: sorted array of unique event names (object-literal keys).
 *
 * THROWS: Error with file:line if `methods={…}` is anything other than
 * a plain inline object literal with static keys. Specifically:
 *   - `methods={spread}` (Identifier initializer) — throws.
 *   - `methods={{ ...other }}` (spread element) — throws.
 *   - `methods={{ [key]: handler }}` (computed key) — throws.
 *   - `methods={{ click: fn }}` (PropertyAssignment) — OK.
 *   - `methods={{ click }}` (Shorthand) — OK, key is `"click"`.
 *
 * Strings ARE accepted as keys (`methods={{ "click-x": fn }}`).
 */
export const extractEvents = (files: string[]): string[] => {
    const events = new Set<string>()
    for (const file of files) {
        let text: string
        try {
            text = fs.readFileSync(file, 'utf8')
        } catch {
            continue
        }
        const sourceFile = ts.createSourceFile(
            file,
            text,
            ts.ScriptTarget.ES2020,
            true,
            file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        )

        const visit = (node: any): void => {
            if (isPieCardJsx(node)) {
                const opening = ts.isJsxElement(node)
                    ? node.openingElement
                    : node
                const methodsAttr = findMethodsAttribute(opening, sourceFile)
                if (methodsAttr && methodsAttr.initializer) {
                    const init = methodsAttr.initializer
                    if (!ts.isJsxExpression(init) || !init.expression) {
                        const start = ts.getLineAndCharacterOfPosition(
                            sourceFile,
                            init.getStart()
                        )
                        throw new Error(
                            `${file}:${start.line + 1}: ` +
                                `<PieCard methods={…}> must be set with an inline object literal`
                        )
                    }
                    if (!ts.isObjectLiteralExpression(init.expression)) {
                        const start = ts.getLineAndCharacterOfPosition(
                            sourceFile,
                            init.expression.getStart()
                        )
                        throw new Error(
                            `${file}:${start.line + 1}: ` +
                                `<PieCard methods={…}> must be an inline object literal ` +
                                `(found ${ts.SyntaxKind[init.expression.kind]})`
                        )
                    }
                    for (const k of extractKeysFromObjectLiteral(
                        init.expression,
                        sourceFile
                    )) {
                        events.add(k)
                    }
                }
            }
            ts.forEachChild(node, visit)
        }
        visit(sourceFile)
    }
    return Array.from(events).sort()
}