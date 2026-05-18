import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const PACKAGE_NAME = '@swarm.ing/pieui'

type PackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn'

const INSTALL_ARGS: Record<PackageManager, string[]> = {
    bun: ['add', '-g', `${PACKAGE_NAME}@latest`],
    npm: ['install', '-g', `${PACKAGE_NAME}@latest`],
    pnpm: ['add', '-g', `${PACKAGE_NAME}@latest`],
    yarn: ['global', 'add', `${PACKAGE_NAME}@latest`],
}

const isPackageManager = (value: string): value is PackageManager =>
    value === 'bun' || value === 'npm' || value === 'pnpm' || value === 'yarn'

const hasBinary = (bin: string): boolean => {
    const result = spawnSync('which', [bin], { stdio: 'ignore' })
    return result.status === 0
}

const detectPackageManager = (): PackageManager => {
    const order: PackageManager[] = ['bun', 'pnpm', 'yarn', 'npm']
    for (const pm of order) {
        if (hasBinary(pm)) return pm
    }
    return 'npm'
}

const readInstalledVersion = (): string | null => {
    const candidates = [
        path.resolve(__dirname, '..', 'package.json'),
        path.resolve(__dirname, '..', '..', 'package.json'),
        path.resolve(__dirname, '..', '..', '..', 'package.json'),
    ]
    for (const file of candidates) {
        try {
            const raw = fs.readFileSync(file, 'utf8')
            const parsed = JSON.parse(raw) as {
                name?: string
                version?: string
            }
            if (parsed.name === PACKAGE_NAME && parsed.version) {
                return parsed.version
            }
        } catch {
            // try next
        }
    }
    return null
}

export const selfUpgradeCommand = async (override?: string): Promise<void> => {
    const before = readInstalledVersion()
    console.log(
        `[pieui] Current version: ${before ?? 'unknown (running from source or dev build)'}`
    )

    let pm: PackageManager
    if (override) {
        if (!isPackageManager(override)) {
            console.error(
                `[pieui] Error: --pm must be one of: bun, npm, pnpm, yarn`
            )
            process.exit(1)
        }
        pm = override
    } else {
        pm = detectPackageManager()
    }

    const args = INSTALL_ARGS[pm]
    console.log(`[pieui] Upgrading via ${pm}: ${pm} ${args.join(' ')}`)

    const result = spawnSync(pm, args, {
        stdio: 'inherit',
        env: process.env,
    })

    if (result.error) {
        console.error(`[pieui] Failed to run ${pm}: ${result.error.message}`)
        process.exit(1)
    }

    if (result.status !== 0) {
        console.error(
            `[pieui] Upgrade failed (exit code ${result.status ?? 'unknown'})`
        )
        process.exit(result.status ?? 1)
    }

    console.log(`[pieui] Upgrade complete. Run \`pieui --help\` to verify.`)
}
