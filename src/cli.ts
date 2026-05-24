#!/usr/bin/env node

import path from 'node:path'
import { detectHelpScope, parseArgs, printUsage } from './code/args'
import { initCommand } from './code/commands/init'
import { addCommand } from './code/commands/add'
import { removeCommand } from './code/commands/remove'
import { listCommand } from './code/commands/list'
import { listEventsCommand } from './code/commands/listEvents'
import { addEventCommand } from './code/commands/addEvent'
import { postbuildCommand } from './code/commands/postbuild'
import { cardRemotePushCommand } from './code/commands/cardRemote/push'
import { cardRemotePullCommand } from './code/commands/cardRemote/pull'
import { cardRemoteListCommand } from './code/commands/cardRemote/list'
import { cardRemoteRemoveCommand } from './code/commands/cardRemote/remove'
import { cardRemoteHistoryCommand } from './code/commands/cardRemote/history'
import { cardRemotePublicCommand } from './code/commands/cardRemote/public'
import { cardRemotePrivateCommand } from './code/commands/cardRemote/private'
import { cardPullCommand } from './code/commands/cardPull'
import { cardViewCommand } from './code/commands/cardView'
import { cardDumpMetadataCommand } from './code/commands/cardDumpMetadata'
import { cardCheckSyncCommand } from './code/commands/cardCheckSync'
import { cardAddStoryCommand } from './code/commands/cardAddStory'
import {
    cardAddFromMetaCommand,
    hasBackendSourceFor,
} from './code/commands/cardAddFromMeta'
import { pageAddCommand } from './code/commands/pageAdd'
import { pageViewCommand } from './code/commands/pageView'
import { pageAjaxCommand } from './code/commands/pageAjax'
import { createCommand } from './code/commands/create'
import { createPieAppCommand } from './code/commands/createPieApp'
import { loginCommand } from './code/commands/login'
import { selfUpgradeCommand } from './code/commands/selfUpgrade'

const requireName = (value: string | undefined, label: string): string => {
    if (!value) {
        console.error(`[pieui] Error: ${label} is required`)
        printUsage()
        process.exit(1)
    }
    return value
}

