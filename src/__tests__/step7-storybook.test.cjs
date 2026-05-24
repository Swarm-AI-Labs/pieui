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
    throw new Error('Cannot resolve pieui CLI runtime')
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

const STORYBOOK_INTEGRATION = path.join(
    repoRoot,
    'src',
    'code',
    'storybookIntegration'
)

const requireFresh = (mod) => {
    delete require.cache[require.resolve(mod)]
    return require(mod)
}

// Verifies the multi-line addons array gains our entry and second run is a no-op.
test('patchStorybookMainAddons adds entry to a multi-line addons array idempotently', () => {
    const projectDir = makeProjectDir('pieui-step7-multiline-')
    const mainPath = path.join(projectDir, '.storybook', 'main.ts')
    writeFile(
        mainPath,
        `import type { StorybookConfig } from '@storybook/nextjs-vite'

const config: StorybookConfig = {
    stories: ['../src/**/*.stories.tsx'],
    addons: [
        '@storybook/addon-onboarding',
        '@chromatic-com/storybook',
    ],
    framework: { name: '@storybook/nextjs-vite', options: {} },
}

export default config
`
    )

    const sb = requireFresh(STORYBOOK_INTEGRATION)
    assert.equal(sb.patchStorybookMainAddons(mainPath), true)
    const after = fs.readFileSync(mainPath, 'utf8')
    assert.match(after, /'@swarm\.ing\/pieui\/storybook\/addon\/preset'/)
    assert.match(after, /'@storybook\/addon-onboarding'/)
    assert.match(after, /'@chromatic-com\/storybook'/)
    // Second run is a no-op (returns false, file unchanged).
    assert.equal(sb.patchStorybookMainAddons(mainPath), false)
    assert.equal(after, fs.readFileSync(mainPath, 'utf8'))
})

// Verifies an inline addons array also accepts the new entry.
test('patchStorybookMainAddons handles an inline addons array', () => {
    const projectDir = makeProjectDir('pieui-step7-inline-')
    const mainPath = path.join(projectDir, '.storybook', 'main.ts')
    writeFile(
        mainPath,
        `const config = { stories: [], addons: ['a', 'b'] };\nexport default config;\n`
    )
    const sb = requireFresh(STORYBOOK_INTEGRATION)
    assert.equal(sb.patchStorybookMainAddons(mainPath), true)
    const after = fs.readFileSync(mainPath, 'utf8')
    assert.match(
        after,
        /addons:\s*\['a', 'b', '@swarm\.ing\/pieui\/storybook\/addon\/preset'\]/
    )
})

// Verifies the stories array gains the piecomponents glob (idempotent).
test('patchStorybookMainStories adds the piecomponents glob idempotently', () => {
    const projectDir = makeProjectDir('pieui-step7-stories-')
    const mainPath = path.join(projectDir, '.storybook', 'main.ts')
    writeFile(
        mainPath,
        `import type { StorybookConfig } from '@storybook/nextjs-vite'

const config: StorybookConfig = {
    stories: [
        '../src/**/*.mdx',
        '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    ],
    addons: [],
    framework: { name: '@storybook/nextjs-vite', options: {} },
}

export default config
`
    )
    const sb = requireFresh(STORYBOOK_INTEGRATION)
    assert.equal(sb.patchStorybookMainStories(mainPath), true)
    const after = fs.readFileSync(mainPath, 'utf8')
    assert.match(
        after,
        /'\.\.\/piecomponents\/\*\*\/\*\.stories\.@\(js\|jsx\|mjs\|ts\|tsx\)'/
    )
    assert.match(after, /'\.\.\/src\/\*\*\/\*\.mdx'/)
    // Second run is a no-op.
    assert.equal(sb.patchStorybookMainStories(mainPath), false)
})

