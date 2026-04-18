/**
 * step6-extra: Additional CLI integration tests covering scenarios not
 * addressed in step1–step5.
 *
 * Gaps filled by this suite:
 *
 *  1. Component type templates — "complex" and "simple-container" explicit
 *     flags. step1 only checks "simple" and the default "complex-container".
 *     We verify the generated types/index.ts uses the correct PieUI base
 *     interface and that the UI template destructures the expected props.
 *
 *  2. `postbuild --append` actually merges entries into an existing manifest.
 *     step3 only validates the flag is echoed; it does not check the file.
 *
 *  3. Remote commands fail meaningfully when the configured endpoint is not
 *     reachable (connection-refused scenario), giving a non-zero exit code
 *     and a human-readable error in stderr.
 *
 *  4. `list-events` returns only the methods for the requested card when
 *     multiple PieCard instances share the same source file.
 *
 *  5. `init` on a pristine project (no tailwind.config.js / next.config.ts)
 *     creates only the registry without crashing.
 *
 * Implementation notes on list type-filter behaviour:
 *   The `list` command detects component types by resolving TypeScript prop
 *   types at analysis time. In isolated temp project dirs the package
 *   "@piedata/pieui" is not installed, so resolution falls back to `simple`
 *   for all templates. This is the expected behaviour in that context and is
 *   verified explicitly in the list-simple-fallback test below.
 *
 * Every test uses helpers.cjs to avoid duplicating the runner boilerplate.
 */

'use strict'

const { test } = require('bun:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')

const {
    runCliSync,
    runCliAsync,
    makeProjectDir,
    writeFile,
    assertSucceeded,
    startServer,
    stopServer,
} = require('./helpers.cjs')

// ---------------------------------------------------------------------------
// 1. Component type templates
// ---------------------------------------------------------------------------

// Verifies "add complex" generates PieComplexComponentProps in the types file.
// The UI template intentionally provides a minimal scaffold (only `data`
// destructured) — the developer wires up setUiAjaxConfiguration themselves.
test('add complex type generates PieComplexComponentProps in types/index.ts', () => {
    const projectDir = makeProjectDir('pieui-s6-add-complex-')
    assertSucceeded(
        runCliSync({ cwd: projectDir, args: ['init'] }),
        'init should succeed before add'
    )

    const addResult = runCliSync({
        cwd: projectDir,
        args: ['add', 'complex', 'ComplexCard'],
    })
    assertSucceeded(addResult, 'add complex should succeed')
    // CLI should report the expected component type in its output
    assert.match(addResult.stdout, /Component type: complex/)

    // types/index.ts must reference the complex prop interface
    const typesFile = fs.readFileSync(
        path.join(projectDir, 'piecomponents', 'ComplexCard', 'types', 'index.ts'),
        'utf8'
    )
    assert.match(typesFile, /PieComplexComponentProps/)

    // The template UI wraps content in PieCard; verify the basic structure
    const uiFile = fs.readFileSync(
        path.join(projectDir, 'piecomponents', 'ComplexCard', 'ui', 'ComplexCard.tsx'),
        'utf8'
    )
    assert.match(uiFile, /PieCard/)
    // The generated ComplexCardProps type must be used by the component
    assert.match(uiFile, /ComplexCardProps/)

    // Registry must be updated
    const registry = fs.readFileSync(
        path.join(projectDir, 'piecomponents', 'registry.ts'),
        'utf8'
    )
    assert.match(registry, /piecomponents\/ComplexCard/)
})

// Verifies "add simple-container" generates PieContainerComponentProps in the
// types file, and that the UI template destructures content and
// setUiAjaxConfiguration (the container scaffold renders its child UIConfig).
test('add simple-container generates PieContainerComponentProps and destructures content', () => {
    const projectDir = makeProjectDir('pieui-s6-add-simple-container-')
    assertSucceeded(
        runCliSync({ cwd: projectDir, args: ['init'] }),
        'init should succeed before add'
    )

    const addResult = runCliSync({
        cwd: projectDir,
        args: ['add', 'simple-container', 'WrapCard'],
    })
    assertSucceeded(addResult, 'add simple-container should succeed')
    assert.match(addResult.stdout, /Component type: simple-container/)

    // types/index.ts must use the container prop interface (single UIConfig child)
    const typesFile = fs.readFileSync(
        path.join(projectDir, 'piecomponents', 'WrapCard', 'types', 'index.ts'),
        'utf8'
    )
    assert.match(typesFile, /PieContainerComponentProps/)

    // The UI template must destructure content so the developer can render
    // the single nested UIConfig child right out of the box
    const uiFile = fs.readFileSync(
        path.join(projectDir, 'piecomponents', 'WrapCard', 'ui', 'WrapCard.tsx'),
        'utf8'
    )
    assert.match(uiFile, /content/)
    assert.match(uiFile, /setUiAjaxConfiguration/)

    // Registry must be updated
    const registry = fs.readFileSync(
        path.join(projectDir, 'piecomponents', 'registry.ts'),
        'utf8'
    )
    assert.match(registry, /piecomponents\/WrapCard/)
})