const main = async () => {
    const rawArgs = process.argv.slice(2)

    const helpScope = detectHelpScope(rawArgs)
    if (helpScope) {
        printUsage(helpScope)
        return
    }

    const args = parseArgs(rawArgs)
    const {
        command,
        outDir,
        srcDir,
        append,
        componentName,
        createAppName,
        componentType,
        listFilter,
        eventName,
        cardAction,
        cardAjax,
        cardIo,
        cardInput,
        cardAddStoryForce,
        cardRemoteAction,
        cardPullRef,
        remoteUserId,
        remoteProject,
        pageAction,
        pagePath,
        pageName,
        pageAjaxAction,
        pageAjaxHandler,
        historyPage,
        historyPerPage,
        historyFrom,
        historyTo,
    } = args

    console.log(`[pieui] CLI started with command: "${command}"`)

    switch (command) {
        case 'init':
            await initCommand(outDir)
            return

        case 'create': {
            const name = requireName(createAppName, 'App name')
            await createCommand(name)
            return
        }
        case 'create-pie-app':
        case 'create-pieui': {
            const name = requireName(createAppName, 'App name')
            createPieAppCommand(name)
            return
        }

        case 'login':
            await loginCommand()
            return

        case 'self-upgrade':
            await selfUpgradeCommand(args.selfUpgradePm)
            return

        case 'postbuild':
            console.log(
                `[pieui] Source directory: ${path.resolve(process.cwd(), srcDir)}`
            )
            console.log(
                `[pieui] Output directory: ${path.resolve(process.cwd(), outDir)}`
            )
            console.log(`[pieui] Append mode: ${append}`)
            await postbuildCommand(srcDir, outDir, append)
            return

        case 'card': {
            if (!cardAction) {
                console.error(
                    '[pieui] Error: Supported card subcommands: add, list, pull, view, remove, list-events, add-event, remote'
                )
                printUsage()
                process.exit(1)
            }
            if (cardAction === 'add') {
                const name = requireName(componentName, 'Component name')
                const explicitFrom = args.cardAddFrom !== undefined
                const autoFrom = !explicitFrom && hasBackendSourceFor(name)
                if (explicitFrom || autoFrom) {
                    if (autoFrom) {
                        console.log(
                            `[pieui] Auto-detected backend source for ${name} (use --from to override)`
                        )
                    }
                    cardAddFromMetaCommand(
                        name,
                        componentType ?? 'simple',
                        args.cardAddFrom
                    )
                    return
                }
                addCommand(name, componentType, {
                    ajax: cardAjax,
                    io: cardIo,
                    input: cardInput,
                })
                return
            }
            if (cardAction === 'list') {
                listCommand(srcDir, listFilter || 'all')
                return
            }
            if (cardAction === 'pull') {
                const ref = requireName(cardPullRef, 'Card reference')
                await cardPullCommand(ref)
                return
            }
            if (cardAction === 'view') {
                const name = requireName(componentName, 'Component name')
                cardViewCommand(name)
                return
            }
            if (cardAction === 'remove') {
                const name = requireName(componentName, 'Component name')
                removeCommand(name)
                return
            }
            if (cardAction === 'list-events') {
                const name = requireName(componentName, 'Component name')
                listEventsCommand(srcDir, name)
                return
            }
            if (cardAction === 'add-event') {
                const name = requireName(componentName, 'Component name')
                if (!eventName) {
                    console.error('[pieui] Error: Event name is required')
                    printUsage()
                    process.exit(1)
                }
                addEventCommand(srcDir, name, eventName)
                return
            }
            if (cardAction === 'dump-metadata') {
                const name = requireName(componentName, 'Component name')
                cardDumpMetadataCommand(name, args.dumpMetadataOut)
                return
            }
            if (cardAction === 'check-sync') {
                const name = requireName(componentName, 'Component name')
                const exitCode = await cardCheckSyncCommand(name)
                process.exit(exitCode)
            }
            if (cardAction === 'add-story') {
                const name = requireName(componentName, 'Component name')
                cardAddStoryCommand(name, { force: cardAddStoryForce })
                return
            }
            if (cardAction === 'remote') {
                if (cardRemoteAction === 'list') {
                    await cardRemoteListCommand({
                        userId: remoteUserId,
                        project: remoteProject,
                    })
                    return
                }
                const name = requireName(componentName, 'Component name')
                if (cardRemoteAction === 'push') {
                    await cardRemotePushCommand(name)
                    return
                }
                if (cardRemoteAction === 'pull') {
                    await cardRemotePullCommand(name)
                    return
                }
                if (cardRemoteAction === 'remove') {
                    await cardRemoteRemoveCommand(name)
                    return
                }
                if (cardRemoteAction === 'history') {
                    await cardRemoteHistoryCommand({
                        componentName: name,
                        page: historyPage,
                        perPage: historyPerPage,
                        from: historyFrom,
                        to: historyTo,
                    })
                    return
                }
                if (cardRemoteAction === 'public') {
                    await cardRemotePublicCommand(name)
                    return
                }
                if (cardRemoteAction === 'private') {
                    await cardRemotePrivateCommand(name)
                    return
                }
                console.error(
                    '[pieui] Error: Supported card remote subcommands: list, push, pull, remove, history, public, private'
                )
                printUsage()
                process.exit(1)
            }
            return
        }

        case 'page': {
            if (!pageAction) {
                console.error(
                    '[pieui] Error: Supported page subcommands: add, view, ajax'
                )
                printUsage()
                process.exit(1)
            }
            if (pageAction === 'add') {
                const p = requireName(pagePath, 'Path')
                pageAddCommand(p)
                return
            }
            if (pageAction === 'view') {
                const name = requireName(pageName, 'Path')
                pageViewCommand(name)
                return
            }
            if (pageAction === 'ajax') {
                const name = requireName(pageName, 'Page name')
                if (!pageAjaxAction) {
                    console.error(
                        '[pieui] Error: page ajax action must be `add` or `remove`'
                    )
                    printUsage()
                    process.exit(1)
                }
                const handler = requireName(pageAjaxHandler, 'Handler name')
                pageAjaxCommand(name, pageAjaxAction, handler)
                return
            }
            return
        }

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
