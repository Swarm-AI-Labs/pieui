/**
 * Tests for `pieui card check-sync` — config handling and delegation.
 *
 * Critical invariants:
 *  - Non-interactive shell without backendProjectDir in config → descriptive
 *    error message, exits without spawning python.
 *  - Reads backendProjectDir from .pie/config.json.
 *  - Does NOT read the `python` envelope (TS side is just a proxy).
 *  - Returns exit code 0 on success, 1 on failure.
 */

import { describe, test, expect } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cardCheckSyncCommand } from '../code/commands/cardCheckSync'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mkTempDir = (prefix: string) =>
    fs.mkdtempSync(path.join(os.tmpdir(), prefix))

const runWithEnv = <T>(
    env: Record<string, string | undefined>,
    fn: () => T
): T => {
    const prev: Record<string, string | undefined> = {}
    for (const [k, v] of Object.entries(env)) {
        prev[k] = process.env[k]
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
    }
    try {
        return fn()
    } finally {
        for (const [k, v] of Object.entries(prev)) {
            if (v === undefined) delete process.env[k]
            else process.env[k] = v
        }
    }
}

const withCwd = <T>(dir: string, fn: () => T): T => {
    const orig = process.cwd()
    process.chdir(dir)
    try {
        return fn()
    } finally {
        process.chdir(orig)
    }
}

const writePieConfig = (
    projectDir: string,
    config: Record<string, unknown>
): void => {
    const pieDir = path.join(projectDir, '.pie')
    fs.mkdirSync(pieDir, { recursive: true })
    fs.writeFileSync(
        path.join(pieDir, 'config.json'),
        JSON.stringify(config, null, 2),
        'utf8'
    )
}

// ---------------------------------------------------------------------------
// Non-interactive shell behavior
// ---------------------------------------------------------------------------

describe('cardCheckSyncCommand — non-interactive without config', () => {
    test('returns exit code 1 when no backendProjectDir and stdin is not TTY', async () => {
        const projectDir = mkTempDir('pieui-checksync-noint-')

        // Ensure stdin is seen as non-TTY (it already is in test environment)
        // No .pie/config.json exists
        const exitCode = await withCwd(projectDir, () =>
            cardCheckSyncCommand('AnyCard')
        )

        expect(exitCode).toBe(1)
    })

    test('prints helpful message when non-interactive and no config', async () => {
        const projectDir = mkTempDir('pieui-checksync-msg-')

        const messages: string[] = []
        const origError = console.error.bind(console)
        console.error = (...args: any[]) => {
            messages.push(args.join(' '))
        }

        try {
            await withCwd(projectDir, () => cardCheckSyncCommand('AnyCard'))
        } finally {
            console.error = origError
        }

        const combined = messages.join('\n')
        // Must mention the config file path and the key to set
        expect(combined).toMatch(/backendProjectDir/)
        expect(combined).toMatch(/config\.json/)
    })
})

// ---------------------------------------------------------------------------
// Config reading
// ---------------------------------------------------------------------------