// Verifies pieui init patches both arrays (addons + stories) on the way.
test('pieui init wires both addon and stories glob into existing main.ts', () => {
    const projectDir = makeProjectDir('pieui-step7-init-both-')
    writeFile(
        path.join(projectDir, '.storybook', 'main.ts'),
        `const config = {
    stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
    addons: ['@storybook/addon-essentials'],
};
export default config;
`
    )
    const result = runCli({ cwd: projectDir, args: ['init'] })
    assert.equal(result.status, 0, result.stderr)
    const main = fs.readFileSync(
        path.join(projectDir, '.storybook', 'main.ts'),
        'utf8'
    )
    assert.match(main, /'@swarm\.ing\/pieui\/storybook\/addon\/preset'/)
    assert.match(
        main,
        /'\.\.\/piecomponents\/\*\*\/\*\.stories\.@\(js\|jsx\|mjs\|ts\|tsx\)'/
    )
})

// Verifies an empty addons array gets seeded with our entry.
test('patchStorybookMainAddons seeds an empty addons array', () => {
    const projectDir = makeProjectDir('pieui-step7-empty-')
    const mainPath = path.join(projectDir, '.storybook', 'main.ts')
    writeFile(
        mainPath,
        `const config = { stories: [], addons: [] };\nexport default config;\n`
    )
    const sb = requireFresh(STORYBOOK_INTEGRATION)
    assert.equal(sb.patchStorybookMainAddons(mainPath), true)
    const after = fs.readFileSync(mainPath, 'utf8')
    assert.match(
        after,
        /addons:\s*\['@swarm\.ing\/pieui\/storybook\/addon\/preset'\]/
    )
})

// Verifies absence of .storybook/main.* is handled silently.
test('findStorybookMainPath returns null when no storybook is configured', () => {
    const projectDir = makeProjectDir('pieui-step7-none-')
    const sb = requireFresh(STORYBOOK_INTEGRATION)
    assert.equal(sb.findStorybookMainPath(projectDir), null)
})

// Verifies `pieui init` patches an existing main.ts on the way.
test('pieui init wires the addon into an existing .storybook/main.ts', () => {
    const projectDir = makeProjectDir('pieui-step7-init-patches-')
    writeFile(
        path.join(projectDir, '.storybook', 'main.ts'),
        `const config = {
    stories: ['../src/**/*.stories.tsx'],
    addons: [
        '@storybook/addon-essentials',
    ],
};
export default config;
`
    )

    const result = runCli({ cwd: projectDir, args: ['init'] })
    assert.equal(
        result.status,
        0,
        `init failed:\n${result.stdout}\n${result.stderr}`
    )
    const main = fs.readFileSync(
        path.join(projectDir, '.storybook', 'main.ts'),
        'utf8'
    )
    assert.match(main, /'@swarm\.ing\/pieui\/storybook\/addon\/preset'/)
    assert.match(
        result.stdout,
        /Added '@swarm\.ing\/pieui\/storybook\/addon\/preset'/
    )
})

// Verifies `pieui init` is silent (no error) when no storybook is configured.
test('pieui init does not fail when no .storybook directory exists', () => {
    const projectDir = makeProjectDir('pieui-step7-init-no-storybook-')
    const result = runCli({ cwd: projectDir, args: ['init'] })
    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /Storybook addon already wired/)
    assert.doesNotMatch(
        result.stdout,
        /Added '@swarm\.ing\/pieui\/storybook\/addon\/preset'/
    )
})

