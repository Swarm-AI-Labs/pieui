import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const DEFAULT_TEMPLATE_SPEC = 'next-app@latest'
const SHARED_TEMPLATE_DIR_ENV = 'PIEUI_SHARED_TEMPLATE_DIR'
const AI_EXCHANGE_BOT_DIR_ENV = 'PIEUI_AI_EXCHANGE_BOT_DIR'
const BACKEND_LINK_COMMENT =
    '// TODO(pie-backend): Link generated Python Unicorn backend routes here once backend template sync is enabled.'

const updateNextScriptsToBun = (packageJsonPath: string) => {
    if (!fs.existsSync(packageJsonPath)) return

    try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
            scripts?: Record<string, string>
        }

        if (!pkg.scripts) return

        const updates: Record<string, string> = {
            dev: 'bun --bun next dev',
            build: 'bun --bun next build',
            start: 'bun --bun next start',
        }

        for (const [scriptName, scriptValue] of Object.entries(updates)) {
            if (pkg.scripts[scriptName]) {
                pkg.scripts[scriptName] = scriptValue
            }
        }

        fs.writeFileSync(
            packageJsonPath,
            `${JSON.stringify(pkg, null, 2)}\n`,
            'utf8'
        )
    } catch {
        // Keep generated project as-is if package.json rewrite fails.
    }
}

const appendBackendLinkComment = (pagePath: string) => {
    if (!fs.existsSync(pagePath)) return

    const page = fs.readFileSync(pagePath, 'utf8')
    if (page.includes(BACKEND_LINK_COMMENT)) return
    fs.writeFileSync(
        pagePath,
        `${page.trimEnd()}\n\n${BACKEND_LINK_COMMENT}\n`,
        'utf8'
    )
}

const uniq = (items: string[]) => [...new Set(items)]

const isDirectory = (target: string) => {
    try {
        return fs.statSync(target).isDirectory()
    } catch {
        return false
    }
}

const resolveSharedTemplateDir = (): string => {
    const explicitSharedDir = process.env[SHARED_TEMPLATE_DIR_ENV]
    if (explicitSharedDir) {
        const normalized = path.resolve(explicitSharedDir)
        if (!isDirectory(normalized)) {
            throw new Error(
                `${SHARED_TEMPLATE_DIR_ENV} points to a missing directory: ${normalized}`
            )
        }
        return normalized
    }

    const cwd = process.cwd()
    const baseDirs = [cwd, path.resolve(cwd, '..'), path.resolve(cwd, '../..')]
    const explicitRepoDir = process.env[AI_EXCHANGE_BOT_DIR_ENV]
    if (explicitRepoDir) {
        baseDirs.unshift(path.resolve(explicitRepoDir))
    }

    const repoNames = ['ai-exchange-bot', 'ai-exchange-web', 'a-exchange-web']
    const repoCandidates = uniq([
        ...baseDirs,
        ...baseDirs.flatMap((base) =>
            repoNames.map((name) => path.join(base, name))
        ),
    ]).filter((candidate) => isDirectory(candidate))

    const sharedSubpaths = [
        '_shared',
        'src/_shared',
        'app/_shared',
        'pages/_shared',
        'pages/components/_shared',
        'apps/web/_shared',
        'apps/web/src/_shared',
    ]

    for (const repoDir of repoCandidates) {
        for (const subpath of sharedSubpaths) {
            const candidate = path.join(repoDir, subpath)
            if (isDirectory(candidate)) {
                return candidate
            }
        }
    }

    throw new Error(
        [
            'Could not locate a _shared template directory from ai-exchange-bot.',
            `Set ${SHARED_TEMPLATE_DIR_ENV}=/absolute/path/to/_shared`,
            `or ${AI_EXCHANGE_BOT_DIR_ENV}=/absolute/path/to/ai-exchange-bot.`,
        ].join(' ')
    )
}

const copySharedTemplate = (sharedTemplateDir: string, appDir: string) => {
    const destination = path.join(appDir, '_shared')
    fs.cpSync(sharedTemplateDir, destination, { recursive: true, force: true })
}

export const createPieAppCommand = (appName: string) => {
    const trimmedAppName = appName.trim()
    if (!trimmedAppName) {
        console.error(
            '[pieui] Error: App name is required for create-pie-app command'
        )
        process.exit(1)
    }

    const appDir = path.resolve(process.cwd(), trimmedAppName)
    if (fs.existsSync(appDir)) {
        console.error(
            `[pieui] Error: Target directory already exists: ${trimmedAppName}`
        )
        process.exit(1)
    }

    const bunBin = process.env.PIEUI_CREATE_BUN_BIN || 'bun'
    const templateSpec =
        process.env.PIEUI_CREATE_NEXT_APP_SPEC || DEFAULT_TEMPLATE_SPEC

    console.log(
        `[pieui] Creating blank PieUI web template in "${trimmedAppName}"...`
    )

    const args = ['create', templateSpec, trimmedAppName, '--yes']
    const result = spawnSync(bunBin, args, {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: process.env,
    })

    if (result.error) {
        throw result.error
    }
    if (result.status !== 0) {
        throw new Error(
            `create-pie-app failed (exit code ${result.status ?? 'unknown'})`
        )
    }

    const sharedTemplateDir = resolveSharedTemplateDir()
    copySharedTemplate(sharedTemplateDir, appDir)

    updateNextScriptsToBun(path.join(appDir, 'package.json'))
    appendBackendLinkComment(path.join(appDir, 'app', 'page.tsx'))

    console.log('[pieui] Template created successfully.')
    console.log(`[pieui] Copied _shared from: ${sharedTemplateDir}`)
    console.log(`[pieui] Next steps:`)
    console.log(`  1. cd ${trimmedAppName}`)
    console.log(`  2. bun install`)
    console.log(`  3. bun run dev`)
}
