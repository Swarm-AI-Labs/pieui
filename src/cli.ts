#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { glob } from 'glob'
import * as TJS from 'typescript-json-schema'

const MANIFEST_FILENAME = 'pieui.components.json'
const REGISTER_FUNCTION = 'registerPieComponent'

const ts = TJS.ts

type ComponentType =
    | 'simple'
    | 'complex'
    | 'simple-container'
    | 'complex-container'

type ListFilter = 'all' | ComponentType

type ParsedArgs = {
    command: string
    outDir: string
    srcDir: string
    append: boolean
    componentName?: string
    componentType?: ComponentType
    removeComponentName?: string
    listFilter?: ListFilter
}

type ComponentManifestEntry = {
    card: string
    data: TJS.Definition
}

type ComponentInfo = {
    name: string
    file: string
    dataTypeName: string
}

const parseArgs = (argv: string[]): ParsedArgs => {
    const [command = ''] = argv
    const outDirFlag = argv.find((arg) => arg.startsWith('--out-dir='))
    const srcDirFlag = argv.find((arg) => arg.startsWith('--src-dir='))
    const outDirIndex = argv.findIndex(
        (arg) => arg === '--out-dir' || arg === '-o'
    )
    const srcDirIndex = argv.findIndex(
        (arg) => arg === '--src-dir' || arg === '-s'
    )
    const appendFlag = argv.includes('--append')

    let outDir = command === 'postbuild' ? 'public' : '.'
    let srcDir = 'src'
    let componentType: ComponentType | undefined
    let componentName: string | undefined

    let removeComponentName: string | undefined
    let listFilter: ListFilter | undefined

    if (command === 'remove' && argv[1]) {
        removeComponentName = argv[1]
    }

    if (command === 'list') {
        const validFilters: ListFilter[] = [
            'all',
            'simple',
            'complex',
            'simple-container',
            'complex-container',
        ]
        const filterArg = argv[1] as ListFilter | undefined
        listFilter =
            filterArg && validFilters.includes(filterArg) ? filterArg : 'all'
    }

    if (command === 'add' && argv[1]) {
        // Check if first argument is a component type
        const validTypes: ComponentType[] = [
            'simple',
            'complex',
            'simple-container',
            'complex-container',
        ]
        if (validTypes.includes(argv[1] as ComponentType)) {
            componentType = argv[1] as ComponentType
            componentName = argv[2]
        } else {
            // Default to complex-container if no type specified
            componentType = 'complex-container'
            componentName = argv[1]
        }
    }

    if (outDirFlag) {
        outDir = outDirFlag.split('=')[1] || outDir
    } else if (outDirIndex !== -1 && argv[outDirIndex + 1]) {
        outDir = argv[outDirIndex + 1]
    }

    if (srcDirFlag) {
        srcDir = srcDirFlag.split('=')[1] || srcDir
    } else if (srcDirIndex !== -1 && argv[srcDirIndex + 1]) {
        srcDir = argv[srcDirIndex + 1]
    }

    return {
        command,
        outDir,
        srcDir,
        append: appendFlag,
        componentName,
        componentType,
        removeComponentName,
        listFilter,
    }
}

const printUsage = () => {
    console.log('Usage: pieui <command> [options]')
    console.log('')
    console.log('Commands:')
    console.log(
        '  init                                    Initialize piecomponents directory with registry.ts'
    )
    console.log(
        '  add [type] <ComponentName>              Create a new component in piecomponents directory'
    )
    console.log(
        '  remove <ComponentName>                  Remove a component from piecomponents directory'
    )
    console.log(
        '  postbuild                               Scan for components and generate manifest'
    )
    console.log(
        '  list [filter]                            List registered components in a table'
    )
    console.log('')
    console.log('Component types for add command:')
    console.log('  simple                  Simple component (only data prop)')
    console.log(
        '  complex                 Complex component (data + children props)'
    )
    console.log(
        '  simple-container        Container with single content (data + content)'
    )
    console.log(
        '  complex-container       Container with array content (data + content[])'
    )
    console.log('                         (default if type not specified)')
    console.log('')
    console.log('Options for init:')
    console.log(
        '  --out-dir <dir>, -o <dir>    Base directory for piecomponents (default: .)'
    )
    console.log('')
    console.log('Options for postbuild:')
    console.log(
        '  --out-dir <dir>, -o <dir>    Output directory (default: public)'
    )
    console.log(
        '  --src-dir <dir>, -s <dir>    Source directory (default: src)'
    )
    console.log(
        '  --append                      Include built-in pieui components in the manifest'
    )
    console.log('')
    console.log('Options for list:')
    console.log(
        '  --src-dir <dir>, -s <dir>    Source directory (default: src)'
    )
    console.log('')
    console.log('Filters for list:')
    console.log(
        '  all                 All components (default)'
    )
    console.log(
        '  simple              Simple components (only data prop)'
    )
    console.log(
        '  complex             Complex components (data + children props)'
    )
    console.log(
        '  simple-container    Container with single content'
    )
    console.log(
        '  complex-container   Container with array content'
    )
    console.log('')
    console.log('Examples:')
    console.log('  pieui init')
    console.log('  pieui init --out-dir packages/app')
    console.log(
        '  pieui add MyCustomCard                        # Creates complex-container by default'
    )
    console.log(
        '  pieui add simple MySimpleCard                 # Creates simple component'
    )
    console.log(
        '  pieui add complex-container MyContainerCard   # Creates complex container'
    )
    console.log('  pieui postbuild --append --out-dir dist')
    console.log('  pieui list                                    # List all components')
    console.log('  pieui list simple                             # List only simple components')
    console.log('  pieui list complex-container --src-dir app    # List complex containers in app/')
}

