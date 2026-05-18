import fs from 'fs'
import os from 'os'
import path from 'path'
import * as readline from 'readline/promises'
import { nextConfigTemplate, REQUIRED_NEXT_CONFIG_ENV_KEYS } from '../templates'
import { initRequirements, printRequirements } from '../printRequirements'
import {
    findStorybookMainPath,
    patchStorybookMainAddons,
    patchStorybookMainStories,
    PIEUI_STORYBOOK_ADDON,
    PIEUI_STORYBOOK_STORIES_GLOB,
} from '../storybookIntegration'

export const initCommand = async (outDir: string) => {
    const resolvedOutDir = path.resolve(process.cwd(), outDir)

    console.log(
        `[pieui] Initializing piecomponents directory in ${resolvedOutDir}...`
    )

    const pieComponentsDir = path.join(resolvedOutDir, 'piecomponents')

    // Create piecomponents directory
    if (!fs.existsSync(pieComponentsDir)) {
        fs.mkdirSync(pieComponentsDir, { recursive: true })
        console.log(
            `[pieui] Created piecomponents directory: ${pieComponentsDir}`
        )
    } else {
        console.log(
            `[pieui] piecomponents directory already exists: ${pieComponentsDir}`
        )
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
        console.log(`[pieui] Created registry.ts: ${registryPath}`)
    } else {
        console.log(`[pieui] registry.ts already exists: ${registryPath}`)
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

    await ensureBackendPaths(resolvedOutDir)

    const sbMain = findStorybookMainPath(resolvedOutDir)
    if (sbMain) {
        const patchedAddons = patchStorybookMainAddons(sbMain)
        if (patchedAddons) {
            console.log(`[pieui] Added '${PIEUI_STORYBOOK_ADDON}' to ${sbMain}`)
        } else {
            console.log(`[pieui] Storybook addon already wired in ${sbMain}`)
        }
        const patchedStories = patchStorybookMainStories(sbMain)
        if (patchedStories) {
            console.log(
                `[pieui] Added '${PIEUI_STORYBOOK_STORIES_GLOB}' to stories in ${sbMain}`
            )
        }
    }

    console.log('[pieui] Initialization complete!')
    console.log('[pieui] Next steps:')
    console.log(
        '  1. Import "./piecomponents/registry" in your app entry point'
    )
    console.log(
        '  2. Use "pieui card add <ComponentName>" to create new components'
    )

    printRequirements(initRequirements())
}

type PieProjectConfig = {
    backendPagesDir?: string
    backendComponentsDir?: string
    [key: string]: unknown
}

type BackendCandidate = {
    project: string
    pages: string
    components: string
}

const PIE_CONFIG_DIR = '.pie'
const PIE_CONFIG_FILE = 'config.json'
const MAX_HOMEDIR_SCAN_DEPTH = 2

const ensureBackendPaths = async (resolvedOutDir: string): Promise<void> => {
    const existing = readPieConfig(resolvedOutDir)
    if (existing.backendPagesDir && existing.backendComponentsDir) {
        console.log(
            `[pieui] Backend dirs already configured in .pie/${PIE_CONFIG_FILE}:`
        )
        console.log(`[pieui]   pages:      ${existing.backendPagesDir}`)
        console.log(`[pieui]   components: ${existing.backendComponentsDir}`)
        return
    }

    if (!process.stdin.isTTY) {
        console.log(
            '[pieui] Non-interactive shell — skipping backend pages/components prompt.'
        )
        console.log(
            `[pieui] To configure, add "backendPagesDir" and "backendComponentsDir" to ${path.join(resolvedOutDir, PIE_CONFIG_DIR, PIE_CONFIG_FILE)}`
        )
        return
    }

    const home = os.homedir()
    console.log(
        `[pieui] Searching ${home} for backend projects with pages/ and components/ directories...`
    )
    const candidates = findBackendCandidates(home, MAX_HOMEDIR_SCAN_DEPTH)

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })

    try {
        let pagesDir = existing.backendPagesDir
        let componentsDir = existing.backendComponentsDir

        if (!pagesDir || !componentsDir) {
            const picked = await pickBackendPair(rl, candidates, home)
            if (picked) {
                pagesDir = pagesDir || picked.pages
                componentsDir = componentsDir || picked.components
            }
        }

        if (!pagesDir) {
            pagesDir = await promptAbsoluteDir(
                rl,
                'Path to backend pages directory',
                home
            )
        }
        if (!componentsDir) {
            componentsDir = await promptAbsoluteDir(
                rl,
                'Path to backend components directory',
                home
            )
        }

        if (!pagesDir || !componentsDir) {
            console.log(
                '[pieui] Skipped backend paths — neither directory was provided.'
            )
            return
        }

        writePieConfig(resolvedOutDir, {
            ...existing,
            backendPagesDir: pagesDir,
            backendComponentsDir: componentsDir,
        })

        const configPath = path.join(
            resolvedOutDir,
            PIE_CONFIG_DIR,
            PIE_CONFIG_FILE
        )
        console.log(`[pieui] Saved backend paths to ${configPath}`)
        console.log(`[pieui]   pages:      ${pagesDir}`)
        console.log(`[pieui]   components: ${componentsDir}`)
    } finally {
        rl.close()
    }
}

