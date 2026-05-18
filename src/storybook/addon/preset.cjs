/**
 * Storybook addon preset for `@swarm.ing/pieui/storybook/addon`.
 *
 * Hand-written CommonJS because bun build inlines `__dirname` with the
 * source path at build time, which breaks once the package is installed
 * into a consumer's node_modules. Plain CJS lets Node resolve `__dirname`
 * at runtime against the actual install location.
 *
 * Users opt in via `.storybook/main.ts`:
 *
 *     export default {
 *         addons: ['@swarm.ing/pieui/storybook/addon/preset'],
 *     }
 */
const path = require('node:path')

exports.managerEntries = (entry = []) => [
    ...entry,
    path.join(__dirname, 'manager.js'),
]
