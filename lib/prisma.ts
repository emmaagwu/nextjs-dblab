// /**
//  * lib/prisma.ts
//  * ─────────────────────────────────────────────────────────────────────────
//  * PRISMA 7 CLIENT SINGLETON
//  * ─────────────────────────────────────────────────────────────────────────
//  *
//  * This is the most important file in the data layer. It does three things:
//  *
//  *   1. Creates the PrismaPg driver adapter (the "engine" replacement)
//  *   2. Wraps PrismaClient in a globalThis singleton to prevent connection
//  *      exhaustion during Next.js Hot Module Replacement (HMR) in dev
//  *   3. Extends the client with query-level behaviors (replaces $use)
//  *
//  * ── IMPORT PATH: WHERE IS THE GENERATED CLIENT? ──────────────────────────
//  *
//  * Prisma 7 generates the client into YOUR project source tree (not
//  * node_modules). The path is whatever you set in schema.prisma:
//  *
//  *   output = "../app/generated/prisma"    ← from prisma/schema.prisma
//  *
//  * From lib/prisma.ts (one level deep), the import is:
//  *   "@/app/generated/prisma/client"       ← /client at the end is required
//  *
//  * Why "/client"? Prisma generates several files in that directory:
//  *   - client.ts   → the main PrismaClient class (import from here)
//  *   - index.ts    → re-exports types but NOT the class correctly
//  *   - runtime/    → internal runtime files
//  *
//  * Always import from /client. Never from /index or the directory itself.
//  *
//  * ── THE DRIVER ADAPTER: REPLACING THE RUST ENGINE ────────────────────────
//  *
//  * In Prisma 6, a compiled Rust binary acted as the query engine:
//  *   Your app → PrismaClient → [Rust Engine] → Postgres
//  *
//  * In Prisma 7, the flow is:
//  *   Your app → PrismaClient → [Query Compiler (TS)] → [Driver Adapter] → Postgres
//  *
//  * The Query Compiler translates Prisma API calls into SQL strings.
//  * The Driver Adapter executes those SQL strings against the DB.
//  * YOU must provide the adapter. Without it you get:
//  *
//  *   PrismaClientConstructorValidationError: Using engine type "client"
//  *   requires either "adapter" or "accelerateUrl" to be provided
//  *
//  * For standard Postgres: use @prisma/adapter-pg (wraps the pg npm package)
//  * For Neon serverless:    use @prisma/adapter-neon (uses Neon's WS driver)
//  * For SQLite:             use @prisma/adapter-better-sqlite3
//  *
//  * ── WHY PrismaPg AND NOT PrismaNeon FOR THIS DEMO? ───────────────────────
//  *
//  * Both work with Neon databases. The difference:
//  *
//  * @prisma/adapter-pg (PrismaPg):
//  *   - Uses the `pg` npm package (standard Node.js Postgres driver)
//  *   - Uses a TCP connection pool (pg.Pool)
//  *   - Works everywhere Node.js runs (Vercel Serverless, EC2, Railway, etc.)
//  *   - Does NOT work on edge runtimes (Cloudflare Workers, Vercel Edge)
//  *   - Correct choice for: Next.js Server Components + Serverless Functions
//  *
//  * @prisma/adapter-neon (PrismaNeon):
//  *   - Uses Neon's serverless driver (@neondatabase/serverless)
//  *   - Uses WebSockets (HTTP/WS) instead of TCP
//  *   - Works on edge runtimes (Cloudflare Workers, Vercel Edge Functions)
//  *   - Correct choice for: Edge middleware, Cloudflare Workers
//  *
//  * Since our Next.js app runs Server Components in a Node.js serverless
//  * runtime (not edge), PrismaPg is the right choice.
//  *
//  * ── THE SINGLETON PATTERN: WHY IT'S CRITICAL ─────────────────────────────
//  *
//  * Next.js HMR (Hot Module Replacement) re-evaluates modules on every
//  * file save during development. Without a singleton:
//  *
//  *   Save 1 → new PrismaClient (pool: 10 connections)
//  *   Save 2 → new PrismaClient (pool: 10 connections)
//  *   Save 10 → new PrismaClient (pool: 10 connections)
//  *   Total: 100 connections used — Postgres limit hit, everything fails.
//  *
//  * globalThis is NOT affected by HMR. It persists across module reloads.
//  * So we store the client there on first creation, and reuse it on every
//  * subsequent module evaluation.
//  *
//  * In production, each serverless function invocation is a fresh process,
//  * so there's only ever one module evaluation per invocation — the singleton
//  * is effectively just the module-level export.
//  *
//  * ── EXTENSIONS: REPLACING $use() MIDDLEWARE ──────────────────────────────
//  *
//  * Prisma 7 removed $use(). The replacement is $extends().
//  * Extensions are more powerful and fully type-safe.
//  *
//  * Types of extensions:
//  *   query   → intercept and modify operations (like old $use)
//  *   result  → add computed fields to query results
//  *   model   → add custom methods to model instances (e.g. post.publish())
//  *   client  → add methods to the PrismaClient itself
//  *
//  * ─────────────────────────────────────────────────────────────────────────
//  */

