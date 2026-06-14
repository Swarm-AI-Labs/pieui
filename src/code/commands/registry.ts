import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

import { loadSettings } from '../services/settings'

/**
 * `pieui registry [dev|build]` — run or build a standalone preview harness that
 * mounts ONLY {@link PiePreviewRoot} + the project's card registry, with none
 * of the application's own layout/providers/gating.
 *
 * The harness is a self-contained mini Next app generated under
 * `.pie/registry/` inside the frontend project, so it resolves the host's
 * `node_modules` and `@/...` imports (including `@/<components>/registry`).
 *
 * - `dev`   → `next dev` on the harness (reads `PIE_API_SERVER`, cross-origin
 *             to an ephemeral backend with CORS). Used by `pie card show`.
 * - `build` → `next build` with `output: "export"` → a static SPA in
 *             `.pie/registry/out`, served same-origin by `pie`
 *             (`disable_serving=False`); the card API is relative (`/`).
 */

const REGISTRY_DIR = '.pie/registry'
const OUT_DIRNAME = 'out'

type RegistryOptions = {
    port?: number
    apiServer?: string
    out?: string
}

const writeIfChanged = (filePath: string, contents: string): void => {
    if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === contents) {
        return
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, contents, 'utf8')
}

/**
 * (Re)generate the mini Next app under `<frontend>/.pie/registry/`.
 * `registryName` is the basename of the components dir (e.g. `piecomponents`),
 * used to import the host card registry as `@/<name>/registry`.
 */
const scaffoldHarness = (frontendRoot: string, registryName: string): string => {
    const dir = path.join(frontendRoot, REGISTRY_DIR)

    // Minimal package.json so Next treats this dir as the project root; deps
    // resolve upward to the host's node_modules.
    writeIfChanged(
        path.join(dir, 'package.json'),
        JSON.stringify(
            { name: 'pie-registry-preview', version: '0.0.0', private: true },
            null,
            2
        ) + '\n'
    )

    // Static-export Next config. `@` → frontend root is provided via tsconfig
    // paths (honored by both Turbopack and webpack); `env` exposes
    // PIE_API_SERVER to the client (set at `next dev` start; empty for the
    // static build so the client falls back to a same-origin `/`).
    writeIfChanged(
        path.join(dir, 'next.config.mjs'),
        `import path from 'node:path'

// Next runs with cwd = this harness dir; the frontend project is two levels up.
const harnessRoot = process.cwd()
const frontendRoot = path.resolve(harnessRoot, '..', '..')

/** @type {import('next').NextConfig} */
export default {
  output: 'export',
  reactStrictMode: true,
  // Next 16 blocks dev requests from non-localhost origins; allow loopback so
  // the HMR socket / lazy chunk loading work when opened via 127.0.0.1.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  transpilePackages: ['@swarm.ing/pieui'],
  // The workspace root must be the frontend project: that's where node_modules
  // (incl. \`next\`) lives and where the card registry + cards are imported from
  // (outside this harness dir). The app dir stays this harness (cwd).
  outputFileTracingRoot: frontendRoot,
  env: {
    PIE_API_SERVER: process.env.PIE_API_SERVER ?? '',
    NEXT_PUBLIC_PIE_API_SERVER: process.env.NEXT_PUBLIC_PIE_API_SERVER ?? '',
  },
  turbopack: { root: frontendRoot, resolveAlias: { '@': frontendRoot } },
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = { ...(config.resolve.alias || {}), '@': frontendRoot }
    return config
  },
}
`
    )

    // baseUrl = frontend root so \`@/*\` resolves to the host project (the card
    // registry and every card it imports rely on the \`@\` alias).
    writeIfChanged(
        path.join(dir, 'tsconfig.json'),
        JSON.stringify(
            {
                compilerOptions: {
                    target: 'ES2017',
                    lib: ['dom', 'dom.iterable', 'esnext'],
                    allowJs: true,
                    skipLibCheck: true,
                    strict: false,
                    noEmit: true,
                    esModuleInterop: true,
                    module: 'esnext',
                    moduleResolution: 'bundler',
                    resolveJsonModule: true,
                    isolatedModules: true,
                    jsx: 'preserve',
                    incremental: true,
                    baseUrl: '../..',
                    paths: { '@/*': ['./*'] },
                    plugins: [{ name: 'next' }],
                },
                include: [
                    'next-env.d.ts',
                    '**/*.ts',
                    '**/*.tsx',
                    '.next/types/**/*.ts',
                ],
                exclude: ['node_modules'],
            },
            null,
            2
        ) + '\n'
    )

    // Bare root layout — no providers, no gating, no host chrome.
    writeIfChanged(
        path.join(dir, 'app', 'layout.tsx'),
        `import '@/app/globals.css'

export const metadata = { title: 'Pie Registry Preview' }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`
    )

    // Client-only mount: keep the card graph out of prerender (mirrors how host
    // apps load the registry via \`dynamic(..., { ssr: false })\`).
    writeIfChanged(
        path.join(dir, 'app', 'page.tsx'),
        `'use client'

import dynamic from 'next/dynamic'

const PreviewClient = dynamic(
  () =>
    import('./preview-client').catch((e) => ({
      default: () => (
        <pre style={{ color: 'red', padding: 16, whiteSpace: 'pre-wrap' }}>
          {'[pie] preview harness failed to load:\\n' + String(e && e.stack ? e.stack : e)}
        </pre>
      ),
    })),
  { ssr: false, loading: () => <div style={{ padding: 16 }}>harness loading…</div> }
)

export default function Page() {
  return <PreviewClient />
}
`
    )

    writeIfChanged(
        path.join(dir, 'app', 'preview-client.tsx'),
        `'use client'

import '@/${registryName}/registry'
import { PiePreviewRoot } from '@swarm.ing/pieui'

export default function PreviewClient() {
  // Dev: NEXT_PUBLIC_PIE_API_SERVER points at the ephemeral backend (Next
  // statically inlines NEXT_PUBLIC_* into the client bundle). Static build:
  // unset → falls back to same-origin '/' (pie serves both the SPA and API).
  const apiServer = process.env.NEXT_PUBLIC_PIE_API_SERVER || '/'
  return <PiePreviewRoot apiServer={apiServer} pathname="/" />
}
`
    )

    // .gitignore the generated harness by default.
    writeIfChanged(path.join(dir, '.gitignore'), '*\n')

    return dir
}

