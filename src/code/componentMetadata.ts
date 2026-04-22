import path from 'path'
import { glob } from 'glob'
import { ts } from './ts'
import { ComponentType, REGISTER_FUNCTION } from './types'

export type ComponentPushMetadata = {
    component: string
    language: 'typescript'
    type: ComponentType | 'unknown'
    dataType: string | null
    lazy: boolean
    files: string[]
}

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

const detectComponentType = (propsType: any, checker: any): ComponentType => {
    const contentProperty = propsType.getProperty('content')
    const childrenProperty = propsType.getProperty('children')

    if (contentProperty) {
        const contentType = checker.getTypeOfSymbolAtLocation(
            contentProperty,
            contentProperty.valueDeclaration || contentProperty.declarations?.[0]
        )
        const typeStr = checker.typeToString(contentType)
        return typeStr.endsWith('[]')
            ? 'complex-container'
            : 'simple-container'
    }

    if (childrenProperty) {
        return 'complex'
    }

    return 'simple'
}

const getDataTypeName = (componentRef: any, checker: any): string | null => {
    const componentType = checker.getTypeAtLocation(componentRef)
    const signatures = checker.getSignaturesOfType(
        componentType,
        ts.SignatureKind.Call
    )

    if (signatures.length === 0) {
        return null
    }

    const propsParam = signatures[0].getParameters()[0]
    if (!propsParam) {
        return null
    }

    const propsType = checker.getTypeOfSymbolAtLocation(propsParam, componentRef)
    const dataProperty = propsType.getProperty('data')
    if (!dataProperty) {
        return null
    }

    const dataType = checker.getTypeOfSymbolAtLocation(dataProperty, componentRef)
    const dataSymbol = dataType.getSymbol()
    return dataSymbol ? dataSymbol.getName() : checker.typeToString(dataType)
}

export const inspectComponentPushMetadata = (
    componentDir: string,
    componentName: string,
    files: string[]
): ComponentPushMetadata => {
    const sourceFiles = glob.sync(`${componentDir}/**/*.{ts,tsx,js,jsx}`, {
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

    let type: ComponentType | 'unknown' = 'unknown'
    let dataType: string | null = null
    let lazy = false

    if (sourceFiles.length > 0) {
        const program = ts.createProgram(sourceFiles, compilerOptions)
        const checker = program.getTypeChecker()

        for (const sourceFile of program.getSourceFiles()) {
            if (sourceFile.isDeclarationFile) continue
            if (
                !sourceFiles.some(
                    (file) =>
                        path.resolve(file) === path.resolve(sourceFile.fileName)
                )
            ) {
                continue
            }

            const visit = (node: any) => {
                if (!ts.isCallExpression(node)) {
                    ts.forEachChild(node, visit)
                    return
                }

                const expr = node.expression
                const isRegisterCall =
                    (ts.isIdentifier(expr) && expr.text === REGISTER_FUNCTION) ||
                    (ts.isPropertyAccessExpression(expr) &&
                        expr.name.text === REGISTER_FUNCTION)

                if (!isRegisterCall || node.arguments.length === 0) {
                    ts.forEachChild(node, visit)
                    return
                }

                const arg = node.arguments[0]
                if (!ts.isObjectLiteralExpression(arg)) {
                    ts.forEachChild(node, visit)
                    return
                }

                let registeredName: string | null = null
                let componentRef: any | null = null
                let hasLoader = false

                for (const prop of arg.properties) {
                    if (ts.isPropertyAssignment(prop)) {
                        const propName =
                            ts.isIdentifier(prop.name) ||
                            ts.isStringLiteral(prop.name)
                                ? prop.name.text
                                : null

                        if (
                            propName === 'name' &&
                            ts.isStringLiteral(prop.initializer)
                        ) {
                            registeredName = prop.initializer.text
                        }
                        if (propName === 'component') {
                            componentRef = prop.initializer
                        }
                        if (propName === 'loader') {
                            hasLoader = true
                        }
                    } else if (ts.isShorthandPropertyAssignment(prop)) {
                        if (prop.name.text === 'component') {
                            componentRef = prop.name
                        }
                        if (prop.name.text === 'loader') {
                            hasLoader = true
                        }
                    }
                }

                if (registeredName !== componentName) {
                    ts.forEachChild(node, visit)
                    return
                }

                lazy = hasLoader && !componentRef
                if (componentRef) {
                    const componentType = checker.getTypeAtLocation(componentRef)
                    const signatures = checker.getSignaturesOfType(
                        componentType,
                        ts.SignatureKind.Call
                    )
                    if (signatures.length > 0) {
                        const propsParam = signatures[0].getParameters()[0]
                        if (propsParam) {
                            const propsType = checker.getTypeOfSymbolAtLocation(
                                propsParam,
                                componentRef
                            )
                            type = detectComponentType(propsType, checker)
                        }
                    }
                    dataType = getDataTypeName(componentRef, checker)
                }
            }

            visit(sourceFile)
        }
    }

    return {
        component: componentName,
        language: 'typescript',
        type,
        dataType,
        lazy,
        files: [...files].sort((a, b) => a.localeCompare(b)),
    }
}
