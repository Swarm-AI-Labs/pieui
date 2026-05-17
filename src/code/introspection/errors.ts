/**
 * Errors raised by TS introspection.
 *
 * Each error carries:
 *   - the file being analysed (`sourceFile`)
 *   - line/column when available
 *   - a stack of contexts describing the location in the structure
 *   - actionable hint about how to fix the source
 *
 * These propagate to the CLI without being caught — the whole point
 * of the strict model is to surface unknown shapes loudly.
 */

export type IntrospectionErrorOptions = {
    sourceFile?: string
    line?: number
    column?: number
    context?: string[]
    hint?: string
}

export class IntrospectionError extends Error {
    sourceFile?: string
    line?: number
    column?: number
    context: string[]
    hint?: string

    constructor(message: string, opts: IntrospectionErrorOptions = {}) {
        const parts: string[] = []
        if (opts.sourceFile) {
            let loc = opts.sourceFile
            if (opts.line !== undefined) {
                loc += `:${opts.line}`
                if (opts.column !== undefined) loc += `:${opts.column}`
            }
            parts.push(loc)
        }
        if (opts.context && opts.context.length > 0) {
            parts.push(opts.context.join(' → '))
        }
        parts.push(message)
        let rendered = parts.join(' | ')
        if (opts.hint) rendered += `\n  hint: ${opts.hint}`
        super(rendered)
        this.name = 'IntrospectionError'
        this.sourceFile = opts.sourceFile
        this.line = opts.line
        this.column = opts.column
        this.context = opts.context ? [...opts.context] : []
        this.hint = opts.hint
    }

    /** Push a context frame and return self (for try/catch rethrow). */
    withContext(frame: string): IntrospectionError {
        this.context.unshift(frame)
        // Rebuild message to include new frame.
        const m = new IntrospectionError(this.bareMessage(), {
            sourceFile: this.sourceFile,
            line: this.line,
            column: this.column,
            context: this.context,
            hint: this.hint,
        })
        this.message = m.message
        return this
    }

    private bareMessage(): string {
        // Reconstruct the original "bare" message by stripping the
        // location/context prefix we added in the constructor.
        let raw = this.message
        if (this.hint) {
            const hintMark = `\n  hint: ${this.hint}`
            if (raw.endsWith(hintMark)) raw = raw.slice(0, -hintMark.length)
        }
        const parts = raw.split(' | ')
        return parts[parts.length - 1] ?? raw
    }
}

const lineCol = (sourceFile: any, node: any): {
    line?: number
    column?: number
} => {
    if (!sourceFile || !node || typeof node.getStart !== 'function') return {}
    try {
        const start = node.getStart(sourceFile)
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            start
        )
        return { line: line + 1, column: character + 1 }
    } catch {
        return {}
    }
}

export const errorOptsFromNode = (
    sourceFile: any,
    node: any
): IntrospectionErrorOptions => ({
    sourceFile: sourceFile?.fileName,
    ...lineCol(sourceFile, node),
})
