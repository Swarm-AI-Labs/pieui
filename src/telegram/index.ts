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

// Telegram-only storage cards. Importing them here registers the components
// (registerPieComponent side-effect) whenever the Telegram entry is loaded.
export { default as CloudStorageCard } from './components/CloudStorageCard'
export { default as SecureStorageCard } from './components/SecureStorageCard'

export type { CloudStorageCardData } from './components/CloudStorageCard/types'
export type { SecureStorageCardData } from './components/SecureStorageCard/types'

export type {
    WebApp,
    Telegram,
    InitData,
    InitDataUnsafe,
    WebAppUser,
    WebAppInitData,
} from '../types'
