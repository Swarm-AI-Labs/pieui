import fs from 'fs'
import path from 'path'
import { glob } from 'glob'
import { ts } from '../ts'

const getStringLiteralFromJsxInitializer = (init: any): string | undefined => {
    if (!init) return
    if (ts.isStringLiteral(init)) return init.text
    if (
        ts.isJsxExpression(init) &&
        init.expression &&
        ts.isStringLiteral(init.expression)
    )
        return init.expression.text
}

const getAttribute = (attrs: any, name: string): any => {
    for (const prop of attrs.properties) {
        if (!ts.isJsxAttribute(prop)) continue
        if (ts.isIdentifier(prop.name) && prop.name.text === name) return prop
    }
}

const getObjectLiteralFromMethodsAttr = (methodsAttr: any): any => {
    const init = methodsAttr?.initializer
    const expr = init && ts.isJsxExpression(init) ? init.expression : undefined
    if (!expr) return
    if (ts.isObjectLiteralExpression(expr)) return expr
}

const getPropertyKeys = (obj: any): Set<string> => {
    const keys = new Set<string>()
    for (const prop of obj.properties) {
        if (ts.isPropertyAssignment(prop)) {
            if (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) {
                keys.add(prop.name.text)
            }
        } else if (ts.isShorthandPropertyAssignment(prop)) {
            keys.add(prop.name.text)
        } else if (ts.isMethodDeclaration(prop)) {
            if (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) {
                keys.add(prop.name.text)
            }
        }
    }
    return keys
}

const computeIndentFromExistingProp = (
    sourceText: string,
    sourceFile: any,
    obj: any
): { propIndent: string; closingIndent: string } => {
    const getLineStart = (pos: number) => {
        let p = pos
        while (p > 0 && sourceText[p - 1] !== '\n') p -= 1
        return p
    }

    const closingLineStart = getLineStart(obj.getEnd())
    const closingIndentMatch = sourceText
        .slice(closingLineStart, obj.getEnd())
        .match(/^\s*/)
    const closingIndent = closingIndentMatch ? closingIndentMatch[0] : ''

    const firstProp = obj.properties[0]
    if (!firstProp) {
        return { propIndent: closingIndent + '    ', closingIndent }
    }

    const propStart = firstProp.getStart(sourceFile)
    const propLineStart = getLineStart(propStart)
    const propIndentMatch = sourceText
        .slice(propLineStart, propStart)
        .match(/^\s*/)
    const propIndent = propIndentMatch ? propIndentMatch[0] : ''
    return { propIndent, closingIndent }
}

const isValidEventKey = (key: string) => {
    if (!key) return false
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$-]*$/.test(key)) return false
    return true
}

export const addEventCommand = (
    srcDir: string,
    componentName: string,
    eventName: string
) => {
    if (!isValidEventKey(eventName)) {
        console.error(
            `[pieui] Error: Invalid event key "${eventName}". Use something like "alert" or "create".`
        )
        process.exit(1)
    }

    console.log(
        `[pieui] Adding methods.${eventName} to PieCard(card="${componentName}")`
    )

    const files = glob.sync(`${srcDir}/**/*.{ts,tsx,js,jsx}`, {
        ignore: [
            '**/*.d.ts',
            '**/dist/**',
            '**/node_modules/**',
            '**/*.test.*',
            '**/*.spec.*',
            '**/tests/**',
            '**/__tests__/**',
        ],
    })

    const compilerOptions = {
        allowJs: true,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
    }

    const program = ts.createProgram(files, compilerOptions)

    let target:
        | {
              sourceFile: any
              methodsObj: any
          }
        | undefined

    for (const sourceFile of program.getSourceFiles()) {
        if (target) break
        if (sourceFile.isDeclarationFile) continue
        if (
            !files.some(
                (f) => path.resolve(f) === path.resolve(sourceFile.fileName)
            )
        )
            continue

        const visit = (node: any) => {
            if (target) return

            const isPieCardTag = (tagName: any) =>
                ts.isIdentifier(tagName) && tagName.text === 'PieCard'

            const handleAttrs = (attrs: any) => {
                const cardAttr = getAttribute(attrs, 'card')
                const cardValue = getStringLiteralFromJsxInitializer(
                    cardAttr?.initializer
                )
                if (cardValue !== componentName) return

                const methodsAttr = getAttribute(attrs, 'methods')
                const obj = getObjectLiteralFromMethodsAttr(methodsAttr)
                if (!obj) return

                target = { sourceFile, methodsObj: obj }
            }

            if (
                ts.isJsxSelfClosingElement(node) &&
                isPieCardTag(node.tagName)
            ) {
                handleAttrs(node.attributes)
                ts.forEachChild(node, visit)
                return
            }

            if (ts.isJsxOpeningElement(node) && isPieCardTag(node.tagName)) {
                handleAttrs(node.attributes)
                ts.forEachChild(node, visit)
                return
            }

            ts.forEachChild(node, visit)
        }

        visit(sourceFile)
    }

    if (!target) {
        console.error(
            `[pieui] Error: Could not find <PieCard card="${componentName}" ... methods={{...}} /> in ${srcDir}`
        )
        console.error(
            `[pieui] Note: add-event currently supports only inline object literals: methods={{ ... }}`
        )
        process.exit(1)
    }

    const filePath = target.sourceFile.fileName
    const sourceText = fs.readFileSync(filePath, 'utf8')
    const methodsObj = target.methodsObj
    const existingKeys = getPropertyKeys(methodsObj)

    if (existingKeys.has(eventName)) {
        console.log(
            `[pieui] methods.${eventName} already exists in ${path.relative(
                process.cwd(),
                filePath
            )}`
        )
        return
    }

    const { propIndent, closingIndent } = computeIndentFromExistingProp(
        sourceText,
        target.sourceFile,
        methodsObj
    )

    const insertAt = methodsObj.getEnd() - 1
    const isEmpty = methodsObj.properties.length === 0

    const handler = `(payload: any) => {
${propIndent}    console.log('[pieui] ${componentName}:${eventName}', payload)
${propIndent}}`

    const insertion = isEmpty
        ? `\n${propIndent}${eventName}: ${handler}\n${closingIndent}`
        : `,\n${propIndent}${eventName}: ${handler}\n${closingIndent}`

    const updated =
        sourceText.slice(0, insertAt) + insertion + sourceText.slice(insertAt)

    fs.writeFileSync(filePath, updated, 'utf8')

    console.log(
        `[pieui] Updated: ${path.relative(process.cwd(), filePath)} (added "${eventName}")`
    )
}
