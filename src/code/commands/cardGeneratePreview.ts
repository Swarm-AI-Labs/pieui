import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { loadSettings } from '../services/settings'

const STORYBOOK_PORT = 6006
const STORY_TITLE_NAMESPACE = 'PieComponents'

const isStorybookReachable = (port: number): Promise<boolean> =>
    new Promise((resolve) => {
        const req = http.get(
            { hostname: 'localhost', port, path: '/index.json' },
            (res) => {
                res.resume()
                resolve(res.statusCode === 200)
            }
        )
        req.on('error', () => resolve(false))
        req.setTimeout(1500, () => {
            req.destroy()
            resolve(false)
        })
    })

const waitForStorybook = async (
    port: number,
    timeoutMs: number
): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (await isStorybookReachable(port)) return true
        await new Promise((r) => setTimeout(r, 1500))
    }
    return false
}

const killProcessTree = (proc: ChildProcess): void => {
    if (!proc.pid) return
    try {
        // Negative pid signals the process group (only works because we spawn
        // with `detached: true`, which gives the child its own pgid).
        process.kill(-proc.pid, 'SIGTERM')
    } catch {
        try {
            proc.kill('SIGTERM')
        } catch {
            /* ignore */
        }
    }
}

export const cardGeneratePreviewCommand = async (
    componentName: string,
    options: { out?: string } = {}
): Promise<void> => {
    if (!componentName) {
        throw new Error('Component name is required')
    }

    const settings = loadSettings()
    const componentDir = path.join(settings.componentsDir, componentName)
    if (!fs.existsSync(componentDir)) {
        throw new Error(`Component directory not found: ${componentDir}`)
    }

    const storyPath = path.join(componentDir, `${componentName}.stories.tsx`)
    if (!fs.existsSync(storyPath)) {
        throw new Error(
            `Story file not found: ${storyPath}\n` +
                `Run \`pieui card add-story ${componentName}\` first.`
        )
    }

    const outPath = path.resolve(
        process.cwd(),
        options.out || path.join(componentDir, 'preview.png')
    )
    fs.mkdirSync(path.dirname(outPath), { recursive: true })

    const bunBin = process.env.PIEUI_CREATE_BUN_BIN || 'bun'

    let sbProc: ChildProcess | null = null
    const alreadyRunning = await isStorybookReachable(STORYBOOK_PORT)
    if (!alreadyRunning) {
        console.log(
            `[pieui] Storybook not running on :${STORYBOOK_PORT} — starting it temporarily...`
        )
        sbProc = spawn(bunBin, ['run', 'storybook'], {
            cwd: process.cwd(),
            stdio: 'ignore',
            env: process.env,
            detached: true,
        })
        sbProc.unref()
        const ready = await waitForStorybook(STORYBOOK_PORT, 180_000)
        if (!ready) {
            killProcessTree(sbProc)
            throw new Error(
                'Storybook failed to become reachable within 3 minutes'
            )
        }
        console.log(`[pieui] Storybook ready on :${STORYBOOK_PORT}`)
    } else {
        console.log(`[pieui] Using running Storybook on :${STORYBOOK_PORT}`)
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pieui-storycap-'))
    try {
        // Match every state of the card (e.g. `Default`, `Blue`, `White`, …).
        // Hand-written stories rarely use the auto-scaffolded `Default` name.
        const include = `${STORY_TITLE_NAMESPACE}/${componentName}/*`
        console.log(`[pieui] Running storycap for "${include}"...`)
        const result = spawnSync(
            bunBin,
            [
                'x',
                'storycap@latest',
                `http://localhost:${STORYBOOK_PORT}`,
                '--include',
                include,
                '--outDir',
                tmpDir,
                '--serverTimeout',
                '60000',
            ],
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
                `storycap exited with code ${result.status ?? 'unknown'}`
            )
        }

        const producedDir = path.join(
            tmpDir,
            STORY_TITLE_NAMESPACE,
            componentName
        )
        if (!fs.existsSync(producedDir)) {
            throw new Error(
                `storycap finished but no PNGs were produced under ${producedDir}\n` +
                    `Tmp listing: ${fs.readdirSync(tmpDir).join(', ') || '(empty)'}`
            )
        }
        const pngs = fs
            .readdirSync(producedDir)
            .filter((f) => f.endsWith('.png'))
            .sort()
        if (pngs.length === 0) {
            throw new Error(`No PNGs in ${producedDir}`)
        }

        const picked = path.join(producedDir, pngs[0])
        fs.copyFileSync(picked, outPath)
        console.log(
            `[pieui] Preview written: ${outPath}` +
                (pngs.length > 1
                    ? ` (picked ${pngs[0]}; other states available: ${pngs.slice(1).join(', ')})`
                    : '')
        )
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
        if (sbProc) {
            killProcessTree(sbProc)
            console.log('[pieui] Storybook stopped')
        }
    }
}
