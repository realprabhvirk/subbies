import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the parent directory makes Turbopack's
  // workspace-root inference ambiguous. Pin it to this project.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
