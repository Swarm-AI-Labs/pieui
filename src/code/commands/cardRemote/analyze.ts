import fs from 'node:fs'
import path from 'node:path'
import { analyzeComponentDeps, formatDepReport } from '../../cardDeps'
import { loadSettings } from '../../services/settings'

export type CardRemoteAnalyzeOptions = {
    componentName: string
    includeStories?: boolean
}

export const cardRemoteAnalyzeCommand = async (
    options: CardRemoteAnalyzeOptions
): Promise<void> => {
    if (!/^[A-Z][A-Za-z0-9]+$/.test(options.componentName)) {
        throw new Error(
            'Component name must start with uppercase letter and contain only letters and numbers'
        )
    }
    const settings = loadSettings()
    const componentDir = path.join(settings.componentsDir, options.componentName)
    if (
        !fs.existsSync(componentDir) ||
        !fs.statSync(componentDir).isDirectory()
    ) {
        throw new Error(`Component directory not found: ${componentDir}`)
    }
    const report = analyzeComponentDeps(componentDir, {
        includeStories: options.includeStories,
    })
    console.log(formatDepReport(report).join('\n'))
    if (report.hasBlockers) {
        console.log('')
        console.log(
            `[pieui] Blockers present (${report.blockerClasses.join(', ')}). Push will refuse without --allow-external.`
        )
    }
}
