#!/usr/bin/env node

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')

const prefixArg = argv.find((arg) => arg.startsWith('--prefix='))
const prefix = prefixArg ? prefixArg.split('=')[1] : 'pieui-'

const tempRoot = os.tmpdir()
const entries = fs.readdirSync(tempRoot, { withFileTypes: true })

const targets = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => path.join(tempRoot, entry.name))

if (targets.length === 0) {
    console.log(
        `[cleanup] No test artifact directories found in ${tempRoot} for prefix "${prefix}".`
    )
    process.exit(0)
}

console.log(
    `[cleanup] ${dryRun ? 'Would remove' : 'Removing'} ${targets.length} directories from ${tempRoot} (prefix: "${prefix}").`
)

for (const dirPath of targets) {
    if (dryRun) {
        console.log(`[cleanup] DRY-RUN ${dirPath}`)
        continue
    }
    fs.rmSync(dirPath, { recursive: true, force: true })
    console.log(`[cleanup] Removed ${dirPath}`)
}
