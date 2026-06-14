'use client'

/**
 * Telegram Mini Apps integration entry.
 *
 * `PieTelegramRoot` and the Telegram `WebApp` hooks are intentionally split out
 * of the main `@swarm.ing/pieui` barrel so that apps which do not target
 * Telegram never reference this code from the main entry point. Import from
 * `@swarm.ing/pieui/telegram` when building a Telegram Mini App.
 */
export { default as PieTelegramRoot } from '../components/PieTelegramRoot'
export { useWebApp, useInitData } from '../util/useWebApp'

export type {
    WebApp,
    Telegram,
    InitData,
    InitDataUnsafe,
    WebAppUser,
    WebAppInitData,
} from '../types'
