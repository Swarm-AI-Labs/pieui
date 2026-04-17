const { test } = require('bun:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const repoRoot = path.resolve(__dirname, '../..')

const EXPECTED_MAIN_EXPORTS = [
    'UI',
    'PieRoot',
    'PieTelegramRoot',
    'PieBaseRoot',
    'PieMaxRoot',
    'PieCard',
    'registerPieComponent',
    'useAjaxSubmit',
    'useOpenAIWebRTC',
    'cn',
    'PIEBREAK',
    'submitGlobalForm',
]

const EXPECTED_COMPONENTS_EXPORTS = [
    'PieCard',
    'UI',
    'SequenceCard',
    'BoxCard',
    'UnionCard',
    'AjaxGroupCard',
    'HTMLEmbedCard',
    'HiddenCard',
    'AutoRedirectCard',
    'IOEventsCard',
    'SessionStorageCard',
    'DeviceStorageCard',
    'CloudStorageCard',
    'SecureStorageCard',
]

const EXPECTED_REGISTERED = [
    'SequenceCard',
    'BoxCard',
    'UnionCard',
    'AjaxGroupCard',
    'HTMLEmbedCard',
    'HiddenCard',
    'AutoRedirectCard',
    'IOEventsCard',
]

const DIST_FILES = [
    path.join(repoRoot, 'dist', 'index.esm.js'),
    path.join(repoRoot, 'dist', 'index.js'),
    path.join(repoRoot, 'dist', 'components', 'index.esm.js'),
    path.join(repoRoot, 'dist', 'components', 'index.js'),
    path.join(repoRoot, 'dist', 'index.d.ts'),
    path.join(repoRoot, 'dist', 'components', 'index.d.ts'),
    path.join(repoRoot, 'dist', 'cli.js'),
    path.join(repoRoot, 'dist', 'create.js'),
]

const MIN_BUNDLE_SIZE = 200

const runCommand = (command, args, cwd = repoRoot, env = {}) => {
    const result = spawnSync(command, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: 'pipe',
    })

    return {
        status: result.status,
        stdout: result.stdout ? result.stdout.toString() : '',
        stderr: result.stderr ? result.stderr.toString() : '',
    }
}

const runNodeScript = (args, cwd = repoRoot) => runCommand('node', args, cwd)