// Verifies `pieui create` invokes the configured storybook init binary and wires the addon.
test('pieui create installs storybook + wires addon via PIEUI_STORYBOOK_INIT_BIN', () => {
    const projectDir = makeProjectDir('pieui-step7-create-sb-')
    const fakeBunPath = path.join(projectDir, 'fake-bun.sh')
    const fakeStorybookPath = path.join(projectDir, 'fake-storybook.sh')
    const sbLogPath = path.join(projectDir, 'sb.log')
    const bunLogPath = path.join(projectDir, 'bun.log')

    writeFile(
        fakeBunPath,
        `#!/bin/sh
set -eu
printf '%s\\n' "$*" >> "${bunLogPath}"
if [ "$1" = "create" ]; then
  APP_DIR="$PWD/$3"
  mkdir -p "$APP_DIR/app/_shared" "$APP_DIR/components" "$APP_DIR/public"
  cat > "$APP_DIR/package.json" <<'EOF'
{
  "name": "fake-next-app",
  "scripts": { "dev": "next dev", "build": "next build", "start": "next start" }
}
EOF
  cat > "$APP_DIR/app/page.tsx" <<'EOF'
export default function Page() { return <main>Hello</main> }
EOF
  cat > "$APP_DIR/app/_shared/simple.tsx" <<'EOF'
export default function Simple() { return null }
EOF
  cat > "$APP_DIR/components/ErrorToast.tsx" <<'EOF'
export const ErrorToast = () => null
EOF
  touch "$APP_DIR/app/piecache.json" "$APP_DIR/app/favicon.ico"
  exit 0
fi
if [ "$1" = "add" ]; then exit 0; fi
if [ "$1" = "run" ] && [ "\${2:-}" = "dev" ]; then exit 0; fi
echo "unexpected bun args: $*" >&2; exit 3
`
    )
    fs.chmodSync(fakeBunPath, 0o755)

    writeFile(
        fakeStorybookPath,
        `#!/bin/sh
set -eu
printf '%s\\n' "$*" > "${sbLogPath}"
mkdir -p .storybook
cat > .storybook/main.ts <<'EOF'
import type { StorybookConfig } from '@storybook/nextjs-vite'

const config: StorybookConfig = {
    stories: ['../src/**/*.stories.tsx'],
    addons: [
        '@storybook/addon-onboarding',
    ],
    framework: { name: '@storybook/nextjs-vite', options: {} },
}

export default config
EOF
exit 0
`
    )
    fs.chmodSync(fakeStorybookPath, 0o755)

    const result = runCli({
        cwd: projectDir,
        args: ['create', 'my-app'],
        env: {
            PIEUI_CREATE_BUN_BIN: fakeBunPath,
            PIEUI_STORYBOOK_INIT_BIN: fakeStorybookPath,
        },
    })
    assert.equal(
        result.status,
        0,
        `create failed:\n${result.stdout}\n${result.stderr}`
    )

    // Storybook fake binary was invoked.
    assert.ok(
        fs.existsSync(sbLogPath),
        'fake storybook should have been called'
    )
    // .storybook/main.ts inside the new app contains our addon.
    const main = fs.readFileSync(
        path.join(projectDir, 'my-app', '.storybook', 'main.ts'),
        'utf8'
    )
    assert.match(main, /'@swarm\.ing\/pieui\/storybook\/addon\/preset'/)
})

// Verifies the SKIP env var short-circuits Storybook setup.
test('pieui create respects PIEUI_CREATE_SKIP_STORYBOOK=1', () => {
    const projectDir = makeProjectDir('pieui-step7-create-skip-')
    const fakeBunPath = path.join(projectDir, 'fake-bun.sh')
    const fakeStorybookPath = path.join(projectDir, 'fake-storybook.sh')
    const sbLogPath = path.join(projectDir, 'sb.log')

    writeFile(
        fakeBunPath,
        `#!/bin/sh
set -eu
if [ "$1" = "create" ]; then
  APP_DIR="$PWD/$3"
  mkdir -p "$APP_DIR/app/_shared" "$APP_DIR/components" "$APP_DIR/public"
  cat > "$APP_DIR/package.json" <<'EOF'
{ "name": "fake-next-app", "scripts": { "dev": "next dev", "build": "next build", "start": "next start" } }
EOF
  cat > "$APP_DIR/app/page.tsx" <<'EOF'
export default function Page() { return <main>Hello</main> }
EOF
  cat > "$APP_DIR/app/_shared/simple.tsx" <<'EOF'
export default function Simple() { return null }
EOF
  cat > "$APP_DIR/components/ErrorToast.tsx" <<'EOF'
export const ErrorToast = () => null
EOF
  touch "$APP_DIR/app/piecache.json" "$APP_DIR/app/favicon.ico"
  exit 0
fi
if [ "$1" = "add" ]; then exit 0; fi
if [ "$1" = "run" ] && [ "\${2:-}" = "dev" ]; then exit 0; fi
echo "unexpected bun args: $*" >&2; exit 3
`
    )
    fs.chmodSync(fakeBunPath, 0o755)

    writeFile(
        fakeStorybookPath,
        `#!/bin/sh
echo "called" > "${sbLogPath}"
exit 0
`
    )
    fs.chmodSync(fakeStorybookPath, 0o755)

    const result = runCli({
        cwd: projectDir,
        args: ['create', 'skip-app'],
        env: {
            PIEUI_CREATE_BUN_BIN: fakeBunPath,
            PIEUI_STORYBOOK_INIT_BIN: fakeStorybookPath,
            PIEUI_CREATE_SKIP_STORYBOOK: '1',
        },
    })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(
        fs.existsSync(sbLogPath),
        false,
        'fake storybook should NOT have been called when PIEUI_CREATE_SKIP_STORYBOOK=1'
    )
})

