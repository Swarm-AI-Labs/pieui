/**
 * Verifies that the built package exports all expected symbols
 * and that they are actually defined (not undefined/broken references).
 *
 * Run: node scripts/verify-exports.mjs
 */

import { readFileSync, existsSync } from 'node:fs'

const EXPECTED_MAIN_EXPORTS = [
  'UI',
  'PieRoot',
  'PieTelegramRoot',
  'PieBaseRoot',
  'PieMaxRoot',
  'PieCard',
  'registerPieComponent',
  'initializePieComponents',
  'isPieComponentsInitialized',
  'useAjaxSubmit',
  'useOpenAIWebRTC',
  'sx2radium',
  'cn',
  'PIEBREAK',
  'submitGlobalForm',
]

const EXPECTED_COMPONENTS_EXPORTS = [
  'PieCard',
  'UI',
  'ChatCard',
  'AjaxButtonCard',
  'RedirectButtonCard',
  'SequenceCard',
  'UnionCard',
  'HTMLEmbedCard',
  'OpenAIVoiceAgentCard',
  'HiddenCard',
  'AutoRedirectCard',
  'IOEventsCard',
]

const MIN_BUNDLE_SIZE = 10_000

let failed = false

function fail(msg) {
  console.error(`  FAIL: ${msg}`)
  failed = true
}

function pass(msg) {
  console.log(`  OK: ${msg}`)
}

function checkBundle(label, filePath, expectedExports) {
  console.log(`\n--- ${label} ---`)

  if (!existsSync(filePath)) {
    fail(`${filePath} does not exist`)
    return
  }

  const content = readFileSync(filePath, 'utf8')
  const size = Buffer.byteLength(content)
  console.log(`  Size: ${size} bytes`)

  // 1. Size check
  if (size < MIN_BUNDLE_SIZE) {
    fail(`Bundle too small (${size} bytes) — likely empty re-exports without code`)
    return
  }
  pass(`Bundle size OK (${size} bytes)`)

  // 2. Export name presence
  const missing = expectedExports.filter((name) => !content.includes(name))
  if (missing.length > 0) {
    fail(`Missing export names: ${missing.join(', ')}`)
  } else {
    pass(`All ${expectedExports.length} export names present`)
  }

  // 3. ESM: check that imports from externals actually exist (not stripped)
  if (filePath.includes('.esm.')) {
    const hasReactImport = /from\s*["']react["']/.test(content)
    if (!hasReactImport) {
      fail('No import from "react" found — external imports may have been stripped')
    } else {
      pass('External "react" import present')
    }
  }

  // 4. CJS: check that require calls for externals exist
  if (!filePath.includes('.esm.')) {
    const hasReactRequire = /require\(["']react["']\)/.test(content)
    if (!hasReactRequire) {
      fail('No require("react") found — external requires may have been stripped')
    } else {
      pass('External require("react") present')
    }
  }
}

function checkTypeDefinitions() {
  console.log('\n--- Type Definitions ---')
  const files = ['dist/index.d.ts', 'dist/components/index.d.ts']
  for (const f of files) {
    if (!existsSync(f)) {
      fail(`Missing: ${f}`)
    } else {
      const content = readFileSync(f, 'utf8')
      if (content.length < 100) {
        fail(`${f} is suspiciously small (${content.length} bytes)`)
      } else {
        pass(`${f} exists (${content.length} bytes)`)
      }
    }
  }
}

// Run checks
checkBundle('Main ESM (dist/index.esm.js)', 'dist/index.esm.js', EXPECTED_MAIN_EXPORTS)
checkBundle('Main CJS (dist/index.js)', 'dist/index.js', EXPECTED_MAIN_EXPORTS)
checkBundle('Components ESM (dist/components/index.esm.js)', 'dist/components/index.esm.js', EXPECTED_COMPONENTS_EXPORTS)
checkBundle('Components CJS (dist/components/index.js)', 'dist/components/index.js', EXPECTED_COMPONENTS_EXPORTS)
checkTypeDefinitions()

console.log('')
if (failed) {
  console.error('BUILD VERIFICATION FAILED')
  process.exit(1)
} else {
  console.log('BUILD VERIFICATION PASSED')
}