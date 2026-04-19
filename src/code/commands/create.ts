import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { initCommand } from './init'
import {
    envTemplate,
    homePageTemplate,
    loadingScreenTemplate,
    rootLayoutTemplate,
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

const resolveTemplatePublicDir = () => {
    const entrypointPath = process.argv[1]
        ? path.resolve(process.argv[1])
        : path.join(process.cwd(), 'src', 'cli.ts')
    const entrypointDir = path.dirname(entrypointPath)
    const candidateDirs = [
        path.join(entrypointDir, 'code', 'public'),
        path.join(process.cwd(), 'src', 'code', 'public'),
    ]

    for (const candidateDir of candidateDirs) {
        if (fs.existsSync(candidateDir)) {
            return candidateDir
        }
    }

    throw new Error('[pieui] Could not resolve bundled public template assets')
}

const scaffoldCreateAppFiles = (appDir: string) => {
    clearDirectory(path.join(appDir, 'public'))

    writeFile(path.join(appDir, 'app', '_shared', 'page.tsx'), sharedPageTemplate)
    writeFile(path.join(appDir, 'app', 'page.tsx'), homePageTemplate)
    writeFile(path.join(appDir, 'app', 'layout.tsx'), rootLayoutTemplate)
    fs.rmSync(path.join(appDir, 'app', '_shared', 'simple.tsx'), {
        force: true,
    })
    fs.rmSync(path.join(appDir, 'app', 'piecache.json'), { force: true })
    fs.rmSync(path.join(appDir, 'app', 'favicon.ico'), { force: true })
    writeFile(
        path.join(appDir, 'components', 'LoadingScreen.tsx'),
        loadingScreenTemplate
    )
    fs.rmSync(path.join(appDir, 'components', 'ErrorToast.tsx'), { force: true })
    fs.cpSync(resolveTemplatePublicDir(), path.join(appDir, 'public'), {
        recursive: true,
        force: true,
    })
}

const runBunCommand = (bunBin: string, args: string[], cwd: string) => {
    const result = spawnSync(bunBin, args, {
        cwd,
        stdio: 'inherit',
        env: process.env,
    })

    if (result.error) {
        throw result.error
    }

    if (result.status !== 0) {
        throw new Error(
            `${args.join(' ')} failed (exit code ${result.status ?? 'unknown'})`
        )
    }
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
    runBunCommand(bunBin, ['install'], appDir)
    runBunCommand(bunBin, ['run', 'dev'], appDir)
}
