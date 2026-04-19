import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { initCommand } from './init'

const DEFAULT_TEMPLATE_SPEC = 'next-app@latest'
const SHARED_PAGE_TEMPLATE = `"use client";

import { useRouter } from "next/navigation";
import { PieRoot } from "@swarm.ing/pieui";
import "@/piecomponents/registry";
import { usePathname, useSearchParams } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";

export default function PiePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return (
    <PieRoot
      location={{ pathname, search }}
      config={{
        apiServer: process.env.PIE_API_SERVER!,
        centrifugeServer: process.env.PIE_CENTRIFUGE_SERVER!,
        enableRenderingLog: true,
      }}
      onNavigate={(url) => router.push(url)}
      fallback={<></>}
    />
  );
}
`

const HOME_PAGE_TEMPLATE = `"use client";

import PiePage from "@/app/_shared/page";
import { Suspense } from "react";

export default function HomePage() {
  return (
    <Suspense fallback={<></>}>
      <PiePage />
    </Suspense>
  );
}
`

const LOADING_SCREEN_TEMPLATE = `"use client";

export default function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
      Loading...
    </div>
  );
}
`

const clearDirectory = (targetDir: string) => {
    if (!fs.existsSync(targetDir)) return

    for (const entry of fs.readdirSync(targetDir)) {
        fs.rmSync(path.join(targetDir, entry), { recursive: true, force: true })
    }
}

const writeFile = (filePath: string, content: string) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content, 'utf8')
}

const scaffoldCreateAppFiles = (appDir: string) => {
    clearDirectory(path.join(appDir, 'public'))

    writeFile(path.join(appDir, 'app', '_shared', 'page.tsx'), SHARED_PAGE_TEMPLATE)
    writeFile(path.join(appDir, 'app', 'page.tsx'), HOME_PAGE_TEMPLATE)
    fs.rmSync(path.join(appDir, 'app', '_shared', 'simple.tsx'), {
        force: true,
    })
    fs.rmSync(path.join(appDir, 'app', 'piecache.json'), { force: true })
    writeFile(
        path.join(appDir, 'components', 'LoadingScreen.tsx'),
        LOADING_SCREEN_TEMPLATE
    )
    fs.rmSync(path.join(appDir, 'components', 'ErrorToast.tsx'), { force: true })
}

export const createCommand = (appName: string) => {
    const trimmedAppName = appName.trim()
    if (!trimmedAppName) {
        console.error('[pieui] Error: App name is required for create command')
        process.exit(1)
    }

    const appDir = path.resolve(process.cwd(), trimmedAppName)
    if (fs.existsSync(appDir)) {
        console.error(
            `[pieui] Error: Target directory already exists: ${trimmedAppName}`
        )
        process.exit(1)
    }

    const bunBin = process.env.PIEUI_CREATE_BUN_BIN || 'bun'
    const templateSpec =
        process.env.PIEUI_CREATE_NEXT_APP_SPEC || DEFAULT_TEMPLATE_SPEC

    console.log(`[pieui] Creating Next.js app in "${trimmedAppName}"...`)

    const result = spawnSync(
        bunBin,
        ['create', templateSpec, trimmedAppName, '--yes'],
        {
            cwd: process.cwd(),
            stdio: 'inherit',
            env: process.env,
        }
    )

    if (result.error) {
        throw result.error
    }
    if (result.status !== 0) {
        throw new Error(
            `create failed (exit code ${result.status ?? 'unknown'})`
        )
    }

    scaffoldCreateAppFiles(appDir)
    initCommand(trimmedAppName)

    console.log('[pieui] App created successfully.')
    console.log('[pieui] Next steps:')
    console.log(`  1. cd ${trimmedAppName}`)
    console.log('  2. bun run dev')
}
