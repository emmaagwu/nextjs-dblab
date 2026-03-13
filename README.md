# DBLab — Phase 4: Databases on Vercel

**Prisma 7 + Neon (serverless Postgres) + Next.js 15**

A working lab that teaches every database pattern you need for production Next.js apps. Every file is annotated with the WHY, not just the HOW.

---

## What This Lab Covers

| Pattern | File | Prisma API |
|---|---|---|
| Singleton client setup | `lib/prisma.ts` | `PrismaClient({ adapter })`, `globalThis` |
| Driver adapter (Postgres) | `lib/prisma.ts` | `PrismaPg`, `Pool` |
| Soft delete extension | `lib/prisma.ts` | `$extends({ query })` |
| Computed fields extension | `lib/prisma.ts` | `$extends({ result })` |
| Query logging extension | `lib/prisma.ts` | `$extends({ query.$allModels })` |
| Filtered list query | `lib/queries.ts` | `findMany`, `where`, `select` |
| Relation filtering | `lib/queries.ts` | `tags: { some: { tag: { slug } } }` |
| Cursor pagination | `lib/queries.ts` | `cursor`, `skip: 1`, `take` |
| Detail page query | `lib/queries.ts` | `findUnique`, `include` |
| Parallel queries | `lib/queries.ts` | `Promise.all([...])` |
| Aggregations | `lib/queries.ts` | `aggregate({ _sum, _avg, _max })` |
| Atomic increment | `lib/queries.ts` | `{ increment: 1 }` |
| Multi-step transaction | `lib/queries.ts` | `$transaction(async (tx) => ...)` |
| Raw SQL (safe) | `lib/queries.ts` | `$queryRaw`, `Prisma.sql` |
| Full-text search | `app/db/page.tsx` | `$queryRaw` + `to_tsvector` |
| Server Action + Zod | `actions/posts.ts` | `safeParse`, `createPost` |
| Nested create (M:M) | `actions/posts.ts` | `tags: { create: [...] }` |
| Replace M:M relations | `actions/posts.ts` | `tags: { deleteMany: {}, create: [...] }` |
| Cache revalidation | `actions/posts.ts` | `revalidateTag`, `revalidatePath` |
| EXPLAIN plans | `app/db/page.tsx` | `$queryRaw\`EXPLAIN...\`` |
| Index inspection | `app/db/page.tsx` | `$queryRaw` on `pg_indexes` |

---

## Setup

### 1. Get a Neon database

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project
3. Go to **Connection Details** in your project dashboard
4. Copy both connection strings:
   - **Pooled connection** (has `-pooler` in hostname) → `DATABASE_URL`
   - **Direct connection** (no `-pooler`) → `DIRECT_URL`

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
# Edit .env.local and paste your connection strings
```

### 3. Install dependencies

```bash
npm install
```

### 4. Generate the Prisma client

```bash
npm run db:generate
# Generates TypeScript files into app/generated/prisma/
```

> ⚠️ **Prisma 7 change**: `prisma migrate dev` no longer auto-generates the client. You must run `prisma generate` explicitly.

### 5. Create database tables

```bash
npm run db:migrate
# Runs prisma migrate dev
# Creates all tables defined in prisma/schema.prisma
# Uses DIRECT_URL from prisma.config.ts (bypasses PgBouncer)
```

### 6. Seed the database

```bash
npm run db:seed
# Runs prisma db seed → tsx prisma/seed.ts
# Creates 3 users, 5 tags, 4 posts, 6 comments
```

> ⚠️ **Prisma 7 change**: Seeding no longer runs automatically after `migrate dev`. Must run explicitly.

### 7. Start the dev server

```bash
npm run dev
# → http://localhost:3000
```

---

## Key Prisma 7 Breaking Changes

### 1. Provider name changed

```diff
generator client {
-  provider = "prisma-client-js"
+  provider = "prisma-client"
+  output   = "../app/generated/prisma"
}
```

### 2. `output` is now required

The client is generated into your source tree, not `node_modules`.

### 3. No `url` in `schema.prisma`

```diff
datasource db {
  provider = "postgresql"
-  url      = env("DATABASE_URL")
}
```

URL goes in `prisma.config.ts` instead.

### 4. Driver adapter is required

```typescript
// OLD (v6) — now throws PrismaClientConstructorValidationError
const prisma = new PrismaClient()

// NEW (v7) — adapter is required
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
```

### 5. `$use()` middleware removed → use `$extends()`

```typescript
// OLD (removed in v7)
prisma.$use(async (params, next) => { return next(params) })

// NEW
const prisma = new PrismaClient({ adapter }).$extends({
  query: {
    post: {
      async findMany({ args, query }) { return query(args) }
    }
  }
})
```

### 6. Import path changed

```typescript
// OLD
import { PrismaClient } from '@prisma/client'

// NEW — import from /client specifically
import { PrismaClient } from '@/app/generated/prisma/client'
```

### 7. Mapped enums (@map) was REVERTED

The changelog announced `@map` on enum members. This was reverted before v7 stable. TypeScript enum values are still uppercase schema names (`Role.USER = "USER"`, not `"user"`).

### 8. No auto-seeding, no auto-generate

```bash
# OLD (v6): migrate dev ran generate AND seed automatically
# NEW (v7): run these explicitly
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 9. Turbopack fix required

Add to `next.config.ts`:

```typescript
serverExternalPackages: ["pg", "@prisma/adapter-pg"]
```

Without this, Turbopack fails to resolve the generated ESM client files.

---

## The Two-URL Pattern

```
Your app (runtime)
  → DATABASE_URL (pooled, has -pooler in hostname)
  → PgBouncer (Neon's connection pooler)
  → Postgres

Prisma CLI (migrate / seed)
  → DIRECT_URL (direct, no -pooler)
  → Postgres directly (advisory locks work)
```

**Why two URLs?**

PgBouncer uses "transaction mode" pooling. This mode doesn't support:
- Advisory locks (`pg_advisory_lock`) — used by Prisma migrations to prevent concurrent runs
- `SET LOCAL` statements — used internally by Prisma

Migrations MUST use a direct connection. Your app MUST use the pooled connection (otherwise you exhaust Postgres's connection limit under serverless load).

---

## Scripts Reference

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack |
| `npm run db:generate` | Generate Prisma client into app/generated/prisma/ |
| `npm run db:migrate` | Run pending migrations (creates tables) |
| `npm run db:push` | Push schema changes without migration files (good for prototyping) |
| `npm run db:seed` | Seed the database with sample data |
| `npm run db:reset` | Reset + re-migrate + re-seed (destructive!) |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |

---

## Next: Phase 5 — Data Fetching Patterns

- `useOptimistic` for instant UI updates
- `Promise.all` vs sequential waterfall performance analysis
- React Query / SWR with the App Router
- Suspense boundaries + streaming HTML
- Infinite scroll with cursor pagination