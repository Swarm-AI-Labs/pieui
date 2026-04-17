const test = require('node:test')
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

const runCli = ({ cwd, args }) => {
    const cmd = resolveCliCommand()
    const result = spawnSync(cmd[0], [...cmd.slice(1), ...args], {
        cwd,
        env: {
            ...process.env,
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

const makeProjectDir = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix))

const assertSucceeded = (result, details) => {
    assert.equal(
        result.status,
        0,
        `${details}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    )
}

test('init creates piecomponents and updates tailwind/next config', () => {
    const projectDir = makeProjectDir('pieui-cli-init-')

    writeFile(
        path.join(projectDir, 'tailwind.config.js'),
        `module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}\n`
    )

    writeFile(
        path.join(projectDir, 'next.config.ts'),
        `const nextConfig = {}

export default nextConfig
`
    )

    const result = runCli({ cwd: projectDir, args: ['init'] })
    assertSucceeded(result, 'init command should succeed')

    const registryPath = path.join(projectDir, 'piecomponents', 'registry.ts')
    assert.ok(fs.existsSync(registryPath), 'registry.ts should be created')

    const tailwind = fs.readFileSync(
        path.join(projectDir, 'tailwind.config.js'),
        'utf8'
    )
    assert.match(tailwind, /@piedata\/pieui\/dist\/\*\*\//)

    const nextConfig = fs.readFileSync(
        path.join(projectDir, 'next.config.ts'),
        'utf8'
    )
    assert.match(nextConfig, /PIE_PLATFORM/)
    assert.match(nextConfig, /PIE_API_SERVER/)
    assert.match(nextConfig, /transpilePackages\s*:\s*\["@piedata\/pieui"\]/)
})

test('add and remove manage files and registry entry', () => {
    const projectDir = makeProjectDir('pieui-cli-add-remove-')

    assertSucceeded(
        runCli({ cwd: projectDir, args: ['init'] }),
        'init should succeed before add/remove'
    )

    const addResult = runCli({
        cwd: projectDir,
        args: ['add', 'simple', 'StatusCard'],
    })
    assertSucceeded(addResult, 'add command should succeed')

    const componentDir = path.join(projectDir, 'piecomponents', 'StatusCard')
    assert.ok(fs.existsSync(path.join(componentDir, 'index.ts')))
    assert.ok(fs.existsSync(path.join(componentDir, 'types', 'index.ts')))
    assert.ok(fs.existsSync(path.join(componentDir, 'ui', 'StatusCard.tsx')))

    const registryPath = path.join(projectDir, 'piecomponents', 'registry.ts')
    const registryAfterAdd = fs.readFileSync(registryPath, 'utf8')
    assert.match(registryAfterAdd, /import "@\/piecomponents\/StatusCard";/)

    const removeResult = runCli({
        cwd: projectDir,
        args: ['remove', 'StatusCard'],
    })
    assertSucceeded(removeResult, 'remove command should succeed')

    assert.equal(fs.existsSync(componentDir), false)
    const registryAfterRemove = fs.readFileSync(registryPath, 'utf8')
    assert.doesNotMatch(registryAfterRemove, /StatusCard/)
})

test('list prints components and supports type filter', () => {
    const projectDir = makeProjectDir('pieui-cli-list-')

    assertSucceeded(runCli({ cwd: projectDir, args: ['init'] }), 'init should succeed')
    assertSucceeded(
        runCli({ cwd: projectDir, args: ['add', 'simple', 'SimpleCard'] }),
        'add simple should succeed'
    )
    assertSucceeded(
        runCli({ cwd: projectDir, args: ['add', 'complex', 'ComplexCard'] }),
        'add complex should succeed'
    )

    const listAll = runCli({ cwd: projectDir, args: ['list'] })
    assertSucceeded(listAll, 'list should succeed')
    assert.match(listAll.stdout, /SimpleCard/)
    assert.match(listAll.stdout, /ComplexCard/)

    const listSimple = runCli({ cwd: projectDir, args: ['list', 'simple'] })
    assertSucceeded(listSimple, 'list simple should succeed')
    assert.match(listSimple.stdout, /SimpleCard/)
    assert.match(listSimple.stdout, /\(filtered by: simple\)/)
})

test('list-events prints methods keys for PieCard', () => {
    const projectDir = makeProjectDir('pieui-cli-list-events-')

    writeFile(
        path.join(projectDir, 'src', 'Screen.tsx'),
        `export const Screen = () => (
  <PieCard
    card="AlertsCard"
    methods={{
      alert: (payload) => payload,
      refresh() {
        return true
      },
    }}
  />
)
`
    )

    const result = runCli({
        cwd: projectDir,
        args: ['list-events', 'AlertsCard', '--src-dir', 'src'],
    })

    assertSucceeded(result, 'list-events should succeed')
    assert.match(result.stdout, /alert/)
    assert.match(result.stdout, /refresh/)
})

test('add-event appends a methods handler for inline object literal', () => {
    const projectDir = makeProjectDir('pieui-cli-add-event-')
    const targetFile = path.join(projectDir, 'src', 'Screen.tsx')

    writeFile(
        targetFile,
        `export const Screen = () => (
  <PieCard
    card="AlertsCard"
    methods={{
      alert: (payload) => payload,
    }}
  />
)
`
    )

    const addEvent = runCli({
        cwd: projectDir,
        args: ['add-event', 'AlertsCard', 'create', '--src-dir', 'src'],
    })
    assertSucceeded(addEvent, 'add-event should succeed')

    const updated = fs.readFileSync(targetFile, 'utf8')
    assert.match(updated, /create:\s*\(payload: any\) => \{/)
    assert.match(updated, /\[pieui\] AlertsCard:create/)

    const addInvalid = runCli({
        cwd: projectDir,
        args: ['add-event', 'AlertsCard', 'invalid key', '--src-dir', 'src'],
    })
    assert.equal(addInvalid.status, 1)
    assert.match(addInvalid.stderr, /Invalid event key/)
})

test('postbuild without components still writes empty manifest', () => {
    const projectDir = makeProjectDir('pieui-cli-postbuild-empty-')
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true })

    const result = runCli({
        cwd: projectDir,
        args: ['postbuild', '--src-dir', 'src', '--out-dir', 'public'],
    })
    assertSucceeded(result, 'postbuild should succeed when no components found')

    const manifestPath = path.join(projectDir, 'public', 'pieui.components.json')
    assert.ok(fs.existsSync(manifestPath), 'manifest file should be created')

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    assert.deepEqual(manifest, [])
})
