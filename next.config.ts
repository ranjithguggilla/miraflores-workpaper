import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",   // small production image: .next/standalone + server.js
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
