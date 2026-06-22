/**
 * Host-supplied wiring for the React Native `ClientSources` implementation.
 *
 * The library deliberately depends on no native modules. A React Native host
 * injects its own sources here once at startup (e.g. MMKV for sync storage,
 * the active navigation route for `url:` deps, an in-memory store for form
 * fields). Every field is optional; an unconfigured source degrades to the
 * same "missing value" semantics as the web implementation (`null` / `[]`).
 */

/**
 * Synchronous key/value store. `getItem` satisfies the synchronous
 * {@link readAjaxKey} contract; the optional writers back the native
 * `DeviceStorageCard` / `SessionStorageCard` so they can persist values
 * (e.g. MMKV's `getString` / `set` / `delete`).
 */
export interface NativeStorageAdapter {
    getItem(key: string): string | null
    setItem?(key: string, value: string): void
    removeItem?(key: string): void
}

/**
 * Asynchronous key/value reader, for stores that are async-only such as
 * `@react-native-async-storage/async-storage`. Used by the `readAjaxKeyAsync`
 * submit path (which already awaits its sources).
 */
export interface NativeAsyncStorageAdapter {
    getItem(key: string): Promise<string | null>
}

export interface NativeClientConfig {
    /** Backs `localStorage:` dep sources synchronously (e.g. MMKV). */
    storage?: NativeStorageAdapter
    /** Backs `sessionStorage:` dep sources synchronously. */
    sessionStorage?: NativeStorageAdapter
    /**
     * Async backing for `localStorage:` deps (e.g. AsyncStorage). Preferred by
     * the async submit path; falls back to {@link storage} when absent.
     */
    asyncStorage?: NativeAsyncStorageAdapter
    /** Async backing for `sessionStorage:` deps; falls back to {@link sessionStorage}. */
    asyncSessionStorage?: NativeAsyncStorageAdapter
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
