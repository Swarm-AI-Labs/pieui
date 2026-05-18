/**
 * Split a component's import graph into `relativeImports` (project-local
 * file paths) and `packages` (third-party deps with version specs from
 * package.json).
 *
 * Resolution strategy:
 *   1. `ts.resolveModuleName` with a ts.sys-backed host.
 *   2. Manual fallback through `tsconfig.json` paths aliases for cases
 *      where Bundler resolution doesn't match (e.g. `@/components/*`).
 *
 * Output classification:
 *   - resolved path INSIDE cwd AND NOT under any `node_modules/` →
 *     `relativeImports`.
 *   - everything else → `packages`, with version copied verbatim from
 *     `package.json` deps (dev/peer/optional included) when known.
 */

import fs from 'node:fs'
import path from 'node:path'
import { ts } from '../ts'

type ResolveHost = {
    fileExists(name: string): boolean
    readFile(name: string): string | undefined
    directoryExists?(name: string): boolean
    getDirectories?(name: string): string[]
    getCurrentDirectory?(): string
    useCaseSensitiveFileNames?: boolean
    realpath?(name: string): string
}

const createHost = (cwd: string): ResolveHost => {
    const sys = (ts as any).sys
    return {
        fileExists: (name: string) =>
            sys ? sys.fileExists(name) : fs.existsSync(name),
        readFile: (name: string) => {
            if (sys) return sys.readFile(name)
            try {
                return fs.readFileSync(name, 'utf8')
            } catch {
                return undefined
            }
        },
        directoryExists: (name: string) =>
            sys
                ? sys.directoryExists(name)
                : fs.existsSync(name) && fs.statSync(name).isDirectory(),
        getDirectories: (name: string) =>
            sys
                ? sys.getDirectories(name)
                : fs.existsSync(name)
                  ? fs
                        .readdirSync(name, { withFileTypes: true })
                        .filter((e) => e.isDirectory())
                        .map((e) => e.name)
                  : [],
        getCurrentDirectory: () => cwd,
        useCaseSensitiveFileNames: sys ? sys.useCaseSensitiveFileNames : true,
        realpath: sys?.realpath,
    }
}

type TsconfigInfo = {
    paths?: Record<string, string[]>
    baseUrl?: string
}

const readTsconfig = (cwd: string): TsconfigInfo => {
    const tsconfigPath = path.join(cwd, 'tsconfig.json')
    if (!fs.existsSync(tsconfigPath)) return {}
    try {
        const raw = fs.readFileSync(tsconfigPath, 'utf8')
        const result = (ts as any).parseConfigFileTextToJson(tsconfigPath, raw)
        const parsed = result?.config as
            | {
                  compilerOptions?: {
                      paths?: Record<string, string[]>
                      baseUrl?: string
                  }
              }
            | undefined
        if (!parsed) return {}
        return {
            paths: parsed.compilerOptions?.paths,
            baseUrl: parsed.compilerOptions?.baseUrl,
        }
    } catch {
        return {}
    }
}

const resolveByTsconfigPaths = (
    spec: string,
    cwd: string,
    tsconfig: TsconfigInfo
): string | null => {
    if (!tsconfig.paths) return null
    const base = tsconfig.baseUrl ? path.resolve(cwd, tsconfig.baseUrl) : cwd
    for (const pattern of Object.keys(tsconfig.paths)) {
        const targets = tsconfig.paths[pattern]
        if (!targets || targets.length === 0) continue
        const star = pattern.indexOf('*')
        if (star === -1) {
            if (spec !== pattern) continue
            for (const target of targets) {
                const candidate = path.resolve(base, target)
                const resolved = tryExtensions(candidate)
                if (resolved) return resolved
            }
        } else {
            const prefix = pattern.slice(0, star)
            const suffix = pattern.slice(star + 1)
            if (!spec.startsWith(prefix) || !spec.endsWith(suffix)) continue
            const matched = spec.slice(
                prefix.length,
                spec.length - suffix.length
            )
            for (const target of targets) {
                const replaced = target.replace('*', matched)
                const candidate = path.resolve(base, replaced)
                const resolved = tryExtensions(candidate)
                if (resolved) return resolved
            }
        }
    }
    return null
}

const tryExtensions = (candidate: string): string | null => {
    const exts = ['', '.ts', '.tsx', '.d.ts', '.js', '.jsx']
    for (const ext of exts) {
        const file = candidate + ext
        if (fs.existsSync(file) && fs.statSync(file).isFile()) return file
    }
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        for (const ext of ['index.ts', 'index.tsx', 'index.js']) {
            const file = path.join(candidate, ext)
            if (fs.existsSync(file)) return file
        }
    }
    return null
}

const COMPILER_OPTIONS = (cwd: string): any => {
    const tsconfig = readTsconfig(cwd)
    return {
        allowJs: true,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        baseUrl: tsconfig.baseUrl ? path.resolve(cwd, tsconfig.baseUrl) : cwd,
        paths: tsconfig.paths,
    }
}

