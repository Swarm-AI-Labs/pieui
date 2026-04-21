import type {
    CardAction,
    CardRemoteAction,
    ComponentType,
    ListFilter,
    PageAction,
    ParsedArgs,
} from './types'

export const parseArgs = (argv: string[]): ParsedArgs => {
    const [command = ''] = argv
    const cardFlagSet = new Set(['--io', '--ajax'])
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
    let componentType: ComponentType | undefined
    let componentName: string | undefined
    let createAppName: string | undefined
    let eventName: string | undefined
    let cardAction: CardAction | undefined
    let cardAjax = false
    let cardIo = false
    let cardRemoteAction: CardRemoteAction | undefined
    let remoteUserId: string | undefined
    let remoteProjectSlug: string | undefined
    let pageAction: PageAction | undefined
    let pagePath: string | undefined

    let removeComponentName: string | undefined
    let listFilter: ListFilter | undefined

    if (command === 'remove' && argv[1]) {
        removeComponentName = argv[1]
    }

    if (
        (command === 'create-pie-app' ||
            command === 'create-pieui' ||
            command === 'create') &&
        argv[1]
    ) {
        createAppName = argv[1]
    }

    if (command === 'list') {
        const validFilters: ListFilter[] = [
            'all',
            'simple',
            'complex',
            'simple-container',
            'complex-container',
        ]
        const filterArg = argv[1] as ListFilter | undefined
        listFilter =
            filterArg && validFilters.includes(filterArg) ? filterArg : 'all'
    }

    if (command === 'card' && argv[1]) {
        const validActions: CardAction[] = ['add', 'remote']
        if (validActions.includes(argv[1] as CardAction)) {
            cardAction = argv[1] as CardAction
        }
    }

    if (
        ((command === 'card' && cardAction === 'add') || command === 'add') &&
        argv[1]
    ) {
        const offset = command === 'card' ? 2 : 1
        const cardArgv = argv.slice(offset)
        const positionalArgs = cardArgv.filter((arg) => !cardFlagSet.has(arg))
        cardIo = cardArgv.includes('--io')
        cardAjax = cardArgv.includes('--ajax')

        // Check if first argument is a component type
        const validTypes: ComponentType[] = [
            'simple',
            'complex',
            'simple-container',
            'complex-container',
        ]
        if (validTypes.includes(positionalArgs[0] as ComponentType)) {
            componentType = positionalArgs[0] as ComponentType
            componentName = positionalArgs[1]
        } else {
            // Default to complex-container if no type specified
            componentType = 'complex-container'
            componentName = positionalArgs[0]
        }
    }

    if (command === 'card' && cardAction === 'remote' && argv[2]) {
        const validRemoteActions: CardRemoteAction[] = [
            'push',
            'pull',
            'list',
            'remove',
        ]
        const action = argv[2] as CardRemoteAction
        if (validRemoteActions.includes(action)) {
            cardRemoteAction = action
            const rest = argv.slice(3)
            const flagIndexes = new Set<number>()
            for (let i = 0; i < rest.length; i++) {
                const tok = rest[i]
                if (tok === '--user' && rest[i + 1]) {
                    remoteUserId = rest[i + 1]
                    flagIndexes.add(i)
                    flagIndexes.add(i + 1)
                    i++
                } else if (tok === '--project' && rest[i + 1]) {
                    remoteProjectSlug = rest[i + 1]
                    flagIndexes.add(i)
                    flagIndexes.add(i + 1)
                    i++
                } else if (tok?.startsWith('--user=')) {
                    remoteUserId = tok.slice('--user='.length)
                    flagIndexes.add(i)
                } else if (tok?.startsWith('--project=')) {
                    remoteProjectSlug = tok.slice('--project='.length)
                    flagIndexes.add(i)
                }
            }
            const positionals = rest.filter((_, i) => !flagIndexes.has(i))
            if (positionals[0]) componentName = positionals[0]
        }
    }

    if (command === 'page' && argv[1]) {
        const validActions: PageAction[] = ['add']
        if (validActions.includes(argv[1] as PageAction)) {
            pageAction = argv[1] as PageAction
            pagePath = argv[2]
        }
    }

    if (command === 'list-events' && argv[1]) {
        componentName = argv[1]
    }

    if (command === 'add-event' && argv[1] && argv[2]) {
        componentName = argv[1]
        eventName = argv[2]
    }

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

    return {
        command,
        outDir,
        srcDir,
        append: appendFlag,
        componentName,
        createAppName,
        componentType,
        eventName,
        removeComponentName,
        listFilter,
        cardAction,
        cardAjax,
        cardIo,
        cardRemoteAction,
        remoteUserId,
        remoteProjectSlug,
        pageAction,
        pagePath,
    }
}

