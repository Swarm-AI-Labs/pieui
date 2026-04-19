import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { initCommand } from './init'

const DEFAULT_TEMPLATE_SPEC = 'next-app@latest'

export const createCommand = (appName: string) => {
    const trimmedAppName = appName.trim()
    if (!trimmedAppName) {
        console.error('[pieui] Error: App name is required for create command')
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

    console.log(`[pieui] Creating Next.js app in "${trimmedAppName}"...`)

    const result = spawnSync(
        bunBin,
        ['create', templateSpec, trimmedAppName, '--yes'],
        {
            cwd: process.cwd(),
            stdio: 'inherit',
            env: process.env,
        }
    )

    if (result.error) {
        throw result.error
    }
    if (result.status !== 0) {
        throw new Error(
            `create failed (exit code ${result.status ?? 'unknown'})`
        )
    }

    initCommand(trimmedAppName)

    console.log('[pieui] App created successfully.')
    console.log('[pieui] Next steps:')
    console.log(`  1. cd ${trimmedAppName}`)
    console.log('  2. bun run dev')
}
