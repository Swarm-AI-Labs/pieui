import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { Glob } from 'bun'

const SRC = resolve(import.meta.dir, '..')

// Files that MUST have 'use client' — they use hooks, browser APIs, or createContext
const CLIENT_REQUIRED_PATTERNS = [
    'util/mitt.ts',
    'util/socket.ts',
    'util/centrifuge.ts',
    'util/pieConfig.ts',
    'util/navigate.ts',
    'util/fallback.tsx',
    'util/useWebApp.ts',
    'util/useMaxWebApp.ts',
    'util/useIsSupported.ts',
    'util/useOpenAIWebRTC.ts',
    'util/ajaxCommonUtils.ts',
    'util/globalForm.ts',
    'components/PieCard/index.tsx',
    'components/UI/index.tsx',
    'components/PieRoot/index.tsx',
    'components/PieBaseRoot/index.tsx',
    'components/PieTelegramRoot/index.tsx',
    'components/PieMaxRoot/index.tsx',
    'providers/SocketIOInitProvider.tsx',
    'providers/CentrifugeIOInitProvider.tsx',
    'index.ts',
]

// Files that MUST NOT have 'use client' — they are server-safe
const SERVER_SAFE_PATTERNS = [
    'types/index.ts',
    'util/tailwindCommonUtils.ts',
    'util/sx2radium.ts',
    'util/registry.ts',
    'util/lazy.ts',
]

describe("'use client' directives", () => {
    for (const file of CLIENT_REQUIRED_PATTERNS) {
        test(`${file} has 'use client'`, () => {
            const content = readFileSync(resolve(SRC, file), 'utf-8')
            const firstLine = content.split('\n')[0].trim()
            expect(firstLine).toBe("'use client'")
        })
    }

    for (const file of SERVER_SAFE_PATTERNS) {
        test(`${file} does NOT have 'use client' (server-safe)`, () => {
            const content = readFileSync(resolve(SRC, file), 'utf-8')
            expect(content.startsWith("'use client'")).toBe(false)
        })
    }
})

describe('No module-level browser globals in server-safe files', () => {
    for (const file of SERVER_SAFE_PATTERNS) {
        test(`${file} does not reference window/document at module level`, () => {
            const content = readFileSync(resolve(SRC, file), 'utf-8')
            // Only check top-level, outside function bodies is hard to parse,
            // so just verify no raw window./document. usage exists
            const lines = content.split('\n')
            for (const line of lines) {
                const trimmed = line.trim()
                // Skip comments
                if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue
                // Module-level: lines that aren't inside a function
                if (
                    trimmed.startsWith('window.') ||
                    trimmed.startsWith('document.')
                ) {
                    throw new Error(
                        `${file} has module-level browser global: ${trimmed}`
                    )
                }
            }
        })
    }
})