const findBackendCandidates = (
    home: string,
    maxDepth: number
): BackendCandidate[] => {
    const found: BackendCandidate[] = []
    const visit = (dir: string, depth: number): void => {
        if (depth > maxDepth) return
        let entries: fs.Dirent[]
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true })
        } catch {
            return
        }

        const subdirs = entries.filter(
            (e) => e.isDirectory() && !e.name.startsWith('.')
        )
        const subdirNames = new Set(subdirs.map((e) => e.name))

        if (subdirNames.has('pages') && subdirNames.has('components')) {
            found.push({
                project: dir,
                pages: path.join(dir, 'pages'),
                components: path.join(dir, 'components'),
            })
        }

        for (const sub of subdirs) {
            if (sub.name === 'node_modules' || sub.name === '.git') continue
            visit(path.join(dir, sub.name), depth + 1)
        }
    }
    visit(home, 0)
    return found
}

const pickBackendPair = async (
    rl: readline.Interface,
    candidates: BackendCandidate[],
    home: string
): Promise<BackendCandidate | null> => {
    if (candidates.length === 0) {
        console.log(
            '[pieui] No matching backend projects found under home directory.'
        )
        return null
    }
    console.log('[pieui] Found backend candidates:')
    candidates.forEach((c, i) => {
        const rel = path.relative(home, c.project) || '.'
        console.log(`  ${i + 1}. ~/${rel}`)
    })
    const answer = (
        await rl.question(
            `[pieui] Pick a candidate [1-${candidates.length}] or press Enter to type paths manually: `
        )
    ).trim()
    if (!answer) return null
    const idx = Number.parseInt(answer, 10)
    if (Number.isNaN(idx) || idx < 1 || idx > candidates.length) {
        console.log('[pieui] Invalid selection — falling back to manual input.')
        return null
    }
    return candidates[idx - 1]
}

const promptAbsoluteDir = async (
    rl: readline.Interface,
    label: string,
    home: string
): Promise<string | undefined> => {
    while (true) {
        const raw = (
            await rl.question(`[pieui] ${label} (absolute or ~/...): `)
        ).trim()
        if (!raw) return undefined
        const expanded = raw.startsWith('~')
            ? path.join(home, raw.slice(1).replace(/^[\\/]/, ''))
            : raw
        const absolute = path.resolve(expanded)
        if (!absolute.startsWith(home + path.sep) && absolute !== home) {
            console.log(
                `[pieui] Warning: ${absolute} is outside ${home}. Continuing anyway.`
            )
        }
        if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
            console.log(`[pieui] Not a directory: ${absolute}. Try again.`)
            continue
        }
        return absolute
    }
}

const readPieConfig = (resolvedOutDir: string): PieProjectConfig => {
    const configPath = path.join(
        resolvedOutDir,
        PIE_CONFIG_DIR,
        PIE_CONFIG_FILE
    )
    if (!fs.existsSync(configPath)) return {}
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(configPath, 'utf8'))
        if (
            typeof parsed !== 'object' ||
            parsed === null ||
            Array.isArray(parsed)
        )
            return {}
        return parsed as PieProjectConfig
    } catch {
        return {}
    }
}

const writePieConfig = (
    resolvedOutDir: string,
    config: PieProjectConfig
): void => {
    const pieDir = path.join(resolvedOutDir, PIE_CONFIG_DIR)
    if (!fs.existsSync(pieDir)) {
        fs.mkdirSync(pieDir, { recursive: true })
    }
    const configPath = path.join(pieDir, PIE_CONFIG_FILE)
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
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

const envEntryFor = (key: string): string => `    ${key}: process.env.${key},`

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
