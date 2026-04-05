import fs from 'fs'
import path from 'path'
import { ComponentType } from '../types'
import { resolveRegistryPath } from '../registryPath'
import {
    baseInterfaceFor,
    componentIndexTemplate,
    componentTemplateFor,
    componentTypesTemplate,
    registerCallTemplate,
} from '../templates'

const updateRegistryFile = (
    registryPath: string,
    componentName: string,
    componentDir: string
) => {
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
        fs.rmSync(componentDir, { recursive: true, force: true })
        process.exit(1)
    }

    // Add import
    const importLine = `import ${componentName} from "./${componentName}/ui/${componentName}";`

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
    const registerLine = registerCallTemplate(componentName)

    const functionMatch = registryContent.match(
        /export const initializePieUI = \(\) => \{([\s\S]*?)\n\}/m
    )
    if (functionMatch) {
        const functionContent = functionMatch[1]

        if (functionContent.includes('registerPieComponent({')) {
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
            const functionStart = registryContent.indexOf(
                'export const initializePieUI = () => {'
            )
            const openBracePos = registryContent.indexOf('{', functionStart) + 1

            const commentStart = registryContent.indexOf(
                '// Register your custom components here',
                openBracePos
            )
            if (
                commentStart !== -1 &&
                commentStart < registryContent.indexOf('}', openBracePos)
            ) {
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

                registryContent =
                    registryContent.slice(0, commentStart) +
                    registerLine +
                    '\n' +
                    registryContent.slice(commentEnd)
            } else {
                registryContent =
                    registryContent.slice(0, openBracePos) +
                    '\n' +
                    registerLine +
                    registryContent.slice(openBracePos)
            }
        }
    }

    fs.writeFileSync(registryPath, registryContent, 'utf8')
}

export const addCommand = (
    componentName: string,
    componentType: ComponentType = 'complex-container'
) => {
    if (!componentName) {
        console.error('[pieui] Error: Component name is required')
        console.log('Usage: pieui add [type] <ComponentName>')
        process.exit(1)
    }

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

    if (fs.existsSync(componentDir)) {
        console.error(
            `[pieui] Error: Component ${componentName} already exists`
        )
        console.error(`[pieui] Directory exists at: ${componentDir}`)
        process.exit(1)
    }

    fs.mkdirSync(path.join(componentDir, 'ui'), { recursive: true })
    fs.mkdirSync(path.join(componentDir, 'types'), { recursive: true })

    // Create index.ts
    fs.writeFileSync(
        path.join(componentDir, 'index.ts'),
        componentIndexTemplate(componentName),
        'utf8'
    )

    // Create types/index.ts based on component type
    fs.writeFileSync(
        path.join(componentDir, 'types', 'index.ts'),
        componentTypesTemplate(componentName, baseInterfaceFor(componentType)),
        'utf8'
    )

    fs.writeFileSync(
        path.join(componentDir, 'ui', `${componentName}.tsx`),
        componentTemplateFor(componentType, componentName),
        'utf8'
    )

    // Update registry.ts (fall back to registry.tsx if .ts is missing)
    const registryPath = resolveRegistryPath(pieComponentsDir)
    updateRegistryFile(registryPath, componentName, componentDir)

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