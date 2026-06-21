/**
 * Host-supplied wiring for the React Native `ClientSources` implementation.
 *
 * The library deliberately depends on no native modules. A React Native host
 * injects its own sources here once at startup (e.g. MMKV for sync storage,
 * the active navigation route for `url:` deps, an in-memory store for form
 * fields). Every field is optional; an unconfigured source degrades to the
 * same "missing value" semantics as the web implementation (`null` / `[]`).
 */

/** Minimal synchronous key/value reader (the contract `readAjaxKey` needs). */
export interface NativeStorageAdapter {
    getItem(key: string): string | null
}

export interface NativeClientConfig {
    /** Backs `localStorage:` dep sources. Must be synchronous (e.g. MMKV). */
    storage?: NativeStorageAdapter
    /** Backs `sessionStorage:` dep sources. Must be synchronous. */
    sessionStorage?: NativeStorageAdapter
    /** Backs `cookie:` dep sources. Usually unused on native. */
    getCookie?: (name: string) => string | null
    /** Backs `url:` dep sources — typically the current route's query params. */
    getRouteParams?: (key: string) => string[]
    /**
     * Backs plain (DOM) dep sources — the host resolves a field name to its
     * current value(s) from whatever form-state store it uses. Return `null`
     * when no field by that name exists (mirrors "element not found").
     */
    getInput?: (name: string) => Array<string | File> | null
    /** Performs the global submit (there is no HTML form on native). */
    submitForm?: () => void
}

let current: NativeClientConfig = {}

/**
 * Registers (merges) native client sources. Call once at app startup, before
 * any Ajax submit runs. Repeated calls shallow-merge over previous config.
 */
export function configureNativeClientSources(config: NativeClientConfig): void {
    current = { ...current, ...config }
}

/** Returns the currently registered native client sources. */
export function getNativeClientConfig(): NativeClientConfig {
    return current
}

/** Test helper: clears all configured native sources back to empty. */
export function resetNativeClientSources(): void {
    current = {}
}
