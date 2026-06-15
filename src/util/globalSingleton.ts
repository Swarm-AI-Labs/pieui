/**
 * Cross-bundle singleton store.
 *
 * Each pre-bundled entry point (main, `/components`, `/telegram`, `/max`,
 * `/agent`) inlines its own copy of the `util/*` modules. Any module-level
 * value created with `createContext` or `new Map()` would therefore exist as N
 * distinct instances — a Provider rendered from one bundle (e.g. `PieTelegramRoot`
 * from `@swarm.ing/pieui/telegram`) is invisible to a consumer loaded from
 * another (e.g. a card importing `usePieConfig` from `@swarm.ing/pieui`),
 * surfacing as "usePieConfig must be used within PieConfigProvider" or
 * "[UI] Component not found in registry".
 *
 * Stashing the value on `globalThis` under a shared `Symbol.for` key makes every
 * copy of the module resolve to the SAME instance, regardless of how many times
 * the bundler inlines it or which output format (ESM/CJS) is consumed.
 *
 * This module is intentionally server-safe (no React, no browser globals) so it
 * can back both the component registry and the React contexts.
 */
const globalScope = globalThis as unknown as Record<symbol, unknown>

export const globalSingleton = <T>(name: string, create: () => T): T => {
    const key = Symbol.for(name)
    if (!(key in globalScope)) {
        globalScope[key] = create()
    }
    return globalScope[key] as T
}