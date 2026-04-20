#!/usr/bin/env node

import { parseArgs, printUsage } from './code/args'
import { initCommand } from './code/commands/init'
import { addCommand } from './code/commands/add'
import { removeCommand } from './code/commands/remove'
import { listCommand } from './code/commands/list'
import { listEventsCommand } from './code/commands/listEvents'
import { addEventCommand } from './code/commands/addEvent'
import { postbuildCommand } from './code/commands/postbuild'
import { pushCommand } from './code/commands/push'
import { pullCommand } from './code/commands/pull'
import { remoteRemoveCommand } from './code/commands/remoteRemove'
import { pageAddCommand } from './code/commands/pageAdd'
import { createCommand } from './code/commands/create'
import { createPieAppCommand } from './code/commands/createPieApp'
import { loginCommand } from './code/commands/login'

const main = async () => {
    const {
        command,
        outDir,
        srcDir,
        append,
        componentName,
        createAppName,
        componentType,
        removeComponentName,
        listFilter,
        eventName,
        cardAction,
        cardAjax,
        cardIo,
        pageAction,
        pagePath,
    } = parseArgs(process.argv.slice(2))

    console.log(`[pieui] CLI started with command: "${command}"`)

    switch (command) {
        case 'init':
            initCommand(outDir)
            return

        case 'create':
            if (!createAppName) {
                console.error(
                    '[pieui] Error: App name is required for create command'
                )
                printUsage()
                process.exit(1)
            }
            createCommand(createAppName)
            return
        case 'create-pie-app':
        case 'create-pieui':
            if (!createAppName) {
                console.error(
                    '[pieui] Error: App name is required for create-pie-app command'
                )
                printUsage()
                process.exit(1)
            }
            createPieAppCommand(createAppName)
            return

        case 'card':
            if (cardAction !== 'add') {
                console.error(
                    '[pieui] Error: Supported card subcommands: add'
                )
                printUsage()
                process.exit(1)
            }
            if (!componentName) {
                console.error(
                    '[pieui] Error: Component name is required for card add command'
                )
                printUsage()
                process.exit(1)
            }
            addCommand(componentName, componentType, {
                ajax: cardAjax,
                io: cardIo,
            })
            return

        case 'add':
            if (!componentName) {
                console.error(
                    '[pieui] Error: Component name is required for card add command'
                )
                printUsage()
                process.exit(1)
            }
            addCommand(componentName, componentType, {
                ajax: cardAjax,
                io: cardIo,
            })
            return

        case 'page':
            if (pageAction !== 'add') {
                console.error(
                    '[pieui] Error: Supported page subcommands: add'
                )
                printUsage()
                process.exit(1)
            }
            if (!pagePath) {
                console.error(
                    '[pieui] Error: Path is required for page add command'
                )
                printUsage()
                process.exit(1)
            }
            pageAddCommand(pagePath)
            return

        case 'remove':
            if (!removeComponentName) {
                console.error(
                    '[pieui] Error: Component name is required for remove command'
                )
                printUsage()
                process.exit(1)
            }
            removeCommand(removeComponentName)
            return

        case 'list':
            listCommand(srcDir, listFilter || 'all')
            return

        case 'push':
            if (!componentName) {
                console.error(
                    '[pieui] Error: Component name is required for push command'
                )
                printUsage()
                process.exit(1)
            }
            await pushCommand(componentName)
            return

        case 'pull':
            if (!componentName) {
                console.error(
                    '[pieui] Error: Component name is required for pull command'
                )
                printUsage()
                process.exit(1)
            }
            await pullCommand(componentName)
            return

        case 'remote-remove':
            if (!componentName) {
                console.error(
                    '[pieui] Error: Component name is required for remote-remove command'
                )
                printUsage()
                process.exit(1)
            }
            await remoteRemoveCommand(componentName)
            return

        case 'list-events':
            if (!componentName) {
                console.error(
                    '[pieui] Error: Component name is required for list-events command'
                )
                printUsage()
                process.exit(1)
            }
            listEventsCommand(srcDir, componentName)
            return

        case 'add-event':
            if (!componentName || !eventName) {
                console.error(
                    '[pieui] Error: Component name and event name are required for add-event command'
                )
                printUsage()
                process.exit(1)
            }
            addEventCommand(srcDir, componentName, eventName)
            return

        case 'postbuild':
            console.log(`[pieui] Source directory: ${srcDir}`)
            console.log(`[pieui] Output directory: ${outDir}`)
            console.log(`[pieui] Append mode: ${append}`)
            await postbuildCommand(srcDir, outDir, append)
            return

        case 'login':
            await loginCommand()
            return

        default:
            printUsage()
            process.exit(1)
    }
}

void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[pieui] Error: ${message}`)
    process.exit(1)
})
