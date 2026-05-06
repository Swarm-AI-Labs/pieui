import fs from 'node:fs'
import path from 'node:path'
import { ts } from './ts'

export type DepClass =
    | 'internal'
    | 'escapes-component'
    | 'alias-outside'
    | 'bare-npm'
    | 'unresolved'
    | 'asset'

export type DepEdge = {
    from: string
    specifier: string
    resolved?: string
    cls: DepClass
}

export type DepReport = {
    componentDir: string
    filesScanned: string[]
    filesExcluded: string[]
    edges: DepEdge[]
    blockerClasses: DepClass[]
    hasBlockers: boolean
}

export type AnalyzeOptions = {
    includeStories?: boolean
    blockerClasses?: DepClass[]
}

const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']
const ASSET_EXTS = new Set([
    '.css',
    '.scss',
    '.sass',
    '.less',
    '.svg',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.avif',
    '.woff',
    '.woff2',
    '.ttf',
    '.otf',
    '.json',
    '.md',
    '.txt',
])

const EXCLUDE_PATTERNS = [
    /\.stories\.[jt]sx?$/,
    /\.test\.[jt]sx?$/,
    /\.spec\.[jt]sx?$/,
    /\.d\.ts$/,
]

const DEFAULT_BLOCKERS: DepClass[] = [
    'escapes-component',
    'alias-outside',
    'unresolved',
]

const isInside = (parent: string, child: string): boolean => {
    const rel = path.relative(parent, child)
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

const isRelativeSpec = (spec: string): boolean =>
    spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..'

const hasAssetExtension = (spec: string): boolean => {
    const idx = spec.lastIndexOf('.')
    if (idx === -1) return false
    const ext = spec.slice(idx).toLowerCase()
    return ASSET_EXTS.has(ext)
}

const collectSpecifiers = (sourceFile: any): string[] => {
    const out: string[] = []
    const visit = (node: any): void => {
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
        ) {
            out.push(node.moduleSpecifier.text)
        } else if (
            ts.isImportEqualsDeclaration(node) &&
            ts.isExternalModuleReference(node.moduleReference) &&
            ts.isStringLiteral(node.moduleReference.expression)
        ) {
            out.push(node.moduleReference.expression.text)
        } else if (ts.isCallExpression(node)) {
            const expr = node.expression
            const isDynamicImport = expr.kind === ts.SyntaxKind.ImportKeyword
            const isRequire =
                ts.isIdentifier(expr) && expr.text === 'require'
            if (
                (isDynamicImport || isRequire) &&
                node.arguments.length > 0 &&
                ts.isStringLiteral(node.arguments[0])
            ) {
                out.push((node.arguments[0] as { text: string }).text)
            }
        }
        ts.forEachChild(node, visit)
    }
    visit(sourceFile)
    return out
}

const findHostTsconfig = (start: string): string | undefined => {
    let dir = start
    for (let i = 0; i < 12; i++) {
        const candidate = path.join(dir, 'tsconfig.json')
        if (fs.existsSync(candidate)) return candidate
        const parent = path.dirname(dir)
        if (parent === dir) return undefined
        dir = parent
    }
    return undefined
}

const loadCompilerOptions = (
    componentDir: string
): {
    options: any
    aliasPrefixes: string[]
    configPath?: string
} => {
    const configPath = findHostTsconfig(path.dirname(componentDir))
    const fallback: any = {
        allowJs: true,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
    }
    if (!configPath) return { options: fallback, aliasPrefixes: [] }
    const read = ts.readConfigFile(configPath, ts.sys.readFile)
    if (read.error || !read.config)
        return { options: fallback, aliasPrefixes: [], configPath }
    const parsed = ts.parseJsonConfigFileContent(
        read.config,
        ts.sys,
        path.dirname(configPath)
    )
    const merged: any = {
        ...fallback,
        ...parsed.options,
    }
    if (
        merged.moduleResolution === ts.ModuleResolutionKind.Bundler ||
        (merged.moduleResolution as unknown) === undefined
    ) {
        merged.moduleResolution = ts.ModuleResolutionKind.NodeNext
        merged.module = ts.ModuleKind.NodeNext
    }
    const aliasPrefixes: string[] = parsed.options.paths
        ? Object.keys(parsed.options.paths)
        : []
    return { options: merged, aliasPrefixes, configPath }
}

const matchesAlias = (spec: string, aliasPrefixes: string[]): boolean => {
    for (const pattern of aliasPrefixes) {
        const star = pattern.indexOf('*')
        if (star === -1) {
            if (spec === pattern) return true
            continue
        }
        const prefix = pattern.slice(0, star)
        const suffix = pattern.slice(star + 1)
        if (spec.startsWith(prefix) && spec.endsWith(suffix)) return true
    }
    return false
}

const enumerateSourceFiles = (
    componentDir: string,
    includeStories: boolean
): { kept: string[]; excluded: string[] } => {
    const kept: string[] = []
    const excluded: string[] = []
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                walk(abs)
                continue
            }
            if (!entry.isFile()) continue
            const ext = path.extname(entry.name).toLowerCase()
            if (!SOURCE_EXTS.includes(ext)) continue
            const isExcluded = EXCLUDE_PATTERNS.some((re) => re.test(entry.name))
            if (isExcluded && !includeStories) {
                excluded.push(abs)
            } else {
                kept.push(abs)
            }
        }
    }
    walk(componentDir)
    kept.sort()
    excluded.sort()
    return { kept, excluded }
}

