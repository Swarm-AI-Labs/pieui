import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import type { PageAjaxAction } from '../types'

const PIE_CONFIG_PATH = '.pie/config.json'

type PieProjectConfig = {
    backendPagesDir?: string
    backendComponentsDir?: string
}

const readBackendRoot = (): string | undefined => {
    const configPath = path.join(process.cwd(), PIE_CONFIG_PATH)
    if (!fs.existsSync(configPath)) return undefined
    try {
        const parsed: unknown = JSON.parse(
            fs.readFileSync(configPath, 'utf8')
        )
        if (typeof parsed !== 'object' || parsed === null) return undefined
        const config = parsed as PieProjectConfig
        if (!config.backendPagesDir) return undefined
        const pages = path.resolve(config.backendPagesDir)
        if (!fs.existsSync(pages) || !fs.statSync(pages).isDirectory()) {
            return undefined
        }
        return path.dirname(pages)
    } catch {
        return undefined
    }
}

export const pageAjaxCommand = (
    pageName: string,
    action: PageAjaxAction,
    handlerName: string
): void => {
    if (!pageName) throw new Error('Page name is required for page ajax command')
    if (!handlerName) {
        throw new Error('Handler name is required for page ajax command')
    }

    const backendRoot = readBackendRoot()
    if (!backendRoot) {
        throw new Error(
            'Backend project not configured. Run `pieui init` to link a backend project (saves backendPagesDir/.backendComponentsDir to .pie/config.json).'
        )
    }

    console.log(`[pieui] Delegating to backend: ${backendRoot}`)
    console.log(`[pieui]   pie page ajax ${pageName} ${action} ${handlerName}`)

    const result = spawnSync(
        'pie',
        ['page', 'ajax', pageName, action, handlerName],
        { cwd: backendRoot, stdio: 'inherit', env: process.env }
    )

    if (result.error) {
        throw new Error(
            `Failed to invoke \`pie\` in ${backendRoot}: ${result.error.message}`
        )
    }
    if (typeof result.status === 'number' && result.status !== 0) {
        process.exit(result.status)
    }
}