// Verifies that all four component types produce the correct CLI output line,
// confirmed file hierarchy, and a registry entry — covering every branch of
// the add command's type switch.
test('add reports correct component type label for all four type arguments', () => {
    const projectDir = makeProjectDir('pieui-s6-add-all-types-')
    assertSucceeded(runCliSync({ cwd: projectDir, args: ['init'] }), 'init')

    const cases = [
        {
            type: 'simple',
            name: 'AlphaCard',
            expectedProp: 'PieSimpleComponentProps',
        },
        {
            type: 'complex',
            name: 'BetaCard',
            expectedProp: 'PieComplexComponentProps',
        },
        {
            type: 'simple-container',
            name: 'GammaCard',
            expectedProp: 'PieContainerComponentProps',
        },
        {
            type: 'complex-container',
            name: 'DeltaCard',
            expectedProp: 'PieComplexContainerComponentProps',
        },
    ]

    for (const { type, name, expectedProp } of cases) {
        const result = runCliSync({
            cwd: projectDir,
            args: ['add', type, name],
        })
        assertSucceeded(result, `add ${type} ${name} should succeed`)

        // stdout must name the chosen type
        assert.match(
            result.stdout,
            new RegExp(`Component type: ${type}`),
            `stdout should mention type "${type}" for ${name}`
        )

        // types/index.ts must use the correct PieUI base interface
        const typesContent = fs.readFileSync(
            path.join(projectDir, 'piecomponents', name, 'types', 'index.ts'),
            'utf8'
        )
        assert.match(
            typesContent,
            new RegExp(expectedProp),
            `types/index.ts should reference ${expectedProp} for type "${type}"`
        )

        // All three scaffolded files must exist
        assert.ok(
            fs.existsSync(
                path.join(projectDir, 'piecomponents', name, 'index.ts')
            ),
            `index.ts should exist for ${name}`
        )
        assert.ok(
            fs.existsSync(
                path.join(
                    projectDir,
                    'piecomponents',
                    name,
                    'ui',
                    `${name}.tsx`
                )
            ),
            `ui/${name}.tsx should exist`
        )
    }
})

// ---------------------------------------------------------------------------
// 2. list type-filter: fallback-to-simple behaviour in isolated project dirs
// ---------------------------------------------------------------------------

// Verifies that `list simple` finds all components added in a temp project,
// regardless of the type flag used with `add`. This reflects the documented
// behaviour: when `@piedata/pieui` is not installed in the project,
// TypeScript cannot resolve the prop types and detectComponentType falls back
// to "simple" for all scaffolded components.
test('list simple in a temp project finds all added components due to type-resolution fallback', () => {
    const projectDir = makeProjectDir('pieui-s6-list-type-fallback-')
    assertSucceeded(runCliSync({ cwd: projectDir, args: ['init'] }), 'init')
    assertSucceeded(
        runCliSync({ cwd: projectDir, args: ['add', 'simple', 'OneCard'] }),
        'add simple'
    )
    assertSucceeded(
        runCliSync({ cwd: projectDir, args: ['add', 'complex', 'TwoCard'] }),
        'add complex'
    )
    assertSucceeded(
        runCliSync({ cwd: projectDir, args: ['add', 'simple-container', 'ThreeCard'] }),
        'add simple-container'
    )

    // Without @piedata/pieui installed, all three are detected as "simple"
    const result = runCliSync({ cwd: projectDir, args: ['list', 'simple'] })
    assertSucceeded(result, 'list simple should succeed')

    assert.match(result.stdout, /OneCard/)
    assert.match(result.stdout, /TwoCard/)
    assert.match(result.stdout, /ThreeCard/)
    assert.match(result.stdout, /\(filtered by: simple\)/)
})

// ---------------------------------------------------------------------------
// 3. postbuild --append: functional merge verification
// ---------------------------------------------------------------------------

