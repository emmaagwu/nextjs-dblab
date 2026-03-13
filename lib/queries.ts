/**
 * lib/queries.ts
 * ─────────────────────────────────────────────────────────────────────────
 * REUSABLE QUERY FUNCTIONS — The Prisma Pattern Library
 * ─────────────────────────────────────────────────────────────────────────
 *
 * This file is the reference implementation for every query pattern
 * you'll encounter in a production Next.js + Prisma project.
 *
 * Patterns covered:
 *   ✓ findMany with where, orderBy, select, take
 *   ✓ findUnique vs findFirst — when to use each
 *   ✓ include (eager loading) vs select (projection)
 *   ✓ Cursor pagination vs offset pagination
 *   ✓ Relation filtering (some, every, none)
 *   ✓ Aggregations (_count, aggregate with _sum/_avg/_max)
 *   ✓ Promise.all for parallel independent queries
 *   ✓ Atomic updates (increment, decrement)
 *   ✓ $transaction — sequential multi-step
 *   ✓ $queryRaw with Prisma.sql (SQL injection safe)
 *   ✓ Type-safe return types using Prisma's generated types
 *
 * ALL functions here are safe to call from:
 *   - Server Components (RSC)
 *   - Server Actions
 *   - Route Handlers
 *
 * NEVER call these from Client Components. They import from lib/prisma.ts
 * which creates a DB connection — that must stay on the server.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { prisma, Prisma, PostStatus } from "./prisma";

// ─────────────────────────────────────────────────────────────────────────
// TYPE HELPERS
// ─────────────────────────────────────────────────────────────────────────

// Prisma.validator gives you type-safe "fragments" of query args.
// This is the right way to define reusable query shapes — not `any`.
// The generated type is exactly what Prisma expects for that field.
export type PostWithRelations = Prisma.PostGetPayload<{
  include: {
    author: { select: { id: true; name: true; email: true; bio: true } };
    tags: { include: { tag: true } };
    _count: { select: { comments: true } };
  };
}>;

// ─────────────────────────────────────────────────────────────────────────
// GET PUBLISHED POSTS (list page)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Returns published, non-deleted posts with author + tag + comment count.
 *
 * ── SELECT vs INCLUDE ───────────────────────────────────────────────────
 *
 * include: { author: true }
 *   → Fetches ALL fields from the author row
 *   → Generates: SELECT posts.*, users.* FROM posts JOIN users...
 *   → Convenient but overfetches — passwords, tokens, internal fields
 *     all come back even if unused
 *
 * select: { author: { select: { id: true, name: true } } }
 *   → Fetches ONLY declared fields
 *   → Generates: SELECT posts.id, posts.title, ..., users.id, users.name...
 *   → Leaner, faster, more secure (no accidental sensitive field exposure)
 *
 * RULE: Use `include` in Server Components for internal rendering where
 *       data never leaves the server. Use `select` in API routes where
 *       the response becomes JSON sent to a client.
 *
 * ── CURSOR PAGINATION vs OFFSET ─────────────────────────────────────────
 *
 * Offset: skip: (page - 1) * limit, take: limit
 *   ✗ Postgres must read and discard all skipped rows (slow at scale)
 *   ✗ New posts inserted while paginating causes rows to shift
 *     → user sees duplicates on page 2 that appeared after page 1 loaded
 *   ✓ Allows "jump to page 47" — random access
 *
 * Cursor: cursor: { id: lastSeenId }, skip: 1, take: limit
 *   ✓ Postgres does an index seek to the cursor row, then reads forward
 *     — O(limit) regardless of total dataset size
 *   ✓ New rows don't shift your position — no duplicates or gaps
 *   ✗ Can only move forward (prev page requires storing cursor history)
 *   ✗ Cannot jump to an arbitrary page number
 *
 * Use cursor for: feeds, infinite scroll, timeline, real-time data
 * Use offset for: admin tables, search results, small datasets
 */
