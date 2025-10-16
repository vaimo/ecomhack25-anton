import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Disable ESLint during build for hackathon deployment
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
