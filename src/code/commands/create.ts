import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { initCommand } from './init'
import {
    envTemplate,
    homePageTemplate,
    loadingScreenTemplate,
    sharedPageTemplate,
} from '../templates'

const DEFAULT_TEMPLATE_SPEC = 'next-app@latest'

const clearDirectory = (targetDir: string) => {
    if (!fs.existsSync(targetDir)) return

    for (const entry of fs.readdirSync(targetDir)) {
        fs.rmSync(path.join(targetDir, entry), { recursive: true, force: true })
    }
}

const writeFile = (filePath: string, content: string) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content, 'utf8')
}

const scaffoldCreateAppFiles = (appDir: string) => {
    clearDirectory(path.join(appDir, 'public'))

    writeFile(path.join(appDir, 'app', '_shared', 'page.tsx'), sharedPageTemplate)
    writeFile(path.join(appDir, 'app', 'page.tsx'), homePageTemplate)
    fs.rmSync(path.join(appDir, 'app', '_shared', 'simple.tsx'), {
        force: true,
    })
    fs.rmSync(path.join(appDir, 'app', 'piecache.json'), { force: true })
    writeFile(
        path.join(appDir, 'components', 'LoadingScreen.tsx'),
        loadingScreenTemplate
    )
    fs.rmSync(path.join(appDir, 'components', 'ErrorToast.tsx'), { force: true })
}

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

    scaffoldCreateAppFiles(appDir)
    initCommand(trimmedAppName)
    writeFile(path.join(appDir, '.env'), envTemplate())

    const devResult = spawnSync(bunBin, ['run', 'dev'], {
        cwd: appDir,
        stdio: 'inherit',
        env: process.env,
    })

    if (devResult.error) {
        throw devResult.error
    }
    if (devResult.status !== 0) {
        throw new Error(
            `dev failed (exit code ${devResult.status ?? 'unknown'})`
        )
    }

}
