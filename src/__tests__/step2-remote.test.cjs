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

const assertSucceeded = (result, details) => {
    assert.equal(
        result.status,
        0,
        `${details}\nSTATUS:${result.status} SIGNAL:${result.signal}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    )
}

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

const readRequestBody = async (req) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    return Buffer.concat(chunks)
}

const parseMultipartParts = (buffer, contentType) => {
    const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '')
    if (!match) {
        throw new Error('Missing multipart boundary')
    }
    const boundary = match[1] || match[2]
    const raw = buffer.toString('latin1')
    const blocks = raw
        .split(`--${boundary}`)
        .slice(1, -1)
        .map((part) => part.replace(/^\r\n/, '').replace(/\r\n$/, ''))

    return blocks.map((block) => {
        const [headerText, ...bodyParts] = block.split('\r\n\r\n')
        const headers = {}
        for (const line of headerText.split('\r\n')) {
            const idx = line.indexOf(':')
            if (idx === -1) continue
            const key = line.slice(0, idx).trim().toLowerCase()
            const value = line.slice(idx + 1).trim()
            headers[key] = value
        }

        const bodyRaw = bodyParts.join('\r\n\r\n').replace(/\r\n$/, '')
        const disposition = headers['content-disposition'] || ''
        const nameMatch = /name="([^"]+)"/.exec(disposition)
        const filenameMatch = /filename="([^"]+)"/.exec(disposition)

        return {
            name: nameMatch ? nameMatch[1] : undefined,
            filename: filenameMatch ? filenameMatch[1] : undefined,
            bodyBuffer: Buffer.from(bodyRaw, 'latin1'),
            bodyText: bodyRaw,
        }
    })
}

const makeZipBuffer = async (entries) => {
    const zip = new JSZip()
    for (const [name, content] of Object.entries(entries)) {
        zip.file(name, content)
    }
    const uint8 = await zip.generateAsync({ type: 'uint8array' })
    return Buffer.from(uint8)
}

// Verifies push uploads multipart payload with expected component slug, zip content, and API key header.
test('push uploads zip archive and sends expected metadata', async () => {
    const projectDir = makeProjectDir('pieui-step2-push-success-')
    writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: '@Acme/My_App' })
    )
    writeFile(
        path.join(projectDir, 'piecomponents', 'AlertsCard', 'index.ts'),
        'export {}\n'
    )
    writeFile(
        path.join(projectDir, 'piecomponents', 'AlertsCard', 'ui', 'view.tsx'),
        'export default null\n'
    )

    let requestRecord
    const { server, baseUrl } = await startServer(async (req, res) => {
        requestRecord = {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: await readRequestBody(req),
        }
        res.statusCode = 200
        res.end('ok')
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['push', 'AlertsCard'],
            env: {
                PIEUI_EXTERNAL_PUSH_URL: `${baseUrl}/push`,
                PIEUI_EXTERNAL_API_KEY: 'secret-key',
            },
        })

        assertSucceeded(result, 'push should succeed')
        assert.equal(requestRecord.method, 'POST')
        assert.equal(requestRecord.url, '/push')
        assert.equal(requestRecord.headers['x-api-key'], 'secret-key')

        const parts = parseMultipartParts(
            requestRecord.body,
            requestRecord.headers['content-type']
        )
        const componentPart = parts.find((p) => p.name === 'component')
        const filePart = parts.find((p) => p.name === 'file')

        assert.ok(componentPart)
        assert.equal(componentPart.bodyText, 'my_app/AlertsCard')
        assert.ok(filePart)
        assert.equal(filePart.filename, 'AlertsCard.zip')

        const zip = await JSZip.loadAsync(filePart.bodyBuffer)
        const names = Object.keys(zip.files).sort()
        assert.deepEqual(names, ['index.ts', 'ui/', 'ui/view.tsx'])
    } finally {
        await stopServer(server)
    }
})

// Verifies push derives project slug from cwd name when package.json is absent.
test('push falls back to cwd basename slug for remote component name', async () => {
    const base = makeProjectDir('pieui-step2-push-fallback-')
    const projectDir = path.join(base, 'My Project!')
    fs.mkdirSync(projectDir, { recursive: true })
    writeFile(
        path.join(projectDir, 'piecomponents', 'CardX', 'index.ts'),
        'export {}\n'
    )

    let requestRecord
    const { server, baseUrl } = await startServer(async (req, res) => {
        requestRecord = {
            headers: req.headers,
            body: await readRequestBody(req),
        }
        res.statusCode = 200
        res.end('ok')
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['push', 'CardX'],
            env: { PIEUI_EXTERNAL_PUSH_URL: `${baseUrl}/push` },
        })
        assertSucceeded(result, 'push should succeed without package.json')

        const parts = parseMultipartParts(
            requestRecord.body,
            requestRecord.headers['content-type']
        )
        const componentPart = parts.find((p) => p.name === 'component')
        assert.ok(componentPart)
        assert.equal(componentPart.bodyText, 'my-project/CardX')
    } finally {
        await stopServer(server)
    }
})

// Verifies push reports upstream server errors with status and body details.
test('push surfaces non-2xx server response', async () => {
    const projectDir = makeProjectDir('pieui-step2-push-error-')
    writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: 'demo' })
    )
    writeFile(
        path.join(projectDir, 'piecomponents', 'BrokenCard', 'index.ts'),
        'export {}\n'
    )

    const { server, baseUrl } = await startServer(async (_req, res) => {
        res.statusCode = 500
        res.statusMessage = 'Internal Server Error'
        res.end('boom')
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['push', 'BrokenCard'],
            env: { PIEUI_EXTERNAL_PUSH_URL: `${baseUrl}/push` },
        })

        assert.equal(result.status, 1)
        assert.match(result.stderr, /push failed: 500 Internal Server Error/)
        assert.match(result.stderr, /boom/)
    } finally {
        await stopServer(server)
    }
})

// Verifies push does not send API key header when PIEUI_EXTERNAL_API_KEY is not set.
test('push omits api key header when environment key is absent', async () => {
    const projectDir = makeProjectDir('pieui-step2-push-no-apikey-')
    writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: 'demo' })
    )
    writeFile(
        path.join(projectDir, 'piecomponents', 'NoKeyCard', 'index.ts'),
        'export {}\n'
    )

    let requestRecord
    const { server, baseUrl } = await startServer(async (req, res) => {
        requestRecord = {
            headers: req.headers,
            body: await readRequestBody(req),
        }
        res.statusCode = 200
        res.end('ok')
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['push', 'NoKeyCard'],
            env: { PIEUI_EXTERNAL_PUSH_URL: `${baseUrl}/push` },
        })

        assertSucceeded(result, 'push should succeed without api key')
        assert.equal(requestRecord.headers['x-api-key'], undefined)
    } finally {
        await stopServer(server)
    }
})

// Verifies push fails early when piecomponents root directory does not exist.
test('push fails when piecomponents directory is missing', async () => {
    const projectDir = makeProjectDir('pieui-step2-push-no-root-')
    const result = await runCli({ cwd: projectDir, args: ['push', 'AnyCard'] })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /piecomponents directory not found/)
})

// Verifies push fails early when the requested component folder does not exist.
test('push fails when target component directory is missing', async () => {
    const projectDir = makeProjectDir('pieui-step2-push-no-component-')
    fs.mkdirSync(path.join(projectDir, 'piecomponents'), { recursive: true })

    const result = await runCli({ cwd: projectDir, args: ['push', 'AnyCard'] })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Component directory not found/)
})

// Verifies pull downloads zip payload, overwrites existing directory, and preserves API key headers.
test('pull extracts downloaded archive and overwrites previous component files', async () => {
    const projectDir = makeProjectDir('pieui-step2-pull-success-')
    writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: 'Demo_App' })
    )
    writeFile(
        path.join(projectDir, 'piecomponents', 'SyncCard', 'old.txt'),
        'old\n'
    )

    const zipBuffer = await makeZipBuffer({
        'index.ts': 'export const value = 1\n',
        'ui/view.tsx': 'export default null\n',
    })

    let requestRecord
    const { server, baseUrl } = await startServer(async (req, res) => {
        requestRecord = {
            method: req.method,
            url: req.url,
            headers: req.headers,
        }
        res.statusCode = 200
        res.setHeader('content-type', 'application/zip')
        res.end(zipBuffer)
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['pull', 'SyncCard'],
            env: {
                PIEUI_EXTERNAL_PULL_URL: `${baseUrl}/pull`,
                PIEUI_EXTERNAL_API_KEY: 'pull-key',
            },
        })

        assertSucceeded(result, 'pull should succeed')
        assert.equal(requestRecord.method, 'GET')
        assert.equal(requestRecord.headers['x-api-key'], 'pull-key')
        assert.match(requestRecord.url, /\/pull\?component=demo_app%2FSyncCard/)

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

// Verifies pull reports upstream server errors with status and body details.
test('pull surfaces non-2xx server response', async () => {
    const projectDir = makeProjectDir('pieui-step2-pull-error-')
    fs.mkdirSync(path.join(projectDir, 'piecomponents'), { recursive: true })

    const { server, baseUrl } = await startServer(async (_req, res) => {
        res.statusCode = 404
        res.statusMessage = 'Not Found'
        res.end('nope')
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['pull', 'MissingCard'],
            env: { PIEUI_EXTERNAL_PULL_URL: `${baseUrl}/pull` },
        })

        assert.equal(result.status, 1)
        assert.match(result.stderr, /pull failed: 404 Not Found/)
        assert.match(result.stderr, /nope/)
    } finally {
        await stopServer(server)
    }
})

// Verifies pull omits API key header when PIEUI_EXTERNAL_API_KEY is not set.
test('pull omits api key header when environment key is absent', async () => {
    const projectDir = makeProjectDir('pieui-step2-pull-no-apikey-')
    fs.mkdirSync(path.join(projectDir, 'piecomponents'), { recursive: true })

    const zipBuffer = await makeZipBuffer({ 'index.ts': 'export {}\n' })
    let requestRecord
    const { server, baseUrl } = await startServer(async (req, res) => {
        requestRecord = { headers: req.headers }
        res.statusCode = 200
        res.setHeader('content-type', 'application/zip')
        res.end(zipBuffer)
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['pull', 'NoKeyCard'],
            env: { PIEUI_EXTERNAL_PULL_URL: `${baseUrl}/pull` },
        })

        assertSucceeded(result, 'pull should succeed without api key')
        assert.equal(requestRecord.headers['x-api-key'], undefined)
    } finally {
        await stopServer(server)
    }
})

// Verifies pull normalizes backslash separators in archive entries.
test('pull normalizes windows-style archive paths', async () => {
    const projectDir = makeProjectDir('pieui-step2-pull-backslashes-')
    fs.mkdirSync(path.join(projectDir, 'piecomponents'), { recursive: true })

    const zipBuffer = await makeZipBuffer({
        'ui\\view.tsx': 'export default 1\n',
        'types\\index.ts': 'export type T = string\n',
    })

    const { server, baseUrl } = await startServer(async (_req, res) => {
        res.statusCode = 200
        res.setHeader('content-type', 'application/zip')
        res.end(zipBuffer)
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['pull', 'WinPathCard'],
            env: { PIEUI_EXTERNAL_PULL_URL: `${baseUrl}/pull` },
        })
        assertSucceeded(
            result,
            'pull should succeed for windows-style archive paths'
        )

        assert.equal(
            fs.readFileSync(
                path.join(
                    projectDir,
                    'piecomponents',
                    'WinPathCard',
                    'ui',
                    'view.tsx'
                ),
                'utf8'
            ),
            'export default 1\n'
        )
        assert.equal(
            fs.readFileSync(
                path.join(
                    projectDir,
                    'piecomponents',
                    'WinPathCard',
                    'types',
                    'index.ts'
                ),
                'utf8'
            ),
            'export type T = string\n'
        )
    } finally {
        await stopServer(server)
    }
})

// Verifies pull rejects path-traversal entries in archive payloads.
test('pull blocks unsafe archive paths', async () => {
    const projectDir = makeProjectDir('pieui-step2-pull-unsafe-')
    fs.mkdirSync(path.join(projectDir, 'piecomponents'), { recursive: true })

    const zipBuffer = await makeZipBuffer({
        '../escape.txt': 'hacked\n',
        'ok.txt': 'ok\n',
    })

    const { server, baseUrl } = await startServer(async (_req, res) => {
        res.statusCode = 200
        res.setHeader('content-type', 'application/zip')
        res.end(zipBuffer)
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['pull', 'UnsafeCard'],
            env: { PIEUI_EXTERNAL_PULL_URL: `${baseUrl}/pull` },
        })

        assert.equal(result.status, 1)
        assert.match(result.stderr, /unsafe path in archive/)
        assert.equal(
            fs.existsSync(path.join(projectDir, 'piecomponents', 'escape.txt')),
            false
        )
        assert.equal(fs.existsSync(path.join(projectDir, 'escape.txt')), false)
    } finally {
        await stopServer(server)
    }
})

// Verifies pull fails early when piecomponents root directory does not exist.
test('pull fails when piecomponents directory is missing', async () => {
    const projectDir = makeProjectDir('pieui-step2-pull-no-root-')
    const result = await runCli({ cwd: projectDir, args: ['pull', 'AnyCard'] })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /piecomponents directory not found/)
})

// Verifies remote-remove uses DELETE with encoded component name and API key header.
test('remote-remove sends delete request with expected query and headers', async () => {
    const projectDir = makeProjectDir('pieui-step2-remove-success-')
    writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: '@Org/My-App' })
    )

    let requestRecord
    const { server, baseUrl } = await startServer(async (req, res) => {
        requestRecord = {
            method: req.method,
            url: req.url,
            headers: req.headers,
        }
        res.statusCode = 200
        res.end('deleted')
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['remote-remove', 'LegacyCard'],
            env: {
                PIEUI_EXTERNAL_REMOVE_URL: `${baseUrl}/remove`,
                PIEUI_EXTERNAL_API_KEY: 'remove-key',
            },
        })

        assertSucceeded(result, 'remote-remove should succeed')
        assert.equal(requestRecord.method, 'DELETE')
        assert.equal(requestRecord.headers['x-api-key'], 'remove-key')
        assert.match(
            requestRecord.url,
            /\/remove\?component=my-app%2FLegacyCard/
        )
    } finally {
        await stopServer(server)
    }
})

// Verifies remote-remove reports upstream errors with response payload details.
test('remote-remove surfaces non-2xx server response', async () => {
    const projectDir = makeProjectDir('pieui-step2-remove-error-')
    writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: 'demo' })
    )

    const { server, baseUrl } = await startServer(async (_req, res) => {
        res.statusCode = 404
        res.statusMessage = 'Not Found'
        res.end('missing')
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['remote-remove', 'GhostCard'],
            env: { PIEUI_EXTERNAL_REMOVE_URL: `${baseUrl}/remove` },
        })

        assert.equal(result.status, 1)
        assert.match(result.stderr, /remote-remove failed: 404 Not Found/)
        assert.match(result.stderr, /missing/)
    } finally {
        await stopServer(server)
    }
})

// Verifies remote-remove omits API key header when PIEUI_EXTERNAL_API_KEY is not set.
test('remote-remove omits api key header when environment key is absent', async () => {
    const projectDir = makeProjectDir('pieui-step2-remove-no-apikey-')
    writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: 'demo' })
    )

    let requestRecord
    const { server, baseUrl } = await startServer(async (req, res) => {
        requestRecord = { headers: req.headers }
        res.statusCode = 200
        res.end('ok')
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['remote-remove', 'NoKeyCard'],
            env: { PIEUI_EXTERNAL_REMOVE_URL: `${baseUrl}/remove` },
        })
        assertSucceeded(result, 'remote-remove should succeed without api key')
        assert.equal(requestRecord.headers['x-api-key'], undefined)
    } finally {
        await stopServer(server)
    }
})

// Verifies remote-remove falls back to cwd basename slug when package.json is absent.
test('remote-remove falls back to cwd basename slug for remote component name', async () => {
    const base = makeProjectDir('pieui-step2-remove-fallback-')
    const projectDir = path.join(base, 'My Remove App!')
    fs.mkdirSync(projectDir, { recursive: true })

    let requestRecord
    const { server, baseUrl } = await startServer(async (req, res) => {
        requestRecord = { method: req.method, url: req.url }
        res.statusCode = 200
        res.end('ok')
    })

    try {
        const result = await runCli({
            cwd: projectDir,
            args: ['remote-remove', 'LegacyCard'],
            env: { PIEUI_EXTERNAL_REMOVE_URL: `${baseUrl}/remove` },
        })
        assertSucceeded(
            result,
            'remote-remove should succeed without package.json'
        )
        assert.equal(requestRecord.method, 'DELETE')
        assert.match(
            requestRecord.url,
            /\/remove\?component=my-remove-app%2FLegacyCard/
        )
    } finally {
        await stopServer(server)
    }
})

// Verifies CLI argument validation for remote commands when component name is missing.
test('remote command args are required for push, pull, and remote-remove', async () => {
    const projectDir = makeProjectDir('pieui-step2-args-required-')

    const pushResult = await runCli({ cwd: projectDir, args: ['push'] })
    const pullResult = await runCli({ cwd: projectDir, args: ['pull'] })
    const removeResult = await runCli({
        cwd: projectDir,
        args: ['remote-remove'],
    })

    assert.equal(pushResult.status, 1)
    assert.match(
        pushResult.stderr,
        /Component name is required for push command/
    )

    assert.equal(pullResult.status, 1)
    assert.match(
        pullResult.stderr,
        /Component name is required for pull command/
    )

    assert.equal(removeResult.status, 1)
    assert.match(
        removeResult.stderr,
        /Component name is required for remote-remove command/
    )
})

// ---------------------------------------------------------------------------
// Connection-refused error handling
// ---------------------------------------------------------------------------

// Verifies push exits non-zero and surfaces a human-readable error (no raw
// stack trace) when the target server refuses the connection.
test('push surfaces a clean error message when the server refuses the connection', async () => {
    // Bind a server to get a free port, close it immediately — leaves nothing listening
    const { server, baseUrl } = await startServer((_req, res) => {
        res.statusCode = 200
        res.end('ok')
    })
    const url = `${baseUrl}/push`
    await stopServer(server)

    const projectDir = makeProjectDir('pieui-step2-push-refused-')
    writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: 'demo' })
    )
    writeFile(
        path.join(projectDir, 'piecomponents', 'AnyCard', 'index.ts'),
        'export {}\n'
    )

    const result = await runCli({
        cwd: projectDir,
        args: ['push', 'AnyCard'],
        env: { PIEUI_EXTERNAL_PUSH_URL: url },
    })

    assert.equal(result.status, 1)
    assert.doesNotMatch(result.stderr, /\n\s*at\s+.*\(/)
})

// Verifies pull exits non-zero and surfaces a human-readable error when the
// target server refuses the connection.
test('pull surfaces a clean error message when the server refuses the connection', async () => {
    const { server, baseUrl } = await startServer((_req, res) => {
        res.statusCode = 200
        res.end('ok')
    })
    const url = `${baseUrl}/pull`
    await stopServer(server)

    const projectDir = makeProjectDir('pieui-step2-pull-refused-')
    fs.mkdirSync(path.join(projectDir, 'piecomponents'), { recursive: true })

    const result = await runCli({
        cwd: projectDir,
        args: ['pull', 'AnyCard'],
        env: { PIEUI_EXTERNAL_PULL_URL: url },
    })

    assert.equal(result.status, 1)
    assert.doesNotMatch(result.stderr, /\n\s*at\s+.*\(/)
})

// Verifies remote-remove exits non-zero and surfaces a human-readable error
// when the target server refuses the connection.
test('remote-remove surfaces a clean error message when the server refuses the connection', async () => {
    const { server, baseUrl } = await startServer((_req, res) => {
        res.statusCode = 200
        res.end('ok')
    })
    const url = `${baseUrl}/remove`
    await stopServer(server)

    const projectDir = makeProjectDir('pieui-step2-remove-refused-')
    writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: 'demo' })
    )

    const result = await runCli({
        cwd: projectDir,
        args: ['remote-remove', 'OldCard'],
        env: { PIEUI_EXTERNAL_REMOVE_URL: url },
    })

    assert.equal(result.status, 1)
    assert.doesNotMatch(result.stderr, /\n\s*at\s+.*\(/)
})