const classifyResolved = (args: {
    spec: string
    fromFile: string
    componentDir: string
    aliasPrefixes: string[]
    resolved?: { resolvedFileName: string; isExternalLibraryImport?: boolean }
}): { cls: DepClass; resolvedPath?: string } => {
    const { spec, componentDir, aliasPrefixes, resolved } = args
    if (resolved) {
        if (resolved.isExternalLibraryImport) {
            return { cls: 'bare-npm', resolvedPath: resolved.resolvedFileName }
        }
        const resolvedPath = resolved.resolvedFileName
        if (isInside(componentDir, resolvedPath)) {
            return { cls: 'internal', resolvedPath }
        }
        if (isRelativeSpec(spec)) {
            return { cls: 'escapes-component', resolvedPath }
        }
        return { cls: 'alias-outside', resolvedPath }
    }
    if (hasAssetExtension(spec)) return { cls: 'asset' }
    if (isRelativeSpec(spec)) return { cls: 'unresolved' }
    if (matchesAlias(spec, aliasPrefixes)) return { cls: 'alias-outside' }
    return { cls: 'bare-npm' }
}

export const analyzeComponentDeps = (
    componentDir: string,
    opts: AnalyzeOptions = {}
): DepReport => {
    const absComponentDir = path.resolve(componentDir)
    const includeStories = opts.includeStories === true
    const blockerClasses = opts.blockerClasses ?? DEFAULT_BLOCKERS
    const { kept, excluded } = enumerateSourceFiles(
        absComponentDir,
        includeStories
    )
    const { options, aliasPrefixes } = loadCompilerOptions(absComponentDir)
    const host = ts.createCompilerHost(options, true)
    const moduleResolutionHost: any = {
        fileExists: (f: string) => host.fileExists(f),
        readFile: (f: string) => host.readFile(f),
        directoryExists: host.directoryExists?.bind(host),
        getCurrentDirectory: host.getCurrentDirectory.bind(host),
        getDirectories: host.getDirectories?.bind(host),
        realpath: host.realpath?.bind(host),
        useCaseSensitiveFileNames: () => host.useCaseSensitiveFileNames(),
    }

    const edges: DepEdge[] = []
    const visited = new Set<string>()
    const queue: string[] = [...kept]

    while (queue.length > 0) {
        const file = queue.shift() as string
        if (visited.has(file)) continue
        visited.add(file)
        if (!fs.existsSync(file)) continue
        const text = fs.readFileSync(file, 'utf8')
        const sourceFile = ts.createSourceFile(
            file,
            text,
            ts.ScriptTarget.Latest,
            true,
            file.endsWith('.tsx') || file.endsWith('.jsx')
                ? ts.ScriptKind.TSX
                : undefined
        )
        const specs = collectSpecifiers(sourceFile)
        for (const spec of specs) {
            if (hasAssetExtension(spec) && !SOURCE_EXTS.some((e) => spec.endsWith(e))) {
                edges.push({
                    from: path.relative(absComponentDir, file),
                    specifier: spec,
                    cls: 'asset',
                })
                continue
            }
            const result = ts.resolveModuleName(
                spec,
                file,
                options,
                moduleResolutionHost
            )
            const { cls, resolvedPath } = classifyResolved({
                spec,
                fromFile: file,
                componentDir: absComponentDir,
                aliasPrefixes,
                resolved: result.resolvedModule,
            })
            edges.push({
                from: path.relative(absComponentDir, file),
                specifier: spec,
                resolved: resolvedPath,
                cls,
            })
            if (
                cls === 'internal' &&
                resolvedPath &&
                !visited.has(resolvedPath) &&
                SOURCE_EXTS.includes(path.extname(resolvedPath).toLowerCase())
            ) {
                queue.push(resolvedPath)
            }
        }
    }

    const filesScanned = Array.from(visited)
        .filter((f) => isInside(absComponentDir, f))
        .map((f) => path.relative(absComponentDir, f))
        .sort()
    const filesExcluded = excluded
        .map((f) => path.relative(absComponentDir, f))
        .sort()

    const blockerSet = new Set(blockerClasses)
    const hasBlockers = edges.some((e) => blockerSet.has(e.cls))

    return {
        componentDir: absComponentDir,
        filesScanned,
        filesExcluded,
        edges,
        blockerClasses,
        hasBlockers,
    }
}

export const formatDepReport = (report: DepReport): string[] => {
    const lines: string[] = []
    const componentName = path.basename(report.componentDir)
    lines.push(`component ${componentName}`)
    lines.push(
        `files-scanned ${report.filesScanned.length}   excluded ${report.filesExcluded.length}`
    )
    if (report.filesExcluded.length > 0) {
        for (const f of report.filesExcluded) lines.push(`  excluded ${f}`)
    }
    const groups: Record<DepClass, DepEdge[]> = {
        internal: [],
        'bare-npm': [],
        'escapes-component': [],
        'alias-outside': [],
        unresolved: [],
        asset: [],
    }
    for (const edge of report.edges) groups[edge.cls].push(edge)
    const order: DepClass[] = [
        'internal',
        'bare-npm',
        'escapes-component',
        'alias-outside',
        'unresolved',
        'asset',
    ]
    for (const cls of order) {
        const list = groups[cls]
        if (list.length === 0) continue
        const unique = new Map<string, DepEdge>()
        for (const e of list) {
            const key = `${e.from}::${e.specifier}`
            if (!unique.has(key)) unique.set(key, e)
        }
        lines.push('')
        lines.push(`${cls} ${unique.size}`)
        for (const e of unique.values()) {
            lines.push(`  ${e.from} → ${e.specifier}`)
        }
    }
    return lines
}
