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

// Force-dedupe React and pieui so linked installs (`file:`/`npm link`) that
// drag pieui's own node_modules along don't end up with two React instances.
// Two Reacts → two distinct PieConfigContext objects → providers and
// consumers don't match → "must be used within PieConfigProvider". Published
// npm installs already dedupe via peerDependencies; declaring this here is a
// safe no-op there.
exports.viteFinal = async (config) => {
    config.resolve = config.resolve || {}
    const dedupe = new Set([
        ...(config.resolve.dedupe || []),
        'react',
        'react-dom',
        '@swarm.ing/pieui',
    ])
    config.resolve.dedupe = Array.from(dedupe)
    return config
}