// Verifies `pieui card add-story` does NOT add IO forwarding on a non-IO card.
// (Forwarding `useMittSupport` etc. would tunnel fields the data interface
// doesn't declare and break typechecking.)
test('card add-story leaves non-IO <PieCard> alone', () => {
    const projectDir = makeProjectDir('pieui-step7-fwd-simple-')
    runCli({ cwd: projectDir, args: ['init'] })
    runCli({
        cwd: projectDir,
        args: ['card', 'add', 'simple', 'SimpleFwd'],
    })

    const uiPath = path.join(
        projectDir,
        'piecomponents',
        'SimpleFwd',
        'ui',
        'SimpleFwd.tsx'
    )
    // Sanity: default scaffold does NOT forward useMittSupport.
    assert.doesNotMatch(fs.readFileSync(uiPath, 'utf8'), /useMittSupport=/)

    const result = runCli({
        cwd: projectDir,
        args: ['card', 'add-story', 'SimpleFwd'],
    })
    assert.equal(
        result.status,
        0,
        `add-story failed:\n${result.stdout}\n${result.stderr}`
    )

    const ui = fs.readFileSync(uiPath, 'utf8')
    // Non-IO: NONE of the IO forwarding attrs are added.
    assert.doesNotMatch(ui, /useMittSupport=/)
    assert.doesNotMatch(ui, /useSocketioSupport=/)
    assert.doesNotMatch(ui, /useCentrifugeSupport=/)
    assert.doesNotMatch(ui, /centrifugeChannel=/)

    // The story file also omits useMittSupport in args.data.
    const storyPath = path.join(
        projectDir,
        'piecomponents',
        'SimpleFwd',
        'SimpleFwd.stories.tsx'
    )
    assert.doesNotMatch(fs.readFileSync(storyPath, 'utf8'), /useMittSupport/)

    // Patcher is a no-op on non-IO cards whose <PieCard> already has `data`.
    const sb = requireFresh(
        path.join(repoRoot, 'src', 'code', 'patchPieCardForwarding')
    )
    const second = sb.patchPieCardForwarding(uiPath, { io: false })
    assert.equal(second.patched, false)
})

// Verifies `pieui card add-story` forwards the full IO quartet on an --io card.
test('card add-story forwards full IO quartet on an --io card', () => {
    const projectDir = makeProjectDir('pieui-step7-fwd-io-')
    runCli({ cwd: projectDir, args: ['init'] })
    runCli({
        cwd: projectDir,
        args: ['card', 'add', 'simple', 'IoFwd', '--io'],
    })

    const result = runCli({
        cwd: projectDir,
        args: ['card', 'add-story', 'IoFwd'],
    })
    assert.equal(result.status, 0, result.stderr)

    const ui = fs.readFileSync(
        path.join(projectDir, 'piecomponents', 'IoFwd', 'ui', 'IoFwd.tsx'),
        'utf8'
    )
    // IO template already forwards all four — patcher should be a no-op
    // and leave the file as-is.
    assert.match(ui, /useSocketioSupport=/)
    assert.match(ui, /useCentrifugeSupport=/)
    assert.match(ui, /useMittSupport=/)
    assert.match(ui, /centrifugeChannel=/)
})

