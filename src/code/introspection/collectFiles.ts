/**
 * Glob a component directory for source files relevant to introspection.
 *
 * Excludes everything that's not "real" component code: tests, snapshots,
 * Storybook stories, mocks.
 */

import path from 'node:path'
import { glob } from 'glob'

/**
 * Return absolute paths of `.ts`/`.tsx`/`.css` files belonging to a
 * component, sorted, deduplicated.
 *
 * ASSUMES: `componentDir` is the absolute directory containing the
 * component (e.g. `<cwd>/piecomponents/<Name>`).
 *
 * RETURNS: sorted absolute paths. Empty array if nothing matches.
 *
 * EXCLUDED:
 *   - `**​/__tests__/**` / `**​/__snapshots__/**` / `**​/__mocks__/**`
 *   - `*.test.{ts,tsx}` / `*.spec.{ts,tsx}`
 *   - `*.stories.{ts,tsx}` (Storybook)
 *
 * EDGE CASES:
 *   - Files outside `componentDir` are never included.
 *   - `.css` files are listed but not parsed by downstream introspection
 *     (they go into `files` for completeness).
 */
export const collectComponentFiles = (componentDir: string): string[] => {
    const patterns = [
        `${componentDir}/**/*.ts`,
        `${componentDir}/**/*.tsx`,
        `${componentDir}/**/*.css`,
    ]
    const ignore = [
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.stories.ts',
        '**/*.stories.tsx',
        '**/__snapshots__/**',
        '**/__mocks__/**',
    ]
    const out = new Set<string>()
    for (const p of patterns) {
        for (const f of glob.sync(p, { ignore })) {
            out.add(path.resolve(f))
        }
    }
    return Array.from(out).sort()
}
