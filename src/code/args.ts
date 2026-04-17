import type { ComponentType, ListFilter, ParsedArgs } from './types'

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
    let componentType: ComponentType | undefined
    let componentName: string | undefined
    let createAppName: string | undefined
    let eventName: string | undefined

    let removeComponentName: string | undefined
    let listFilter: ListFilter | undefined

    if (command === 'remove' && argv[1]) {
        removeComponentName = argv[1]
    }

    if (command === 'create-pie-app' && argv[1]) {
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

    if (command === 'add' && argv[1]) {
        // Check if first argument is a component type
        const validTypes: ComponentType[] = [
            'simple',
            'complex',
            'simple-container',
            'complex-container',
        ]
        if (validTypes.includes(argv[1] as ComponentType)) {
            componentType = argv[1] as ComponentType
            componentName = argv[2]
        } else {
            // Default to complex-container if no type specified
            componentType = 'complex-container'
            componentName = argv[1]
        }
    }

    if (command === 'list-events' && argv[1]) {
        componentName = argv[1]
    }

    if (command === 'add-event' && argv[1] && argv[2]) {
        componentName = argv[1]
        eventName = argv[2]
    }

    if (
        (command === 'pull' ||
            command === 'push' ||
            command === 'remote-remove') &&
        argv[1]
    ) {
        componentName = argv[1]
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
    }
}

export const printUsage = () => {
    console.log('Usage: pieui <command> [options]')
    console.log('')
    console.log('Commands:')
    console.log(
        '  create-pie-app <AppName>                Create a blank Next.js web template for PieUI (bun create next-app under the hood)'
    )
    console.log(
        '  init                                    Initialize piecomponents directory with registry.ts'
    )
    console.log(
        '  add [type] <ComponentName>              Create a new component in piecomponents directory'
    )
    console.log(
        '  push <ComponentName>                    Archive piecomponents/<ComponentName> and upload to PieUI server'
    )
    console.log(
        '  pull <ComponentName>                    Download archive from PieUI server and extract into piecomponents/<ComponentName>'
    )
    console.log(
        '  remote-remove <ComponentName>           Remove remote component from PieUI server'
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
    console.log('Component types for add command:')
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
    console.log('  pieui init')
    console.log('  pieui create-pie-app my-pie-app')
    console.log('  pieui init --out-dir packages/app')
    console.log(
        '  pieui add MyCustomCard                        # Creates complex-container by default'
    )
    console.log(
        '  pieui add simple MySimpleCard                 # Creates simple component'
    )
    console.log(
        '  pieui add complex-container MyContainerCard   # Creates complex container'
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
        '  pieui push ExchangeAlertsCard                # Upload component folder as zip'
    )
    console.log(
        '  pieui pull ExchangeAlertsCard                # Download & extract component folder'
    )
    console.log(
        '  pieui remote-remove ExchangeAlertsCard       # Delete remote component (and remove from Feed)'
    )
}