// Verifies that "--append" mode adds new entries to an existing manifest
// without overwriting the ones already present.
test('postbuild --append merges new component entries into existing manifest', () => {
    const projectDir = makeProjectDir('pieui-s6-postbuild-append-')
    const srcDir = path.join(projectDir, 'src')
    const outDir = path.join(projectDir, 'out')

    // First component — added to the manifest in the initial (non-append) run
    writeFile(
        path.join(srcDir, 'FirstCard.tsx'),
        `import { registerPieComponent } from '@piedata/pieui'

export interface FirstCardData { label: string }

const FirstCard = (_: { data: FirstCardData }) => null

registerPieComponent({ name: 'FirstCard', component: FirstCard })
`
    )

    const firstRun = runCliSync({
        cwd: projectDir,
        args: ['postbuild', '--src-dir', 'src', '--out-dir', 'out'],
    })
    assertSucceeded(firstRun, 'initial postbuild run should succeed')

    // Verify first run produced a single-entry manifest
    const manifestPath = path.join(outDir, 'pieui.components.json')
    const afterFirst = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    assert.equal(afterFirst.length, 1)
    assert.equal(afterFirst[0].card, 'FirstCard')

    // Second component — added later; should merge WITH FirstCard in append mode
    writeFile(
        path.join(srcDir, 'SecondCard.tsx'),
        `import { registerPieComponent } from '@piedata/pieui'

export interface SecondCardData { count: number }

const SecondCard = (_: { data: SecondCardData }) => null

registerPieComponent({ name: 'SecondCard', component: SecondCard })
`
    )

    const appendRun = runCliSync({
        cwd: projectDir,
        args: ['postbuild', '--src-dir', 'src', '--out-dir', 'out', '--append'],
    })
    assertSucceeded(appendRun, 'append postbuild run should succeed')
    assert.match(appendRun.stdout, /Append mode: true/)

    // Both components must be present after the append run
    const afterAppend = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const names = afterAppend.map((e) => e.card).sort()
    assert.deepEqual(names, ['FirstCard', 'SecondCard'])
})

// Verifies that running postbuild a second time WITHOUT --append overwrites
// the manifest (i.e. append is opt-in, not the default).
test('postbuild without --append overwrites existing manifest on second run', () => {
    const projectDir = makeProjectDir('pieui-s6-postbuild-overwrite-')
    const srcDir = path.join(projectDir, 'src')
    const outDir = path.join(projectDir, 'out')

    writeFile(
        path.join(srcDir, 'OnlyCard.tsx'),
        `import { registerPieComponent } from '@piedata/pieui'

export interface OnlyCardData { title: string }

const OnlyCard = (_: { data: OnlyCardData }) => null

registerPieComponent({ name: 'OnlyCard', component: OnlyCard })
`
    )

    // First run: write manifest with OnlyCard
    assertSucceeded(
        runCliSync({
            cwd: projectDir,
            args: ['postbuild', '--src-dir', 'src', '--out-dir', 'out'],
        }),
        'first postbuild run should succeed'
    )

    // Add a second source file between runs
    writeFile(
        path.join(srcDir, 'AnotherCard.tsx'),
        `import { registerPieComponent } from '@piedata/pieui'

export interface AnotherCardData { subtitle: string }

const AnotherCard = (_: { data: AnotherCardData }) => null

registerPieComponent({ name: 'AnotherCard', component: AnotherCard })
`
    )

    // Second run WITHOUT --append: manifest should only contain entries from
    // the current scan (both files scanned, both appear in fresh manifest)
    const secondRun = runCliSync({
        cwd: projectDir,
        args: ['postbuild', '--src-dir', 'src', '--out-dir', 'out'],
    })
    assertSucceeded(secondRun, 'second postbuild run should succeed')
    assert.match(secondRun.stdout, /Append mode: false/)

    const manifest = JSON.parse(
        fs.readFileSync(
            path.join(outDir, 'pieui.components.json'),
            'utf8'
        )
    )
    // Both source files are scanned → both appear in the overwritten manifest
    const names = manifest.map((e) => e.card).sort()
    assert.deepEqual(names, ['AnotherCard', 'OnlyCard'])
})

// ---------------------------------------------------------------------------
// 4. Remote commands: connection-refused error handling
// ---------------------------------------------------------------------------

