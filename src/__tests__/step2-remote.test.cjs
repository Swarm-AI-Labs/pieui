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
    if (fs.existsSync(distCli)) return ['node', distCli]
    throw new Error(
        'Cannot resolve pieui CLI runtime. Install bun or build dist/cli.js.'
    )
}

const runCli = ({ cwd, args, env = {}, timeoutMs = 20000 }) =>
    new Promise((resolve) => {
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
        const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
        child.stdout.on('data', (c) => (stdout += c.toString()))
        child.stderr.on('data', (c) => (stderr += c.toString()))
        child.on('close', (code, signal) => {
            clearTimeout(timer)
            resolve({ status: code, signal, stdout, stderr })
        })
    })

const startServer = async (handler) => {
    const server = http.createServer((req, res) => {
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
            const body = Buffer.concat(chunks)
            Promise.resolve(handler(req, res, body)).catch((error) => {
                res.statusCode = 500
                res.end(String(error))
            })
        })
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    return { server, baseUrl: `http://127.0.0.1:${addr.port}` }
}
const stopServer = (server) => new Promise((r) => server.close(r))

const parseMultipart = (body, contentType) => {
    const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '')
    if (!m) throw new Error('no boundary')
    const boundary = m[1] || m[2]
    const raw = body.toString('latin1')
    return raw
        .split(`--${boundary}`)
        .slice(1, -1)
        .map((b) => b.replace(/^\r\n/, '').replace(/\r\n$/, ''))
        .map((block) => {
            const [headerText, ...bodyParts] = block.split('\r\n\r\n')
            const headers = {}
            for (const line of headerText.split('\r\n')) {
                const idx = line.indexOf(':')
                if (idx === -1) continue
                headers[line.slice(0, idx).trim().toLowerCase()] = line
                    .slice(idx + 1)
                    .trim()
            }
            const name = /name="([^"]+)"/.exec(
                headers['content-disposition'] || ''
            )?.[1]
            return {
                name,
                value: bodyParts.join('\r\n\r\n').replace(/\r\n$/, ''),
            }
        })
}