const resolveNextBin = (frontendRoot: string): string => {
    const bin = path.join(frontendRoot, 'node_modules', '.bin', 'next')
    if (!fs.existsSync(bin)) {
        throw new Error(
            `Next.js binary not found at ${bin}. Install dependencies in the ` +
                `frontend project first (the registry harness reuses them).`
        )
    }
    return bin
}

export const registryCommand = (
    action: 'dev' | 'build',
    opts: RegistryOptions = {}
): void => {
    const frontendRoot = process.cwd()
    const settings = loadSettings(frontendRoot)
    const registryName = path.basename(settings.componentsDir)

    const dir = scaffoldHarness(frontendRoot, registryName)
    const nextBin = resolveNextBin(frontendRoot)

    const env = { ...process.env }
    if (opts.apiServer) {
        env.PIE_API_SERVER = opts.apiServer
        env.NEXT_PUBLIC_PIE_API_SERVER = opts.apiServer
    }

    if (action === 'dev') {
        const port = opts.port ?? 3210
        console.log(`[pieui] registry dev → http://localhost:${port}`)
        console.log(`[pieui]   harness: ${dir}`)
        console.log(`[pieui]   PIE_API_SERVER=${env.PIE_API_SERVER ?? '(unset → /)'}`)
        const result = spawnSync(nextBin, ['dev', '-p', String(port)], {
            cwd: dir,
            stdio: 'inherit',
            env,
        })
        if (result.error) throw result.error
        if (typeof result.status === 'number' && result.status !== 0) {
            process.exitCode = result.status
        }
        return
    }

    // build → static export. Force a same-origin client (no baked API server).
    delete env.PIE_API_SERVER
    delete env.NEXT_PUBLIC_PIE_API_SERVER
    console.log(`[pieui] registry build (static export) → ${path.join(dir, OUT_DIRNAME)}`)
    const result = spawnSync(nextBin, ['build'], {
        cwd: dir,
        stdio: 'inherit',
        env,
    })
    if (result.error) throw result.error
    if (typeof result.status === 'number' && result.status !== 0) {
        process.exitCode = result.status
        return
    }
    const outDir = opts.out
        ? path.resolve(frontendRoot, opts.out)
        : path.join(dir, OUT_DIRNAME)
    console.log(`[pieui] registry build complete: ${outDir}`)
}