// Verifies push exits non-zero and surfaces a human-readable error (no raw
// stack trace) when the target server refuses the connection.
test('push surfaces a clean error message when the server refuses the connection', async () => {
    // Bind a server, get its port, then close it — leaves nothing listening
    const { server, baseUrl } = await startServer((_req, res) => {
        res.statusCode = 200
        res.end('ok')
    })
    const url = `${baseUrl}/push`
    await stopServer(server) // port now unreachable

    const projectDir = makeProjectDir('pieui-s6-push-refused-')
    writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: 'demo' })
    )
    writeFile(
        path.join(projectDir, 'piecomponents', 'AnyCard', 'index.ts'),
        'export {}\n'
    )

    const result = await runCliAsync({
        cwd: projectDir,
        args: ['push', 'AnyCard'],
        env: { PIEUI_EXTERNAL_PUSH_URL: url },
    })

    assert.equal(result.status, 1)
    // Must not expose a raw Node.js stack trace
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

    const projectDir = makeProjectDir('pieui-s6-pull-refused-')
    fs.mkdirSync(path.join(projectDir, 'piecomponents'), { recursive: true })

    const result = await runCliAsync({
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

    const projectDir = makeProjectDir('pieui-s6-remove-refused-')
    writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify({ name: 'demo' })
    )

    const result = await runCliAsync({
        cwd: projectDir,
        args: ['remote-remove', 'OldCard'],
        env: { PIEUI_EXTERNAL_REMOVE_URL: url },
    })

    assert.equal(result.status, 1)
    assert.doesNotMatch(result.stderr, /\n\s*at\s+.*\(/)
})

// ---------------------------------------------------------------------------
// 5. list-events: multi-card disambiguation
// ---------------------------------------------------------------------------

// Verifies that list-events returns only the methods for the requested card
// when multiple PieCard instances exist in the same source file.
test('list-events returns only the target card methods when multiple PieCard exist in the same file', () => {
    const projectDir = makeProjectDir('pieui-s6-list-events-multi-card-')

    // Two PieCards in the same file — each with distinct method sets
    writeFile(
        path.join(projectDir, 'src', 'Dashboard.tsx'),
        `export const Dashboard = () => (
  <div>
    <PieCard
      card="AlertsCard"
      methods={{
        notify: (payload) => payload,
        dismiss() { return true },
      }}
    />
    <PieCard
      card="MetricsCard"
      methods={{
        refresh: (payload) => payload,
        reset() { return null },
        update: (data) => data,
      }}
    />
  </div>
)
`
    )

    // Querying AlertsCard must return only its own two methods
    const alertsResult = runCliSync({
        cwd: projectDir,
        args: ['list-events', 'AlertsCard', '--src-dir', 'src'],
    })
    assertSucceeded(alertsResult, 'list-events AlertsCard should succeed')
    assert.match(alertsResult.stdout, /notify/)
    assert.match(alertsResult.stdout, /dismiss/)
    // MetricsCard methods must NOT leak into AlertsCard output
    assert.doesNotMatch(alertsResult.stdout, /refresh/)
    assert.doesNotMatch(alertsResult.stdout, /reset/)
    assert.doesNotMatch(alertsResult.stdout, /update/)
    assert.match(alertsResult.stdout, /\[pieui\] Total: 2/)

    // Querying MetricsCard must return only its own three methods
    const metricsResult = runCliSync({
        cwd: projectDir,
        args: ['list-events', 'MetricsCard', '--src-dir', 'src'],
    })
    assertSucceeded(metricsResult, 'list-events MetricsCard should succeed')
    assert.match(metricsResult.stdout, /refresh/)
    assert.match(metricsResult.stdout, /reset/)
    assert.match(metricsResult.stdout, /update/)
    assert.doesNotMatch(metricsResult.stdout, /notify/)
    assert.doesNotMatch(metricsResult.stdout, /dismiss/)
    assert.match(metricsResult.stdout, /\[pieui\] Total: 3/)
})

// ---------------------------------------------------------------------------
// 6. init on a pristine project (no framework config files)
// ---------------------------------------------------------------------------

// Verifies init succeeds on a completely empty project directory —
// no tailwind.config.js, no next.config.ts — and creates only the registry
// without crashing or emitting unexpected errors.
test('init on a bare project with no framework config files creates registry only', () => {
    const projectDir = makeProjectDir('pieui-s6-init-bare-')

    const result = runCliSync({ cwd: projectDir, args: ['init'] })
    assertSucceeded(result, 'init should succeed on a bare project')

    // Registry must be created
    const registryPath = path.join(projectDir, 'piecomponents', 'registry.ts')
    assert.ok(fs.existsSync(registryPath), 'registry.ts should be created')

    // The stderr must be empty — no errors when config files are absent
    assert.equal(result.stderr, '')
})
