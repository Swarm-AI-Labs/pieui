import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: false,
  transpilePackages: ["@piedata/pieui"],
};

export default nextConfig;