import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const DEFAULT_TEMPLATE_SPEC = 'next-app@latest'
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

    updateNextScriptsToBun(path.join(appDir, 'package.json'))
    appendBackendLinkComment(path.join(appDir, 'app', 'page.tsx'))

    console.log('[pieui] Template created successfully.')
    console.log(`[pieui] Next steps:`)
    console.log(`  1. cd ${trimmedAppName}`)
    console.log(`  2. bun install`)
    console.log(`  3. bun run dev`)
}
