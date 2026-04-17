const { test } = require('bun:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const repoRoot = path.resolve(__dirname, '../..')

const runNodeScript = (args, cwd = repoRoot) => {
    const result = spawnSync('node', args, {
        cwd,
        env: { ...process.env },
        stdio: 'pipe',
    })

    return {
        status: result.status,
        stdout: result.stdout ? result.stdout.toString() : '',
        stderr: result.stderr ? result.stderr.toString() : '',
    }
}

// Verifies package scripts expose deterministic entry points for each step suite and full run.
test('package.json includes step test scripts and cleanup script', () => {
    const packageJsonPath = path.join(repoRoot, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const scripts = pkg.scripts || {}

    assert.equal(
        scripts['test:step1'],
        'bun test src/__tests__/step1-local.test.cjs'
    )
    assert.equal(
        scripts['test:step2'],
        'bun test src/__tests__/step2-remote.test.cjs'
    )
    assert.equal(
        scripts['test:step3'],
        'bun test src/__tests__/step3-contract.test.cjs'
    )
    assert.equal(
        scripts['test:step4'],
        'bun test src/__tests__/step4-ci.test.cjs'
    )
    assert.equal(
        scripts['test:step5'],
        'bun test src/__tests__/step5-regres.test.cjs'
    )
    assert.equal(
        scripts['test:steps'],
        'bun test src/__tests__/step1-local.test.cjs src/__tests__/step2-remote.test.cjs src/__tests__/step3-contract.test.cjs src/__tests__/step4-ci.test.cjs src/__tests__/step5-regres.test.cjs'
    )
    assert.equal(
        scripts['test:cleanup'],
        'node scripts/cleanup-test-artifacts.mjs'
    )
})

// Verifies CI workflow enforces step suite gates and always uploads logs and cleanup.
test('ci workflow contains step-gating, cleanup, and artifact-upload contracts', () => {
    const workflowPath = path.join(repoRoot, '.github', 'workflows', 'ci.yml')
    const workflow = fs.readFileSync(workflowPath, 'utf8')

    assert.match(workflow, /name:\s*CI/)
    assert.match(workflow, /name:\s*Run step suites with logs/)
    assert.match(workflow, /bun run test:step1/)
    assert.match(workflow, /bun run test:step2/)
    assert.match(workflow, /bun run test:step3/)
    assert.match(workflow, /bun run test:step4/)
    assert.match(workflow, /bun run test:step5/)

    assert.match(workflow, /name:\s*Cleanup temporary test artifacts/)
    assert.match(workflow, /if:\s*always\(\)/)
    assert.match(workflow, /bun run test:cleanup/)

    assert.match(workflow, /name:\s*Upload step-suite logs/)
    assert.match(workflow, /actions\/upload-artifact@v4/)
    assert.match(workflow, /name:\s*step-suite-logs/)
    assert.match(workflow, /path:\s*test-artifacts/)
})

// Verifies cleanup script dry-run mode reports matched directories without deleting them.
test('cleanup script dry-run keeps matching directories intact', () => {
    const prefix = 'pieui-step4-ci-dry-'
    const tempRoot = os.tmpdir()

    const dirA = fs.mkdtempSync(path.join(tempRoot, `${prefix}A-`))
    const dirB = fs.mkdtempSync(path.join(tempRoot, `${prefix}B-`))

    try {
        const result = runNodeScript([
            path.join('scripts', 'cleanup-test-artifacts.mjs'),
            '--dry-run',
            `--prefix=${prefix}`,
        ])

        assert.equal(result.status, 0)
        assert.match(result.stdout, /Would remove/)
        assert.match(result.stdout, /DRY-RUN/)
        assert.ok(fs.existsSync(dirA))
        assert.ok(fs.existsSync(dirB))
    } finally {
        fs.rmSync(dirA, { recursive: true, force: true })
        fs.rmSync(dirB, { recursive: true, force: true })
    }
})

// Verifies cleanup script removes only matched prefix directories while preserving non-matching paths.
test('cleanup script removes only matching prefix directories', () => {
    const matchPrefix = 'pieui-step4-ci-clean-'
    const tempRoot = os.tmpdir()

    const matchingDir = fs.mkdtempSync(path.join(tempRoot, `${matchPrefix}M-`))
    const otherDir = fs.mkdtempSync(path.join(tempRoot, 'pieui-step4-ci-keep-'))

    try {
        const result = runNodeScript([
            path.join('scripts', 'cleanup-test-artifacts.mjs'),
            `--prefix=${matchPrefix}`,
        ])

        assert.equal(result.status, 0)
        assert.match(result.stdout, /Removing/)
        assert.match(result.stdout, /Removed/)

        assert.equal(fs.existsSync(matchingDir), false)
        assert.equal(fs.existsSync(otherDir), true)
    } finally {
        fs.rmSync(otherDir, { recursive: true, force: true })
    }
})
