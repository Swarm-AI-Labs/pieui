const { test } = require('bun:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

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

const runCli = ({ cwd, args, env = {} }) => {
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

const makeProjectDir = (prefix) =>
    fs.mkdtempSync(path.join(os.tmpdir(), prefix))

const assertSucceeded = (result, details) => {
    assert.equal(
        result.status,
        0,
        `${details}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    )
}

const assertUsageShown = (result) => {
    assert.match(result.stdout, /Usage: pieui <command> \[options\]/)
    assert.match(result.stdout, /Commands:/)
}

// Verifies CLI exits non-zero and prints usage when no command is provided.
test('no command prints usage and exits with code 1', () => {
    const projectDir = makeProjectDir('pieui-step3-empty-command-')
    const result = runCli({ cwd: projectDir, args: [] })

    assert.equal(result.status, 1)
    assert.match(result.stdout, /CLI started with command: ""/)
    assertUsageShown(result)
})

// Verifies unknown commands are rejected with usage output.
test('unknown command prints usage and exits with code 1', () => {
    const projectDir = makeProjectDir('pieui-step3-unknown-command-')
    const result = runCli({ cwd: projectDir, args: ['unknown-cmd'] })

    assert.equal(result.status, 1)
    assert.match(result.stdout, /CLI started with command: "unknown-cmd"/)
    assertUsageShown(result)
})

// Verifies required-argument errors keep their contract for local commands.
test('required arg contract for create-pie-app/add/remove/list-events/add-event', () => {
    const projectDir = makeProjectDir('pieui-step3-required-args-local-')

    const createPieAppResult = runCli({
        cwd: projectDir,
        args: ['create-pie-app'],
    })
    assert.equal(createPieAppResult.status, 1)
    assert.match(
        createPieAppResult.stderr,
        /App name is required for create-pie-app command/
    )
    assertUsageShown(createPieAppResult)

    const addResult = runCli({ cwd: projectDir, args: ['add'] })
    assert.equal(addResult.status, 1)
    assert.match(addResult.stderr, /Component name is required for add command/)
    assertUsageShown(addResult)

    const removeResult = runCli({ cwd: projectDir, args: ['remove'] })
    assert.equal(removeResult.status, 1)
    assert.match(
        removeResult.stderr,
        /Component name is required for remove command/
    )
    assertUsageShown(removeResult)

    const listEventsResult = runCli({ cwd: projectDir, args: ['list-events'] })
    assert.equal(listEventsResult.status, 1)
    assert.match(
        listEventsResult.stderr,
        /Component name is required for list-events command/
    )
    assertUsageShown(listEventsResult)

    const addEventResult = runCli({
        cwd: projectDir,
        args: ['add-event', 'OnlyCard'],
    })
    assert.equal(addEventResult.status, 1)
    assert.match(
        addEventResult.stderr,
        /Component name and event name are required for add-event command/
    )
    assertUsageShown(addEventResult)
})

// Verifies postbuild default contracts for src-dir, out-dir, append flag, and output manifest path.
test('postbuild defaults are stable and produce manifest in public', () => {
    const projectDir = makeProjectDir('pieui-step3-postbuild-defaults-')

    const result = runCli({ cwd: projectDir, args: ['postbuild'] })
    assertSucceeded(result, 'postbuild with defaults should succeed')

    assert.match(result.stdout, /Source directory: \./)
    assert.match(result.stdout, /Output directory: public/)
    assert.match(result.stdout, /Append mode: false/)
    assert.ok(
        fs.existsSync(path.join(projectDir, 'public', 'pieui.components.json'))
    )
})

// Verifies postbuild flag contracts for equals-form flags and append mode.
test('postbuild equals flags and append mode are reflected in output contract', () => {
    const projectDir = makeProjectDir('pieui-step3-postbuild-flags-')
    fs.mkdirSync(path.join(projectDir, 'appsrc'), { recursive: true })

    const result = runCli({
        cwd: projectDir,
        args: ['postbuild', '--src-dir=appsrc', '--out-dir=distx', '--append'],
    })
    assertSucceeded(result, 'postbuild with explicit flags should succeed')

    assert.match(result.stdout, /Source directory: appsrc/)
    assert.match(result.stdout, /Output directory: distx/)
    assert.match(result.stdout, /Append mode: true/)
    assert.ok(
        fs.existsSync(path.join(projectDir, 'distx', 'pieui.components.json'))
    )
})

// Verifies short -s flag contract for list command source directory selection.
test('list short -s flag sets source directory used in scan output', () => {
    const projectDir = makeProjectDir('pieui-step3-list-short-flag-')
    fs.mkdirSync(path.join(projectDir, 'appsrc'), { recursive: true })

    const result = runCli({ cwd: projectDir, args: ['list', '-s', 'appsrc'] })
    assertSucceeded(result, 'list with short source flag should succeed')

    assert.match(result.stdout, /Scanning components in: appsrc/)
})

// Verifies list invalid filter contract falls back to unfiltered output wording.
test('list invalid filter keeps unfiltered total wording contract', () => {
    const projectDir = makeProjectDir('pieui-step3-list-filter-contract-')

    runCli({ cwd: projectDir, args: ['init'] })
    runCli({ cwd: projectDir, args: ['add', 'simple', 'OneCard'] })

    const result = runCli({ cwd: projectDir, args: ['list', 'not-a-filter'] })
    assertSucceeded(result, 'list should succeed with invalid filter')

    assert.match(result.stdout, /\[pieui\] Total: 1 component/)
    assert.doesNotMatch(result.stdout, /filtered by:/)
})

// Verifies add default type contract prints complex-container in success output.
test('add default type contract reports complex-container', () => {
    const projectDir = makeProjectDir('pieui-step3-add-default-type-contract-')
    assertSucceeded(
        runCli({ cwd: projectDir, args: ['init'] }),
        'init should succeed'
    )

    const result = runCli({ cwd: projectDir, args: ['add', 'ContractCard'] })
    assertSucceeded(result, 'add should succeed with default type')

    assert.match(result.stdout, /Component type: complex-container/)
})

// Verifies add explicit type contract prints simple type in success output.
test('add explicit simple type contract reports simple', () => {
    const projectDir = makeProjectDir('pieui-step3-add-explicit-type-contract-')
    assertSucceeded(
        runCli({ cwd: projectDir, args: ['init'] }),
        'init should succeed'
    )

    const result = runCli({
        cwd: projectDir,
        args: ['add', 'simple', 'SimpleContractCard'],
    })
    assertSucceeded(result, 'add with explicit type should succeed')

    assert.match(result.stdout, /Component type: simple/)
})

// Verifies init short -o flag contract creates scaffold under requested base path.
test('init short -o flag creates piecomponents in provided directory', () => {
    const projectDir = makeProjectDir('pieui-step3-init-short-o-')

    const result = runCli({
        cwd: projectDir,
        args: ['init', '-o', 'apps/site'],
    })
    assertSucceeded(result, 'init with short out-dir flag should succeed')

    const registryPath = path.join(
        projectDir,
        'apps',
        'site',
        'piecomponents',
        'registry.ts'
    )
    assert.ok(fs.existsSync(registryPath))
})

// Verifies remove error contract when piecomponents root does not exist.
test('remove without piecomponents returns stable error contract', () => {
    const projectDir = makeProjectDir('pieui-step3-remove-missing-root-')
    const result = runCli({ cwd: projectDir, args: ['remove', 'GhostCard'] })

    assert.equal(result.status, 1)
    assert.match(
        result.stderr,
        /piecomponents directory not found\. Nothing to remove\./
    )
})

// Verifies add-event contract for invalid event key remains explicit and non-zero.
test('add-event invalid key returns stable validation error', () => {
    const projectDir = makeProjectDir('pieui-step3-add-event-invalid-key-')
    writeFile(
        path.join(projectDir, 'src', 'Screen.tsx'),
        `export const Screen = () => <PieCard card="A" methods={{ ping: () => true }} />\n`
    )

    const result = runCli({
        cwd: projectDir,
        args: ['add-event', 'A', 'invalid key', '--src-dir', 'src'],
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /Invalid event key/)
})

// Verifies postbuild short-flag contract (-s/-o) is reflected in startup output lines.
test('postbuild short flags are reflected in output contract', () => {
    const projectDir = makeProjectDir('pieui-step3-postbuild-short-flags-')
    fs.mkdirSync(path.join(projectDir, 'ssrc'), { recursive: true })

    const result = runCli({
        cwd: projectDir,
        args: ['postbuild', '-s', 'ssrc', '-o', 'oout'],
    })
    assertSucceeded(result, 'postbuild with short flags should succeed')

    assert.match(result.stdout, /Source directory: ssrc/)
    assert.match(result.stdout, /Output directory: oout/)
    assert.match(result.stdout, /Append mode: false/)
    assert.ok(
        fs.existsSync(path.join(projectDir, 'oout', 'pieui.components.json'))
    )
})

// Verifies init supports equals-form out-dir flag and creates target scaffold path.
test('init equals-form out-dir creates scaffold in requested directory', () => {
    const projectDir = makeProjectDir('pieui-step3-init-equals-o-')
    const result = runCli({
        cwd: projectDir,
        args: ['init', '--out-dir=apps/eqsite'],
    })
    assertSucceeded(result, 'init with equals-form out-dir should succeed')

    assert.ok(
        fs.existsSync(
            path.join(
                projectDir,
                'apps',
                'eqsite',
                'piecomponents',
                'registry.ts'
            )
        )
    )
})

// Verifies list supports equals-form src-dir flag and reports selected scan path.
test('list equals-form src-dir prints selected source directory', () => {
    const projectDir = makeProjectDir('pieui-step3-list-equals-s-')
    fs.mkdirSync(path.join(projectDir, 'eqsrc'), { recursive: true })

    const result = runCli({
        cwd: projectDir,
        args: ['list', '--src-dir=eqsrc'],
    })
    assertSucceeded(result, 'list with equals-form src-dir should succeed')
    assert.match(result.stdout, /Scanning components in: eqsrc/)
})

// Verifies usage text keeps key command entries to preserve discoverability contract.
test('usage output includes key command entries', () => {
    const projectDir = makeProjectDir('pieui-step3-usage-content-')
    const result = runCli({ cwd: projectDir, args: [] })

    assert.equal(result.status, 1)
    assert.match(result.stdout, /init/)
    assert.match(result.stdout, /create-pie-app <AppName>/)
    assert.match(result.stdout, /add \[type\] <ComponentName>/)
    assert.match(result.stdout, /postbuild/)
    assert.match(result.stdout, /list-events <ComponentName>/)
    assert.match(result.stdout, /remote-remove <ComponentName>/)
})

// Verifies add parser fallback behavior when first positional token is not a known type.
test('add unknown type token falls back to default type using first token as component name', () => {
    const projectDir = makeProjectDir('pieui-step3-add-unknown-type-token-')
    assertSucceeded(
        runCli({ cwd: projectDir, args: ['init'] }),
        'init should succeed'
    )

    const result = runCli({
        cwd: projectDir,
        args: ['add', 'UnknownType', 'IgnoredName'],
    })
    assertSucceeded(result, 'add fallback parsing should succeed')

    assert.match(
        result.stdout,
        /Creating complex-container component: UnknownType/
    )
    assert.ok(
        fs.existsSync(
            path.join(projectDir, 'piecomponents', 'UnknownType', 'index.ts')
        )
    )
    assert.equal(
        fs.existsSync(path.join(projectDir, 'piecomponents', 'IgnoredName')),
        false
    )
})