// import { PrismaClient } from "@/app/generated/prisma/client";
// import { PrismaPg } from "@prisma/adapter-pg";
// import { Pool } from "pg";

// // ── STEP 1: CREATE THE pg CONNECTION POOL ────────────────────────────────
// //
// // PrismaPg wraps a standard pg.Pool. The pool manages a fixed number of
// // TCP connections to Postgres, reusing them across queries.
// //
// // DATABASE_URL must be the POOLED URL (contains "-pooler" in hostname for Neon):
// //   postgres://user:pass@ep-abc-pooler.us-east-2.aws.neon.tech/mydb
// //
// // Pool settings we configure:
// //   max: 10              — maximum open connections in the pool
// //                         For Neon's free tier, keep this ≤ 10
// //                         For production, match to your Neon plan limits
// //
// //   connectionTimeoutMillis: 5000
// //                         — how long to wait for a connection from the pool
// //                         before throwing. Prevents requests hanging forever.
// //                         pg default is 0 (no timeout) — Prisma 6 was 5000ms.
// //                         Explicitly set to maintain Prisma 6 behavior.
// //
// //   idleTimeoutMillis: 10000
// //                         — how long an idle connection waits before being
// //                         closed. For serverless, keep connections short-lived.
// //
// // Note: Pool is created once per module evaluation. With the singleton
// // pattern, this means once per process in production, and once per dev
// // server start (not per HMR cycle).
// function createPool(): Pool {
//   if (!process.env.DATABASE_URL) {
//     throw new Error(
//       [
//         "❌ DATABASE_URL is not set.",
//         "Add it to .env.local:",
//         "",
//         "# Pooled URL (for runtime) — has -pooler in hostname:",
//         'DATABASE_URL="postgres://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/mydb?sslmode=require"',
//         "",
//         "# Direct URL (for Prisma CLI / migrations) — no -pooler:",
//         'DIRECT_URL="postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/mydb?sslmode=require"',
//       ].join("\n")
//     );
//   }

//   return new Pool({
//     connectionString: process.env.DATABASE_URL,
//     max: 10,
//     connectionTimeoutMillis: 5000, // match Prisma v6 default
//     idleTimeoutMillis: 10_000,
//     ssl: {
//       // Neon requires SSL. rejectUnauthorized: false accepts Neon's cert.
//       // For your own Postgres with a verified cert, set this to true.
//       rejectUnauthorized: false,
//     },
//   });
// }

// // ── STEP 2: FACTORY FUNCTION FOR THE EXTENDED CLIENT ─────────────────────
// //
// // We build the client in a factory so extensions can be composed cleanly.
// // Each $extends() call returns a new extended client (the base is immutable).
// function createPrismaClient() {
//   const pool = createPool();
//   const adapter = new PrismaPg(pool);