const collectImportSpecifiers = (sourceFile: any): string[] => {
    const out: string[] = []
    const visit = (node: any): void => {
        if (
            ts.isImportDeclaration(node) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
        ) {
            out.push(node.moduleSpecifier.text)
        } else if (
            ts.isExportDeclaration(node) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
        ) {
            out.push(node.moduleSpecifier.text)
        } else if (
            ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments[0] &&
            ts.isStringLiteral(node.arguments[0])
        ) {
            out.push(node.arguments[0].text)
        }
        ts.forEachChild(node, visit)
    }
    visit(sourceFile)
    return out
}

const isInside = (child: string, parent: string): boolean => {
    const rel = path.relative(parent, child)
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

const isNodeModulesPath = (file: string): boolean =>
    file.includes(`${path.sep}node_modules${path.sep}`)

const readPackageDeps = (cwd: string): Record<string, string> => {
    const pkgPath = path.join(cwd, 'package.json')
    if (!fs.existsSync(pkgPath)) return {}
    try {
        const raw = fs.readFileSync(pkgPath, 'utf8')
        const pkg = JSON.parse(raw) as {
            dependencies?: Record<string, string>
            devDependencies?: Record<string, string>
            peerDependencies?: Record<string, string>
            optionalDependencies?: Record<string, string>
        }
        return {
            ...pkg.dependencies,
            ...pkg.devDependencies,
            ...pkg.peerDependencies,
            ...pkg.optionalDependencies,
        }
    } catch {
        return {}
    }
}

const packageNameFromSpec = (spec: string): string => {
    if (spec.startsWith('@')) {
        const [scope, name] = spec.split('/')
        return name ? `${scope}/${name}` : scope
    }
    return spec.split('/')[0]
}

export type ImportSplit = {
    relativeImports: string[]
    packages: string[]
}

/**
 * Walk imports in each file and classify them.
 *
 * ASSUMES:
 *   - `files` are absolute paths.
 *   - `cwd` (default: `process.cwd()`) is the project root containing
 *     `tsconfig.json` and `package.json`.
 *
 * RETURNS:
 *   - `relativeImports`: sorted absolute paths to project-local files.
 *     `node_modules` paths are excluded — they're classified as packages.
 *   - `packages`: sorted strings ready for `bun add` / `npm install`.
 *     Format is either `name` (no version found) or `name@<spec>`
 *     where `<spec>` is the verbatim entry from package.json.
 *
 * EDGE CASES:
 *   - Symlinks INSIDE cwd → followed to realpath; if realpath is still
 *     inside cwd, kept as relativeImport; if outside, dropped as package.
 *   - Path-aliased imports (`@/x`) when `paths` is in tsconfig.json:
 *     resolved via `resolveByTsconfigPaths` if `ts.resolveModuleName`
 *     fails.
 *   - Bare specs starting with `.` or `/` that don't resolve to a real
 *     file → silently dropped (consumer can't add a missing file).
 */
export const extractImports = (
    files: string[],
    cwd: string = process.cwd()
): ImportSplit => {
    const options = COMPILER_OPTIONS(cwd)
    const host = createHost(cwd)
    const tsconfig = readTsconfig(cwd)
    const relativeSet = new Set<string>()
    const packageSet = new Set<string>()
    const deps = readPackageDeps(cwd)

    for (const file of files) {
        const text = host.readFile(file)
        if (!text) continue
        let sourceFile: any
        try {
            sourceFile = ts.createSourceFile(
                file,
                text,
                ts.ScriptTarget.ES2020,
                true,
                file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
            )
        } catch {
            continue
        }
        const specs = collectImportSpecifiers(sourceFile)
        for (const spec of specs) {
            const resolved = ts.resolveModuleName(spec, file, options, host)
            let resolvedAbs = resolved?.resolvedModule?.resolvedFileName
                ? path.resolve(resolved.resolvedModule.resolvedFileName)
                : null
            if (!resolvedAbs) {
                const viaPaths = resolveByTsconfigPaths(spec, cwd, tsconfig)
                if (viaPaths) resolvedAbs = path.resolve(viaPaths)
            }
            if (
                resolvedAbs &&
                isInside(resolvedAbs, cwd) &&
                !isNodeModulesPath(resolvedAbs)
            ) {
                relativeSet.add(resolvedAbs)
                continue
            }
            const isRelativeSpec =
                spec.startsWith('.') ||
                spec.startsWith('/') ||
                spec.startsWith('~')
            if (isRelativeSpec) {
                if (resolvedAbs && !isNodeModulesPath(resolvedAbs)) {
                    relativeSet.add(resolvedAbs)
                }
                continue
            }
            const pkgName = packageNameFromSpec(spec)
            const version = deps[pkgName]
            packageSet.add(version ? `${pkgName}@${version}` : pkgName)
        }
    }

    return {
        relativeImports: Array.from(relativeSet).sort(),
        packages: Array.from(packageSet).sort(),
    }
}
