import type {
    CardAction,
    CardRemoteAction,
    ComponentType,
    ListFilter,
    PageAction,
    PageAjaxAction,
    ParsedArgs,
} from './types'

const VALID_CARD_ACTIONS: CardAction[] = [
    'add',
    'list',
    'pull',
    'view',
    'remove',
    'list-events',
    'add-event',
    'remote',
]

const VALID_CARD_REMOTE_ACTIONS: CardRemoteAction[] = [
    'push',
    'pull',
    'list',
    'remove',
    'history',
    'public',
    'private',
]

const VALID_PAGE_ACTIONS: PageAction[] = ['add', 'view', 'ajax']
const VALID_PAGE_AJAX_ACTIONS: PageAjaxAction[] = ['add', 'remove']
const VALID_COMPONENT_TYPES: ComponentType[] = [
    'simple',
    'complex',
    'simple-container',
    'complex-container',
]
const VALID_LIST_FILTERS: ListFilter[] = [
    'all',
    'simple',
    'complex',
    'simple-container',
    'complex-container',
]

const parseIntFlag = (name: string, raw: string): number => {
    if (!/^-?\d+$/.test(raw)) {
        throw new Error(
            `${name} must be an integer, got ${JSON.stringify(raw)}`
        )
    }
    return Number(raw)
}

type FlagState = {
    historyPage?: number
    historyPerPage?: number
    historyFrom?: number
    historyTo?: number
    remoteUserId?: string
    remoteProject?: string
}

const consumeFlags = (
    tokens: string[]
): {
    positionals: string[]
    flags: FlagState
    boolFlags: { ajax: boolean; io: boolean }
} => {
    const flags: FlagState = {}
    const positionals: string[] = []
    let ajax = false
    let io = false

    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i]
        if (tok === '--ajax') {
            ajax = true
            continue
        }
        if (tok === '--io') {
            io = true
            continue
        }
        if (tok === '--user' && tokens[i + 1]) {
            flags.remoteUserId = tokens[i + 1]
            i++
            continue
        }
        if (tok === '--project' && tokens[i + 1]) {
            flags.remoteProject = tokens[i + 1]
            i++
            continue
        }
        if (tok === '--page' && tokens[i + 1]) {
            flags.historyPage = parseIntFlag('--page', tokens[i + 1])
            i++
            continue
        }
        if (tok === '--per-page' && tokens[i + 1]) {
            flags.historyPerPage = parseIntFlag('--per-page', tokens[i + 1])
            i++
            continue
        }
        if (tok === '--from' && tokens[i + 1]) {
            flags.historyFrom = parseIntFlag('--from', tokens[i + 1])
            i++
            continue
        }
        if (tok === '--to' && tokens[i + 1]) {
            flags.historyTo = parseIntFlag('--to', tokens[i + 1])
            i++
            continue
        }
        if (tok.startsWith('--user=')) {
            flags.remoteUserId = tok.slice('--user='.length)
            continue
        }
        if (tok.startsWith('--project=')) {
            flags.remoteProject = tok.slice('--project='.length)
            continue
        }
        if (tok.startsWith('--page=')) {
            flags.historyPage = parseIntFlag(
                '--page',
                tok.slice('--page='.length)
            )
            continue
        }
        if (tok.startsWith('--per-page=')) {
            flags.historyPerPage = parseIntFlag(
                '--per-page',
                tok.slice('--per-page='.length)
            )
            continue
        }
        if (tok.startsWith('--from=')) {
            flags.historyFrom = parseIntFlag(
                '--from',
                tok.slice('--from='.length)
            )
            continue
        }
        if (tok.startsWith('--to=')) {
            flags.historyTo = parseIntFlag('--to', tok.slice('--to='.length))
            continue
        }
        positionals.push(tok)
    }

    return { positionals, flags, boolFlags: { ajax, io } }
}

