import path from 'path'
import { glob } from 'glob'
import { ts } from './ts'
import { ComponentInfo, ComponentType, REGISTER_FUNCTION } from './types'

const defaultCompilerOptions = () => ({
    allowJs: true,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
})

export const findComponentRegistrations = (srcDir: string): ComponentInfo[] => {
    console.log(`[pieui] Searching for components in: ${srcDir}`)

    const files = glob.sync(`${srcDir}/**/*.{ts,tsx}`, {
        ignore: ['**/*.d.ts', '**/dist/**', '**/node_modules/**'],
    })

    console.log(`[pieui] Found ${files.length} files to scan`)

    const program = ts.createProgram(files, defaultCompilerOptions())
    const checker = program.getTypeChecker()
    const components: ComponentInfo[] = []

    for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile) continue

        if (
            !files.some(
                (f) => path.resolve(f) === path.resolve(sourceFile.fileName)
            )
        )
            continue

        function visit(node: any) {
            if (ts.isCallExpression(node)) {
                const expr = node.expression
                const isRegisterCall =
                    (ts.isIdentifier(expr) &&
                        expr.text === REGISTER_FUNCTION) ||
                    (ts.isPropertyAccessExpression(expr) &&
                        expr.name.text === REGISTER_FUNCTION)

                if (isRegisterCall && node.arguments.length > 0) {
                    const arg = node.arguments[0]
                    if (ts.isObjectLiteralExpression(arg)) {
                        let componentName: string | null = null
                        let componentRef: any | null = null

                        for (const prop of arg.properties) {
                            if (ts.isPropertyAssignment(prop)) {
                                if (
                                    ts.isIdentifier(prop.name) ||
                                    ts.isStringLiteral(prop.name)
                                ) {
                                    const propName = ts.isIdentifier(prop.name)
                                        ? prop.name.text
                                        : prop.name.text

                                    if (
                                        propName === 'name' &&
                                        ts.isStringLiteral(prop.initializer)
                                    ) {
                                        componentName = prop.initializer.text
                                    }

                                    if (propName === 'component') {
                                        componentRef = prop.initializer
                                    }
                                }
                            } else if (ts.isShorthandPropertyAssignment(prop)) {
                                if (prop.name.text === 'component') {
                                    componentRef = prop.name
                                }
                            }
                        }

                        if (componentName && componentRef) {
                            console.log(
                                `[pieui] Found component registration: ${componentName}`
                            )

                            let foundDataType = false

                            const componentType =
                                checker.getTypeAtLocation(componentRef)
                            const symbol = componentType.getSymbol()

                            if (symbol) {
                                const componentTypeName = symbol.getName()

                                const signatures = checker.getSignaturesOfType(
                                    componentType,
                                    ts.SignatureKind.Call
                                )
                                if (signatures.length > 0) {
                                    const propsParam =
                                        signatures[0].getParameters()[0]
                                    if (propsParam) {
                                        const propsType =
                                            checker.getTypeOfSymbolAtLocation(
                                                propsParam,
                                                componentRef
                                            )
                                        const dataProperty =
                                            propsType.getProperty('data')

                                        if (dataProperty) {
                                            const dataType =
                                                checker.getTypeOfSymbolAtLocation(
                                                    dataProperty,
                                                    componentRef
                                                )
                                            const dataSymbol =
                                                dataType.getSymbol()

                                            if (
                                                dataSymbol &&
                                                dataSymbol.declarations &&
                                                dataSymbol.declarations.length >
                                                    0
                                            ) {
                                                const declaration =
                                                    dataSymbol.declarations[0]
                                                const sourceFile =
                                                    declaration.getSourceFile()

                                                if (
                                                    ts.isInterfaceDeclaration(
                                                        declaration
                                                    ) ||
                                                    ts.isTypeAliasDeclaration(
                                                        declaration
                                                    )
                                                ) {
                                                    const hasExport =
                                                        declaration.modifiers?.some(
                                                            (m) =>
                                                                m.kind ===
                                                                ts.SyntaxKind
                                                                    .ExportKeyword
                                                        )
                                                    if (hasExport) {
                                                        const dataTypeName =
                                                            dataSymbol.getName()
                                                        console.log(
                                                            `[pieui]   Found exported data type: ${dataTypeName}`
                                                        )

                                                        components.push({
                                                            name: componentName,
                                                            file: sourceFile.fileName,
                                                            dataTypeName:
                                                                dataTypeName,
                                                        })
                                                        foundDataType = true
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                if (!foundDataType) {
                                    const possibleDataTypes = [
                                        `${componentName}Data`,
                                        `${componentTypeName}Data`,
                                        `${componentTypeName}Props`,
                                        `I${componentName}Data`,
                                        `I${componentTypeName}Data`,
                                    ]

                                    for (const typeName of possibleDataTypes) {
                                        const typeSymbol = checker.resolveName(
                                            typeName,
                                            undefined,
                                            ts.SymbolFlags.Type,
                                            false
                                        )
                                        if (
                                            typeSymbol &&
                                            typeSymbol.declarations &&
                                            typeSymbol.declarations.length > 0
                                        ) {
                                            const declaration =
                                                typeSymbol.declarations[0]
                                            if (
                                                ts.isInterfaceDeclaration(
                                                    declaration
                                                ) ||
                                                ts.isTypeAliasDeclaration(
                                                    declaration
                                                )
                                            ) {
                                                const hasExport =
                                                    declaration.modifiers?.some(
                                                        (m) =>
                                                            m.kind ===
                                                            ts.SyntaxKind
                                                                .ExportKeyword
                                                    )
                                                if (hasExport) {
                                                    console.log(
                                                        `[pieui]   Found data type: ${typeName}`
                                                    )
                                                    components.push({
                                                        name: componentName,
                                                        file: declaration.getSourceFile()
                                                            .fileName,
                                                        dataTypeName: typeName,
                                                    })
                                                    foundDataType = true
                                                    break
                                                }
                                            }
                                        }
                                    }
                                }

                                if (!foundDataType) {
                                    console.log(
                                        `[pieui]   Warning: Could not find exported data type for ${componentName}`
                                    )
                                }
                            }
                        }
                    }
                }
            }

            ts.forEachChild(node, visit)
        }

        visit(sourceFile)
    }

    console.log(`[pieui] Found ${components.length} components with data types`)
    return components
}

export const detectComponentType = (
    propsType: any,
    checker: any
): ComponentType => {
    const contentProperty = propsType.getProperty('content')
    const childrenProperty = propsType.getProperty('children')

    if (contentProperty) {
        const contentType = checker.getTypeOfSymbolAtLocation(
            contentProperty,
            contentProperty.valueDeclaration ||
                contentProperty.declarations?.[0]
        )
        const typeStr = checker.typeToString(contentType)

        if (
            typeStr.includes('[]') ||
            typeStr.includes('Array') ||
            contentType.symbol?.getName() === 'Array'
        ) {
            return 'complex-container'
        }

        if (checker.isArrayType?.(contentType)) {
            return 'complex-container'
        }

        return 'simple-container'
    }

    if (childrenProperty) {
        return 'complex'
    }

    return 'simple'
}
