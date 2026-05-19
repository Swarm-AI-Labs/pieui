/**
 * Tests for `extractEvents` strictness policy.
 *
 * Critical invariants (per QA test plan):
 *  - methods={handlers} (variable reference) → IntrospectionError
 *  - <PieCard {...spread} /> → IntrospectionError
 *  - Inline object literal methods={{...}} → events extracted correctly
 *  - 0-parameter handler → event still registered (empty schema)
 *  - Computed key in methods → IntrospectionError
 */

import { describe, test, expect } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { extractEvents } from '../code/introspection/extractEvents'
import { IntrospectionError } from '../code/introspection/errors'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mkTempDir = (prefix: string) =>
    fs.mkdtempSync(path.join(os.tmpdir(), prefix))

/** Write a .tsx file to a temp dir and return its absolute path. */
const writeTsx = (dir: string, name: string, content: string): string => {
    const filePath = path.join(dir, name)
    fs.writeFileSync(filePath, content, 'utf8')
    return filePath
}

// ---------------------------------------------------------------------------
// Inline object literal — success cases
// ---------------------------------------------------------------------------

describe('extractEvents — inline methods literal', () => {
    test('extracts single event name', () => {
        const dir = mkTempDir('pieui-events-single-')
        const file = writeTsx(
            dir,
            'Good.tsx',
            `const C = () => (
    <PieCard card="C" methods={{ click: (p: { id: string }) => {} }} />
)`
        )
        const events = extractEvents([file])
        expect(events).toContain('click')
    })

    test('extracts multiple event names', () => {
        const dir = mkTempDir('pieui-events-multi-')
        const file = writeTsx(
            dir,
            'Multi.tsx',
            `const C = () => (
    <PieCard
        card="C"
        methods={{
            like: (p: { id: string }) => {},
            save: (p: { note: string }) => {},
            share: () => {},
        }}
    />
)`
        )
        const events = extractEvents([file])
        expect(events).toContain('like')
        expect(events).toContain('save')
        expect(events).toContain('share')
        expect(events).toHaveLength(3)
    })

    test('zero-parameter handler is accepted (no-payload event)', () => {
        const dir = mkTempDir('pieui-events-noparam-')
        const file = writeTsx(
            dir,
            'NoParam.tsx',
            `const C = () => (
    <PieCard card="C" methods={{ refresh: () => { reload() } }} />
)`
        )
        const events = extractEvents([file])
        expect(events).toContain('refresh')
    })

    test('returns empty array when no PieCard in file', () => {
        const dir = mkTempDir('pieui-events-none-')
        const file = writeTsx(
            dir,
            'NoPieCard.tsx',
            `const C = () => <div className="x" />`
        )
        const events = extractEvents([file])
        expect(events).toHaveLength(0)
    })

    test('returns empty array when PieCard has no methods prop', () => {
        const dir = mkTempDir('pieui-events-nomethods-')
        const file = writeTsx(
            dir,
            'NoMethods.tsx',
            `const C = () => <PieCard card="C" />`
        )
        const events = extractEvents([file])
        expect(events).toHaveLength(0)
    })

    test('handles self-closing PieCard', () => {
        const dir = mkTempDir('pieui-events-selfclose-')
        const file = writeTsx(
            dir,
            'SelfClose.tsx',
            `const C = () => (
    <PieCard
        card="C"
        methods={{ submit: (p: { value: string }) => {} }}
    />
)`
        )
        const events = extractEvents([file])
        expect(events).toContain('submit')
    })
})

// ---------------------------------------------------------------------------
// Forbidden patterns — IntrospectionError
// ---------------------------------------------------------------------------

describe('extractEvents — variable reference → IntrospectionError', () => {
    test('methods={handlers} with external variable throws', () => {
        const dir = mkTempDir('pieui-events-varref-')
        const file = writeTsx(
            dir,
            'VarRef.tsx',
            `const handlers = { click: () => {} }
const C = () => <PieCard card="C" methods={handlers} />`
        )
        expect(() => extractEvents([file])).toThrow(IntrospectionError)
    })

    test('methods={obj.prop} property access throws', () => {
        const dir = mkTempDir('pieui-events-propaccess-')
        const file = writeTsx(
            dir,
            'PropAccess.tsx',
            `const C = ({ methods }: any) => (
    <PieCard card="C" methods={methods.handlers} />
)`
        )
        expect(() => extractEvents([file])).toThrow(IntrospectionError)
    })

    test('methods={getHandlers()} call expression throws', () => {
        const dir = mkTempDir('pieui-events-callexpr-')
        const file = writeTsx(
            dir,
            'CallExpr.tsx',
            `const C = () => <PieCard card="C" methods={getHandlers()} />`
        )
        expect(() => extractEvents([file])).toThrow(IntrospectionError)
    })
})

describe('extractEvents — spread attribute → IntrospectionError', () => {
    test('<PieCard {...props} /> throws', () => {
        const dir = mkTempDir('pieui-events-spread-')
        const file = writeTsx(
            dir,
            'Spread.tsx',
            `const C = (props: any) => <PieCard {...props} />`
        )
        expect(() => extractEvents([file])).toThrow(IntrospectionError)
    })

    test('IntrospectionError message mentions spread', () => {
        const dir = mkTempDir('pieui-events-spread-msg-')
        const file = writeTsx(
            dir,
            'SpreadMsg.tsx',
            `const C = (props: any) => <PieCard {...props} />`
        )
        let err: unknown
        try {
            extractEvents([file])
        } catch (e) {
            err = e
        }
        expect(err).toBeInstanceOf(IntrospectionError)
        expect((err as IntrospectionError).message).toMatch(/spread/i)
    })

    test('IntrospectionError carries sourceFile location', () => {
        const dir = mkTempDir('pieui-events-spread-loc-')
        const file = writeTsx(
            dir,
            'SpreadLoc.tsx',
            `const C = (props: any) => <PieCard {...props} />`
        )
        let err: unknown
        try {
            extractEvents([file])
        } catch (e) {
            err = e
        }
        expect(err).toBeInstanceOf(IntrospectionError)
        const ie = err as IntrospectionError
        expect(ie.sourceFile).toBeTruthy()
        expect(ie.line).toBeGreaterThanOrEqual(1)
    })
})

// ---------------------------------------------------------------------------
// Multiple files — aggregation
// ---------------------------------------------------------------------------

describe('extractEvents — across multiple files', () => {
    test('aggregates events from all files', () => {
        const dir = mkTempDir('pieui-events-multifile-')
        const f1 = writeTsx(
            dir,
            'A.tsx',
            `const A = () => <PieCard card="A" methods={{ alpha: () => {} }} />`
        )
        const f2 = writeTsx(
            dir,
            'B.tsx',
            `const B = () => <PieCard card="B" methods={{ beta: () => {} }} />`
        )
        const events = extractEvents([f1, f2])
        expect(events).toContain('alpha')
        expect(events).toContain('beta')
    })

    test('stops on first IntrospectionError', () => {
        const dir = mkTempDir('pieui-events-early-stop-')
        const bad = writeTsx(
            dir,
            'Bad.tsx',
            `const B = (p: any) => <PieCard {...p} />`
        )
        const good = writeTsx(
            dir,
            'Good.tsx',
            `const G = () => <PieCard card="G" methods={{ ok: () => {} }} />`
        )
        expect(() => extractEvents([bad, good])).toThrow(IntrospectionError)
    })
})
