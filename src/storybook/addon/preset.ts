/**
 * Storybook addon preset for `@swarm.ing/pieui/storybook/addon`.
 *
 * Registers a manager entry that mounts the "PieCard Methods" panel in
 * Storybook's sidebar/addons strip. Users opt in via `.storybook/main.ts`:
 *
 *     export default {
 *         addons: ['@swarm.ing/pieui/storybook/addon'],
 *     }
 */
import path from 'node:path'

export const managerEntries = (entry: string[] = []): string[] => [
    ...entry,
    path.join(__dirname, 'manager.js'),
]