const findComponentRegistrations = (srcDir: string): ComponentInfo[] => {
    console.log(`[pieui] Searching for components in: ${srcDir}`)

    const files = glob.sync(`${srcDir}/**/*.{ts,tsx}`, {
        ignore: ['**/*.d.ts', '**/dist/**', '**/node_modules/**', '**/cli.ts'],
    })

    console.log(`[pieui] Found ${files.length} files to scan`)

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
    const checker = program.getTypeChecker()
    const components: ComponentInfo[] = []

    for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile) continue

        const relativePath = path.relative(process.cwd(), sourceFile.fileName)
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

                            // Try to determine the data type name
                            const componentType =
                                checker.getTypeAtLocation(componentRef)
                            const symbol = componentType.getSymbol()

                            if (symbol) {
                                const componentTypeName = symbol.getName()

                                // Try to find the actual data type from props
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

                                                // Check if it's exported
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

                                // Fallback: try to find exported type in the same file
                                if (!foundDataType) {
                                    // Common patterns for data type names
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

const isCssPropertiesType = (type: any, checker: any): boolean => {
    if (type.isUnion()) {
        return type.types.some((unionType: any) =>
            isCssPropertiesType(unionType, checker)
        )
    }

    const aliasSymbol = type.aliasSymbol
    if (aliasSymbol && aliasSymbol.getName() === 'CSSProperties') {
        return true
    }

    const symbol = type.getSymbol()
    if (symbol && symbol.getName() === 'CSSProperties') {
        return true
    }

    const typeText = checker.typeToString(type)
    if (typeText.includes('CSSProperties')) {
        return true
    }

    if (symbol) {
        const declarations = symbol.getDeclarations()
        if (!declarations || declarations.length === 0) {
            return false
        }

        return declarations.some((declaration: any) => {
            const fileName = declaration.getSourceFile().fileName
            return fileName.includes('react') || fileName.includes('csstype')
        })
    }

    return false
}

const schemaForIndexType = (type: any, checker: any): Record<string, any> => {
    const normalizedType = type.getNonNullableType
        ? type.getNonNullableType()
        : type

    if (normalizedType.flags & ts.TypeFlags.StringLike) {
        return { type: 'string' }
    }

    if (normalizedType.flags & ts.TypeFlags.NumberLike) {
        return { type: 'number' }
    }

    if (normalizedType.flags & ts.TypeFlags.BooleanLike) {
        return { type: 'boolean' }
    }

    if (normalizedType.flags & ts.TypeFlags.BigIntLike) {
        return { type: 'integer' }
    }

    if (isCssPropertiesType(normalizedType, checker)) {
        return { type: 'object', additionalProperties: {} }
    }

    if (normalizedType.isUnion()) {
        return {
            anyOf: normalizedType.types.map((unionType: any) =>
                schemaForIndexType(unionType, checker)
            ),
        }
    }

    if (checker.isArrayType(normalizedType)) {
        const elementType = checker.getElementTypeOfArrayType(normalizedType)
        if (elementType) {
            return {
                type: 'array',
                items: schemaForIndexType(elementType, checker),
            }
        }
    }

    return {}
}

const patchSchemaForType = (
    type: any,
    schema: Record<string, any>,
    checker: any,
    visited: Set<number> = new Set()
): void => {
    if (!schema || typeof schema !== 'object') {
        return
    }

    const normalizedType = type.getNonNullableType
        ? type.getNonNullableType()
        : type
    if (visited.has(normalizedType.id)) {
        return
    }
    visited.add(normalizedType.id)

    if (isCssPropertiesType(normalizedType, checker)) {
        schema.type = 'object'
        schema.additionalProperties = {}
        delete schema.properties
        delete schema.required
        return
    }

    const stringIndexType = normalizedType.getStringIndexType?.()
    if (stringIndexType) {
        const indexSchema = schemaForIndexType(stringIndexType, checker)
        schema.type = 'object'
        schema.additionalProperties = indexSchema

        if (schema.properties && Object.keys(schema.properties).length === 0) {
            delete schema.properties
            delete schema.required
        }
    }

    if (checker.isTupleType(normalizedType)) {
        const elementTypes = checker.getTypeArguments(normalizedType as any)
        if (schema.items && Array.isArray(schema.items)) {
            for (
                let i = 0;
                i < schema.items.length && i < elementTypes.length;
                i += 1
            ) {
                patchSchemaForType(
                    elementTypes[i],
                    schema.items[i],
                    checker,
                    visited
                )
            }
        }
        return
    }

    if (checker.isArrayType(normalizedType)) {
        const elementType = checker.getElementTypeOfArrayType(normalizedType)
        if (elementType && schema.items && !Array.isArray(schema.items)) {
            patchSchemaForType(elementType, schema.items, checker, visited)
        }
        return
    }

    if (normalizedType.isUnion() && Array.isArray(schema.anyOf)) {
        const unionTypes = normalizedType.types
        for (
            let i = 0;
            i < schema.anyOf.length && i < unionTypes.length;
            i += 1
        ) {
            patchSchemaForType(unionTypes[i], schema.anyOf[i], checker, visited)
        }
        return
    }

    if (normalizedType.isIntersection() && Array.isArray(schema.allOf)) {
        const intersectionTypes = normalizedType.types
        for (
            let i = 0;
            i < schema.allOf.length && i < intersectionTypes.length;
            i += 1
        ) {
            patchSchemaForType(
                intersectionTypes[i],
                schema.allOf[i],
                checker,
                visited
            )
        }
        return
    }

    const properties = checker.getPropertiesOfType(normalizedType)
    if (schema.properties && properties.length > 0) {
        for (const property of properties) {
            const propertyName = property.getName()
            const propertySchema = schema.properties[propertyName]
            if (!propertySchema) {
                continue
            }
            const declaration =
                property.valueDeclaration ?? property.declarations?.[0]
            if (!declaration) {
                continue
            }
            const propertyType = checker.getTypeOfSymbolAtLocation(
                property,
                declaration
            )
            patchSchemaForType(propertyType, propertySchema, checker, visited)
        }
    }
}

const initCommand = (outDir: string) => {
    const resolvedOutDir = path.resolve(process.cwd(), outDir)

    console.log(
        `[pieui] Initializing piecomponents directory in ${resolvedOutDir}...`
    )

    const pieComponentsDir = path.join(resolvedOutDir, 'piecomponents')

    // Create piecomponents directory
    if (!fs.existsSync(pieComponentsDir)) {
        fs.mkdirSync(pieComponentsDir, { recursive: true })
        console.log('[pieui] Created piecomponents directory')
    } else {
        console.log('[pieui] piecomponents directory already exists')
    }

    // Create registry.ts
    const registryPath = path.join(pieComponentsDir, 'registry.ts')
    const registryContent = `"use client"

import { registerPieComponent } from "@piedata/pieui";

// Import your custom components here
// Example:
// import MyCustomCard from "./MyCustomCard/ui/MyCustomCard";

export const initializePieUI = () => {
    // Register your custom components here
    // Example:
    // registerPieComponent({
    //     name: 'MyCustomCard',
    //     component: MyCustomCard,
    // });
}
`

    if (!fs.existsSync(registryPath)) {
        fs.writeFileSync(registryPath, registryContent, 'utf8')
        console.log('[pieui] Created registry.ts')
    } else {
        console.log('[pieui] registry.ts already exists')
    }

    // Update tailwind.config.js if it exists
    const tailwindConfigPath = path.join(resolvedOutDir, 'tailwind.config.js')
    const tailwindConfigTsPath = path.join(resolvedOutDir, 'tailwind.config.ts')
    const pieuiContentPath =
        './node_modules/@piedata/pieui/dist/**/*.{js,mjs,ts,jsx,tsx}'

    let configPath = null
    if (fs.existsSync(tailwindConfigPath)) {
        configPath = tailwindConfigPath
    } else if (fs.existsSync(tailwindConfigTsPath)) {
        configPath = tailwindConfigTsPath
    }

    if (configPath) {
        console.log('[pieui] Updating Tailwind config...')

        try {
            let configContent = fs.readFileSync(configPath, 'utf8')

            // Check if the path is already added
            if (!configContent.includes(pieuiContentPath)) {
                // Try to find the content array
                const contentMatch = configContent.match(
                    /content\s*:\s*\[([^\]]*)\]/s
                )

                if (contentMatch) {
                    const contentArray = contentMatch[1]
                    // Add the pieui path to the content array
                    const newContentArray = contentArray.trim()
                        ? `${contentArray.trim()},\n    "${pieuiContentPath}"`
                        : `\n    "${pieuiContentPath}"\n  `

                    configContent = configContent.replace(
                        contentMatch[0],
                        `content: [${newContentArray}]`
                    )

                    fs.writeFileSync(configPath, configContent, 'utf8')
                    console.log(
                        '[pieui] Added PieUI path to Tailwind content configuration'
                    )
                } else {
                    console.log(
                        '[pieui] Warning: Could not find content array in Tailwind config'
                    )
                    console.log(
                        '[pieui] Please manually add the following to your Tailwind content array:'
                    )
                    console.log(`[pieui]   "${pieuiContentPath}"`)
                }
            } else {
                console.log(
                    '[pieui] PieUI path already exists in Tailwind config'
                )
            }
        } catch (error) {
            console.error('[pieui] Error updating Tailwind config:', error)
            console.log(
                '[pieui] Please manually add the following to your Tailwind content array:'
            )
            console.log(`[pieui]   "${pieuiContentPath}"`)
        }
    } else {
        console.log(
            '[pieui] No Tailwind config found. If you use Tailwind CSS, add this to your content array:'
        )
        console.log(`[pieui]   "${pieuiContentPath}"`)
    }

    console.log('[pieui] Initialization complete!')
    console.log('[pieui] Next steps:')
    console.log(
        '  1. Import { initializePieUI } from "./piecomponents/registry" in your app'
    )
    console.log('  2. Call initializePieUI() before using PieRoot')
    console.log('  3. Use "pieui add <ComponentName>" to create new components')
}

const addCommand = (
    componentName: string,
    componentType: ComponentType = 'complex-container'
) => {
    if (!componentName) {
        console.error('[pieui] Error: Component name is required')
        console.log('Usage: pieui add [type] <ComponentName>')
        process.exit(1)
    }

    // Validate component name
    if (!/^[A-Z][a-zA-Z0-9]+$/.test(componentName)) {
        console.error(
            '[pieui] Error: Component name must start with uppercase letter and contain only letters and numbers'
        )
        process.exit(1)
    }

    console.log(`[pieui] Creating ${componentType} component: ${componentName}`)

    const pieComponentsDir = path.join(process.cwd(), 'piecomponents')
    if (!fs.existsSync(pieComponentsDir)) {
        console.error(
            '[pieui] Error: piecomponents directory not found. Run "pieui init" first.'
        )
        process.exit(1)
    }

    const componentDir = path.join(pieComponentsDir, componentName)

    // Check if component already exists
    if (fs.existsSync(componentDir)) {
        console.error(
            `[pieui] Error: Component ${componentName} already exists`
        )
        console.error(`[pieui] Directory exists at: ${componentDir}`)
        process.exit(1)
    }

    // Create component directory structure
    fs.mkdirSync(path.join(componentDir, 'ui'), { recursive: true })
    fs.mkdirSync(path.join(componentDir, 'types'), { recursive: true })

    // Create index.ts
    const indexContent = `export { default } from './ui/${componentName}'
`
    fs.writeFileSync(path.join(componentDir, 'index.ts'), indexContent, 'utf8')

    // Create types/index.ts based on component type
    let baseInterface: string
    switch (componentType) {
        case 'simple':
            baseInterface = 'PieSimpleComponentProps'
            break
        case 'complex':
            baseInterface = 'PieComplexComponentProps'
            break
        case 'simple-container':
            baseInterface = 'PieContainerComponentProps'
            break
        case 'complex-container':
        default:
            baseInterface = 'PieComplexContainerComponentProps'
            break
    }

    const typesContent = `import { ${baseInterface} } from '@piedata/pieui'

export interface ${componentName}Data {
    name: string
    // Add your component-specific props here
}

export interface ${componentName}Props extends ${baseInterface}<${componentName}Data> {}
`
    fs.writeFileSync(
        path.join(componentDir, 'types', 'index.ts'),
        typesContent,
        'utf8'
    )

    // Create ui/ComponentName.tsx based on component type
    let componentContent: string

    if (componentType === 'simple') {
        componentContent = `import React from 'react'
import { PieCard } from '@piedata/pieui'
import { ${componentName}Props } from '../types'

const ${componentName}: React.FC<${componentName}Props> = ({ data }) => {
    const { name } = data

    return (
        <PieCard card='${componentName}' data={data}>
            <div>
                <h2>${componentName}</h2>
                {/* Add your component logic here */}
            </div>
        </PieCard>
    )
}

export default ${componentName}
`
    } else if (componentType === 'complex') {
        componentContent = `import React from 'react'
import { PieCard } from '@piedata/pieui'
import { ${componentName}Props } from '../types'

const ${componentName}: React.FC<${componentName}Props> = ({ data, children }) => {
    const { name } = data

    return (
        <PieCard card='${componentName}' data={data}>
            <div>
                <h2>${componentName}</h2>
                {/* Add your component logic here */}
                {children}
            </div>
        </PieCard>
    )
}

export default ${componentName}
`
    } else if (componentType === 'simple-container') {
        componentContent = `import React, { useContext } from 'react'
import { PieCard, UI, UIRendererContext } from '@piedata/pieui'
import { ${componentName}Props } from '../types'

const ${componentName}: React.FC<${componentName}Props> = ({
    data,
    content,
    setUiAjaxConfiguration,
}) => {
    const { name } = data
    const Renderer = useContext(UIRendererContext) ?? UI

    return (
        <PieCard card='${componentName}' data={data}>
            <div>
                <h2>${componentName}</h2>
                {/* Add your component logic here */}
                {content && (
                    <Renderer
                        uiConfig={content}
                        setUiAjaxConfiguration={setUiAjaxConfiguration}
                    />
                )}
            </div>
        </PieCard>
    )
}

export default ${componentName}
`
    } else {
        // complex-container
        componentContent = `import React, { useContext } from 'react'
import { PieCard, UI, UIRendererContext } from '@piedata/pieui'
import { ${componentName}Props } from '../types'

const ${componentName}: React.FC<${componentName}Props> = ({
    data,
    content,
    setUiAjaxConfiguration,
}) => {
    const { name } = data
    const Renderer = useContext(UIRendererContext) ?? UI

    return (
        <PieCard card='${componentName}' data={data}>
            <div>
                <h2>${componentName}</h2>
                {/* Add your component logic here */}
                {content && Array.isArray(content) && content.map((child, index) => (
                    <Renderer
                        key={\`child-\${index}\`}
                        uiConfig={child}
                        setUiAjaxConfiguration={setUiAjaxConfiguration}
                    />
                ))}
            </div>
        </PieCard>
    )
}

export default ${componentName}
`
    }

    fs.writeFileSync(
        path.join(componentDir, 'ui', `${componentName}.tsx`),
        componentContent,
        'utf8'
    )

    // Update registry.ts
    const registryPath = path.join(pieComponentsDir, 'registry.ts')
    let registryContent = fs.readFileSync(registryPath, 'utf8')

    // Check if component is already registered
    const componentRegex = new RegExp(
        `registerPieComponent\\s*\\(\\s*\\{[^}]*name:\\s*['"\`]${componentName}['"\`]`,
        's'
    )
    if (componentRegex.test(registryContent)) {
        console.error(
            `[pieui] Error: Component ${componentName} is already registered in registry.ts`
        )
        console.error('[pieui] Aborting to prevent duplicate registration')
        // Clean up created files
        fs.rmSync(componentDir, { recursive: true, force: true })
        process.exit(1)
    }

    // Check if import already exists
    const importRegex = new RegExp(`import\\s+${componentName}\\s+from`)
    if (importRegex.test(registryContent)) {
        console.error(
            `[pieui] Error: Import for ${componentName} already exists in registry.ts`
        )
        console.error('[pieui] Aborting to prevent duplicate import')
        // Clean up created files
        fs.rmSync(componentDir, { recursive: true, force: true })
        process.exit(1)
    }

    // Add import
    const importLine = `import ${componentName} from "./${componentName}/ui/${componentName}";`

    // Find the position to insert the import (after other component imports or after pieui import)
    const lastImportMatch = registryContent.match(
        /import .* from "\.\/.*\/ui\/.*";/g
    )
    if (lastImportMatch) {
        const lastImport = lastImportMatch[lastImportMatch.length - 1]
        const insertPos =
            registryContent.lastIndexOf(lastImport) + lastImport.length
        registryContent =
            registryContent.slice(0, insertPos) +
            '\n' +
            importLine +
            registryContent.slice(insertPos)
    } else {
        // Insert after the pieui import
        const pieuiImportMatch = registryContent.match(
            /import .* from ["']@piedata\/pieui["'];/
        )
        if (pieuiImportMatch) {
            const pieuiImportEnd =
                registryContent.indexOf(pieuiImportMatch[0]) +
                pieuiImportMatch[0].length
            registryContent =
                registryContent.slice(0, pieuiImportEnd) +
                '\n\n// Import your custom components here\n// Example:\n// import MyCustomCard from "./MyCustomCard/ui/MyCustomCard";\n' +
                importLine +
                registryContent.slice(pieuiImportEnd)
        }
    }

    // Add registration inside the initializePieUI function
    const registerLine = `    registerPieComponent({
        name: '${componentName}',
        component: ${componentName},
    });`

    // Find the initializePieUI function
    const functionMatch = registryContent.match(
        /export const initializePieUI = \(\) => \{([\s\S]*?)\n\}/m
    )
    if (functionMatch) {
        const functionContent = functionMatch[1]

        // Check if there are already registrations
        if (functionContent.includes('registerPieComponent({')) {
            // Add after the last registration
            const lastRegisterMatch = functionContent.match(
                /registerPieComponent\([^)]+\);/g
            )
            if (lastRegisterMatch) {
                const lastRegister =
                    lastRegisterMatch[lastRegisterMatch.length - 1]
                const lastRegisterPos =
                    registryContent.lastIndexOf(lastRegister) +
                    lastRegister.length
                registryContent =
                    registryContent.slice(0, lastRegisterPos) +
                    '\n\n' +
                    registerLine +
                    registryContent.slice(lastRegisterPos)
            }
        } else {
            // Find where to insert - after the opening brace of the function
            const functionStart = registryContent.indexOf(
                'export const initializePieUI = () => {'
            )
            const openBracePos = registryContent.indexOf('{', functionStart) + 1

            // Check if we should replace comment block
            const commentStart = registryContent.indexOf(
                '// Register your custom components here',
                openBracePos
            )
            if (
                commentStart !== -1 &&
                commentStart < registryContent.indexOf('}', openBracePos)
            ) {
                // Find the end of the comment block
                const lines = registryContent
                    .substring(commentStart)
                    .split('\n')
                let commentEnd = commentStart
                for (const line of lines) {
                    if (line.trim() && !line.trim().startsWith('//')) {
                        break
                    }
                    commentEnd += line.length + 1
                }

                // Replace the comment block
                registryContent =
                    registryContent.slice(0, commentStart) +
                    registerLine +
                    '\n' +
                    registryContent.slice(commentEnd)
            } else {
                // Just add after the opening brace
                registryContent =
                    registryContent.slice(0, openBracePos) +
                    '\n' +
                    registerLine +
                    registryContent.slice(openBracePos)
            }
        }
    }

    fs.writeFileSync(registryPath, registryContent, 'utf8')

    console.log(
        `[pieui] Component ${componentName} (${componentType}) created successfully!`
    )
    console.log(`[pieui] Files created:`)
    console.log(`  - piecomponents/${componentName}/index.ts`)
    console.log(`  - piecomponents/${componentName}/types/index.ts`)
    console.log(`  - piecomponents/${componentName}/ui/${componentName}.tsx`)
    console.log(`[pieui] Updated registry.ts with new component`)
    console.log('')
    console.log(`[pieui] Component type: ${componentType}`)
    switch (componentType) {
        case 'simple':
            console.log('  - Props: data only')
            break
        case 'complex':
            console.log('  - Props: data + children (React nodes)')
            break
        case 'simple-container':
            console.log('  - Props: data + content (single UIConfig)')
            break
        case 'complex-container':
            console.log('  - Props: data + content (array of UIConfig)')
            break
    }
}

const removeCommand = (componentName: string) => {
    if (!componentName) {
        console.error('[pieui] Error: Component name is required')
        console.log('Usage: pieui remove <ComponentName>')
        process.exit(1)
    }

    const pieComponentsDir = path.join(process.cwd(), 'piecomponents')
    if (!fs.existsSync(pieComponentsDir)) {
        console.error(
            '[pieui] Error: piecomponents directory not found. Nothing to remove.'
        )
        process.exit(1)
    }

    const componentDir = path.join(pieComponentsDir, componentName)

    // Remove component directory
    if (fs.existsSync(componentDir)) {
        fs.rmSync(componentDir, { recursive: true, force: true })
        console.log(`[pieui] Removed directory: piecomponents/${componentName}`)
    } else {
        console.log(
            `[pieui] Warning: Component directory piecomponents/${componentName} not found`
        )
    }

    // Clean up registry.ts
    const registryPath = path.join(pieComponentsDir, 'registry.ts')
    if (fs.existsSync(registryPath)) {
        let registryContent = fs.readFileSync(registryPath, 'utf8')
        const originalContent = registryContent

        // Remove import line
        const importRegex = new RegExp(
            `^import\\s+${componentName}\\s+from\\s+[\"'].*[\"'];?\\s*\\n`,
            'gm'
        )
        registryContent = registryContent.replace(importRegex, '')

        // Remove registerPieComponent block
        const registerRegex = new RegExp(
            `\\s*registerPieComponent\\(\\s*\\{[^}]*name:\\s*['"\`]${componentName}['"\`][^)]*\\)\\s*;?`,
            'gs'
        )
        registryContent = registryContent.replace(registerRegex, '')

        // Clean up double blank lines
        registryContent = registryContent.replace(/\n{3,}/g, '\n\n')

        if (registryContent !== originalContent) {
            fs.writeFileSync(registryPath, registryContent, 'utf8')
            console.log(`[pieui] Cleaned up registry.ts`)
        } else {
            console.log(
                `[pieui] Warning: ${componentName} not found in registry.ts`
            )
        }
    }

    console.log(`[pieui] Component ${componentName} removed successfully!`)
}

const detectComponentType = (
    propsType: any,
    checker: any
): ComponentType => {
    const contentProperty = propsType.getProperty('content')
    const childrenProperty = propsType.getProperty('children')

    if (contentProperty) {
        const contentType = checker.getTypeOfSymbolAtLocation(
            contentProperty,
            contentProperty.valueDeclaration || contentProperty.declarations?.[0]
        )
        const typeStr = checker.typeToString(contentType)

        // Array<UIConfigType> or UIConfigType[]
        if (
            typeStr.includes('[]') ||
            typeStr.includes('Array') ||
            contentType.symbol?.getName() === 'Array'
        ) {
            return 'complex-container'
        }

        // Check if it's actually an array type
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

const listCommand = (srcDir: string, filter: ListFilter) => {
    console.log(`[pieui] Scanning components in: ${srcDir}`)

    const files = glob.sync(`${srcDir}/**/*.{ts,tsx}`, {
        ignore: [
            '**/*.d.ts',
            '**/dist/**',
            '**/node_modules/**',
            '**/cli.ts',
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
    const checker = program.getTypeChecker()

    type ComponentListEntry = {
        name: string
        type: ComponentType
        file: string
        dataType: string
        lazy: boolean
    }

    const components: ComponentListEntry[] = []

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
                        let hasLoader = false

                        for (const prop of arg.properties) {
                            if (ts.isPropertyAssignment(prop)) {
                                const propName =
                                    ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)
                                        ? prop.name.text
                                        : null

                                if (
                                    propName === 'name' &&
                                    ts.isStringLiteral(prop.initializer)
                                ) {
                                    componentName = prop.initializer.text
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

                        if (componentName) {
                            let compType: ComponentType = 'simple'
                            let dataTypeName = '-'
                            let componentFile = sourceFile.fileName

                            if (componentRef) {
                                // Resolve the actual file where the component is defined
                                const componentSymbol = checker.getSymbolAtLocation(componentRef)
                                if (componentSymbol) {
                                    let resolved = componentSymbol
                                    // Follow aliases (imports) to the original declaration
                                    if (resolved.flags & ts.SymbolFlags.Alias) {
                                        resolved = checker.getAliasedSymbol(resolved)
                                    }
                                    const declarations = resolved.getDeclarations()
                                    if (declarations && declarations.length > 0) {
                                        componentFile = declarations[0].getSourceFile().fileName
                                    }
                                }

                                const componentType =
                                    checker.getTypeAtLocation(componentRef)
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
                                        compType = detectComponentType(
                                            propsType,
                                            checker
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
                                            if (dataSymbol) {
                                                dataTypeName =
                                                    dataSymbol.getName()
                                            } else {
                                                dataTypeName =
                                                    checker.typeToString(
                                                        dataType
                                                    )
                                            }
                                        }
                                    }
                                }
                            }

                            components.push({
                                name: componentName,
                                type: compType,
                                file: path.relative(
                                    process.cwd(),
                                    componentFile
                                ),
                                dataType: dataTypeName,
                                lazy: hasLoader && !componentRef,
                            })
                        }
                    }
                }
            }

            ts.forEachChild(node, visit)
        }

        visit(sourceFile)
    }

    // Filter
    const filtered =
        filter === 'all'
            ? components
            : components.filter((c) => c.type === filter)

    if (filtered.length === 0) {
        console.log(
            filter === 'all'
                ? '[pieui] No components found.'
                : `[pieui] No ${filter} components found.`
        )
        return
    }

    // Sort by name
    filtered.sort((a, b) => a.name.localeCompare(b.name))

    // Build table
    const headers = ['Name', 'Type', 'Data Type', 'Lazy', 'File']
    const rows = filtered.map((c) => [
        c.name,
        c.type,
        c.dataType,
        c.lazy ? 'yes' : 'no',
        c.file,
    ])

    // Calculate column widths
    const colWidths = headers.map((h, i) =>
        Math.max(h.length, ...rows.map((r) => r[i].length))
    )

    const separator = colWidths.map((w) => '─'.repeat(w + 2)).join('┼')
    const formatRow = (cells: string[]) =>
        cells.map((c, i) => ` ${c.padEnd(colWidths[i])} `).join('│')

    console.log('')
    console.log(formatRow(headers))
    console.log(separator)
    for (const row of rows) {
        console.log(formatRow(row))
    }
    console.log('')
    console.log(
        `[pieui] Total: ${filtered.length} component${filtered.length === 1 ? '' : 's'}` +
            (filter !== 'all' ? ` (filtered by: ${filter})` : '')
    )
}

const main = async () => {
    const {
        command,
        outDir,
        srcDir,
        append,
        componentName,
        componentType,
        removeComponentName,
        listFilter,
    } = parseArgs(process.argv.slice(2))

    console.log(`[pieui] CLI started with command: "${command}"`)

    switch (command) {
        case 'init':
            initCommand(outDir)
            return

        case 'add':
            if (!componentName) {
                console.error(
                    '[pieui] Error: Component name is required for add command'
                )
                printUsage()
                process.exit(1)
            }
            addCommand(componentName, componentType)
            return

        case 'remove':
            if (!removeComponentName) {
                console.error(
                    '[pieui] Error: Component name is required for remove command'
                )
                printUsage()
                process.exit(1)
            }
            removeCommand(removeComponentName)
            return

        case 'list':
            listCommand(srcDir, listFilter || 'all')
            return

        case 'postbuild':
            console.log(`[pieui] Source directory: ${srcDir}`)
            console.log(`[pieui] Output directory: ${outDir}`)
            console.log(`[pieui] Append mode: ${append}`)
            break

        default:
            printUsage()
            process.exit(1)
    }

    try {
        const components = findComponentRegistrations(srcDir)

        if (components.length === 0) {
            console.log('[pieui] Warning: No components with data types found!')
        }

        // Get all unique files that contain components
        const cliSchemaPath = path.join(__dirname, 'cli-schema.d.ts')
        const uniqueFiles = [
            cliSchemaPath,
            ...new Set(components.map((c) => c.file)),
        ]

        console.log(
            '[pieui] Creating TypeScript program for schema generation...'
        )

        // Create program with all files
        const program = TJS.getProgramFromFiles(uniqueFiles, {
            allowJs: true,
            jsx: ts.JsxEmit.ReactJSX,
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.NodeNext,
            moduleResolution: ts.ModuleResolutionKind.NodeNext,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            skipLibCheck: true,
        })

        const checker = program.getTypeChecker()

        const findTypeSymbol = (component: ComponentInfo): any => {
            const sourceFile = program.getSourceFile(component.file)
            if (sourceFile) {
                let found: any

                const visit = (node: any) => {
                    if (
                        ts.isInterfaceDeclaration(node) ||
                        ts.isTypeAliasDeclaration(node)
                    ) {
                        if (node.name.text === component.dataTypeName) {
                            found = checker.getSymbolAtLocation(node.name)
                            return
                        }
                    }
                    ts.forEachChild(node, visit)
                }

                visit(sourceFile)

                if (found) {
                    return found
                }

                const symbols = checker.getSymbolsInScope(
                    sourceFile,
                    ts.SymbolFlags.Type
                )
                const match = symbols.find(
                    (symbol) => symbol.getName() === component.dataTypeName
                )
                if (match) {
                    return match
                }
            }

            return checker.resolveName(
                component.dataTypeName,
                undefined,
                ts.SymbolFlags.Type,
                false
            ) as any
        }

        // Create schema generator
        const generator = TJS.buildGenerator(program, {
            required: true,
            strictNullChecks: true,
            excludePrivate: true,
            ref: false,
            aliasRef: false,
            topRef: false,
            noExtraProps: true,
            ignoreErrors: true,
        })

        if (!generator) {
            throw new Error('Failed to create JSON Schema generator')
        }

        const entries: ComponentManifestEntry[] = []

        // Generate schema for each component
        for (const component of components) {
            console.log(
                `[pieui] Generating schema for ${component.name} (type: ${component.dataTypeName})...`
            )

            try {
                const schema = generator.getSchemaForSymbol(
                    component.dataTypeName
                )

                if (schema) {
                    const typeSymbol = findTypeSymbol(component)
                    if (typeSymbol) {
                        const declaredType =
                            checker.getDeclaredTypeOfSymbol(typeSymbol)
                        patchSchemaForType(declaredType, schema, checker)
                    }
                    entries.push({
                        card: component.name,
                        data: schema,
                    })
                    console.log(`[pieui]   ✓ Schema generated successfully`)
                } else {
                    console.log(`[pieui]   ✗ Could not generate schema`)
                    entries.push({
                        card: component.name,
                        data: {
                            type: 'object',
                            additionalProperties: true,
                        },
                    })
                }
            } catch (error) {
                console.error(
                    `[pieui]   ✗ Error: ${error instanceof Error ? error.message : error}`
                )
                entries.push({
                    card: component.name,
                    data: {
                        type: 'object',
                        additionalProperties: true,
                    },
                })
            }
        }

        // Try to load existing manifest from pieui library if append mode is enabled
        let existingEntries: ComponentManifestEntry[] = []

        if (append) {
            console.log(
                '[pieui] Append mode enabled - loading existing pieui components'
            )

            // First, try to find pieui's manifest in node_modules
            const nodeModulesPath = path.join(
                process.cwd(),
                'node_modules',
                '@piedata',
                'pieui',
                'dist',
                MANIFEST_FILENAME
            )

            if (fs.existsSync(nodeModulesPath)) {
                try {
                    const existingManifest = fs.readFileSync(
                        nodeModulesPath,
                        'utf8'
                    )
                    existingEntries = JSON.parse(existingManifest)
                    console.log(
                        `[pieui] Loaded ${existingEntries.length} existing components from pieui library at ${nodeModulesPath}`
                    )
                } catch (error) {
                    console.error(
                        `[pieui] Error reading manifest from ${nodeModulesPath}:`,
                        error
                    )
                }
            } else {
                console.log(
                    `[pieui] No existing pieui manifest found at ${nodeModulesPath}`
                )
            }
        } else {
            console.log(
                '[pieui] Append mode disabled - only including components from current project'
            )
        }

        // Merge existing and new entries
        const componentMap = new Map<string, ComponentManifestEntry>()

        // Add existing entries first
        for (const entry of existingEntries) {
            componentMap.set(entry.card, entry)
        }

        // Add/update with new entries
        for (const entry of entries) {
            componentMap.set(entry.card, entry)
        }

        // Convert back to array
        const mergedEntries = Array.from(componentMap.values())

        // Write manifest
        const resolvedOutDir = path.resolve(process.cwd(), outDir)
        fs.mkdirSync(resolvedOutDir, { recursive: true })
        const manifestPath = path.join(resolvedOutDir, MANIFEST_FILENAME)
        fs.writeFileSync(
            manifestPath,
            JSON.stringify(mergedEntries, null, 2),
            'utf8'
        )

        console.log(`[pieui] Component manifest saved to ${manifestPath}`)
        console.log(
            `[pieui] Total components: ${mergedEntries.length} (${existingEntries.length} from pieui, ${entries.length} new/updated)`
        )
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(
            `[pieui] Failed to generate component manifest: ${message}`
        )
        if (error instanceof Error && error.stack) {
            console.error('[pieui] Stack trace:', error.stack)
        }
        process.exit(1)
    }
}

void main()