export async function getPublishedPosts(options?: {
  limit?: number;
  cursor?: string;   // the `id` of the last seen post (from previous page)
  tag?: string;      // tag slug to filter by
  authorId?: string;
}) {
  const { limit = 8, cursor, tag, authorId } = options ?? {};

  return prisma.post.findMany({
    where: {
      status: PostStatus.PUBLISHED,
      deletedAt: null,

      // ── RELATION FILTERING ─────────────────────────────────────────
      // `some` = "at least one related record matches this condition"
      // `every` = "ALL related records match"
      // `none` = "zero related records match"
      // Here: posts where at least one tag has this slug
      ...(tag && {
        tags: {
          some: { tag: { slug: tag } },
        },
      }),

      ...(authorId && { authorId }),
    },

    // ── CURSOR PAGINATION ──────────────────────────────────────────────
    // cursor points to the last row seen on the previous page.
    // skip: 1 tells Prisma to skip that cursor row itself (we already showed it).
    // take: limit reads the next `limit` rows after the cursor.
    ...(cursor
      ? { cursor: { id: cursor }, skip: 1 }
      : {}),
    take: limit,

    orderBy: { publishedAt: "desc" },

    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      status: true,
      publishedAt: true,
      viewCount: true,
      createdAt: true,
      author: {
        select: { id: true, name: true, email: true },
      },
      // _count: fetches aggregate counts without loading the related rows.
      // This is a single JOIN COUNT(*) — far more efficient than loading
      // all comments just to call .length on the array.
      _count: {
        select: { comments: true },
      },
      tags: {
        select: {
          tag: { select: { name: true, slug: true } },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// GET POST BY SLUG (detail page)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Returns a single post with full data for the detail page.
 *
 * ── findUnique vs findFirst ──────────────────────────────────────────────
 *
 * findUnique:
 *   - Only works on fields marked @id or @unique in schema.prisma
 *   - TypeScript return type: Post | null (guaranteed ≤1 result)
 *   - WHERE clause uses the unique constraint index directly
 *   - Slightly faster because Postgres knows to stop after finding 1 row
 *   - Clearer intent: "I expect exactly zero or one result"
 *
 * findFirst:
 *   - Works on ANY field(s) with any filter
 *   - Adds LIMIT 1 to the SQL
 *   - TypeScript return type: Post | null
 *   - Use when filtering on non-unique fields (e.g. most recent by date)
 *
 * slug is @unique → findUnique is correct here.
 */
export async function getPostBySlug(slug: string) {
  return prisma.post.findUnique({
    where: {
      slug,
      deletedAt: null, // Prisma 7 supports compound where on unique fields
    },
    include: {
      author: {
        select: { id: true, name: true, bio: true, email: true },
      },
      comments: {
        include: {
          author: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      tags: {
        include: { tag: true },
        orderBy: { assignedAt: "asc" },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// GET ALL POSTS FOR ADMIN (includes drafts, soft-deleted)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Admin query — conditional filtering based on options.
 *
 * PATTERN: Dynamic where object
 * Build the where clause with spread + conditional fields.
 * This avoids writing multiple similar queries for each filter combo.
 */
export async function getAllPostsAdmin(options?: {
  status?: PostStatus;
  includeDeleted?: boolean;
}) {
  const { status, includeDeleted = false } = options ?? {};

  return prisma.post.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(!includeDeleted ? { deletedAt: null } : {}),
    },
    include: {
      author: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// DASHBOARD STATS — Aggregations + Parallel Queries
// ─────────────────────────────────────────────────────────────────────────

/**
 * Returns platform-wide statistics.
 *
 * PATTERN: Promise.all for parallel independent queries
 *
 * These 4 database queries are completely independent — none depends on
 * the result of another. Sequential awaits would be:
 *   Time = query1 + query2 + query3 + query4 + query5
 *   Time = 20ms + 15ms + 18ms + 12ms + 25ms = 90ms
 *
 * Promise.all runs them in parallel:
 *   Time = max(20ms, 15ms, 18ms, 12ms, 25ms) = 25ms
 *
 * In a serverless function where every millisecond directly affects
 * user-perceived latency (and billing), this matters enormously.
 *
 * PATTERN: aggregate() for multi-stat queries
 * Instead of multiple count() calls, aggregate() can compute _sum, _avg,
 * _min, _max, _count in a single SQL query.
 */
export async function getDashboardStats() {
  const [totalPosts, publishedCount, totalUsers, totalComments, viewStats] =
    await Promise.all([
      // count() → SELECT COUNT(*) FROM posts WHERE deleted_at IS NULL
      prisma.post.count({ where: { deletedAt: null } }),

      prisma.post.count({
        where: { status: PostStatus.PUBLISHED, deletedAt: null },
      }),

      prisma.user.count(),

      prisma.comment.count(),

      // aggregate() → single SQL with COUNT + SUM + AVG + MAX
      prisma.post.aggregate({
        where: { status: PostStatus.PUBLISHED, deletedAt: null },
        _sum: { viewCount: true },
        _avg: { viewCount: true },
        _max: { viewCount: true },
        _count: { _all: true },
      }),
    ]);

  return {
    totalPosts,
    publishedPosts: publishedCount,
    draftPosts: totalPosts - publishedCount,
    totalUsers,
    totalComments,
    totalViews: viewStats._sum.viewCount ?? 0,
    avgViews: Math.round(viewStats._avg.viewCount ?? 0),
    maxViews: viewStats._max.viewCount ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// ATOMIC UPDATE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Increment view count — demonstrates atomic updates.
 *
 * PATTERN: { increment: N } — atomic counter update
 *
 * Naive approach (WRONG under concurrency):
 *   const post = await prisma.post.findUnique(...)
 *   await prisma.post.update({ data: { viewCount: post.viewCount + 1 } })
 *
 * Problem: Two requests read viewCount = 5 simultaneously.
 *   Request A: reads 5, writes 6
 *   Request B: reads 5, writes 6   ← lost update! should have written 7
 *
 * Atomic approach (CORRECT):
 *   data: { viewCount: { increment: 1 } }
 *   → SQL: UPDATE posts SET view_count = view_count + 1 WHERE id = ?
 *   → This is a single atomic SQL statement.
 *   → Postgres handles the read-modify-write internally — no race condition.
 *
 * Prisma supports: increment, decrement, multiply, divide, set
 * All are translated to atomic SQL expressions.
 */
export async function incrementViewCount(postId: string) {
  return prisma.post.update({
    where: { id: postId },
    data: { viewCount: { increment: 1 } },
    select: { viewCount: true },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Publish a post — demonstrates interactive transactions.
 *
 * PATTERN: $transaction(async (tx) => { ... })
 *
 * An "interactive transaction" runs multiple operations in a single
 * atomic database transaction. Either ALL succeed or ALL fail and
 * are rolled back.
 *
 * When to use transactions:
 *   - Multi-step operations where partial completion is worse than failure
 *   - "Publish post" → must verify ownership AND update status together
 *   - "Transfer funds" → debit account A AND credit account B together
 *   - "Create order" → decrement inventory AND create order record together
 *
 * The `tx` parameter is a transactional PrismaClient. Use `tx` for ALL
 * operations inside the transaction. If you accidentally use the outer
 * `prisma` object instead of `tx`, those operations won't be in the
 * transaction and won't roll back on failure.
 *
 * Alternative: $transaction([op1, op2, op3]) — array form for simple cases
 *   where operations don't depend on each other's results.
 *   Less flexible than the callback form.
 */
export async function publishPost(postId: string, authorId: string) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // ── Step 1: verify the post exists and belongs to this author ──────
    const post = await tx.post.findUnique({
      where: { id: postId, deletedAt: null },
      select: { authorId: true, status: true, slug: true },
    });

    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }
    if (post.authorId !== authorId) {
      throw new Error("Permission denied: you are not the author of this post");
    }
    if (post.status === PostStatus.PUBLISHED) {
      throw new Error("Post is already published");
    }

    // ── Step 2: publish ────────────────────────────────────────────────
    // If this throws, Step 1's verification is also rolled back.
    // The transaction guarantees atomicity.
    const published = await tx.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      select: { id: true, slug: true, title: true },
    });

    // In a real app: Step 3 might be "create a notification" or
    // "post to a webhook queue". If it throws, Steps 1+2 roll back.

    return published;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// RAW SQL — For queries Prisma can't express
// ─────────────────────────────────────────────────────────────────────────

/**
 * Full-text search using Postgres's native FTS engine.
 *
 * PATTERN: $queryRaw with Prisma.sql for parameterised queries
 *
 * Prisma doesn't natively support Postgres full-text search syntax
 * (to_tsvector, plainto_tsquery, ts_rank). We drop to raw SQL here.
 *
 * SQL INJECTION WARNING:
 *
 * ❌ NEVER interpolate user input directly into template strings:
 *    prisma.$queryRaw`SELECT * FROM posts WHERE title = '${userQuery}'`
 *    → Attacker sends: ' OR 1=1; DROP TABLE users; --
 *    → Your database is gone.
 *
 * ✅ ALWAYS use Prisma.sql template literals:
 *    prisma.$queryRaw`SELECT * FROM posts WHERE title = ${userQuery}`
 *    (note: NO quotes around ${userQuery})
 *    → Prisma converts ${userQuery} into a $1 parameter
 *    → Postgres receives: WHERE title = $1 (parameterised)
 *    → SQL injection is impossible with parameterised queries
 *
 * The difference is subtle but critical:
 *   '${userQuery}'   → string interpolation before Prisma sees it → dangerous
 *   ${userQuery}     → Prisma.sql sees it as a parameter → safe
 *
 * Note: $queryRaw always uses the Prisma.sql tag implicitly when you use
 * the template literal syntax. You can also use Prisma.sql explicitly
 * when building queries programmatically.
 *
 * FTS EXPLANATION:
 *   to_tsvector('english', text) → converts text to a "tsvector"
 *     (a sorted list of lexemes/word stems) using English dictionary
 *   plainto_tsquery('english', query) → parses the search query
 *   @@ operator → checks if tsvector matches tsquery
 *   ts_rank() → ranks results by relevance (higher = more relevant)
 */
export async function searchPosts(query: string) {
  type SearchResult = {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    rank: number;
  };

  const results = await prisma.$queryRaw<SearchResult[]>`
    SELECT
      id,
      title,
      slug,
      excerpt,
      ts_rank(
        to_tsvector('english',
          title || ' ' ||
          coalesce(excerpt, '') || ' ' ||
          content
        ),
        plainto_tsquery('english', ${query})
      ) AS rank
    FROM posts
    WHERE
      deleted_at IS NULL
      AND status = 'PUBLISHED'
      AND to_tsvector('english',
            title || ' ' ||
            coalesce(excerpt, '') || ' ' ||
            content
          ) @@ plainto_tsquery('english', ${query})
    ORDER BY rank DESC
    LIMIT 10
  `;

  return results;
}

// ─────────────────────────────────────────────────────────────────────────
// TAG QUERIES
// ─────────────────────────────────────────────────────────────────────────

export async function getAllTags() {
  return prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { posts: true } },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// USER QUERIES
// ─────────────────────────────────────────────────────────────────────────

export async function getDemoUser() {
  // For this lab, always use the first admin user.
  // In a real app, this comes from auth() (see Phase 3).
  return prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, name: true, email: true, role: true },
  });
}