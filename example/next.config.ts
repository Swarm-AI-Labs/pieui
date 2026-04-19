import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    reactCompiler: false,
    transpilePackages: ['@swarm.ing/pieui'],
}

export default nextConfig
