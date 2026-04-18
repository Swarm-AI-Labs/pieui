/**
 * Shared test helpers for all __tests__/step*.test.cjs suites.
 *
 * Extracted from the original step files to eliminate copy-paste duplication.
 * New step files should require from here rather than re-define these
 * utilities locally. Existing step files are intentionally left unchanged.
 */

'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { spawn, spawnSync } = require('node:child_process')
const assert = require('node:assert/strict')
const JSZip = require('jszip')

const repoRoot = path.resolve(__dirname, '../..')

/**
 * Resolves the CLI command tuple `[runtime, scriptPath]` using the following
 * priority:
 *   1. `bun` from $PATH
 *   2. `~/.bun/bin/bun`
 *   3. compiled `dist/cli.js` (Node.js fallback)
 *
 * @returns {[string, string]} Tuple of [binary, script].
 */
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

/**
 * Runs the CLI synchronously via spawnSync. Safe for tests that do not
 * involve network I/O or long-running subprocesses.
 *
 * @param {{ cwd: string, args: string[], env?: Record<string,string> }} opts
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
const runCliSync = ({ cwd, args, env = {} }) => {
    const cmd = resolveCliCommand()
    const result = spawnSync(cmd[0], [...cmd.slice(1), ...args], {
        cwd,
        env: {
            ...process.env,
            ...env,
            NODE_PATH: path.join(repoRoot, 'node_modules'),
        },
        stdio: 'pipe',
    })

    return {
        status: result.status,
        stdout: result.stdout ? result.stdout.toString() : '',
        stderr: result.stderr ? result.stderr.toString() : '',
    }
}

/**
 * Runs the CLI asynchronously via spawn with a configurable kill timeout.
 * Use for tests involving network I/O or file-streaming commands (push/pull).
 *
 * @param {{ cwd: string, args: string[], env?: Record<string,string>, timeoutMs?: number }} opts
 * @returns {Promise<{ status: number, signal: string|null, stdout: string, stderr: string }>}
 */
const runCliAsync = ({ cwd, args, env = {}, timeoutMs = 20000 }) =>
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

/**
 * Creates a temporary directory with the given prefix inside `os.tmpdir()`.
 * Directories are not automatically cleaned up — run `bun run test:cleanup`
 * after the suite to remove leftover artifacts.
 *
 * @param {string} prefix
 * @returns {string} Absolute path to the created directory.
 */
const makeProjectDir = (prefix) =>
    fs.mkdtempSync(path.join(os.tmpdir(), prefix))

/**
 * Writes a file to `filePath`, creating all ancestor directories as needed.
 *
 * @param {string} filePath
 * @param {string} contents
 */
const writeFile = (filePath, contents) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, contents, 'utf8')
}

/**
 * Asserts that the CLI result exited with status code 0. Prints STDOUT and
 * STDERR as part of the error message to ease debugging.
 *
 * @param {{ status: number, stdout: string, stderr: string }} result
 * @param {string} details  Human-readable description of what should have succeeded.
 */
const assertSucceeded = (result, details) => {
    assert.equal(
        result.status,
        0,
        `${details}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    )
}

/**
 * Starts a lightweight HTTP server on a random ephemeral port.
 * The `handler` function receives (req, res) and may return a Promise.
 *
 * @param {(req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>} handler
 * @returns {Promise<{ server: http.Server, baseUrl: string }>}
 */
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

/**
 * Gracefully shuts down an HTTP server started by {@link startServer}.
 *
 * @param {http.Server} server
 * @returns {Promise<void>}
 */
const stopServer = (server) =>
    new Promise((resolve) => server.close(resolve))

/**
 * Creates an in-memory ZIP buffer from a `{ filename: content }` record.
 * Useful for mocking remote component archive downloads in pull tests.
 *
 * @param {Record<string, string>} entries
 * @returns {Promise<Buffer>}
 */
const makeZipBuffer = async (entries) => {
    const zip = new JSZip()
    for (const [name, content] of Object.entries(entries)) {
        zip.file(name, content)
    }
    const uint8 = await zip.generateAsync({ type: 'uint8array' })
    return Buffer.from(uint8)
}

module.exports = {
    repoRoot,
    resolveCliCommand,
    runCliSync,
    runCliAsync,
    makeProjectDir,
    writeFile,
    assertSucceeded,
    startServer,
    stopServer,
    makeZipBuffer,
}