//   return (
//     new PrismaClient({
//       adapter,
//       // Log configuration:
//       // Development: log all queries as events so we can intercept slow ones.
//       // Production: only log errors. Query logging in production is noisy
//       //             and can slow things down — avoid it unless debugging.
//       log:
//         process.env.NODE_ENV === "development"
//           ? [
//               { emit: "event", level: "query" },
//               { emit: "stdout", level: "warn" },
//               { emit: "stdout", level: "error" },
//             ]
//           : [{ emit: "stdout", level: "error" }],
//     })

//       // ── EXTENSION 1: Soft Delete ─────────────────────────────────────
//       // Intercepts delete and deleteMany on Post.
//       // Instead of issuing DELETE FROM posts WHERE ..., it sets deletedAt.
//       //
//       // This is a "query extension" — it intercepts Prisma operations.
//       //
//       // IMPORTANT: All queries that list posts must include:
//       //   where: { deletedAt: null }
//       // to exclude soft-deleted posts. This is NOT automatic — the extension
//       // only affects delete operations, not reads.
//       //
//       // The tx parameter in transactions: always use the transaction client
//       // inside transactions, not the global prisma. This extension receives
//       // the operation args so it can pass them through correctly.
//       .$extends({
//         name: "soft-delete",
//         query: {
//           post: {
//             async delete({ args, query: _query }) {
//               // Cast required because TS doesn't know the extended shape yet
//               return (prisma as any).post.update({
//                 ...args,
//                 data: { deletedAt: new Date() },
//               });
//             },
//             async deleteMany({ args, query: _query }) {
//               return (prisma as any).post.updateMany({
//                 ...args,
//                 data: { deletedAt: new Date() },
//               });
//             },
//           },
//         },
//       })

//       // ── EXTENSION 2: Computed Fields (result extension) ──────────────
//       // Adds JavaScript-computed getters to every Post result object.
//       // These run in JS after the query returns — they are NOT SQL computed
//       // columns. They don't add any DB overhead.
//       //
//       // `needs` declares which real fields the computation depends on.
//       // Prisma ensures those fields are always fetched when you use select.
//       //
//       // Computed fields appear on every post object automatically:
//       //   const post = await prisma.post.findUnique(...)
//       //   post.isPublished  ← computed, not in DB
//       //   post.readingTime  ← computed, not in DB
//       .$extends({
//         name: "computed-fields",
//         result: {
//           post: {
//             isPublished: {
//               needs: { status: true },
//               compute(post) {
//                 return post.status === "PUBLISHED";
//               },
//             },
//             readingTime: {
//               needs: { content: true },
//               compute(post) {
//                 const wordsPerMinute = 200;
//                 const words = post.content.trim().split(/\s+/).length;
//                 const minutes = Math.ceil(words / wordsPerMinute);
//                 return `${minutes} min read`;
//               },
//             },
//           },
//         },
//       })

//       // ── EXTENSION 3: Query Logging (development only) ─────────────────
//       // Intercepts all queries and logs those slower than 100ms.
//       // This is how you catch N+1 problems and missing indexes in dev
//       // before they reach production.
//       //
//       // This is a "query extension" using $allModels and $allOperations —
//       // the catch-all pattern that intercepts every Prisma operation.
//       .$extends({
//         name: "query-logger",
//         query: {
//           $allModels: {
//             async $allOperations({ operation, model, args, query }) {
//               if (process.env.NODE_ENV !== "development") {
//                 return query(args);
//               }
//               const start = performance.now();
//               const result = await query(args);
//               const duration = Math.round(performance.now() - start);
//               if (duration > 100) {
//                 console.warn(
//                   `🐌 Slow query (${duration}ms): ${model}.${operation}`,
//                   JSON.stringify(args).slice(0, 200)
//                 );
//               }
//               return result;
//             },
//           },
//         },
//       })
//   );
// }

// // ── STEP 3: SINGLETON ─────────────────────────────────────────────────────
// //
// // TypeScript doesn't know about custom globalThis properties by default.
// // We extend the globalThis type to declare our prisma property.
// // ReturnType<typeof createPrismaClient> captures the full extended type —
// // including all the methods added by $extends() — which is complex to
// // write manually.
// const globalForPrisma = globalThis as unknown as {
//   prisma: ReturnType<typeof createPrismaClient> | undefined;
// };

