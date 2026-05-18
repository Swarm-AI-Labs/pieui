import fs from 'node:fs'
import path from 'node:path'

const PIE_CONFIG_REL = '.pie/config.json'

type PieConfig = {
    backendPagesDir?: string
    backendComponentsDir?: string
    frontendProjectDir?: string
}

const readPieConfig = (): PieConfig => {
    const cfgPath = path.join(process.cwd(), PIE_CONFIG_REL)
    if (!fs.existsSync(cfgPath)) return {}
    try {
        return JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as PieConfig
    } catch {
        return {}
    }
}

const snakeCaseCardFile = (componentName: string): string => {
    const snake = componentName
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toLowerCase()
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
    return snake.endsWith('_card') ? `${snake}.py` : `${snake}_card.py`
}

const backendCardPath = (componentName: string): string => {
    const cfg = readPieConfig()
    if (!cfg.backendComponentsDir) {
        return `<backendComponentsDir>/${snakeCaseCardFile(componentName)}`
    }
    return path.join(cfg.backendComponentsDir, snakeCaseCardFile(componentName))
}

const backendPagesDir = (): string => {
    const cfg = readPieConfig()
    return cfg.backendPagesDir ?? '<backendPagesDir>'
}

export const printRequirements = (lines: string[]): void => {
    const filtered = lines.filter((l) => l && l.trim().length > 0)
    if (filtered.length === 0) return
    console.log('')
    console.log('Requirements:')
    for (const line of filtered) console.log(`  - ${line}`)
}

export const cardAddRequirements = (
    componentName: string,
    options: { ported: boolean }
): string[] => {
    const backendFile = backendCardPath(componentName)
    const cfg = readPieConfig()
    const hasBackendDir = !!cfg.backendComponentsDir
    const out: string[] = []

    if (options.ported) {
        out.push(
            `Backend source for ${componentName} is at ${backendFile}. Any prop/event/input change on either side is a contract change — re-port with \`pie card add … --from ${componentName}\` or \`pieui card add ${componentName} --from\` to keep them aligned.`
        )
    } else {
        out.push(
            hasBackendDir
                ? `Mirror this card on the Python backend: \`pie card add simple ${componentName}\` (target: ${backendFile}). Once it exists, prefer \`pieui card add ${componentName} --from\` for future re-ports so propsSchema stays aligned.`
                : `Mirror this card on the Python backend. First link the project: set "backendComponentsDir" in ${PIE_CONFIG_REL}. Then run \`pie card add simple ${componentName}\`.`
        )
    }
    out.push(
        `Keep propsSchema, eventsPropsSchema, and inputPropsSchema in sync between sides. Verify with \`pieui card check-sync ${componentName}\`.`
    )
    out.push(
        `data.name is read at runtime by <PieCard>: ensure \`name: string\` stays on the data interface (the Python Card already inherits it).`
    )
    out.push(
        `Input metadata (stored prop) is detected only when \`stored={…}\` references a named interface or type alias — inline object literals are invisible to \`card dump-metadata\`.`
    )
    out.push(
        `Events come from inline \`methods={{ … }}\` on <PieCard>; the Python side must list the same names in get_supported_events().`
    )
    return out
}

export const cardRemoveRequirements = (componentName: string): string[] => {
    const cfg = readPieConfig()
    if (!cfg.backendComponentsDir) return []
    const backendFile = backendCardPath(componentName)
    if (!fs.existsSync(backendFile)) return []
    return [
        `The Python module at ${backendFile} is now orphaned. Remove it on the backend (\`rm ${backendFile}\`) and unregister it from any page that references it.`,
    ]
}

export const cardAddEventRequirements = (
    componentName: string,
    eventName: string
): string[] => {
    const backendFile = backendCardPath(componentName)
    return [
        `Add ${JSON.stringify(eventName)} to get_supported_events() on ${backendFile} and implement the corresponding handler.`,
        `If the event payload has a type, mirror it on the backend so eventsPropsSchema lines up. Verify with \`pieui card check-sync ${componentName}\`.`,
    ]
}

export const pageAddRequirements = (pagePath: string): string[] => {
    const cfg = readPieConfig()
    const pagesDir = cfg.backendPagesDir
    if (!pagesDir) {
        return [
            `Mirror this page on the Python backend: configure "backendPagesDir" in ${PIE_CONFIG_REL}, then run \`pie page add ${pagePath}\`.`,
        ]
    }
    return [
        `Mirror this page on the Python backend: \`pie page add ${pagePath}\` (target dir: ${pagesDir}).`,
        `Any AJAX handler must be wired both ways — \`pieui page ajax ${pagePath} add <handler>\` already delegates to pie.`,
    ]
}

export const initRequirements = (): string[] => {
    const cfg = readPieConfig()
    const sbMain =
        fs.existsSync(path.join(process.cwd(), '.storybook')) &&
        fs.statSync(path.join(process.cwd(), '.storybook')).isDirectory()
    const out: string[] = []
    if (!cfg.backendPagesDir || !cfg.backendComponentsDir) {
        out.push(
            `Link the Python (pie) project: set "backendPagesDir" and "backendComponentsDir" (absolute paths) in ${PIE_CONFIG_REL}. They enable auto-resolve for \`pieui card add --from\` and subprocess delegation for \`pieui page ajax\`.`
        )
        out.push(
            `On the backend side, \`pie init\` should likewise set "frontendProjectDir" to this directory.`
        )
    }
    if (!sbMain && process.env.PIEUI_INIT_SKIP_STORYBOOK_HINT !== '1') {
        out.push(
            `Install Storybook for the PieCard methods panel: \`bunx storybook@latest init --yes --no-dev\`. Then re-run \`pieui init\` to wire \`'@swarm.ing/pieui/storybook/addon'\` into \`.storybook/main.ts\`.`
        )
    }
    return out
}

export const cardAddStoryRequirements = (componentName: string): string[] => {
    return [
        `Install Storybook in the host app (\`npx storybook@latest init --type=nextjs\`) and add \`'@swarm.ing/pieui/storybook/addon'\` to its \`.storybook/main.ts\` addons list.`,
        `The generated story passes \`useMittSupport: true\` in args so the addon's "Fire" buttons reach the card. If you change to socketio/centrifuge transports, scaffold a corresponding story.`,
        `Re-run \`pieui card add-story ${componentName}\` after changing the card's \`methods={{ … }}\` so the addon panel stays in sync with eventsPropsSchema.`,
    ]
}

export const createRequirements = (appName: string): string[] => {
    return [
        `Bootstrap the Python backend: in your pie repo, run \`pie init\` and set "frontendProjectDir" to the new app directory (./${appName}).`,
        `Verify the two sides see each other: \`pieui card add <Name> --from\` (TS ← Python) and \`pie card add <type> <Name> --from\` (Python ← TS) both rely on these links.`,
        `Storybook is wired by default (\`.storybook/main.ts\` already includes \`'@swarm.ing/pieui/storybook/addon'\`). Run \`bun storybook\` inside ./${appName} to launch it, and \`pieui card add-story <Name>\` to scaffold stories per card. Skip with PIEUI_CREATE_SKIP_STORYBOOK=1 next time.`,
    ]
}
