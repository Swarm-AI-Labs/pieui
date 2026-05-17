/**
 * Minimal type stubs for `storybook/manager-api` so this addon typechecks
 * without taking `storybook` as a hard dev dependency in this repo. End-users
 * of the addon already have `storybook` installed, and its real types win at
 * their build site.
 */
declare module 'storybook/manager-api' {
    export interface Addon {
        type: string
        title: string
        match?: (context: { viewMode?: string }) => boolean
        render: (context: { active?: boolean }) => unknown
    }
    export const addons: {
        register: (id: string, cb: () => void) => void
        add: (id: string, addon: Addon) => void
        getChannel: () => {
            emit: (event: string, payload: unknown) => void
            on: (event: string, listener: (...args: unknown[]) => void) => void
            off: (event: string, listener: (...args: unknown[]) => void) => void
        }
    }
    export const types: {
        readonly PANEL: 'panel'
        readonly TAB: 'tab'
        readonly TOOL: 'tool'
    }
    export function useParameter<T = unknown>(key: string, fallback: T): T
}
