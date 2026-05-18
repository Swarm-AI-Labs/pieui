/**
 * Shared constants + parameter shapes for the PieCard storybook addon.
 *
 * IMPORTANT: this module must NOT import React, pieui contexts, or any
 * runtime code from `@swarm.ing/pieui`. It is loaded by the Storybook
 * manager bundle (which already ships its own React) and any duplicate
 * React import will explode with cross-context errors like
 * "Cannot read properties of undefined (reading 'recentlyCreatedOwnerStacks')".
 */

export const PIECARD_PARAM_KEY = 'piecard'
export const PIE_STORYBOOK_FIRE_EVENT = 'piecard/fire'

export type PieMethodSpec = {
    name: string
    payloadSchema?: Record<string, unknown> | null
    payloadCode?: string | null
    samplePayload?: unknown
}

export type PieCardParams = {
    card: string
    methods?: PieMethodSpec[]
}
