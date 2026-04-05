import fs from 'fs'
import path from 'path'

/**
 * Resolves the path to the registry file inside `piecomponents`.
 * Prefers `registry.ts`, but falls back to `registry.tsx` if the former
 * does not exist. Returns the `.ts` candidate when neither exists so
 * callers can still decide how to handle the missing file.
 */
export const resolveRegistryPath = (pieComponentsDir: string): string => {
    const tsPath = path.join(pieComponentsDir, 'registry.ts')
    if (fs.existsSync(tsPath)) {
        return tsPath
    }
    const tsxPath = path.join(pieComponentsDir, 'registry.tsx')
    if (fs.existsSync(tsxPath)) {
        return tsxPath
    }
    return tsPath
}