// export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// // Only store on globalThis in development (where HMR is active).
// // In production, this is never true — no globalThis juggling needed.
// if (process.env.NODE_ENV !== "production") {
//   globalForPrisma.prisma = prisma;
// }

// // ── RE-EXPORTS ────────────────────────────────────────────────────────────
// // Export Prisma types and enums from the generated client.
// // Components and queries import from lib/prisma — not from the generated
// // path directly. This keeps generated-path strings in one place.
// export { Prisma, PostStatus, Role } from "@/app/generated/prisma/client";
// export type { Post, User, Comment, Tag } from "@/app/generated/prisma/client";



import { PrismaClient, Prisma } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

function createPool(): pg.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      [
        "❌ DATABASE_URL is not set.",
        "Add it to .env.local:",
        "",
        "# Pooled URL (for runtime) — has -pooler in hostname:",
        'DATABASE_URL="postgres://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/mydb?sslmode=require"',
        "",
        "# Direct URL (for Prisma CLI / migrations) — no -pooler:",
        'DIRECT_URL="postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/mydb?sslmode=require"',
      ].join("\n")
    );
  }

  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false },
  });
}

function createPrismaClient(): PrismaClient {
  const pool = createPool();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(pool as any);

  const client = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "stdout", level: "warn" },
            { emit: "stdout", level: "error" },
          ]
        : [{ emit: "stdout", level: "error" }],
  });

  // ── EXTENSION 1: Soft Delete ──────────────────────────────────────────
  // Uses proper Prisma input types so `where` is preserved correctly.
  // The args passed by Prisma already contain `where` — we just need to
  // merge in the `data` field to convert delete → update.
  const withSoftDelete = client.$extends({
    name: "soft-delete",
    query: {
      post: {
        async delete({
          args,
        }: {
          args: Prisma.PostDeleteArgs;
          query: (args: Prisma.PostDeleteArgs) => Promise<unknown>;
        }) {
          return client.post.update({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },
        async deleteMany({
          args,
        }: {
          args: Prisma.PostDeleteManyArgs;
          query: (args: Prisma.PostDeleteManyArgs) => Promise<unknown>;
        }) {
          return client.post.updateMany({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },
      },
    },
  });

  // ── EXTENSION 2: Computed Fields ──────────────────────────────────────
  const withComputedFields = withSoftDelete.$extends({
    name: "computed-fields",
    result: {
      post: {
        isPublished: {
          needs: { status: true },
          compute(post: { status: string }) {
            return post.status === "PUBLISHED";
          },
        },
        readingTime: {
          needs: { content: true },
          compute(post: { content: string }) {
            const words = post.content.trim().split(/\s+/).length;
            const minutes = Math.ceil(words / 200);
            return `${minutes} min read`;
          },
        },
      },
    },
  });

  // ── EXTENSION 3: Query Logger ─────────────────────────────────────────
  const withLogger = withComputedFields.$extends({
    name: "query-logger",
    query: {
      $allModels: {
        async $allOperations({
          operation,
          model,
          args,
          query,
        }: {
          operation: string;
          model: string;
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) {
          if (process.env.NODE_ENV !== "development") {
            return query(args);
          }
          const start = performance.now();
          const result = await query(args);
          const duration = Math.round(performance.now() - start);
          if (duration > 100) {
            console.warn(
              `🐌 Slow query (${duration}ms): ${model}.${operation}`,
              JSON.stringify(args).slice(0, 200)
            );
          }
          return result;
        },
      },
    },
  });

  return withLogger as unknown as PrismaClient;
}

// ── SINGLETON ─────────────────────────────────────────────────────────────
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ── RE-EXPORTS ────────────────────────────────────────────────────────────
export { Prisma, PostStatus, Role } from "@/app/generated/prisma/client";
export type { Post, User, Comment, Tag } from "@/app/generated/prisma/client";