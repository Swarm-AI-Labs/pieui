#!/usr/bin/env node

import { createPieAppCommand } from './code/commands/createPieApp'

const main = () => {
    const [appName = ''] = process.argv.slice(2)
    if (!appName) {
        console.error('Usage: bun create pieui@latest <app-name>')
        process.exit(1)
    }
    createPieAppCommand(appName)
}

main()
