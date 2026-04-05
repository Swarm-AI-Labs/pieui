import fs from 'fs'
import path from 'path'
import { resolveRegistryPath } from '../registryPath'

export const removeCommand = (componentName: string) => {
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

    // Clean up registry.ts (fall back to registry.tsx if .ts is missing)
    const registryPath = resolveRegistryPath(pieComponentsDir)
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