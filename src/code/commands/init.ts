import fs from 'fs'
import path from 'path'
import { nextConfigTemplate, REQUIRED_NEXT_CONFIG_ENV_KEYS } from '../templates'

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
    const registryContent = `"use client";

// Side-effect imports — each index.ts calls registerPieComponent at module level
// Example:
// import "@/piecomponents/MyCustomCard";
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
        './node_modules/@swarm.ing/pieui/dist/**/*.{js,mjs,ts,jsx,tsx}'

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

    ensureNextConfig(resolvedOutDir)

    console.log('[pieui] Initialization complete!')
    console.log('[pieui] Next steps:')
    console.log(
        '  1. Import "./piecomponents/registry" in your app entry point'
    )
    console.log(
        '  2. Use "pieui card add <ComponentName>" to create new components'
    )
}

const ensureNextConfig = (resolvedOutDir: string) => {
    const candidates = [
        'next.config.ts',
        'next.config.mjs',
        'next.config.js',
        'next.config.cjs',
    ]

    const existing = candidates
        .map((name) => path.join(resolvedOutDir, name))
        .find((filePath) => fs.existsSync(filePath))

    if (!existing) {
        const targetPath = path.join(resolvedOutDir, 'next.config.ts')
        try {
            fs.writeFileSync(targetPath, nextConfigTemplate(), 'utf8')
            console.log('[pieui] Created next.config.ts with PieUI env vars')
        } catch (error) {
            console.error('[pieui] Failed to create next.config.ts:', error)
        }
        return
    }

    console.log(
        `[pieui] Existing Next.js config detected: ${path.basename(existing)}`
    )

    try {
        const originalContent = fs.readFileSync(existing, 'utf8')
        let updatedContent = originalContent

        updatedContent = ensureEnvKeys(updatedContent)
        updatedContent = ensureTranspilePieui(updatedContent)

        if (updatedContent !== originalContent) {
            fs.writeFileSync(existing, updatedContent, 'utf8')
            console.log(
                `[pieui] Updated ${path.basename(existing)} with missing PieUI settings`
            )
        } else {
            console.log('[pieui] Next.js config already has all PieUI settings')
        }
    } catch (error) {
        console.error('[pieui] Error updating Next.js config:', error)
    }
}

const CONFIG_OBJECT_OPEN =
    /(const\s+nextConfig\s*(?::\s*[A-Za-z_][\w.]*)?\s*=\s*|module\.exports\s*=\s*|export\s+default\s*)\{/

const envEntryFor = (key: string): string => {
    if (key === 'PIE_PLATFORM') {
        return `    ${key}: process.env.${key} || "telegram",`
    }
    return `    ${key}: process.env.${key},`
}

const ensureEnvKeys = (content: string): string => {
    const missingKeys = REQUIRED_NEXT_CONFIG_ENV_KEYS.filter(
        (key) => !content.includes(key)
    )
    if (missingKeys.length === 0) return content

    const envBlockMatch = content.match(/env\s*:\s*\{([\s\S]*?)}/)
    if (envBlockMatch) {
        const inner = envBlockMatch[1]
        const trimmed = inner.replace(/\s+$/, '')
        const needsComma =
            trimmed.trim().length > 0 && !trimmed.trimEnd().endsWith(',')
        const addition = missingKeys.map(envEntryFor).join('\n')
        const newInner = `${trimmed}${needsComma ? ',' : ''}\n${addition}\n  `
        console.log(
            `[pieui] Adding missing env vars: ${missingKeys.join(', ')}`
        )
        return content.replace(envBlockMatch[0], `env: {${newInner}}`)
    }

    const envBlock = `  env: {\n${missingKeys.map(envEntryFor).join('\n')}\n  },`
    const inserted = insertIntoConfigObject(content, envBlock)
    if (inserted) {
        console.log(`[pieui] Adding env block with: ${missingKeys.join(', ')}`)
        return inserted
    }
    console.log(
        '[pieui] Warning: could not locate nextConfig object to add env block automatically'
    )
    return content
}

const ensureTranspilePieui = (content: string): string => {
    const match = content.match(/transpilePackages\s*:\s*\[([\s\S]*?)]/)
    if (match) {
        if (match[1].includes('@swarm.ing/pieui')) return content
        const inner = match[1].trim()
        const separator = inner.length > 0 ? ', ' : ''
        console.log('[pieui] Adding "@swarm.ing/pieui" to transpilePackages')
        return content.replace(
            match[0],
            `transpilePackages: [${inner}${separator}"@swarm.ing/pieui"]`
        )
    }

    const inserted = insertIntoConfigObject(
        content,
        '  transpilePackages: ["@swarm.ing/pieui"],'
    )
    if (inserted) {
        console.log('[pieui] Adding transpilePackages: ["@swarm.ing/pieui"]')
        return inserted
    }
    console.log(
        '[pieui] Warning: could not locate nextConfig object to add transpilePackages automatically'
    )
    return content
}

const insertIntoConfigObject = (
    content: string,
    snippet: string
): string | null => {
    const match = content.match(CONFIG_OBJECT_OPEN)
    if (!match || match.index === undefined) return null
    const insertAt = match.index + match[0].length
    return `${content.slice(0, insertAt)}\n${snippet}${content.slice(insertAt)}`
}
