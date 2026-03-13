// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// };

// export default nextConfig;



import type { NextConfig } from "next";

/**
 * next.config.ts
 * ─────────────────────────────────────────────────────────────────────────
 * CRITICAL: serverExternalPackages for Prisma 7 + Turbopack
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Problem: Prisma 7 with the `prisma-client` provider generates the client
 * as TypeScript files inside your source tree (app/generated/prisma/).
 * Turbopack tries to bundle these files into the server bundle — but the
 * generated files contain ESM .js imports for files that only exist as .ts
 * at build time (e.g. import from "./internal/class.js" when only
 * class.ts exists). This causes "Cannot find module" errors at runtime.
 *
 * Fix: Tell Next.js to treat `pg` and the Prisma generated client as
 * external packages — meaning they are NOT bundled by Turbopack.
 * Instead, Node.js resolves them natively at runtime.
 *
 * The `@prisma/adapter-pg` adapter internally requires `pg` (the native
 * Postgres driver). Because pg uses native bindings and dynamic requires,
 * it must NOT be bundled. Adding it to serverExternalPackages tells
 * Turbopack to skip bundling it and let Node handle it.
 *
 * REFERENCE: https://github.com/prisma/prisma/discussions/28956
 * REFERENCE: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages
 * ─────────────────────────────────────────────────────────────────────────
 */
const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pg",
    "@prisma/adapter-pg",
    // If you use Neon's serverless driver instead, replace with:
    // "@neondatabase/serverless",
    // "@prisma/adapter-neon",
  ],
};

export default nextConfig;