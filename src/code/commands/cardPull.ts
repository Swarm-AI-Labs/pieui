import fs from 'node:fs'
import path from 'node:path'
import { cardRemotePullCommand } from './cardRemote/pull'
import { restoreComponentFromEnvelopeText } from '../services/dumpEnvelope'

const isHttpUrl = (ref: string): boolean => /^https?:\/\//i.test(ref)

const isLocalJsonPath = (ref: string): boolean => {
    if (
        ref.startsWith('./') ||
        ref.startsWith('../') ||
        ref.startsWith('/') ||
        ref.startsWith('~')
    ) {
        return true
    }
    if (!ref.endsWith('.json')) return false
    return fs.existsSync(path.resolve(process.cwd(), ref))
}

const fetchJsonText = async (url: string): Promise<string> => {
    const res = await fetch(url)
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${url}`)
    }
    return await res.text()
}

const printRestoreOutput = (
    componentName: string,
    written: string[],
    label: string
): void => {
    console.log(`[pieui] Pulled card from ${label}: ${componentName}`)
    for (const w of written) console.log(`[pieui] Path: ${w}`)
}

export const cardPullCommand = async (cardRef: string): Promise<void> => {
    if (isHttpUrl(cardRef)) {
        console.log(`[pieui] Fetching dump from ${cardRef}`)
        const raw = await fetchJsonText(cardRef)
        const { componentName, written } = restoreComponentFromEnvelopeText(
            raw,
            cardRef
        )
        printRestoreOutput(componentName, written, cardRef)
        return
    }
    if (isLocalJsonPath(cardRef)) {
        const abs = path.resolve(process.cwd(), cardRef)
        if (!fs.existsSync(abs)) {
            throw new Error(`Pull source not found: ${abs}`)
        }
        if (!fs.statSync(abs).isFile()) {
            throw new Error(`Pull source is not a file: ${abs}`)
        }
        const { componentName, written } = restoreComponentFromEnvelopeText(
            fs.readFileSync(abs, 'utf8'),
            abs
        )
        printRestoreOutput(componentName, written, abs)
        return
    }
    await cardRemotePullCommand(cardRef)
}
