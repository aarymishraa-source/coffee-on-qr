import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  agentRules: false,
  // The dev-mode "N" indicator floats bottom-left and can sit on top of the
  // phone's bottom nav / fixed bars — distracting (and sometimes click-
  // blocking) on small screens, so it's off for this project.
  devIndicators: false,
  // PGlite (embedded Postgres, WASM) and the Prisma adapters load their own
  // binaries at runtime — keep them out of the server bundle.
  serverExternalPackages: ["@electric-sql/pglite", "pglite-prisma-adapter", "@prisma/adapter-pg", "pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
