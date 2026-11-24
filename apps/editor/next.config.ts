import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The engine package is consumed from its TypeScript source inside the workspace (its exports point at src/).
  transpilePackages: ["@dblodorn/roland-juno60-engine"],
};

export default nextConfig;
