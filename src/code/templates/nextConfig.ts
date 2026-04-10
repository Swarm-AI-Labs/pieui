export const REQUIRED_NEXT_CONFIG_ENV_KEYS = [
    'PIE_API_SERVER',
    'PIE_CENTRIFUGE_SERVER',
    'PIE_ENABLE_RENDERING_LOG',
    'PIE_PLATFORM',
] as const

export const nextConfigTemplate = (): string =>
    `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: false,
  env: {
    PIE_API_SERVER: process.env.PIE_API_SERVER,
    PIE_CENTRIFUGE_SERVER: process.env.PIE_CENTRIFUGE_SERVER,
    PIE_ENABLE_RENDERING_LOG: process.env.PIE_ENABLE_RENDERING_LOG,
    PIE_PLATFORM: process.env.PIE_PLATFORM || "telegram",
  },
  reactStrictMode: true,
  transpilePackages: ["@piedata/pieui"],
};

export default nextConfig;
`