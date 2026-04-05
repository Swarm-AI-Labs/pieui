#!/usr/bin/env node

import { parseArgs, printUsage } from './code/args'
import { initCommand } from './code/commands/init'
import { addCommand } from './code/commands/add'
import { removeCommand } from './code/commands/remove'
import { listCommand } from './code/commands/list'
import { postbuildCommand } from './code/commands/postbuild'

const main = async () => {
    const {
        command,
        outDir,
        srcDir,
        append,
        componentName,
        componentType,
        removeComponentName,
        listFilter,
    } = parseArgs(process.argv.slice(2))

    console.log(`[pieui] CLI started with command: "${command}"`)

    switch (command) {
        case 'init':
            initCommand(outDir)
            return

        case 'add':
            if (!componentName) {
                console.error(
                    '[pieui] Error: Component name is required for add command'
                )
                printUsage()
                process.exit(1)
            }
            addCommand(componentName, componentType)
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

        case 'postbuild':
            console.log(`[pieui] Source directory: ${srcDir}`)
            console.log(`[pieui] Output directory: ${outDir}`)
            console.log(`[pieui] Append mode: ${append}`)
            break

        default:
            printUsage()
            process.exit(1)
    }

    try {
        await postbuildCommand(srcDir, outDir, append)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(
            `[pieui] Failed to generate component manifest: ${message}`
        )
        if (error instanceof Error && error.stack) {
            console.error('[pieui] Stack trace:', error.stack)
        }
        process.exit(1)
    }
}

void main()