const mkTempDir = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p))
const assertOk = (result, msg) =>
    assert.equal(
        result.status,
        0,
        `${msg}\nSTATUS:${result.status}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    )

test('card remote push uploads all files + eventSchema metadata', async () => {
    const projectDir = mkTempDir('pieui-cr-push-')
    writeFile(
        path.join(projectDir, 'piecomponents', 'AlertsCard', 'index.ts'),
        'export {}\n'
    )
    writeFile(
        path.join(projectDir, 'piecomponents', 'AlertsCard', 'ui', 'view.tsx'),
        'export default null\n'
    )
    writeFile(
        path.join(
            projectDir,
            'piecomponents',
            'AlertsCard',
            'types',
            'index.ts'
        ),
        'export interface AlertsCardData { pathname?: string; depsNames: string[]; kwargs: Record<string,string> }\n'
    )

    const requests = []
    const { server, baseUrl } = await startServer((req, res, body) => {
        requests.push({
            method: req.method,
            url: req.url,
            headers: req.headers,
            body,
        })
        if (req.url?.endsWith('/batch/typescript')) {
            res.end(
                JSON.stringify({
                    objects: [{ key: 'k1' }, { key: 'k2' }, { key: 'k3' }],
                })
            )
        } else {
            res.end(JSON.stringify({ key: 'meta-key' }))
        }
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['card', 'remote', 'push', 'AlertsCard'],
            env: {
                PIE_USER_ID: 'u1',
                PIE_PROJECT: 'proj',
                PIE_API_KEY: 'k',
                PIE_API_BASE_URL: `${baseUrl}/api`,
            },
        })
        assertOk(result, 'push should succeed')
        assert.equal(requests.length, 2)

        const batch = requests[0]
        assert.equal(batch.method, 'PUT')
        assert.equal(
            batch.url,
            '/api/components/u1/proj/AlertsCard/batch/typescript'
        )
        assert.equal(batch.headers['x-api-key'], 'k')
        const parts = parseMultipart(batch.body, batch.headers['content-type'])
        const paths = parts
            .filter((p) => p.name === 'object_paths')
            .map((p) => p.value)
            .sort()
        assert.deepEqual(paths, ['index.ts', 'types/index.ts', 'ui/view.tsx'])

        const meta = requests[1]
        assert.equal(meta.method, 'PUT')
        assert.equal(
            meta.url,
            '/api/components/u1/proj/AlertsCard/metadata/eventSchema'
        )
        assert.equal(meta.headers['content-type'], 'application/json')
        const metaObj = JSON.parse(meta.body.toString('utf8').trim())
        assert.equal(metaObj.component, 'AlertsCard')
        assert.equal(metaObj.ajax, true)
        assert.equal(metaObj.io, false)
        assert.equal(metaObj.input, false)
    } finally {
        await stopServer(server)
    }
})

test('card remote push fails when component dir missing', async () => {
    const projectDir = mkTempDir('pieui-cr-push-missing-')
    fs.mkdirSync(path.join(projectDir, 'piecomponents'), { recursive: true })
    const result = await runCli({
        cwd: projectDir,
        args: ['card', 'remote', 'push', 'NoCard'],
        env: { PIE_USER_ID: 'u', PIE_PROJECT: 'p' },
    })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Component directory not found/)
})

test('card remote push fails when PIE_USER_ID not set', async () => {
    const projectDir = mkTempDir('pieui-cr-push-nouser-')
    writeFile(
        path.join(projectDir, 'piecomponents', 'MyCard', 'index.ts'),
        'export {}\n'
    )
    const result = await runCli({
        cwd: projectDir,
        args: ['card', 'remote', 'push', 'MyCard'],
        env: { PIE_USER_ID: '', PIE_PROJECT: 'p' },
    })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /user_id is required/)
})

test('card remote pull downloads dir and swaps atomically', async () => {
    const projectDir = mkTempDir('pieui-cr-pull-')
    writeFile(
        path.join(projectDir, 'piecomponents', 'SyncCard', 'old.txt'),
        'old\n'
    )

    const { server, baseUrl } = await startServer((req, res) => {
        if (req.url?.endsWith('/SyncCard')) {
            res.end(
                JSON.stringify({
                    prefix: 'p/',
                    typescript: {
                        objects: [
                            { key: 'p/typescript/index.ts' },
                            { key: 'p/typescript/ui/view.tsx' },
                        ],
                    },
                })
            )
            return
        }
        if (req.url?.endsWith('/typescript/index.ts')) {
            res.end('export const value = 1\n')
            return
        }
        if (req.url?.endsWith('/typescript/ui/view.tsx')) {
            res.end('export default null\n')
            return
        }
        res.statusCode = 404
        res.end()
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['card', 'remote', 'pull', 'SyncCard'],
            env: {
                PIE_USER_ID: 'u',
                PIE_PROJECT: 's',
                PIE_API_BASE_URL: `${baseUrl}/api`,
            },
        })
        assertOk(result, 'pull should succeed')
        assert.equal(
            fs.existsSync(
                path.join(projectDir, 'piecomponents', 'SyncCard', 'old.txt')
            ),
            false
        )
        assert.equal(
            fs.readFileSync(
                path.join(projectDir, 'piecomponents', 'SyncCard', 'index.ts'),
                'utf8'
            ),
            'export const value = 1\n'
        )
        assert.equal(
            fs.readFileSync(
                path.join(
                    projectDir,
                    'piecomponents',
                    'SyncCard',
                    'ui',
                    'view.tsx'
                ),
                'utf8'
            ),
            'export default null\n'
        )
    } finally {
        await stopServer(server)
    }
})

test('card remote pull errors when no typescript files present', async () => {
    const projectDir = mkTempDir('pieui-cr-pull-empty-')
    const { server, baseUrl } = await startServer((_req, res) => {
        res.end(JSON.stringify({ prefix: 'p/', typescript: { objects: [] } }))
    })
    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['card', 'remote', 'pull', 'Nothing'],
            env: {
                PIE_USER_ID: 'u',
                PIE_PROJECT: 's',
                PIE_API_BASE_URL: `${baseUrl}/api`,
            },
        })
        assert.equal(result.status, 1)
        assert.match(result.stderr, /No typescript files found/)
    } finally {
        await stopServer(server)
    }
})

test('card remote list prints sorted component names', async () => {
    const projectDir = mkTempDir('pieui-cr-list-')
    const { server, baseUrl } = await startServer((_req, res) => {
        res.end(
            JSON.stringify({
                user_id: 'u',
                project_slug: 's',
                components: [
                    { name: 'Bravo' },
                    { name: 'alpha' },
                    { name: 'Charlie' },
                ],
            })
        )
    })
    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['card', 'remote', 'list'],
            env: {
                PIE_USER_ID: 'u',
                PIE_PROJECT: 's',
                PIE_API_BASE_URL: `${baseUrl}/api`,
            },
        })
        assertOk(result, 'list should succeed')
        const namesLine = result.stdout
            .split('\n')
            .filter((l) => !l.startsWith('[pieui]'))
            .filter(Boolean)
        assert.deepEqual(namesLine, ['alpha', 'Bravo', 'Charlie'])
    } finally {
        await stopServer(server)
    }
})

test('card remote list respects --user / --project overrides', async () => {
    const projectDir = mkTempDir('pieui-cr-list-override-')
    let capturedUrl
    const { server, baseUrl } = await startServer((req, res) => {
        capturedUrl = req.url
        res.end(
            JSON.stringify({ user_id: 'X', project_slug: 'Y', components: [] })
        )
    })
    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['card', 'remote', 'list', '--user', 'X', '--project', 'Y'],
            env: {
                PIE_API_BASE_URL: `${baseUrl}/api`,
                PIE_USER_ID: '',
                PIE_PROJECT: '',
            },
        })
        assertOk(result, 'list override should succeed')
        assert.equal(capturedUrl, '/api/components/X/Y')
    } finally {
        await stopServer(server)
    }
})

test('card remote remove DELETEs the component URL', async () => {
    const projectDir = mkTempDir('pieui-cr-remove-')
    let captured
    const { server, baseUrl } = await startServer((req, res) => {
        captured = { method: req.method, url: req.url }
        res.statusCode = 204
        res.end()
    })
    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['card', 'remote', 'remove', 'LegacyCard'],
            env: {
                PIE_USER_ID: 'u',
                PIE_PROJECT: 's',
                PIE_API_BASE_URL: `${baseUrl}/api`,
            },
        })
        assertOk(result, 'remove should succeed')
        assert.equal(captured.method, 'DELETE')
        assert.equal(captured.url, '/api/components/u/s/LegacyCard')
    } finally {
        await stopServer(server)
    }
})

test('card remote push / pull / remove require component name', async () => {
    const projectDir = mkTempDir('pieui-cr-argcheck-')
    for (const action of ['push', 'pull', 'remove']) {
        const result = await runCli({
            cwd: projectDir,
            args: ['card', 'remote', action],
        })
        assert.equal(result.status, 1, `${action} without name should fail`)
        assert.match(result.stderr, /Component name is required/)
    }
})

test('legacy top-level push / pull / remote-remove commands are gone', async () => {
    const projectDir = mkTempDir('pieui-cr-legacy-')
    for (const cmd of ['push', 'pull', 'remote-remove']) {
        const result = await runCli({ cwd: projectDir, args: [cmd, 'AnyCard'] })
        assert.equal(result.status, 1)
    }
})

test('login still fetches credentials and writes .pie/config.json and .env', async () => {
    const projectDir = mkTempDir('pieui-cr-login-')
    const { server, baseUrl } = await startServer((req, res) => {
        if ((req.url || '').startsWith('/credentials?')) {
            res.setHeader('content-type', 'application/json')
            res.end(
                JSON.stringify({
                    status: 'ok',
                    config: { user_id: 'u', project: 'p', api_key: 'k' },
                })
            )
            return
        }
        res.end(JSON.stringify({ status: 'pending' }))
    })
    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['login'],
            env: {
                PIEUI_LOGIN_CONNECT_BASE: `${baseUrl}/connect`,
                PIEUI_LOGIN_CREDENTIALS_API: `${baseUrl}/credentials`,
            },
            timeoutMs: 10000,
        })
        assertOk(result, 'login should complete')
        const cfgPath = path.join(projectDir, '.pie', 'config.json')
        assert.ok(fs.existsSync(cfgPath))
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
        assert.equal(cfg.user_id, 'u')
    } finally {
        await stopServer(server)
    }
})
