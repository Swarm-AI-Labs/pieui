const { test } = require('bun:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { spawn, spawnSync } = require('node:child_process')

const repoRoot = path.resolve(__dirname, '../..')

const writeFile = (filePath, contents) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, contents, 'utf8')
}

const resolveCliCommand = () => {
    const bunInPath = spawnSync('bun', ['--version'], { stdio: 'ignore' })
    if (bunInPath.status === 0) {
        return ['bun', path.join(repoRoot, 'src', 'cli.ts')]
    }

    const homeBun = path.join(os.homedir(), '.bun', 'bin', 'bun')
    const bunFromHome = spawnSync(homeBun, ['--version'], { stdio: 'ignore' })
    if (bunFromHome.status === 0) {
        return [homeBun, path.join(repoRoot, 'src', 'cli.ts')]
    }

    const distCli = path.join(repoRoot, 'dist', 'cli.js')
    if (fs.existsSync(distCli)) {
        return ['node', distCli]
    }

    throw new Error(
        'Cannot resolve pieui CLI runtime. Install bun or build dist/cli.js.'
    )
}

const runCli = ({ cwd, args, env = {}, timeoutMs = 20000 }) =>
    new Promise((resolve, reject) => {
        const cmd = resolveCliCommand()
        const child = spawn(cmd[0], [...cmd.slice(1), ...args], {
            cwd,
            env: {
                ...process.env,
                ...env,
                NODE_PATH: path.join(repoRoot, 'node_modules'),
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        let stdout = ''
        let stderr = ''
        let finished = false

        const timer = setTimeout(() => {
            if (finished) return
            child.kill('SIGKILL')
        }, timeoutMs)

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString()
        })
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
        })
        child.on('error', (error) => {
            clearTimeout(timer)
            if (!finished) {
                finished = true
                reject(error)
            }
        })
        child.on('close', (code, signal) => {
            clearTimeout(timer)
            if (!finished) {
                finished = true
                resolve({ status: code, signal, stdout, stderr })
            }
        })
    })

const makeProjectDir = (prefix) =>
    fs.mkdtempSync(path.join(os.tmpdir(), prefix))

const startServer = async (handler) => {
    const server = http.createServer((req, res) => {
        Promise.resolve(handler(req, res)).catch((error) => {
            res.statusCode = 500
            res.end(String(error))
        })
    })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') {
        throw new Error('Failed to resolve server address')
    }

    return {
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
    }
}

const stopServer = async (server) => {
    await new Promise((resolve) => server.close(resolve))
}

// Verifies add fails cleanly when registry file is missing and does not leave partial component files.
test('add without registry exits cleanly and rolls back created component directory', async () => {
    const projectDir = makeProjectDir('pieui-step5-add-no-registry-')
    fs.mkdirSync(path.join(projectDir, 'piecomponents'), { recursive: true })

    const result = await runCli({
        cwd: projectDir,
        args: ['card', 'add', 'simple', 'RollbackCard'],
    })

    assert.equal(result.status, 1)
    assert.match(
        result.stderr,
        /registry\.ts not found\. Run "pieui init" first\./
    )

    const componentDir = path.join(projectDir, 'piecomponents', 'RollbackCard')
    assert.equal(fs.existsSync(componentDir), false)
})

// Verifies pull does not delete existing local component when the remote envelope contains an unsafe file path.
test('pull keeps existing component when remote envelope contains unsafe file path', async () => {
    const projectDir = makeProjectDir('pieui-step5-pull-rollback-')
    const existingPath = path.join(
        projectDir,
        'piecomponents',
        'SafeCard',
        'index.ts'
    )
    writeFile(existingPath, 'export const stable = true\n')

    const { server, baseUrl } = await startServer(async (_req, res) => {
        res.statusCode = 200
        res.setHeader('content-type', 'application/json')
        res.end(
            JSON.stringify({
                typescript: {
                    name: 'SafeCard',
                    files: [
                        {
                            path: '../escape.ts',
                            content: 'pwned\n',
                        },
                    ],
                },
            })
        )
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['card', 'remote', 'pull', 'SafeCard'],
            env: {
                PIE_API_BASE_URL: `${baseUrl}/api`,
                PIE_USER_ID: 'demo',
                PIE_PROJECT: 'proj',
            },
        })

        assert.equal(result.status, 1)
        assert.match(result.stderr, /escapes componentsDir/)

        const kept = fs.readFileSync(existingPath, 'utf8')
        assert.match(kept, /stable = true/)
        assert.equal(
            fs.existsSync(path.join(projectDir, 'piecomponents', 'escape.ts')),
            false
        )
    } finally {
        await stopServer(server)
    }
})

// Verifies async card-remote command failures are surfaced with a clean top-level error (no stack traces).
test('async command errors are surfaced with stable top-level error formatting', async () => {
    const projectDir = makeProjectDir('pieui-step5-cli-errors-')
    writeFile(
        path.join(projectDir, 'piecomponents', 'ErrCard', 'index.ts'),
        "export { default as ErrCard } from './ui/view'\n"
    )
    writeFile(
        path.join(projectDir, 'piecomponents', 'ErrCard', 'ui', 'view.tsx'),
        "import { PieCard } from '@swarm.ing/pieui'\n" +
            "import type { ErrCardProps } from '../types'\n" +
            'const ErrCard = ({ data: _data }: ErrCardProps) => <PieCard card="ErrCard" />\n' +
            'export default ErrCard\n'
    )
    writeFile(
        path.join(projectDir, 'piecomponents', 'ErrCard', 'types', 'index.ts'),
        "import { SimpleContainerCardProps } from '@swarm.ing/pieui'\n" +
            'export interface ErrCardData { id: string }\n' +
            'export type ErrCardProps = SimpleContainerCardProps<ErrCardData>\n'
    )

    const { server, baseUrl } = await startServer(async (_req, res) => {
        res.statusCode = 500
        res.statusMessage = 'Internal Server Error'
        res.end('boom')
    })

    try {
        const env = {
            PIE_API_BASE_URL: `${baseUrl}/api`,
            PIE_USER_ID: 'demo',
            PIE_PROJECT: 'proj',
        }
        const checks = [
            {
                args: ['card', 'remote', 'push', 'ErrCard'],
                expected: /\[pieui\] Error: PUT .+ failed: 500/,
            },
            {
                args: ['card', 'remote', 'pull', 'ErrCard'],
                expected: /\[pieui\] Error: GET .+ failed: 500/,
            },
            {
                args: ['card', 'remote', 'remove', 'ErrCard'],
                expected: /\[pieui\] Error: DELETE .+ failed: 500/,
            },
        ]

        for (const check of checks) {
            const result = await runCli({
                cwd: projectDir,
                args: check.args,
                env,
            })

            assert.equal(result.status, 1)
            assert.match(result.stderr, check.expected)
            assert.doesNotMatch(result.stderr, /\n\s*at\s+.*\(/)
        }
    } finally {
        await stopServer(server)
    }
})
