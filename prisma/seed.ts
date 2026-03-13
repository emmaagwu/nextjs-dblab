/**
 * prisma/seed.ts
 * ─────────────────────────────────────────────────────────────────────────
 * DATABASE SEED SCRIPT — Prisma 7
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Run: npm run db:seed   (or: npx prisma db seed)
 *
 * ⚠️ PRISMA 7 CHANGE: Seeding no longer runs automatically after
 * `prisma migrate dev` or `prisma migrate reset`.
 * You must run it explicitly: npx prisma db seed
 *
 * This script:
 *   1. Creates its own PrismaClient with the PrismaPg adapter
 *      (does NOT use the lib/prisma.ts singleton — seeds run standalone)
 *   2. Uses DIRECT_URL for a stable non-pooled connection
 *      (seeds are long-running — direct connections are appropriate here)
 *   3. Cleans existing data before inserting (idempotent)
 *   4. Creates a realistic dataset that exercises all query patterns
 *
 * ENUM VALUES IN PRISMA 7:
 * Use the schema names: Role.USER, PostStatus.PUBLISHED, etc.
 * The TypeScript enum values are "USER", "PUBLISHED" (uppercase schema names).
 * NOT "user", "published" — that's the reverted mapped enum feature.
 * ─────────────────────────────────────────────────────────────────────────
 */

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Seeds use DIRECT_URL (bypasses PgBouncer pooler).
// Long-running scripts work better with a direct connection.
const pool = new Pool({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding DBLab database...\n");

  // ── CLEAN EXISTING DATA ──────────────────────────────────────────────
  // Delete in dependency order (children before parents) to respect FK constraints
  await prisma.tagsOnPosts.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany();
  console.log("  ✓ Cleared existing data");

  // ── USERS ────────────────────────────────────────────────────────────
  // Role enum values: "USER" | "EDITOR" | "ADMIN" (schema names, uppercase)
  // NOT "user" | "editor" | "admin" — that was the reverted @map feature
  const alice = await prisma.user.create({
    data: {
      email: "alice@dblab.dev",
      name: "Alice Chen",
      bio: "Full-stack engineer obsessed with databases, ORMs, and TypeScript. Previously at Stripe.",
      role: "ADMIN",
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: "bob@dblab.dev",
      name: "Bob Martinez",
      bio: "Backend developer. Thinks in SQL first, ORM second.",
      role: "EDITOR",
    },
  });

  const carol = await prisma.user.create({
    data: {
      email: "carol@dblab.dev",
      name: "Carol White",
      bio: "Junior developer learning the ropes.",
      role: "USER",
    },
  });

  console.log("  ✓ Created 3 users (ADMIN, EDITOR, USER)");

  // ── TAGS ─────────────────────────────────────────────────────────────
  const [tagPrisma, tagNextjs, tagPostgres, tagPerf, tagSecurity] =
    await Promise.all([
      prisma.tag.create({ data: { name: "Prisma",      slug: "prisma" } }),
      prisma.tag.create({ data: { name: "Next.js",     slug: "nextjs" } }),
      prisma.tag.create({ data: { name: "PostgreSQL",  slug: "postgresql" } }),
      prisma.tag.create({ data: { name: "Performance", slug: "performance" } }),
      prisma.tag.create({ data: { name: "Security",    slug: "security" } }),
    ]);

  console.log("  ✓ Created 5 tags");

  // ── POSTS ─────────────────────────────────────────────────────────────
  const post1 = await prisma.post.create({
    data: {
      title: "Prisma 7: Every Breaking Change Explained",
      slug: "prisma-7-every-breaking-change",
      excerpt:
        "A deep dive into Prisma 7's Rust-free architecture, mandatory driver adapters, prisma.config.ts, and what actually changed with mapped enums.",
      content: `# Prisma 7: Every Breaking Change Explained

Prisma 7 (November 19, 2025) is the biggest release in Prisma's history. Here's what you actually need to know — including the breaking change that was announced then reverted.

## Change 1: The Rust Engine is Gone

For years, Prisma shipped a compiled Rust binary alongside every project. This binary was the query engine — it translated Prisma Client API calls into SQL and executed them.

The binary caused real problems: slow cold starts on serverless platforms, binary compatibility issues on some deployment targets (especially custom Linux environments), and significant bundle size overhead (~20MB).

Prisma 7 replaces it entirely with the Query Compiler — a pure TypeScript implementation. Result: 90% smaller bundles, 3x faster queries on average, and no binary to worry about.

## Change 2: Driver Adapters Are Now Required

Without the Rust engine, Prisma needs something to actually connect to and execute SQL against your database. That's the driver adapter's job.

In v6, you could write: const prisma = new PrismaClient()

In v7, this throws: PrismaClientConstructorValidationError: Using engine type "client" requires either "adapter" or "accelerateUrl"

You must now write:
\`\`\`typescript
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
\`\`\`

## Change 3: prisma.config.ts

The database URL moved out of schema.prisma and into a new TypeScript config file at the project root. If you put url in both places, you get Error P1012.

## Change 4: The Mapped Enum Situation

The Prisma changelog initially said v7 would support @map on enum members, so Role.USER would equal "user" (lowercase). This was REVERTED before stable shipped. TypeScript enum values are still the schema names: Role.USER = "USER".

## Change 5: No More Auto-Seeding

Running prisma migrate dev no longer automatically seeds your database. You must run npx prisma db seed explicitly.`.trim(),
      status: "PUBLISHED",
      publishedAt: new Date("2026-01-15"),
      viewCount: 2841,
      authorId: alice.id,
      tags: {
        create: [
          { tag: { connect: { id: tagPrisma.id } } },
          { tag: { connect: { id: tagNextjs.id } } },
          { tag: { connect: { id: tagPostgres.id } } },
        ],
      },
    },
  });

  const post2 = await prisma.post.create({
    data: {
      title: "Connection Pooling on Vercel: The Complete Guide",
      slug: "connection-pooling-vercel-complete-guide",
      excerpt:
        "Why serverless functions exhaust Postgres connections, what PgBouncer does, and how to configure the two-URL pattern with Neon and Prisma.",
      content: `# Connection Pooling on Vercel: The Complete Guide

If you've deployed a Next.js app to Vercel with a Postgres database, you've hit this error: "remaining connection slots are reserved for non-replication superuser connections". Here's why it happens and how to fix it properly.

## Why Serverless Breaks Traditional Connection Management

A traditional Node.js server runs as a single process. It creates a connection pool on startup and reuses those connections across all requests. Simple, efficient, no problem.

Vercel's serverless functions are fundamentally different. Each function invocation can spin up a new process. Under load, Vercel might run 200 concurrent instances of your /api/posts route. If each one opens even one database connection, that's 200 new connections. Postgres's default limit is ~100. Everything fails.

## PgBouncer: The Connection Pooler

PgBouncer is a lightweight proxy that sits between your app and Postgres. Your serverless functions connect to PgBouncer. PgBouncer maintains a small pool of real Postgres connections (e.g. 10-20) and multiplexes thousands of application connections across them.

Neon includes PgBouncer in their platform. The pooled URL contains "-pooler" in the hostname.

## The Two-URL Pattern

\`\`\`bash
# .env.local

# Pooled — has -pooler in hostname. Used by your app at runtime.
DATABASE_URL="postgres://user:pass@ep-abc-pooler.us-east-2.aws.neon.tech/db?sslmode=require"

# Direct — no -pooler. Used by Prisma CLI for migrations ONLY.
DIRECT_URL="postgres://user:pass@ep-abc.us-east-2.aws.neon.tech/db?sslmode=require"
\`\`\`

Why two? PgBouncer uses "transaction mode" pooling, which doesn't support advisory locks. Prisma migrations require advisory locks (to prevent concurrent migration runs). So migrations must use a direct connection.

## Configuring in Prisma 7

\`\`\`typescript
// prisma.config.ts — URL for the CLI (use DIRECT_URL)
export default defineConfig({
  datasource: { url: env('DIRECT_URL') }
});

// lib/prisma.ts — Pool for runtime (use DATABASE_URL / pooled)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
\`\`\``.trim(),
      status: "PUBLISHED",
      publishedAt: new Date("2026-02-01"),
      viewCount: 1654,
      authorId: alice.id,
      tags: {
        create: [
          { tag: { connect: { id: tagPostgres.id } } },
          { tag: { connect: { id: tagPerf.id } } },
          { tag: { connect: { id: tagNextjs.id } } },
        ],
      },
    },
  });

  const post3 = await prisma.post.create({
    data: {
      title: "N+1 Queries in Prisma: Detection, Diagnosis, Fix",
      slug: "n-plus-1-queries-prisma-detection-fix",
      excerpt:
        "The most common ORM performance bug, why it happens in Prisma, how to detect it in development, and three patterns to fix it.",
      content: `# N+1 Queries in Prisma: Detection, Diagnosis, Fix

The N+1 query problem is responsible for more production performance incidents than any other ORM pattern. Here's what it is, how to catch it in development, and how to fix it.

## What Is N+1?

Fetch 10 posts (1 query). Then for each post, fetch the author (10 queries). Total: 11 queries. The name comes from: 1 (list query) + N (one per item).

## Detection: Query Logging Extension

\`\`\`typescript
const prisma = new PrismaClient({ adapter }).$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        const start = performance.now();
        const result = await query(args);
        const duration = Math.round(performance.now() - start);
        if (duration > 100) {
          console.warn(\`Slow: \${model}.\${operation} took \${duration}ms\`);
        }
        return result;
      }
    }
  }
});
\`\`\`

## Fix 1: include (Eager Loading)

\`\`\`typescript
// ❌ N+1 — 1 query for posts, N queries for authors
const posts = await prisma.post.findMany();
for (const post of posts) {
  const author = await prisma.user.findUnique({ where: { id: post.authorId } });
}

// ✅ Single query with JOIN
const posts = await prisma.post.findMany({
  include: { author: true }
});
\`\`\`

## Fix 2: select (Projection)

Only fetch the fields the current view actually needs.

## Fix 3: _count Instead of Loading Relations

\`\`\`typescript
// ❌ Loads all comments just to count them
const posts = await prisma.post.findMany({
  include: { comments: true }
});
posts.map(p => p.comments.length); // could be 1000+ rows loaded

// ✅ COUNT(*) in a single JOIN — no rows transferred
const posts = await prisma.post.findMany({
  include: { _count: { select: { comments: true } } }
});
posts.map(p => p._count.comments);
\`\`\``.trim(),
      status: "PUBLISHED",
      publishedAt: new Date("2026-02-20"),
      viewCount: 987,
      authorId: bob.id,
      tags: {
        create: [
          { tag: { connect: { id: tagPrisma.id } } },
          { tag: { connect: { id: tagPerf.id } } },
        ],
      },
    },
  });

  // Draft post — demonstrates status filtering
  await prisma.post.create({
    data: {
      title: "Row-Level Security in PostgreSQL with Prisma",
      slug: "row-level-security-postgresql-prisma",
      excerpt:
        "How to use Postgres RLS policies to enforce data isolation at the database level, and how Prisma works with RLS.",
      content: "Work in progress...",
      status: "DRAFT",
      authorId: bob.id,
      tags: {
        create: [
          { tag: { connect: { id: tagPostgres.id } } },
          { tag: { connect: { id: tagSecurity.id } } },
        ],
      },
    },
  });

  console.log("  ✓ Created 4 posts (3 PUBLISHED, 1 DRAFT)");

  // ── COMMENTS ──────────────────────────────────────────────────────────
  await prisma.comment.createMany({
    data: [
      {
        postId: post1.id,
        authorId: bob.id,
        body: "The section on the reverted mapped enum feature saved me hours of confusion. The changelog was misleading.",
      },
      {
        postId: post1.id,
        authorId: carol.id,
        body: "Finally got my migration working after reading this. The prisma.config.ts setup was the missing piece.",
      },
      {
        postId: post1.id,
        authorId: alice.id,
        body: "Worth emphasizing: ESM (type: module in package.json) is also required. Caught several people on that.",
      },
      {
        postId: post2.id,
        authorId: bob.id,
        body: "The two-URL pattern is elegant once you understand WHY it exists. PgBouncer advisory lock limitation is the key insight.",
      },
      {
        postId: post2.id,
        authorId: carol.id,
        body: "Does this apply to Supabase too? I think they also use PgBouncer by default.",
      },
      {
        postId: post3.id,
        authorId: carol.id,
        body: "The _count pattern was a game changer. Was loading thousands of comment rows just for a count!",
      },
    ],
  });

  console.log("  ✓ Created 6 comments");

  // ── SUMMARY ───────────────────────────────────────────────────────────
  const [users, posts, tags, comments] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.tag.count(),
    prisma.comment.count(),
  ]);

  console.log("\n✅ Seed complete:");
  console.log(`   Users:    ${users}`);
  console.log(`   Posts:    ${posts}`);
  console.log(`   Tags:     ${tags}`);
  console.log(`   Comments: ${comments}`);
  console.log("\nRun: npm run dev → http://localhost:3000");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });