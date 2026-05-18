/**
 * Tests for `pieui card dump-metadata` envelope format policy.
 *
 * Critical invariants:
 *  - Output is always wrapped in `{ typescript: {...} }` — never bare.
 *  - Writing to --out file shallow-merges: only the `typescript` key is
 *    replaced; sibling keys (e.g. `python`) are preserved.
 *  - Re-running on the same --out file does not corrupt the sibling key.
 *  - Existing --out file must be valid JSON and a JSON object; otherwise
 *    a descriptive error is thrown.
 */

import { describe, test, expect } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
    cardDumpMetadataCommand,
    DUMP_METADATA_ENVELOPE_KEY,
    buildCardMetadata,
    stringifyPieMetadata,
} from '../code/commands/cardDumpMetadata'
import { IntrospectionError } from '../code/introspection/errors'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mkTempDir = (prefix: string) =>
    fs.mkdtempSync(path.join(os.tmpdir(), prefix))

const runWithEnv = <T>(
    env: Record<string, string | undefined>,
    fn: () => T
): T => {
    const prev: Record<string, string | undefined> = {}
    for (const [k, v] of Object.entries(env)) {
        prev[k] = process.env[k]
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
    }
    try {
        return fn()
    } finally {
        for (const [k, v] of Object.entries(prev)) {
            if (v === undefined) delete process.env[k]
            else process.env[k] = v
        }
    }
}

/**
 * Write a minimal valid component directory under `componentsDir` and
 * return `{ componentsDir, componentName }`.
 */
const makeMinimalComponent = (
    base: string,
    componentName: string
): { componentsDir: string; componentName: string } => {
    const componentsDir = path.join(base, 'piecomponents')
    const componentDir = path.join(componentsDir, componentName)
    const typesDir = path.join(componentDir, 'types')
    const uiDir = path.join(componentDir, 'ui')
    fs.mkdirSync(typesDir, { recursive: true })
    fs.mkdirSync(uiDir, { recursive: true })

    // Data type — satisfies naming convention `<Name>Data`
    fs.writeFileSync(
        path.join(typesDir, 'index.ts'),
        `export interface ${componentName}Data {\n  title: string\n  count: number\n}\n`,
        'utf8'
    )

    // UI file — PieCard with inline methods (one event)
    fs.writeFileSync(
        path.join(uiDir, `${componentName}.tsx`),
        `'use client'\n` +
            `const ${componentName} = ({ data }: any) => (\n` +
            `    <PieCard\n` +
            `        card="${componentName}"\n` +
            `        methods={{\n` +
            `            submit: (payload: { id: string }) => {\n` +
            `                console.log(payload)\n` +
            `            },\n` +
            `        }}\n` +
            `    />\n` +
            `)\nexport default ${componentName}\n`,
        'utf8'
    )

    fs.writeFileSync(
        path.join(componentDir, 'index.ts'),
        `export { default } from './ui/${componentName}'\n`,
        'utf8'
    )

    return { componentsDir, componentName }
}

// ---------------------------------------------------------------------------
// DUMP_METADATA_ENVELOPE_KEY constant
// ---------------------------------------------------------------------------

describe('DUMP_METADATA_ENVELOPE_KEY', () => {
    test('is "typescript"', () => {
        expect(DUMP_METADATA_ENVELOPE_KEY).toBe('typescript')
    })
})

// ---------------------------------------------------------------------------
// Envelope format for --out file
// ---------------------------------------------------------------------------

describe('cardDumpMetadataCommand — envelope merge policy', () => {
    test('creates file with top-level "typescript" key', () => {
        const base = mkTempDir('pieui-dump-create-')
        const outFile = path.join(base, 'out.json')
        const { componentsDir, componentName } = makeMinimalComponent(
            base,
            'BoxCard'
        )

        runWithEnv({ PIE_COMPONENTS_DIR: componentsDir }, () => {
            cardDumpMetadataCommand(componentName, outFile)
        })

        const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'))
        expect(typeof parsed.typescript).toBe('object')
        expect(parsed.typescript).not.toBeNull()
        expect(parsed.typescript.name).toBe(componentName)
    })

    test('output does NOT have a bare "python" key by default', () => {
        const base = mkTempDir('pieui-dump-nopython-')
        const outFile = path.join(base, 'out.json')
        const { componentsDir, componentName } = makeMinimalComponent(
            base,
            'ListCard'
        )

        runWithEnv({ PIE_COMPONENTS_DIR: componentsDir }, () => {
            cardDumpMetadataCommand(componentName, outFile)
        })

        const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'))
        expect(parsed.python).toBeUndefined()
    })

    test('shallow-merges into existing file — preserves "python" key', () => {
        const base = mkTempDir('pieui-dump-merge-')
        const outFile = path.join(base, 'merged.json')

        // Simulate pie having already written its python envelope
        const pythonPayload = { name: 'BoxCard', events: ['click'] }
        fs.writeFileSync(
            outFile,
            JSON.stringify({ python: pythonPayload }),
            'utf8'
        )

        const { componentsDir, componentName } = makeMinimalComponent(
            base,
            'BoxCard'
        )

        runWithEnv({ PIE_COMPONENTS_DIR: componentsDir }, () => {
            cardDumpMetadataCommand(componentName, outFile)
        })

        const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'))
        // python key untouched
        expect(parsed.python).toEqual(pythonPayload)
        // typescript key populated
        expect(typeof parsed.typescript).toBe('object')
        expect(parsed.typescript.name).toBe(componentName)
    })

    test('re-running replaces only "typescript", never touches "python"', () => {
        const base = mkTempDir('pieui-dump-rerun-')
        const outFile = path.join(base, 'combined.json')
        const { componentsDir, componentName } = makeMinimalComponent(
            base,
            'NavCard'
        )

        // First write — creates typescript key
        runWithEnv({ PIE_COMPONENTS_DIR: componentsDir }, () => {
            cardDumpMetadataCommand(componentName, outFile)
        })

        // Inject a python key (as pie would)
        const before = JSON.parse(fs.readFileSync(outFile, 'utf8'))
        before.python = { name: 'NavCard', version: 1 }
        fs.writeFileSync(outFile, JSON.stringify(before), 'utf8')

        // Second run — should replace typescript, preserve python
        runWithEnv({ PIE_COMPONENTS_DIR: componentsDir }, () => {
            cardDumpMetadataCommand(componentName, outFile)
        })

        const after = JSON.parse(fs.readFileSync(outFile, 'utf8'))
        expect(after.python).toEqual({ name: 'NavCard', version: 1 })
        expect(after.typescript.name).toBe(componentName)
    })

    test('throws on --out file that is not valid JSON', () => {
        const base = mkTempDir('pieui-dump-badjson-')
        const outFile = path.join(base, 'bad.json')
        fs.writeFileSync(outFile, 'this is not json', 'utf8')

        const { componentsDir, componentName } = makeMinimalComponent(
            base,
            'ErrCard'
        )

        expect(() =>
            runWithEnv({ PIE_COMPONENTS_DIR: componentsDir }, () => {
                cardDumpMetadataCommand(componentName, outFile)
            })
        ).toThrow('Cannot merge')
    })

    test('throws on --out file that is a JSON array', () => {
        const base = mkTempDir('pieui-dump-array-')
        const outFile = path.join(base, 'array.json')
        fs.writeFileSync(outFile, JSON.stringify([1, 2, 3]), 'utf8')

        const { componentsDir, componentName } = makeMinimalComponent(
            base,
            'ArrCard'
        )

        expect(() =>
            runWithEnv({ PIE_COMPONENTS_DIR: componentsDir }, () => {
                cardDumpMetadataCommand(componentName, outFile)
            })
        ).toThrow('Cannot merge')
    })

    test('throws when component directory does not exist', () => {
        const base = mkTempDir('pieui-dump-nodir-')
        const componentsDir = path.join(base, 'piecomponents')
        fs.mkdirSync(componentsDir, { recursive: true })

        expect(() =>
            runWithEnv({ PIE_COMPONENTS_DIR: componentsDir }, () => {
                cardDumpMetadataCommand('GhostCard', undefined)
            })
        ).toThrow('not found')
    })
})

// ---------------------------------------------------------------------------
// Stdout mode
// ---------------------------------------------------------------------------

describe('cardDumpMetadataCommand — stdout envelope', () => {
    test('stdout output is valid JSON with "typescript" top-level key', () => {
        const base = mkTempDir('pieui-dump-stdout-')
        const { componentsDir, componentName } = makeMinimalComponent(
            base,
            'PrintCard'
        )

        // Capture stdout
        const chunks: Buffer[] = []
        const origWrite = process.stdout.write.bind(process.stdout)
        ;(process.stdout as any).write = (chunk: any) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
            return true
        }

        try {
            runWithEnv({ PIE_COMPONENTS_DIR: componentsDir }, () => {
                cardDumpMetadataCommand(componentName, undefined)
            })
        } finally {
            ;(process.stdout as any).write = origWrite
        }

        const output = Buffer.concat(chunks).toString('utf8')
        const parsed = JSON.parse(output)
        expect(Object.keys(parsed)).toEqual(['typescript'])
        expect(parsed.typescript.name).toBe(componentName)
    })
})

// ---------------------------------------------------------------------------
// No-silent-empty regression — IntrospectionError strictness
// ---------------------------------------------------------------------------

describe('buildCardMetadata — IntrospectionError strictness (no silent {})', () => {
    test('throws IntrospectionError when no data type found', () => {
        const base = mkTempDir('pieui-dump-nodatatype-')
        const componentsDir = path.join(base, 'piecomponents')
        const componentName = 'NoTypeCard'
        const componentDir = path.join(componentsDir, componentName)
        fs.mkdirSync(componentDir, { recursive: true })

        // File with no matching data type name
        fs.writeFileSync(
            path.join(componentDir, 'index.ts'),
            `export interface WrongNameData { x: string }\n`,
            'utf8'
        )

        expect(() =>
            runWithEnv({ PIE_COMPONENTS_DIR: componentsDir }, () => {
                buildCardMetadata(componentName)
            })
        ).toThrow(IntrospectionError)
    })

    test('IntrospectionError message includes hint about naming convention', () => {
        const base = mkTempDir('pieui-dump-hint-')
        const componentsDir = path.join(base, 'piecomponents')
        const componentName = 'HintCard'
        const componentDir = path.join(componentsDir, componentName)
        fs.mkdirSync(componentDir, { recursive: true })

        fs.writeFileSync(
            path.join(componentDir, 'index.ts'),
            `export interface Unrelated { x: string }\n`,
            'utf8'
        )

        let err: unknown
        try {
            runWithEnv({ PIE_COMPONENTS_DIR: componentsDir }, () => {
                buildCardMetadata(componentName)
            })
        } catch (e) {
            err = e
        }

        expect(err).toBeInstanceOf(IntrospectionError)
        const msg = (err as IntrospectionError).message
        // Must mention the expected name patterns
        expect(msg).toContain('HintCardData')
    })

    test('valid component with IFooData naming convention is accepted', () => {
        const base = mkTempDir('pieui-dump-hungarian-')
        const componentsDir = path.join(base, 'piecomponents')
        const componentName = 'HunCard'
        const componentDir = path.join(componentsDir, componentName)
        fs.mkdirSync(componentDir, { recursive: true })

        // Hungarian prefix variant
        fs.writeFileSync(
            path.join(componentDir, 'index.ts'),
            `export interface IHunCardData { label: string }\n`,
            'utf8'
        )

        expect(() =>
            runWithEnv({ PIE_COMPONENTS_DIR: componentsDir }, () => {
                buildCardMetadata(componentName)
            })
        ).not.toThrow()
    })

    test('valid component with FooProps naming convention is accepted', () => {
        const base = mkTempDir('pieui-dump-props-')
        const componentsDir = path.join(base, 'piecomponents')
        const componentName = 'PropsCard'
        const componentDir = path.join(componentsDir, componentName)
        fs.mkdirSync(componentDir, { recursive: true })

        fs.writeFileSync(
            path.join(componentDir, 'index.ts'),
            `export interface PropsCardProps { value: number }\n`,
            'utf8'
        )

        expect(() =>
            runWithEnv({ PIE_COMPONENTS_DIR: componentsDir }, () => {
                buildCardMetadata(componentName)
            })
        ).not.toThrow()
    })
})