// Verifies detectCardIsIO + patchPieCardForwarding direct API.
test('detectCardIsIO + patchPieCardForwarding work on a hand-crafted card', () => {
    const sb = requireFresh(
        path.join(repoRoot, 'src', 'code', 'patchPieCardForwarding')
    )
    const projectDir = makeProjectDir('pieui-step7-fwd-direct-')

    // Non-IO types
    const typesPath = path.join(
        projectDir,
        'piecomponents',
        'X',
        'types',
        'index.ts'
    )
    writeFile(
        typesPath,
        `export interface XData { name: string; title: string }\n`
    )
    assert.equal(sb.detectCardIsIO(typesPath), false)

    const uiPath = path.join(projectDir, 'piecomponents', 'X', 'ui', 'X.tsx')
    // Non-IO card with `data={data}` already present — patcher is a no-op.
    writeFile(
        uiPath,
        `import { PieCard } from '@swarm.ing/pieui'
export default function X({ data }: any) {
    return (
        <PieCard
            card='X'
            data={data}
        >
            <div />
        </PieCard>
    )
}
`
    )
    const r1 = sb.patchPieCardForwarding(uiPath, { io: false })
    assert.equal(r1.patched, false)
    const ui1 = fs.readFileSync(uiPath, 'utf8')
    assert.doesNotMatch(ui1, /useMittSupport=/)

    // Non-IO card missing `data` — patcher inserts it (and only it).
    const uiPathMissingData = path.join(
        projectDir,
        'piecomponents',
        'X2',
        'ui',
        'X2.tsx'
    )
    writeFile(
        uiPathMissingData,
        `import { PieCard } from '@swarm.ing/pieui'
export default function X2() {
    return (
        <PieCard card='X2'>
            <div />
        </PieCard>
    )
}
`
    )
    const r1b = sb.patchPieCardForwarding(uiPathMissingData, { io: false })
    assert.equal(r1b.patched, true)
    const ui1b = fs.readFileSync(uiPathMissingData, 'utf8')
    assert.match(ui1b, /data=\{data\}/)
    assert.doesNotMatch(ui1b, /useMittSupport=/)

    // IO types
    const ioTypesPath = path.join(
        projectDir,
        'piecomponents',
        'Y',
        'types',
        'index.ts'
    )
    writeFile(
        ioTypesPath,
        `export interface YData {
    name: string
    useMittSupport?: boolean
    useSocketioSupport?: boolean
    centrifugeChannel?: string
}
`
    )
    assert.equal(sb.detectCardIsIO(ioTypesPath), true)

    const ioUiPath = path.join(projectDir, 'piecomponents', 'Y', 'ui', 'Y.tsx')
    writeFile(
        ioUiPath,
        `import { PieCard } from '@swarm.ing/pieui'
export default function Y({ data }: any) {
    return (
        <PieCard card='Y' data={data}>
            <div />
        </PieCard>
    )
}
`
    )
    const r2 = sb.patchPieCardForwarding(ioUiPath, { io: true })
    assert.equal(r2.patched, true)
    const ui2 = fs.readFileSync(ioUiPath, 'utf8')
    assert.match(
        ui2,
        /useSocketioSupport=\{data\.useSocketioSupport \?\? false\}/
    )
    assert.match(
        ui2,
        /useCentrifugeSupport=\{data\.useCentrifugeSupport \?\? false\}/
    )
    assert.match(ui2, /useMittSupport=\{data\.useMittSupport \?\? false\}/)
    assert.match(ui2, /centrifugeChannel=\{data\.centrifugeChannel\}/)
})
