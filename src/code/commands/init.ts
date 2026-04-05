import fs from 'fs'
import path from 'path'

export const initCommand = (outDir: string) => {
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

            if (!configContent.includes(pieuiContentPath)) {
                const contentMatch = configContent.match(
                    /content\s*:\s*\[([^\]]*)\]/s
                )

                if (contentMatch) {
                    const contentArray = contentMatch[1]
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
