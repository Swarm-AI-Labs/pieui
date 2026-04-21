export const parseDotenv = (content: string): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const eq = line.indexOf('=')
        if (eq === -1) continue
        const key = line.slice(0, eq).trim()
        if (!key) continue
        let value = line.slice(eq + 1).trim()
        if (
            value.length >= 2 &&
            ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'")))
        ) {
            value = value.slice(1, -1)
        }
        out[key] = value
    }
    return out
}
