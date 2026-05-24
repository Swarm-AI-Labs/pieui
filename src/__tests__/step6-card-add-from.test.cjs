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

const initProject = (projectDir) => {
    const result = runCli({ cwd: projectDir, args: ['init'] })
    assert.equal(
        result.status,
        0,
        `init failed:\n${result.stdout}\n${result.stderr}`
    )
}

const baseMeta = (overrides = {}) => ({
    typescript: {
        name: 'OrdersCard',
        files: [],
        packages: [],
        relativeImports: [],
        events: [],
        propsSchema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                limit: { type: 'integer' },
            },
            required: ['title', 'limit'],
        },
        propsCode:
            '@dataclass\nclass OrdersCard(Card):\n    title: str\n    limit: int',
        eventsPropsSchema: {},
        eventsPropsCode: {},
        inputPropsCode: null,
        inputPropsSchema: null,
        ajaxList: [],
        ...overrides,
    },
})

test('card add --from json-file scaffolds types and ui from metadata', () => {
    const projectDir = makeProjectDir('pieui-step6-from-basic-')
    initProject(projectDir)
    const metaPath = path.join(projectDir, 'meta.json')
    writeFile(metaPath, JSON.stringify(baseMeta()))

    const result = runCli({
        cwd: projectDir,
        args: ['card', 'add', 'simple', 'OrdersCard', '--from', metaPath],
    })

    assert.equal(
        result.status,
        0,
        `card add --from failed:\n${result.stdout}\n${result.stderr}`
    )
    const typesFile = path.join(
        projectDir,
        'piecomponents',
        'OrdersCard',
        'types',
        'index.ts'
    )
    const uiFile = path.join(
        projectDir,
        'piecomponents',
        'OrdersCard',
        'ui',
        'OrdersCard.tsx'
    )
    assert.ok(fs.existsSync(typesFile))
    assert.ok(fs.existsSync(uiFile))

    const typesText = fs.readFileSync(typesFile, 'utf8')
    assert.match(typesText, /export interface OrdersCard \{/)
    assert.match(typesText, /title: string/)
    assert.match(typesText, /limit: number/)
    assert.match(
        typesText,
        /export type OrdersCardProps = PieSimpleComponentProps<OrdersCard>/
    )

    const uiText = fs.readFileSync(uiFile, 'utf8')
    assert.match(uiText, /import \{ PieCard \} from '@swarm\.ing\/pieui'/)
    assert.match(uiText, /card=\{"OrdersCard"\}/)

    const registry = fs.readFileSync(
        path.join(projectDir, 'piecomponents', 'registry.ts'),
        'utf8'
    )
    assert.match(registry, /piecomponents\/OrdersCard/)
})

test('card add --from json-file generates input interface when inputPropsSchema is present', () => {
    const projectDir = makeProjectDir('pieui-step6-from-input-')
    initProject(projectDir)
    const metaPath = path.join(projectDir, 'meta.json')
    writeFile(
        metaPath,
        JSON.stringify(
            baseMeta({
                inputPropsCode:
                    '@dataclass\nclass OrdersStoredInput(InputCard):\n    user_id: str',
                inputPropsSchema: {
                    type: 'object',
                    properties: {
                        userId: { type: 'string' },
                        role: { enum: ['admin', 'user'] },
                    },
                    required: ['userId'],
                },
            })
        )
    )

    const result = runCli({
        cwd: projectDir,
        args: ['card', 'add', 'simple', 'OrdersCard', '--from', metaPath],
    })
    assert.equal(result.status, 0, result.stderr)

    const typesText = fs.readFileSync(
        path.join(
            projectDir,
            'piecomponents',
            'OrdersCard',
            'types',
            'index.ts'
        ),
        'utf8'
    )
    assert.match(typesText, /export interface OrdersStoredInput \{/)
    assert.match(typesText, /userId: string/)
    assert.match(typesText, /role\?: "admin" \| "user"/)

    const uiText = fs.readFileSync(
        path.join(
            projectDir,
            'piecomponents',
            'OrdersCard',
            'ui',
            'OrdersCard.tsx'
        ),
        'utf8'
    )
    // Input-flavored ports destructure `stored` from props (typed via the
    // InputPie*ComponentProps base) and forward it to <PieCard>.
    assert.match(uiText, /\{ data: _data, stored \}: OrdersCardProps/)
    assert.match(uiText, /stored=\{stored\}/)
    // The Props alias uses the InputPie* base with both Data and Stored params.
    assert.match(
        typesText,
        /InputPieSimpleComponentProps<\w+, OrdersStoredInput>/
    )
})

test('card add --from json-file scaffolds methods with typed payloads from events', () => {
    const projectDir = makeProjectDir('pieui-step6-from-events-')
    initProject(projectDir)
    const metaPath = path.join(projectDir, 'meta.json')
    writeFile(
        metaPath,
        JSON.stringify(
            baseMeta({
                events: ['refresh', 'submit'],
                eventsPropsSchema: {
                    refresh: {
                        type: 'object',
                        properties: { since: { type: 'string' } },
                        required: ['since'],
                    },
                    submit: {
                        type: 'object',
                        properties: {
                            orderId: { type: 'string' },
                            amount: { type: 'number' },
                        },
                        required: ['orderId', 'amount'],
                    },
                },
            })
        )
    )

    const result = runCli({
        cwd: projectDir,
        args: ['card', 'add', 'simple', 'OrdersCard', '--from', metaPath],
    })
    assert.equal(result.status, 0, result.stderr)

    const uiText = fs.readFileSync(
        path.join(
            projectDir,
            'piecomponents',
            'OrdersCard',
            'ui',
            'OrdersCard.tsx'
        ),
        'utf8'
    )
    assert.match(uiText, /type OrdersCardRefreshPayload =/)
    assert.match(uiText, /type OrdersCardSubmitPayload =/)
    assert.match(uiText, /refresh: \(payload: OrdersCardRefreshPayload\)/)
    assert.match(uiText, /submit: \(payload: OrdersCardSubmitPayload\)/)
    assert.match(uiText, /since: string/)
    assert.match(uiText, /orderId: string/)
    assert.match(uiText, /amount: number/)
})

test('card add fails cleanly when --from path does not exist and no backend dir is configured', () => {
    const projectDir = makeProjectDir('pieui-step6-from-missing-')
    initProject(projectDir)

    const result = runCli({
        cwd: projectDir,
        args: ['card', 'add', 'simple', 'GhostCard', '--from', 'no-such'],
    })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /no backendComponentsDir is configured/)
})

test('card add --from preserves type name from propsCode when present', () => {
    const projectDir = makeProjectDir('pieui-step6-from-name-')
    initProject(projectDir)
    const metaPath = path.join(projectDir, 'meta.json')
    writeFile(
        metaPath,
        JSON.stringify(
            baseMeta({
                propsCode:
                    'export interface MySpecialName {\n    foo: string\n}',
            })
        )
    )

    const result = runCli({
        cwd: projectDir,
        args: ['card', 'add', 'simple', 'OrdersCard', '--from', metaPath],
    })
    assert.equal(result.status, 0, result.stderr)
    const typesText = fs.readFileSync(
        path.join(
            projectDir,
            'piecomponents',
            'OrdersCard',
            'types',
            'index.ts'
        ),
        'utf8'
    )
    assert.match(typesText, /export interface MySpecialName \{/)
    assert.match(
        typesText,
        /export type OrdersCardProps = PieSimpleComponentProps<MySpecialName>/
    )
})
