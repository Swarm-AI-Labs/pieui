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

const assertEventsInOutput = (stdout, events) => {
    for (const eventName of events) {
        const escaped = eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        assert.match(stdout, new RegExp(`\\n\\s*${escaped}\\s+│`))
    }
}

// Verifies init creates core scaffolding and updates common config files.
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
    assert.match(tailwind, /@swarm\.ing\/pieui\/dist\/\*\*\//)

    const nextConfig = fs.readFileSync(
        path.join(projectDir, 'next.config.ts'),
        'utf8'
    )
    assert.match(nextConfig, /PIE_API_SERVER/)
    assert.match(nextConfig, /PIE_ENABLE_RENDERING_LOG/)
    assert.match(nextConfig, /transpilePackages\s*:\s*\["@swarm\.ing\/pieui"\]/)
    assert.doesNotMatch(nextConfig, /PIE_PLATFORM/)
})

// Verifies add/remove create and clean component files plus registry wiring.
test('add and remove manage files and registry entry', () => {
    const projectDir = makeProjectDir('pieui-cli-add-remove-')

    assertSucceeded(
        runCli({ cwd: projectDir, args: ['init'] }),
        'init should succeed before add/remove'
    )

    const addResult = runCli({
        cwd: projectDir,
        args: ['card', 'add', 'simple', 'StatusCard'],
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

// Verifies card add can opt into IO and AJAX data fields in the generated type scaffold.
test('card add writes IO and AJAX fields when flags are provided', () => {
    const projectDir = makeProjectDir('pieui-cli-add-flags-')

    assertSucceeded(
        runCli({ cwd: projectDir, args: ['init'] }),
        'init should succeed before card add with flags'
    )

    const addResult = runCli({
        cwd: projectDir,
        args: ['card', 'add', 'simple', 'LiveCard', '--io', '--ajax'],
    })
    assertSucceeded(addResult, 'card add with flags should succeed')

    const typesFile = fs.readFileSync(
        path.join(projectDir, 'piecomponents', 'LiveCard', 'types', 'index.ts'),
        'utf8'
    )
    const uiFile = fs.readFileSync(
        path.join(projectDir, 'piecomponents', 'LiveCard', 'ui', 'LiveCard.tsx'),
        'utf8'
    )

    assert.match(typesFile, /useSocketioSupport\?: boolean/)
    assert.match(typesFile, /useCentrifugeSupport\?: boolean/)
    assert.match(typesFile, /useMittSupport\?: boolean/)
    assert.match(typesFile, /centrifugeChannel\?: string/)
    assert.match(typesFile, /pathname\?: string/)
    assert.match(typesFile, /depsNames: string\[\]/)
    assert.match(
        typesFile,
        /kwargs: Record<string, string \| number \| boolean>/
    )
    assert.match(uiFile, /useSocketioSupport=\{useSocketioSupport\}/)
    assert.match(uiFile, /useCentrifugeSupport=\{useCentrifugeSupport\}/)
    assert.match(uiFile, /useMittSupport=\{useMittSupport\}/)
    assert.match(uiFile, /centrifugeChannel=\{centrifugeChannel\}/)
    assert.match(uiFile, /methods=\{\{\s*\}\}/)
    assert.match(
        uiFile,
        /import \{ PieCard, useAjaxSubmit, type SetUiAjaxConfigurationType \} from '@swarm\.ing\/pieui'/
    )
    assert.match(uiFile, /const ajaxSubmit = useAjaxSubmit\(/)
    assert.match(uiFile, /setUiAjaxConfiguration,/)
    assert.match(uiFile, /kwargs,/)
    assert.match(uiFile, /depsNames,/)
    assert.match(uiFile, /pathname/)
})

// Verifies list command discovers components and applies simple filter output.
test('list prints components and supports type filter', () => {
    const projectDir = makeProjectDir('pieui-cli-list-')

    assertSucceeded(
        runCli({ cwd: projectDir, args: ['init'] }),
        'init should succeed'
    )
    assertSucceeded(
        runCli({
            cwd: projectDir,
            args: ['card', 'add', 'simple', 'SimpleCard'],
        }),
        'add simple should succeed'
    )
    assertSucceeded(
        runCli({
            cwd: projectDir,
            args: ['card', 'add', 'complex', 'ComplexCard'],
        }),
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

// Verifies list-events reads inline methods object from PieCard JSX.
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

// Verifies list-events resolves methods provided via useMemo variable.
test('list-events resolves methods from useMemo variable', () => {
    const projectDir = makeProjectDir('pieui-cli-list-events-usememo-')

    writeFile(
        path.join(projectDir, 'src', 'Screen.tsx'),
        `import { useMemo } from 'react'

export const Screen = () => {
  const methods = useMemo(
    () => ({
      update: (payload) => payload,
      reload(event) {
        return event
      },
    }),
    []
  )

  return <PieCard card="IOEventsCard" methods={methods} />
}
`
    )

    const result = runCli({
        cwd: projectDir,
        args: ['list-events', 'IOEventsCard', '--src-dir', 'src'],
    })

    assertSucceeded(
        result,
        'list-events should support useMemo methods variable'
    )
    assert.match(result.stdout, /update/)
    assert.match(result.stdout, /reload/)
})

// Verifies list-events supports property, shorthand, and method declaration keys.
test('list-events handles identifier methods with property, shorthand, and method declaration', () => {
    const projectDir = makeProjectDir('pieui-cli-list-events-shapes-')

    writeFile(
        path.join(projectDir, 'src', 'Screen.tsx'),
        `const ping = (payload) => payload

export const Screen = () => {
  const methods = {
    update: (payload) => payload,
    ping,
    reload() {
      return true
    },
  }

  return (
    <PieCard card={'ShapeCard'} methods={methods}>
      <div />
    </PieCard>
  )
}
`
    )

    const result = runCli({
        cwd: projectDir,
        args: ['list-events', 'ShapeCard', '--src-dir', 'src'],
    })

    assertSucceeded(
        result,
        'list-events should support mixed object-property method syntaxes'
    )
    assertEventsInOutput(result.stdout, ['update', 'ping', 'reload'])
    assert.match(result.stdout, /\[pieui\] Total: 3/)
})

// Verifies list-events returns expected methods for built-in cards in repo source.
test('list-events covers built-in component methods in repository source', () => {
    const cases = [
        { component: 'AjaxGroupCard', events: ['changeContent'], total: 1 },
        {
            component: 'HTMLEmbedCard',
            events: ['update', 'generateUsingAI', 'initializeAI'],
            total: 3,
        },
        {
            component: 'IOEventsCard',
            events: ['alert', 'log', 'push', 'redirect', 'reload'],
            total: 5,
        },
        {
            component: 'CloudStorageCard',
            events: ['update', 'remove'],
            total: 2,
        },
        {
            component: 'DeviceStorageCard',
            events: ['update', 'remove'],
            total: 2,
        },
        {
            component: 'SecureStorageCard',
            events: ['update', 'remove'],
            total: 2,
        },
        {
            component: 'SessionStorageCard',
            events: ['update', 'remove'],
            total: 2,
        },
        { component: 'HiddenCard', events: ['update'], total: 1 },
    ]

    for (const testCase of cases) {
        const result = runCli({
            cwd: repoRoot,
            args: ['list-events', testCase.component, '--src-dir', './src'],
        })

        assertSucceeded(
            result,
            `list-events should succeed for built-in component ${testCase.component}`
        )
        assertEventsInOutput(result.stdout, testCase.events)
        assert.match(
            result.stdout,
            new RegExp(`\\[pieui\\] Total: ${testCase.total}`)
        )
    }
}, 20000)

// Verifies add-event appends a new handler and validates invalid event keys.
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

// Verifies add-event can insert into an empty inline methods object.
test('add-event inserts into empty inline methods object', () => {
    const projectDir = makeProjectDir('pieui-cli-add-event-empty-methods-')
    const targetFile = path.join(projectDir, 'src', 'Screen.tsx')

    writeFile(
        targetFile,
        `export const Screen = () => (
  <PieCard
    card="AlertsCard"
    methods={{}}
  />
)
`
    )

    const result = runCli({
        cwd: projectDir,
        args: ['add-event', 'AlertsCard', 'create', '--src-dir', 'src'],
    })
    assertSucceeded(result, 'add-event should support empty methods object')

    const updated = fs.readFileSync(targetFile, 'utf8')
    assert.match(updated, /methods=\{\{\s*create:\s*\(payload: any\) => \{/s)
})

// Verifies postbuild writes an empty manifest when no components are found.
test('postbuild without components still writes empty manifest', () => {
    const projectDir = makeProjectDir('pieui-cli-postbuild-empty-')
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true })

    const result = runCli({
        cwd: projectDir,
        args: ['postbuild', '--src-dir', 'src', '--out-dir', 'public'],
    })
    assertSucceeded(result, 'postbuild should succeed when no components found')

    const manifestPath = path.join(
        projectDir,
        'public',
        'pieui.components.json'
    )
    assert.ok(fs.existsSync(manifestPath), 'manifest file should be created')

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    assert.deepEqual(manifest, [])
})
// Verifies init out-dir mode is idempotent and avoids duplicate tailwind entries.
test('init supports --out-dir and does not duplicate tailwind content path', () => {
    const projectDir = makeProjectDir('pieui-cli-init-outdir-')
    const appDir = path.join(projectDir, 'apps', 'web')

    writeFile(
        path.join(appDir, 'tailwind.config.js'),
        `module.exports = {\n  content: ['./src/**/*.{js,ts,jsx,tsx}'],\n}\n`
    )

    assertSucceeded(
        runCli({
            cwd: projectDir,
            args: ['init', '--out-dir', 'apps/web'],
        }),
        'init with --out-dir should succeed'
    )

    assertSucceeded(
        runCli({
            cwd: projectDir,
            args: ['init', '--out-dir', 'apps/web'],
        }),
        'second init should be idempotent'
    )

    const registryPath = path.join(appDir, 'piecomponents', 'registry.ts')
    assert.ok(fs.existsSync(registryPath))

    const tailwind = fs.readFileSync(
        path.join(appDir, 'tailwind.config.js'),
        'utf8'
    )
    const matchCount = (tailwind.match(/@swarm\.ing\/pieui\/dist\/\*\*\//g) || [])
        .length
    assert.equal(matchCount, 1)
})

// Verifies add defaults to complex-container when type argument is omitted.
test('add without explicit type defaults to complex-container templates', () => {
    const projectDir = makeProjectDir('pieui-cli-add-default-type-')
    assertSucceeded(
        runCli({ cwd: projectDir, args: ['init'] }),
        'init should succeed'
    )

    assertSucceeded(
        runCli({ cwd: projectDir, args: ['card', 'add', 'OrdersCard'] }),
        'add should succeed with implicit type'
    )

    const typesFile = fs.readFileSync(
        path.join(
            projectDir,
            'piecomponents',
            'OrdersCard',
            'types',
            'index.ts'
        ),
        'utf8'
    )
    assert.match(typesFile, /PieComplexContainerComponentProps/)

    const uiFile = fs.readFileSync(
        path.join(
            projectDir,
            'piecomponents',
            'OrdersCard',
            'ui',
            'OrdersCard.tsx'
        ),
        'utf8'
    )
    assert.match(uiFile, /content,\n\s*setUiAjaxConfiguration/)
})

// Verifies add rejects component names that violate naming rules.
test('add rejects invalid component names', () => {
    const projectDir = makeProjectDir('pieui-cli-add-invalid-name-')
    assertSucceeded(
        runCli({ cwd: projectDir, args: ['init'] }),
        'init should succeed'
    )

    const result = runCli({
        cwd: projectDir,
        args: ['card', 'add', 'simple', 'invalidName'],
    })

    assert.equal(result.status, 1)
    assert.match(
        result.stderr,
        /Component name must start with uppercase letter/
    )
})

// Verifies add fails for duplicates and does not duplicate registry imports.
test('add fails when component already exists', () => {
    const projectDir = makeProjectDir('pieui-cli-add-duplicate-')
    assertSucceeded(
        runCli({ cwd: projectDir, args: ['init'] }),
        'init should succeed'
    )
    assertSucceeded(
        runCli({
            cwd: projectDir,
            args: ['card', 'add', 'simple', 'AlphaCard'],
        }),
        'first add should succeed'
    )

    const duplicate = runCli({
        cwd: projectDir,
        args: ['card', 'add', 'simple', 'AlphaCard'],
    })

    assert.equal(duplicate.status, 1)
    assert.match(duplicate.stderr, /already exists/)

    const registry = fs.readFileSync(
        path.join(projectDir, 'piecomponents', 'registry.ts'),
        'utf8'
    )
    const importCount = (registry.match(/piecomponents\/AlphaCard/g) || [])
        .length
    assert.equal(importCount, 1)
})

// Verifies remove warns (but succeeds) when target component directory is absent.
test('remove missing component warns but succeeds when piecomponents exists', () => {
    const projectDir = makeProjectDir('pieui-cli-remove-missing-')
    assertSucceeded(
        runCli({ cwd: projectDir, args: ['init'] }),
        'init should succeed'
    )

    const result = runCli({
        cwd: projectDir,
        args: ['remove', 'GhostCard'],
    })

    assertSucceeded(
        result,
        'remove should succeed even if component is missing'
    )
    assert.match(result.stdout, /Warning: Component directory/)
})

// Verifies list falls back to all components for unknown filter values.
test('list with invalid filter falls back to all', () => {
    const projectDir = makeProjectDir('pieui-cli-list-invalid-filter-')
    assertSucceeded(
        runCli({ cwd: projectDir, args: ['init'] }),
        'init should succeed'
    )
    assertSucceeded(
        runCli({
            cwd: projectDir,
            args: ['card', 'add', 'simple', 'OneCard'],
        }),
        'add should succeed'
    )

    const listResult = runCli({
        cwd: projectDir,
        args: ['list', 'not-a-filter'],
    })

    assertSucceeded(listResult, 'list should succeed with invalid filter input')
    assert.match(listResult.stdout, /OneCard/)
    assert.doesNotMatch(listResult.stdout, /filtered by:/)
})

// Verifies list-events reports no methods for non-matching component names.
test('list-events returns no methods for unknown component', () => {
    const projectDir = makeProjectDir('pieui-cli-list-events-empty-')

    writeFile(
        path.join(projectDir, 'src', 'Screen.tsx'),
        `export const Screen = () => <PieCard card="KnownCard" methods={{ ping: () => true }} />\n`
    )

    const result = runCli({
        cwd: projectDir,
        args: ['list-events', 'UnknownCard', '--src-dir=src'],
    })

    assertSucceeded(
        result,
        'list-events should succeed for unknown component name'
    )
    assert.match(result.stdout, /No methods found for: UnknownCard/)
})

// Verifies add-event fails when methods is not an inline object literal.
test('add-event fails if target PieCard with inline methods object is missing', () => {
    const projectDir = makeProjectDir('pieui-cli-add-event-not-found-')

    writeFile(
        path.join(projectDir, 'src', 'Screen.tsx'),
        `const methods = { ping: () => true }\nexport const Screen = () => <PieCard card="AlertsCard" methods={methods} />\n`
    )

    const result = runCli({
        cwd: projectDir,
        args: ['add-event', 'AlertsCard', 'create', '-s', 'src'],
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /supports only inline object literals/)
})

// Verifies postbuild emits schema for a discovered registered component.
test('postbuild generates manifest entry for discovered component', () => {
    const projectDir = makeProjectDir('pieui-cli-postbuild-entry-')

    writeFile(
        path.join(projectDir, 'src', 'InvoiceCard.tsx'),
        `import { registerPieComponent } from '@swarm.ing/pieui'\n\nexport interface InvoiceCardData {\n  name: string\n  total: number\n}\n\nconst InvoiceCard = (_props: { data: InvoiceCardData }) => null\n\nregisterPieComponent({\n  name: 'InvoiceCard',\n  component: InvoiceCard,\n})\n`
    )

    const result = runCli({
        cwd: projectDir,
        args: ['postbuild', '-s', 'src', '-o', 'build'],
    })
    assertSucceeded(result, 'postbuild should succeed for discovered component')

    const manifestPath = path.join(projectDir, 'build', 'pieui.components.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

    assert.ok(Array.isArray(manifest))
    assert.equal(manifest.length, 1)
    assert.equal(manifest[0].card, 'InvoiceCard')
    assert.equal(manifest[0].data.type, 'object')
    assert.equal(manifest[0].data.properties.name.type, 'string')
    assert.equal(manifest[0].data.properties.total.type, 'number')
})

// Verifies postbuild schema patching for sx/kwargs/meta special cases.
test('postbuild applies schema overrides for sx/kwargs/meta', () => {
    const projectDir = makeProjectDir('pieui-postbuild-overrides-')
    const srcDir = path.join(projectDir, 'src')
    const outDir = path.join(projectDir, 'out')

    writeFile(
        path.join(projectDir, 'node_modules', '@types', 'react', 'index.d.ts'),
        `declare module 'react' {
    export interface CSSProperties {
        color?: string
        width?: string | number
    }
}
`
    )

    writeFile(
        path.join(srcDir, 'TestCard.tsx'),
        `import { CSSProperties } from 'react'

export interface TestCardData {
    name: string
    sx?: CSSProperties
    kwargs?: Record<string, string>
    meta?: Record<string, any>
}

const TestCard = ({ data }: { data: TestCardData }) => null

const registerPieComponent = (_: any) => undefined

registerPieComponent({
    name: 'TestCard',
    component: TestCard,
})
`
    )

    const result = runCli({
        cwd: projectDir,
        args: ['postbuild', '--src-dir', 'src', '--out-dir', outDir],
    })
    assertSucceeded(result, 'postbuild should succeed for schema override case')

    const manifestPath = path.join(outDir, 'pieui.components.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const entry = manifest.find((item) => item.card === 'TestCard')

    assert.ok(entry)
    const schema = entry.data
    const sxSchema = schema.properties?.sx
    const kwargsSchema = schema.properties?.kwargs
    const metaSchema = schema.properties?.meta

    assert.equal(sxSchema?.type, 'object')
    assert.deepEqual(sxSchema?.additionalProperties, {})
    assert.equal(sxSchema?.properties, undefined)

    assert.equal(kwargsSchema?.type, 'object')
    assert.deepEqual(kwargsSchema?.additionalProperties, { type: 'string' })

    assert.equal(metaSchema?.type, 'object')
    assert.ok(metaSchema?.additionalProperties)
    assert.notEqual(metaSchema?.additionalProperties, false)
})

// Verifies create-pie-app shells out to Bun create, rewrites Next scripts for Bun runtime, and writes backend-link TODO.
test('create-pie-app scaffolds blank app template with Bun-backed next scripts', () => {
    const projectDir = makeProjectDir('pieui-cli-create-template-')
    const fakeBunPath = path.join(projectDir, 'fake-bun.sh')
    const logPath = path.join(projectDir, 'bun-create.log')
    const sharedSourceDir = path.join(projectDir, 'ai-exchange-bot', '_shared')

    writeFile(
        path.join(sharedSourceDir, 'config.ts'),
        'export const marker = "shared"\n'
    )
    writeFile(path.join(sharedSourceDir, 'ui', 'index.ts'), 'export {}\n')

    writeFile(
        fakeBunPath,
        `#!/bin/sh
set -eu
printf '%s\\n' "$*" > "${logPath}"
if [ "$#" -lt 4 ]; then
  echo "missing args" >&2
  exit 2
fi
APP_DIR="$PWD/$3"
mkdir -p "$APP_DIR/app"
cat > "$APP_DIR/package.json" <<'EOF'
{
  "name": "fake-next-app",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
EOF
cat > "$APP_DIR/app/page.tsx" <<'EOF'
export default function Page() {
  return <main>Hello</main>
}
EOF
`
    )
    fs.chmodSync(fakeBunPath, 0o755)

    const result = runCli({
        cwd: projectDir,
        args: ['create-pie-app', 'my-pie-app'],
        env: {
            PIEUI_CREATE_BUN_BIN: fakeBunPath,
            PIEUI_SHARED_TEMPLATE_DIR: sharedSourceDir,
        },
    })
    assertSucceeded(
        result,
        'create-pie-app should succeed with fake bun runtime'
    )

    const commandArgs = fs.readFileSync(logPath, 'utf8')
    assert.match(commandArgs, /^create next-app@latest my-pie-app --yes/m)

    const appPackage = JSON.parse(
        fs.readFileSync(
            path.join(projectDir, 'my-pie-app', 'package.json'),
            'utf8'
        )
    )
    assert.equal(appPackage.scripts.dev, 'bun --bun next dev')
    assert.equal(appPackage.scripts.build, 'bun --bun next build')
    assert.equal(appPackage.scripts.start, 'bun --bun next start')

    const pageTsx = fs.readFileSync(
        path.join(projectDir, 'my-pie-app', 'app', 'page.tsx'),
        'utf8'
    )
    assert.match(
        pageTsx,
        /TODO\(pie-backend\): Link generated Python Unicorn backend routes here/
    )

    const copiedShared = path.join(projectDir, 'my-pie-app', '_shared')
    assert.ok(fs.existsSync(path.join(copiedShared, 'config.ts')))
    assert.ok(fs.existsSync(path.join(copiedShared, 'ui', 'index.ts')))
})

// Verifies create shells out to Bun create and initializes piecomponents in the new app.
test('create scaffolds next app and runs pieui init in the new app directory', () => {
    const projectDir = makeProjectDir('pieui-cli-create-app-')
    const fakeBunPath = path.join(projectDir, 'fake-bun.sh')
    const logPath = path.join(projectDir, 'bun-create.log')

    writeFile(
        fakeBunPath,
        `#!/bin/sh
set -eu
printf '%s\\n' "$*" > "${logPath}"
if [ "$#" -lt 4 ]; then
  echo "missing args" >&2
  exit 2
fi
APP_DIR="$PWD/$3"
mkdir -p "$APP_DIR"
cat > "$APP_DIR/package.json" <<'EOF'
{
  "name": "fake-next-app"
}
EOF
mkdir -p "$APP_DIR/public"
cat > "$APP_DIR/public/keep.txt" <<'EOF'
remove me
EOF
cat > "$APP_DIR/next.config.ts" <<'EOF'
const nextConfig = {}

export default nextConfig
EOF
cat > "$APP_DIR/tailwind.config.js" <<'EOF'
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
EOF
`
    )
    fs.chmodSync(fakeBunPath, 0o755)

    const result = runCli({
        cwd: projectDir,
        args: ['create', 'my-app-name'],
        env: {
            PIEUI_CREATE_BUN_BIN: fakeBunPath,
        },
    })
    assertSucceeded(result, 'create should succeed with fake bun runtime')

    const commandArgs = fs.readFileSync(logPath, 'utf8')
    assert.match(commandArgs, /^create next-app@latest my-app-name --yes/m)

    const registryPath = path.join(
        projectDir,
        'my-app-name',
        'piecomponents',
        'registry.ts'
    )
    assert.ok(fs.existsSync(registryPath), 'registry.ts should be created')

    const publicDir = path.join(projectDir, 'my-app-name', 'public')
    assert.deepEqual(fs.readdirSync(publicDir), [])

    const sharedPagePath = path.join(
        projectDir,
        'my-app-name',
        'app',
        '_shared',
        'page.tsx'
    )
    const sharedPage = fs.readFileSync(sharedPagePath, 'utf8')
    assert.match(sharedPage, /import \{ PieRoot \} from "@swarm\.ing\/pieui";/)
    assert.match(sharedPage, /fallback=\{<><\/>\}/)
    assert.equal(
        fs.existsSync(
            path.join(projectDir, 'my-app-name', 'app', '_shared', 'simple.tsx')
        ),
        false
    )
    assert.equal(
        fs.existsSync(
            path.join(projectDir, 'my-app-name', 'app', 'piecache.json')
        ),
        false
    )
    assert.ok(
        fs.existsSync(
            path.join(
                projectDir,
                'my-app-name',
                'components',
                'LoadingScreen.tsx'
            )
        )
    )
    assert.equal(
        fs.existsSync(
            path.join(
                projectDir,
                'my-app-name',
                'components',
                'ErrorToast.tsx'
            )
        ),
        false
    )

    const homePage = fs.readFileSync(
        path.join(projectDir, 'my-app-name', 'app', 'page.tsx'),
        'utf8'
    )
    assert.match(homePage, /import PiePage from "@\/app\/_shared\/page";/)
    assert.match(homePage, /<Suspense fallback=\{<><\/>\}>/)

    const envFile = fs.readFileSync(
        path.join(projectDir, 'my-app-name', '.env'),
        'utf8'
    )
    assert.equal(
        envFile,
        `PIE_ENABLE_RENDERING_LOG=true
PIE_API_SERVER=http://localhost:8008/
PIE_CENTRIFUGE_SERVER=wss://localhost:8000/connection/websocket

NEXT_PUBLIC_PIE_ENABLE_RENDERING_LOG=true
NEXT_PUBLIC_PIE_API_SERVER=http://localhost:8008/
NEXT_PUBLIC_PIE_CENTRIFUGE_SERVER=wss://localhost:8000/connection/websocket
`
    )
})

// Verifies page add creates app/<path>/page.tsx and derives the component name from the route path.
test('page add creates nested app page scaffold', () => {
    const projectDir = makeProjectDir('pieui-cli-page-add-')

    const result = runCli({
        cwd: projectDir,
        args: ['page', 'add', 'alpha/beta'],
    })
    assertSucceeded(result, 'page add should succeed')

    const pagePath = path.join(projectDir, 'app', 'alpha', 'beta', 'page.tsx')
    assert.ok(fs.existsSync(pagePath), 'page.tsx should be created')

    const page = fs.readFileSync(pagePath, 'utf8')
    assert.equal(
        page,
        `"use client";

import PiePage from "@/app/_shared/page";
import { Suspense } from "react";

export default function AlphaBetaPage() {
  return (
    <Suspense fallback={<></>}>
      <PiePage />
    </Suspense>
  );
}
`
    )
})
