const { test } = require('bun:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { spawn, spawnSync } = require('node:child_process')
const JSZip = require('jszip')

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

    throw new Error('Cannot resolve pieui CLI runtime. Install bun or build dist/cli.js.')
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

const makeProjectDir = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix))

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

const makeZipBuffer = async (entries) => {
    const zip = new JSZip()
    for (const [name, content] of Object.entries(entries)) {
        zip.file(name, content)
    }
    const uint8 = await zip.generateAsync({ type: 'uint8array' })
    return Buffer.from(uint8)
}

// Verifies add fails cleanly when registry file is missing and does not leave partial component files.
test('add without registry exits cleanly and rolls back created component directory', async () => {
    const projectDir = makeProjectDir('pieui-step5-add-no-registry-')
    fs.mkdirSync(path.join(projectDir, 'piecomponents'), { recursive: true })

    const result = await runCli({
        cwd: projectDir,
        args: ['add', 'simple', 'RollbackCard'],
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /registry\.ts not found\. Run "pieui init" first\./)

    const componentDir = path.join(projectDir, 'piecomponents', 'RollbackCard')
    assert.equal(fs.existsSync(componentDir), false)
})

// Verifies pull does not delete existing local component when archive extraction fails (unsafe path entry).
test('pull keeps existing component when archive contains unsafe path', async () => {
    const projectDir = makeProjectDir('pieui-step5-pull-rollback-')
    const existingPath = path.join(projectDir, 'piecomponents', 'SafeCard', 'index.ts')
    writeFile(existingPath, 'export const stable = true\n')

    const zipBuffer = await makeZipBuffer({
        '../escape.ts': 'bad',
        'index.ts': 'export const overwritten = true\n',
    })

    const { server, baseUrl } = await startServer(async (_req, res) => {
        res.statusCode = 200
        res.setHeader('content-type', 'application/zip')
        res.end(zipBuffer)
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['pull', 'SafeCard'],
            env: { PIEUI_EXTERNAL_PULL_URL: `${baseUrl}/pull` },
        })

        assert.equal(result.status, 1)
        assert.match(result.stderr, /unsafe path in archive/)

        const kept = fs.readFileSync(existingPath, 'utf8')
        assert.match(kept, /stable = true/)
        assert.equal(fs.existsSync(path.join(projectDir, 'piecomponents', 'escape.ts')), false)
    } finally {
        await stopServer(server)
    }
})

// Verifies async command failures (push/pull/remote-remove) are formatted consistently without stack traces.
test('async command errors are surfaced with stable top-level error formatting', async () => {
    const projectDir = makeProjectDir('pieui-step5-cli-errors-')
    writeFile(path.join(projectDir, 'package.json'), JSON.stringify({ name: 'demo' }))
    writeFile(path.join(projectDir, 'piecomponents', 'ErrCard', 'index.ts'), 'export {}\n')

    const { server, baseUrl } = await startServer(async (_req, res) => {
        res.statusCode = 500
        res.statusMessage = 'Internal Server Error'
        res.end('boom')
    })

    try {
        const checks = [
            {
                args: ['push', 'ErrCard'],
                env: { PIEUI_EXTERNAL_PUSH_URL: `${baseUrl}/push` },
                expected: /\[pieui\] Error: push failed: 500 Internal Server Error/,
            },
            {
                args: ['pull', 'ErrCard'],
                env: { PIEUI_EXTERNAL_PULL_URL: `${baseUrl}/pull` },
                expected: /\[pieui\] Error: pull failed: 500 Internal Server Error/,
            },
            {
                args: ['remote-remove', 'ErrCard'],
                env: { PIEUI_EXTERNAL_REMOVE_URL: `${baseUrl}/remove` },
                expected: /\[pieui\] Error: remote-remove failed: 500 Internal Server Error/,
            },
        ]

        for (const check of checks) {
            const result = await runCli({
                cwd: projectDir,
                args: check.args,
                env: check.env,
            })

            assert.equal(result.status, 1)
            assert.match(result.stderr, check.expected)
            assert.doesNotMatch(result.stderr, /\n\s*at\s+.*\(/)
        }
    } finally {
        await stopServer(server)
    }
})