const assertSucceeded = (result, details) => {
    assert.equal(
        result.status,
        0,
        `${details}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    )
}

const resolveBunBinary = () => {
    const bunInPath = runCommand('bun', ['--version'])
    if (bunInPath.status === 0) return 'bun'

    const homeBun = path.join(os.homedir(), '.bun', 'bin', 'bun')
    const bunFromHome = runCommand(homeBun, ['--version'])
    if (bunFromHome.status === 0) return homeBun

    throw new Error('Cannot resolve bun runtime for step4 build verification.')
}

const ensureBuildArtifacts = () => {
    if (DIST_FILES.every((filePath) => fs.existsSync(filePath))) {
        return
    }

    const bunBin = resolveBunBinary()
    const bunDir =
        bunBin.includes(path.sep) ? path.dirname(bunBin) : undefined
    const buildResult = runCommand(
        bunBin,
        ['run', 'build'],
        repoRoot,
        bunDir
            ? {
                  PATH: `${bunDir}${path.delimiter}${process.env.PATH || ''}`,
              }
            : {}
    )
    assertSucceeded(
        buildResult,
        'build should succeed before export verification checks'
    )
}

const checkBundle = (filePath, expectedExports) => {
    assert.ok(fs.existsSync(filePath), `${filePath} should exist`)

    const content = fs.readFileSync(filePath, 'utf8')
    const size = Buffer.byteLength(content)
    assert.ok(
        size >= MIN_BUNDLE_SIZE,
        `${filePath} looks too small (${size} bytes)`
    )

    for (const exportName of expectedExports) {
        assert.match(
            content,
            new RegExp(exportName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
            `${filePath} should reference export ${exportName}`
        )
    }

}

const checkTypeDefinitions = () => {
    const files = [
        path.join(repoRoot, 'dist', 'index.d.ts'),
        path.join(repoRoot, 'dist', 'components', 'index.d.ts'),
    ]

    for (const filePath of files) {
        assert.ok(fs.existsSync(filePath), `${filePath} should exist`)
        const content = fs.readFileSync(filePath, 'utf8')
        assert.ok(content.length >= 100, `${filePath} is suspiciously small`)
    }
}

const checkRuntimeExports = () => {
    const checkScript = `
const path = require('node:path');
const repoRoot = ${JSON.stringify(repoRoot)};
const expectedMain = ${JSON.stringify(EXPECTED_MAIN_EXPORTS)};
const expectedComponents = ${JSON.stringify(EXPECTED_COMPONENTS_EXPORTS)};

const main = require(path.join(repoRoot, 'dist', 'index.js'));
const components = require(path.join(repoRoot, 'dist', 'components', 'index.js'));

const hasExport = (obj, key) =>
  Object.prototype.hasOwnProperty.call(obj, key) || key in obj;

const missingMain = expectedMain.filter((key) => !hasExport(main, key));
const missingComponents = expectedComponents.filter((key) => !hasExport(components, key));

if (missingMain.length > 0 || missingComponents.length > 0) {
  console.error(JSON.stringify({ missingMain, missingComponents }));
  process.exit(1);
}
`

    const result = runCommand('node', ['-e', checkScript], repoRoot)
    assertSucceeded(result, 'node runtime export contract check should succeed')
}

const checkRegisteredComponentNamesInBundle = () => {
    const mainBundlePath = path.join(repoRoot, 'dist', 'index.js')
    const content = fs.readFileSync(mainBundlePath, 'utf8')
    for (const cardName of EXPECTED_REGISTERED) {
        assert.match(content, new RegExp(cardName))
    }
}

let buildPreparationError = null
try {
    // Keep build prep outside test() for compatibility with older Bun versions
    // that do not support test options objects and use stricter per-test timeout rules.
    ensureBuildArtifacts()
} catch (error) {
    buildPreparationError = error
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

// Verifies CI workflow enforces step suite gates, build gate, and cleanup/artifact hooks.
test('ci workflow contains step-gating, build, and artifact cleanup contracts', () => {
    const workflowPath = path.join(repoRoot, '.github', 'workflows', 'ci.yml')
    const workflow = fs.readFileSync(workflowPath, 'utf8')

    assert.match(workflow, /name:\s*CI/)
    assert.match(workflow, /name:\s*Run step suites with logs/)
    assert.match(workflow, /bun run test:step1/)
    assert.match(workflow, /bun run test:step2/)
    assert.match(workflow, /bun run test:step3/)
    assert.match(workflow, /bun run test:step5/)

    assert.match(workflow, /name:\s*Build package/)
    assert.match(workflow, /bun run build/)

    assert.match(workflow, /name:\s*Run step4 build\/export checks with logs/)
    assert.match(workflow, /bun run test:step4/)

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

// Verifies built artifacts export required API/runtime symbols and type definitions.
test('build artifacts expose required exports, components, types, and registry entries', () => {
    if (buildPreparationError) {
        throw buildPreparationError
    }

    checkBundle(
        path.join(repoRoot, 'dist', 'index.esm.js'),
        EXPECTED_MAIN_EXPORTS
    )
    checkBundle(
        path.join(repoRoot, 'dist', 'index.js'),
        EXPECTED_MAIN_EXPORTS
    )
    checkBundle(
        path.join(repoRoot, 'dist', 'components', 'index.esm.js'),
        EXPECTED_COMPONENTS_EXPORTS
    )
    checkBundle(
        path.join(repoRoot, 'dist', 'components', 'index.js'),
        EXPECTED_COMPONENTS_EXPORTS
    )

    checkTypeDefinitions()
    checkRuntimeExports()
    checkRegisteredComponentNamesInBundle()
})