export const printUsage = () => {
    console.log('Usage: pieui <command> [options]')
    console.log('')
    console.log('Commands:')
    console.log(
        '  create <AppName>                        Create a Next.js app and run pieui init inside it'
    )
    console.log(
        '  create-pie-app <AppName>                Create a blank Next.js web template for PieUI (bun create next-app under the hood)'
    )
    console.log(
        '  create-pieui <AppName>                  Alias for create-pie-app'
    )
    console.log(
        '  login                                   Sign in to PieUI and save credentials to .pie/config.json'
    )
    console.log(
        '  init                                    Initialize piecomponents directory with registry.ts'
    )
    console.log(
        '  card add [type] <ComponentName> [--io] [--ajax] Create a new component in piecomponents directory'
    )
    console.log(
        '  page add <path>                         Create app/<path>/page.tsx from the standard Pie page template'
    )
    console.log(
        '  card remote push <ComponentName>         Upload piecomponents/<Name>/ to PieUI storage'
    )
    console.log(
        '  card remote pull <ComponentName>         Download component from PieUI storage into piecomponents/<Name>/'
    )
    console.log(
        '  card remote list [--user U] [--project S]  List remote components for the configured or specified user/project'
    )
    console.log(
        '  card remote remove <ComponentName>       Delete component from PieUI storage'
    )
    console.log(
        '  list-events <ComponentName>             List registered methods keys for <PieCard card="ComponentName" ... methods={...} />'
    )
    console.log(
        '  add-event <ComponentName> <event>       Add a new methods key with a default handler to <PieCard card="ComponentName" ... methods={...} />'
    )
    console.log(
        '  remove <ComponentName>                  Remove a component from piecomponents directory'
    )
    console.log(
        '  postbuild                               Scan for components and generate manifest'
    )
    console.log(
        '  list [filter]                            List registered components in a table'
    )
    console.log('')
    console.log('Component types for card add command:')
    console.log('  simple                  Simple component (only data prop)')
    console.log(
        '  complex                 Complex component (data + children props)'
    )
    console.log(
        '  simple-container        Container with single content (data + content)'
    )
    console.log(
        '  complex-container       Container with array content (data + content[])'
    )
    console.log('                         (default if type not specified)')
    console.log('')
    console.log('Options for card add:')
    console.log(
        '  --io                         Add realtime support fields to the generated data interface'
    )
    console.log(
        '  --ajax                       Add AJAX request fields to the generated data interface'
    )
    console.log('')
    console.log('Options for init:')
    console.log(
        '  --out-dir <dir>, -o <dir>    Base directory for piecomponents (default: .)'
    )
    console.log('')
    console.log('Options for postbuild:')
    console.log(
        '  --out-dir <dir>, -o <dir>    Output directory (default: public)'
    )
    console.log(
        '  --src-dir <dir>, -s <dir>    Source directory (default: src)'
    )
    console.log(
        '  --append                      Include built-in pieui components in the manifest'
    )
    console.log('')
    console.log('Options for list:')
    console.log(
        '  --src-dir <dir>, -s <dir>    Source directory (default: src)'
    )
    console.log('')
    console.log('Options for list-events:')
    console.log(
        '  --src-dir <dir>, -s <dir>    Source directory to scan (default: .)'
    )
    console.log('')
    console.log('Options for add-event:')
    console.log(
        '  --src-dir <dir>, -s <dir>    Source directory to modify (default: .)'
    )
    console.log('')
    console.log('Filters for list:')
    console.log('  all                 All components (default)')
    console.log('  simple              Simple components (only data prop)')
    console.log(
        '  complex             Complex components (data + children props)'
    )
    console.log('  simple-container    Container with single content')
    console.log('  complex-container   Container with array content')
    console.log('')
    console.log('Examples:')
    console.log('  pieui login')
    console.log('  pieui init')
    console.log('  pieui create my-pie-app')
    console.log('  pieui create-pie-app my-pie-app')
    console.log('  pieui create-pieui my-pie-app')
    console.log('  pieui init --out-dir packages/app')
    console.log(
        '  pieui card add MyCustomCard                   # Creates complex-container by default'
    )
    console.log(
        '  pieui card add simple MySimpleCard            # Creates simple component'
    )
    console.log(
        '  pieui card add complex-container MyContainerCard # Creates complex container'
    )
    console.log(
        '  pieui card add simple LiveCard --io --ajax    # Adds realtime and AJAX fields'
    )
    console.log(
        '  pieui page add chat                          # Creates app/chat/page.tsx'
    )
    console.log('  pieui postbuild --append --out-dir dist')
    console.log(
        '  pieui list                                    # List all components'
    )
    console.log(
        '  pieui list simple                             # List only simple components'
    )
    console.log(
        '  pieui list complex-container --src-dir app    # List complex containers in app/'
    )
    console.log(
        '  pieui list-events ExchangeAlertsCard         # Print methods table for that PieCard usage'
    )
    console.log(
        '  pieui add-event ExchangeAlertsCard alert     # Add methods.alert with default handler'
    )
    console.log(
        '  pieui card remote push ExchangeAlertsCard    # Upload component directory'
    )
    console.log(
        '  pieui card remote pull ExchangeAlertsCard    # Download component directory'
    )
    console.log(
        '  pieui card remote list                       # List remote components'
    )
    console.log(
        '  pieui card remote remove ExchangeAlertsCard  # Delete remote component'
    )
}