export const parseArgs = (argv: string[]): ParsedArgs => {
    const [command = ''] = argv

    const outDirFlag = argv.find((arg) => arg.startsWith('--out-dir='))
    const srcDirFlag = argv.find((arg) => arg.startsWith('--src-dir='))
    const outDirIndex = argv.findIndex(
        (arg) => arg === '--out-dir' || arg === '-o'
    )
    const srcDirIndex = argv.findIndex(
        (arg) => arg === '--src-dir' || arg === '-s'
    )
    const appendFlag = argv.includes('--append')

    let outDir = command === 'postbuild' ? 'public' : '.'
    let srcDir = '.'

    if (outDirFlag) {
        outDir = outDirFlag.split('=')[1] || outDir
    } else if (outDirIndex !== -1 && argv[outDirIndex + 1]) {
        outDir = argv[outDirIndex + 1]
    }
    if (srcDirFlag) {
        srcDir = srcDirFlag.split('=')[1] || srcDir
    } else if (srcDirIndex !== -1 && argv[srcDirIndex + 1]) {
        srcDir = argv[srcDirIndex + 1]
    }

    const result: ParsedArgs = {
        command,
        outDir,
        srcDir,
        append: appendFlag,
    }

    if (
        (command === 'create-pie-app' ||
            command === 'create-pieui' ||
            command === 'create') &&
        argv[1]
    ) {
        result.createAppName = argv[1]
    }

    if (command === 'card' && argv[1]) {
        const action = argv[1] as CardAction
        if (!VALID_CARD_ACTIONS.includes(action)) {
            return result
        }
        result.cardAction = action

        const tail = argv.slice(2)
        const { positionals, flags, boolFlags } = consumeFlags(tail)

        if (action === 'add') {
            result.cardAjax = boolFlags.ajax
            result.cardIo = boolFlags.io
            if (
                positionals[0] &&
                VALID_COMPONENT_TYPES.includes(positionals[0] as ComponentType)
            ) {
                result.componentType = positionals[0] as ComponentType
                result.componentName = positionals[1]
            } else {
                result.componentType = 'complex-container'
                result.componentName = positionals[0]
            }
        } else if (action === 'list') {
            const filter = positionals[0] as ListFilter | undefined
            result.listFilter =
                filter && VALID_LIST_FILTERS.includes(filter) ? filter : 'all'
        } else if (action === 'pull') {
            result.cardPullRef = positionals[0]
        } else if (action === 'view') {
            result.componentName = positionals[0]
        } else if (action === 'remove') {
            result.componentName = positionals[0]
        } else if (action === 'list-events') {
            result.componentName = positionals[0]
        } else if (action === 'add-event') {
            result.componentName = positionals[0]
            result.eventName = positionals[1]
        } else if (action === 'remote') {
            const sub = positionals[0] as CardRemoteAction | undefined
            if (sub && VALID_CARD_REMOTE_ACTIONS.includes(sub)) {
                result.cardRemoteAction = sub
                if (positionals[1]) result.componentName = positionals[1]
                result.remoteUserId = flags.remoteUserId
                result.remoteProject = flags.remoteProject
                result.historyPage = flags.historyPage
                result.historyPerPage = flags.historyPerPage
                result.historyFrom = flags.historyFrom
                result.historyTo = flags.historyTo
            }
        }
    }

    if (command === 'page' && argv[1]) {
        const action = argv[1] as PageAction
        if (!VALID_PAGE_ACTIONS.includes(action)) {
            return result
        }
        result.pageAction = action
        if (action === 'add') {
            result.pagePath = argv[2]
        } else if (action === 'view') {
            result.pageName = argv[2]
        } else if (action === 'ajax') {
            result.pageName = argv[2]
            const sub = argv[3] as PageAjaxAction | undefined
            if (sub && VALID_PAGE_AJAX_ACTIONS.includes(sub)) {
                result.pageAjaxAction = sub
            }
            result.pageAjaxHandler = argv[4]
        }
    }

    return result
}

export const printUsage = () => {
    const lines: string[] = [
        'Usage: pieui <command> [options]',
        '',
        'Commands:',
        '  login                                            Sign in to PieUI and save credentials to .pie/config.json',
        '  create <AppName>                                 Create a Next.js app and run pieui init inside it',
        '  create-pie-app <AppName>                         Create a blank Next.js web template for PieUI',
        '  create-pieui <AppName>                           Alias for create-pie-app',
        '  init                                             Initialize piecomponents dir, registry.ts, tailwind & next.config; prompt for backend dirs',
        '  postbuild                                        Scan for components and generate manifest',
        '',
        'Card management (mirrors `pie card ...`):',
        '  card add [type] <Name> [--io] [--ajax]           Create a new component in piecomponents/',
        '  card list [filter]                               List registered components',
        '  card pull <ref>                                  Pull a card by Name, project/Name, or r/user/Name (public alias)',
        '  card view <Name>                                 Print card name, props, ajax, IO, and events',
        '  card remove <Name>                               Remove a component from piecomponents/',
        '  card list-events <Name>                          List methods keys on the registered PieCard',
        '  card add-event <Name> <event>                    Add a new methods key with a default handler',
        '  card remote list [--user U] [--project S]        List remote components',
        '  card remote push <Name>                          Upload piecomponents/<Name>/ to PieUI storage',
        '  card remote pull <Name>[@rev]                    Download component from PieUI storage',
        '  card remote remove <Name>                        Delete component from PieUI storage',
        '  card remote history <Name> [--page N] [--per-page N] [--from R] [--to R]',
        '                                                   Show revision history with per-file diff stats',
        '  card remote public <Name>                        Mark component public (readable as r/<user>/<Name>)',
        '  card remote private <Name>                       Make a public component private again',
        '',
        'Page management (mirrors `pie page ...`):',
        '  page add <path>                                  Create app/<path>/page.tsx from the standard Pie page template',
        '  page view <path>                                 Print app/<path>/page.tsx source',
        '  page ajax <path> <add|remove> <handler>          Add or remove an AJAX handler in app/<path>/page.tsx',
        '',
        'Component types for `card add`:',
        '  simple              Simple component (only data prop)',
        '  complex             Complex component (data + children props)',
        '  simple-container    Container with single content (data + content)',
        '  complex-container   Container with array content (data + content[])  [default]',
        '',
        'Options for `card add`:',
        '  --io                Add realtime support fields to the generated data interface',
        '  --ajax              Add AJAX request fields to the generated data interface',
        '',
        'Options for init:',
        '  --out-dir <dir>, -o <dir>    Base directory for piecomponents (default: .)',
        '',
        'Options for postbuild:',
        '  --out-dir <dir>, -o <dir>    Output directory (default: public)',
        '  --src-dir <dir>, -s <dir>    Source directory (default: src)',
        '  --append                     Include built-in pieui components in the manifest',
        '',
        'Options for `card list` / `card list-events` / `card add-event`:',
        '  --src-dir <dir>, -s <dir>    Source directory (default: .)',
        '',
        'Examples:',
        '  pieui login',
        '  pieui init',
        '  pieui create my-pie-app',
        '  pieui card add MyCustomCard',
        '  pieui card add simple MySimpleCard',
        '  pieui card list complex-container',
        '  pieui card view MyCustomCard',
        '  pieui card pull r/alice/HeroCard',
        '  pieui card remote push MyCustomCard',
        '  pieui page add dashboard',
        '  pieui page view dashboard',
        '  pieui page ajax dashboard add refresh',
    ]
    for (const line of lines) console.log(line)
}