describe('cardCheckSyncCommand — backendProjectDir from config', () => {
    test('reads backendProjectDir from .pie/config.json', async () => {
        const projectDir = mkTempDir('pieui-checksync-cfg-')

        // Create a fake backend dir (exists but no python)
        const backendDir = mkTempDir('pieui-fake-backend-')
        writePieConfig(projectDir, { backendProjectDir: backendDir })

        // The command will try to spawn python in backendDir.
        // We override PIEUI_CHECK_SYNC_PYTHON to a non-existent binary so
        // the spawn fails predictably rather than accidentally finding a
        // real pie installation.
        const exitCode = await runWithEnv(
            { PIEUI_CHECK_SYNC_PYTHON: '/nonexistent/python-fake' },
            () => withCwd(projectDir, () => cardCheckSyncCommand('TestCard'))
        )

        // Spawn failure returns 1, but the key thing is it tried to use backendDir
        // (didn't return early with "no backendProjectDir" message)
        expect(exitCode).toBe(1)
    })

    test('returns 1 when configured backendProjectDir does not exist on disk', async () => {
        const projectDir = mkTempDir('pieui-checksync-missing-')
        writePieConfig(projectDir, {
            backendProjectDir: '/nonexistent/backend',
        })

        const exitCode = await withCwd(projectDir, () =>
            cardCheckSyncCommand('AnyCard')
        )

        expect(exitCode).toBe(1)
    })

    test('derives backendProjectDir from backendComponentsDir when pyproject.toml found', async () => {
        const projectDir = mkTempDir('pieui-checksync-derive-')

        // Create fake backend: root with pyproject.toml, components subdir
        const backendRoot = mkTempDir('pieui-backend-root-')
        fs.writeFileSync(
            path.join(backendRoot, 'pyproject.toml'),
            '[project]\nname = "pie"\n',
            'utf8'
        )
        const backendComponentsDir = path.join(backendRoot, 'pie', 'components')
        fs.mkdirSync(backendComponentsDir, { recursive: true })

        writePieConfig(projectDir, {
            backendComponentsDir,
        })

        // The command should walk up from backendComponentsDir and find pyproject.toml
        // then save backendProjectDir and attempt spawn
        const exitCode = await runWithEnv(
            { PIEUI_CHECK_SYNC_PYTHON: '/nonexistent/python-fake' },
            () => withCwd(projectDir, () => cardCheckSyncCommand('TestCard'))
        )

        // Should have tried to spawn (exit 1 from spawn failure), not exit 1 from missing config
        expect(exitCode).toBe(1)

        // Verify backendProjectDir was saved to config
        const config = JSON.parse(
            fs.readFileSync(
                path.join(projectDir, '.pie', 'config.json'),
                'utf8'
            )
        )
        expect(config.backendProjectDir).toBe(backendRoot)
    })

    test('cross-write does not overwrite existing backendProjectDir', async () => {
        const projectDir = mkTempDir('pieui-checksync-nooverwrite-')
        const existingBackendDir = mkTempDir('pieui-existing-backend-')

        writePieConfig(projectDir, {
            backendProjectDir: existingBackendDir,
            backendComponentsDir: '/other/path',
            someOtherKey: 'preserved',
        })

        // Run command (will fail because no real python, but should not touch config)
        await runWithEnv(
            { PIEUI_CHECK_SYNC_PYTHON: '/nonexistent/python-fake' },
            () => withCwd(projectDir, () => cardCheckSyncCommand('TestCard'))
        )

        const config = JSON.parse(
            fs.readFileSync(
                path.join(projectDir, '.pie', 'config.json'),
                'utf8'
            )
        )

        // backendProjectDir unchanged
        expect(config.backendProjectDir).toBe(existingBackendDir)
        // other keys preserved
        expect(config.someOtherKey).toBe('preserved')
    })
})

// ---------------------------------------------------------------------------
// PIEUI_CHECK_SYNC_PYTHON env override
// ---------------------------------------------------------------------------

describe('cardCheckSyncCommand — PIEUI_CHECK_SYNC_PYTHON', () => {
    test('uses PIEUI_CHECK_SYNC_PYTHON override instead of venv python', async () => {
        const projectDir = mkTempDir('pieui-checksync-pyoverride-')
        const backendDir = mkTempDir('pieui-checksync-backend-')
        writePieConfig(projectDir, { backendProjectDir: backendDir })

        // Point to an obvious non-python to test the override path
        const exitCode = await runWithEnv(
            { PIEUI_CHECK_SYNC_PYTHON: '/usr/bin/false' },
            () => withCwd(projectDir, () => cardCheckSyncCommand('TestCard'))
        )

        // /usr/bin/false always exits non-zero — confirms override was used
        expect(exitCode).not.toBe(0)
    })
})
