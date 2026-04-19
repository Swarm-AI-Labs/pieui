import fs from 'fs'
import path from 'path'
import { CardScaffoldOptions, ComponentType } from '../types'
import { resolveRegistryPath } from '../registryPath'
import {
    baseInterfaceFor,
    componentIndexTemplate,
    componentTemplateFor,
    componentTypesTemplate,
} from '../templates'

const updateRegistryFile = (
    registryPath: string,
    componentName: string,
    componentDir: string
) => {
    if (!fs.existsSync(registryPath)) {
        console.error(
            '[pieui] Error: registry.ts not found. Run "pieui init" first.'
        )
        fs.rmSync(componentDir, { recursive: true, force: true })
        process.exit(1)
    }

    let registryContent = fs.readFileSync(registryPath, 'utf8')

    // Check if component is already imported
    const importRegex = new RegExp(`["']@/piecomponents/${componentName}["']`)
    if (importRegex.test(registryContent)) {
        console.error(
            `[pieui] Error: Component ${componentName} is already registered in registry.ts`
        )
        console.error('[pieui] Aborting to prevent duplicate registration')
        fs.rmSync(componentDir, { recursive: true, force: true })
        process.exit(1)
    }

    // Add side-effect import at the end of the file
    const importLine = `import "@/piecomponents/${componentName}";`
    registryContent = registryContent.trimEnd() + '\n' + importLine + '\n'

    fs.writeFileSync(registryPath, registryContent, 'utf8')
}

export const addCommand = (
    componentName: string,
    componentType: ComponentType = 'complex-container',
    options: CardScaffoldOptions = {}
) => {
    if (!componentName) {
        console.error('[pieui] Error: Component name is required')
        console.log('Usage: pieui card add [type] <ComponentName>')
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

    try {
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
            componentTypesTemplate(
                componentName,
                baseInterfaceFor(componentType),
                options
            ),
            'utf8'
        )

        fs.writeFileSync(
            path.join(componentDir, 'ui', `${componentName}.tsx`),
            componentTemplateFor(componentType, componentName, options),
            'utf8'
        )

        // Update registry.ts (fall back to registry.tsx if .ts is missing)
        const registryPath = resolveRegistryPath(pieComponentsDir)
        updateRegistryFile(registryPath, componentName, componentDir)
    } catch (error) {
        fs.rmSync(componentDir, { recursive: true, force: true })
        throw error
    }

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
    console.log(`[pieui] IO fields: ${options.io ? 'enabled' : 'disabled'}`)
    console.log(`[pieui] AJAX fields: ${options.ajax ? 'enabled' : 'disabled'}`)
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
