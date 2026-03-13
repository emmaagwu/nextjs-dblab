/**
 * app/db/page.tsx — Live Database Explorer
 *
 * DEMONSTRATES:
 *   - $queryRaw for SQL Prisma can't express (pg_indexes, EXPLAIN, FTS)
 *   - Prisma.sql tagged template for parameterised queries (SQL injection safe)
 *   - aggregate() for stats
 *   - EXPLAIN ANALYZE to see query plans
 *   - Full-text search with ts_rank
 */

import { prisma } from "@/lib/prisma";
import { getDashboardStats } from "@/lib/queries";
import { SearchBox } from "@/components/SearchBox";

export const dynamic = "force-dynamic";
export const metadata = { title: "DB Explorer" };

type IndexRow = {
  indexname: string;
  tablename: string;
  indexdef: string;
  unique: boolean;
};

type TableRow = {
  table_name: string;
  total_size: string;
  table_size: string;
  index_size: string;
  row_estimate: string;
};

type ExplainRow = { "QUERY PLAN": string };

type SearchResult = {
  id: string;
  title: string;
  slug: string;
  rank: number;
};

export default async function DbPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const [stats, indexes, tables] = await Promise.all([
    getDashboardStats(),

    prisma.$queryRaw<IndexRow[]>`
      SELECT
        i.indexname,
        i.tablename,
        i.indexdef,
        ix.indisunique AS unique
      FROM pg_indexes i
      JOIN pg_class c ON c.relname = i.indexname
      JOIN pg_index ix ON ix.indexrelid = c.oid
      WHERE i.schemaname = 'public'
        AND i.tablename IN ('posts', 'users', 'comments', 'tags', 'tags_on_posts')
      ORDER BY i.tablename, i.indexname
    `,

    // Fix: reltuples is on pg_class, not pg_statio_user_tables.
    // Alias the statio table as "s" and join pg_class for row estimates.
    prisma.$queryRaw<TableRow[]>`
      SELECT
        s.relname AS table_name,
        pg_size_pretty(pg_total_relation_size(s.relid)) AS total_size,
        pg_size_pretty(pg_relation_size(s.relid)) AS table_size,
        pg_size_pretty(pg_indexes_size(s.relid)) AS index_size,
        c.reltuples::bigint::text AS row_estimate
      FROM pg_catalog.pg_statio_user_tables s
      JOIN pg_class c ON c.oid = s.relid
      WHERE s.relname IN ('posts', 'users', 'comments', 'tags', 'tags_on_posts')
      ORDER BY pg_total_relation_size(s.relid) DESC
    `,
  ]);

  const explainRows = await prisma.$queryRaw<ExplainRow[]>`
    EXPLAIN (FORMAT TEXT)
    SELECT id, title, slug, status
    FROM posts
    WHERE status = 'PUBLISHED'
    ORDER BY id DESC
    LIMIT 8
  `;
  const explainText = explainRows.map((r: ExplainRow) => r["QUERY PLAN"]).join("\n");

  let searchResults: SearchResult[] = [];
  if (q && q.trim().length > 0) {
    searchResults = await prisma.$queryRaw<SearchResult[]>`
      SELECT id, title, slug,
        ts_rank(
          to_tsvector('english', title || ' ' || coalesce(excerpt, '') || ' ' || content),
          plainto_tsquery('english', ${q})
        ) AS rank
      FROM posts
      WHERE deleted_at IS NULL
        AND status = 'PUBLISHED'
        AND to_tsvector('english', title || ' ' || coalesce(excerpt, '') || ' ' || content)
            @@ plainto_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT 10
    `;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-12">

      {/* Header */}
      <div>
        <div className="text-xs font-mono text-cyan-400 uppercase tracking-widest mb-2">$queryRaw</div>
        <h1 className="text-3xl font-bold mb-2">Database Explorer</h1>
        <p className="text-zinc-400 leading-relaxed">
          Live introspection of your Postgres database. Everything on this page
          uses <code className="text-cyan-400 font-mono text-sm">prisma.$queryRaw</code> with
          parameterised <code className="text-cyan-400 font-mono text-sm">Prisma.sql</code> templates.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(
          [
            { label: "Published Posts", value: stats.publishedPosts, c: "text-emerald-400" },
            { label: "Total Views",     value: stats.totalViews.toLocaleString(), c: "text-blue-400" },
            { label: "Avg Views",       value: stats.avgViews, c: "text-violet-400" },
            { label: "Comments",        value: stats.totalComments, c: "text-amber-400" },
          ] as { label: string; value: string | number; c: string }[]
        ).map((s) => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className={`text-2xl font-bold font-mono ${s.c}`}>{s.value}</div>
            <div className="text-xs text-zinc-600 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Indexes */}
      <div>
        <h2 className="text-xl font-bold mb-1">Indexes</h2>
        <p className="text-zinc-500 text-sm mb-4 leading-relaxed">
          Every <code className="font-mono text-xs text-zinc-400">@@index()</code> in schema.prisma
          creates a real B-tree index in Postgres. Missing indexes on WHERE/ORDER BY columns =
          sequential scans = slow queries at scale.
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2 border-b border-zinc-800 text-xs font-mono font-semibold text-zinc-600 uppercase tracking-wider">
            <span className="col-span-3">Table</span>
            <span className="col-span-4">Index Name</span>
            <span className="col-span-1 text-center">Unique</span>
            <span className="col-span-4">Definition</span>
          </div>
          {indexes.map((idx: IndexRow, i: number) => {
            const def = idx.indexdef.replace(/CREATE (UNIQUE )?INDEX \S+ ON public\.\S+ /, "");
            return (
              <div
                key={i}
                className="grid grid-cols-12 px-4 py-2.5 border-b border-zinc-800/50 text-xs font-mono hover:bg-zinc-800/30 transition-colors"
              >
                <span className="col-span-3 text-amber-400">{idx.tablename}</span>
                <span className="col-span-4 text-blue-400 truncate pr-2">{idx.indexname}</span>
                <span className="col-span-1 text-center">
                  {idx.unique
                    ? <span className="text-emerald-400">✓</span>
                    : <span className="text-zinc-700">—</span>}
                </span>
                <span className="col-span-4 text-zinc-500 truncate" title={def}>{def}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 font-mono text-xs text-zinc-700 px-1">
          {"// "}
          <span className="text-zinc-500">SELECT indexname, tablename, indexdef FROM pg_indexes WHERE schemaname = &apos;public&apos;</span>
        </div>
      </div>

      {/* Table sizes */}
      <div>
        <h2 className="text-xl font-bold mb-1">Table Sizes</h2>
        <p className="text-zinc-500 text-sm mb-4">
          Sizes from pg_statio_user_tables + pg_class. Row estimate = Postgres stats (approximate, updated by ANALYZE).
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-5 px-4 py-2 border-b border-zinc-800 text-xs font-mono font-semibold text-zinc-600 uppercase tracking-wider">
            <span className="col-span-2">Table</span>
            <span>Total</span>
            <span>Data</span>
            <span>Indexes</span>
          </div>
          {tables.map((t: TableRow, i: number) => (
            <div key={i} className="grid grid-cols-5 px-4 py-2.5 border-b border-zinc-800/50 text-xs font-mono">
              <span className="col-span-2 text-amber-400">{t.table_name}</span>
              <span className="text-white">{t.total_size}</span>
              <span className="text-zinc-400">{t.table_size}</span>
              <span className="text-blue-400">{t.index_size}</span>
            </div>
          ))}
        </div>
      </div>

      {/* EXPLAIN */}
      <div>
        <h2 className="text-xl font-bold mb-1">EXPLAIN Plan</h2>
        <p className="text-zinc-500 text-sm mb-4 leading-relaxed">
          The query plan Postgres generates for the post list query.{" "}
          <span className="text-emerald-400">Index Scan</span> = good (uses a B-tree index).{" "}
          <span className="text-red-400">Seq Scan</span> = potentially slow (full table scan — missing index).
        </p>
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
          <pre className="font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{explainText}</pre>
        </div>
      </div>

      {/* Full-text search */}
      <div>
        <h2 className="text-xl font-bold mb-1">Full-Text Search</h2>
        <p className="text-zinc-500 text-sm mb-4 leading-relaxed">
          Postgres native FTS using{" "}
          <code className="font-mono text-xs text-zinc-400">to_tsvector</code> +{" "}
          <code className="font-mono text-xs text-zinc-400">plainto_tsquery</code> +{" "}
          <code className="font-mono text-xs text-zinc-400">ts_rank</code>.
          Prisma does not support FTS natively — this is where{" "}
          <code className="font-mono text-xs text-zinc-400">$queryRaw</code> is essential.
        </p>

        <SearchBox defaultValue={q} />

        {q && (
          <div className="mt-4">
            {searchResults.length === 0 ? (
              <p className="text-zinc-600 text-sm font-mono">No results for &quot;{q}&quot;</p>
            ) : (
              <div className="space-y-2">
                {searchResults.map((r: SearchResult) => (
                  <div key={r.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
                    <div>
                      <a href={`/posts/${r.slug}`} className="text-sm font-medium text-white hover:text-violet-400 transition-colors">
                        {r.title}
                      </a>
                      <div className="text-xs text-zinc-600 font-mono mt-0.5">/{r.slug}</div>
                    </div>
                    <div className="text-xs font-mono text-cyan-400">
                      rank: {Number(r.rank).toFixed(4)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SQL injection safety explainer */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
            <div className="text-xs font-mono font-bold text-red-400 mb-3">❌ SQL Injection Vulnerable</div>
            <pre className="font-mono text-xs text-zinc-500 leading-relaxed whitespace-pre-wrap">{`// NEVER interpolate user input directly
const query = req.params.q;

await prisma.$queryRaw\`
  SELECT * FROM posts
  WHERE title = '\${query}'
\`
// Attacker sends: ' OR 1=1; DROP TABLE posts; --
// Your data is gone.`}</pre>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <div className="text-xs font-mono font-bold text-emerald-400 mb-3">✅ Parameterised (Safe)</div>
            <pre className="font-mono text-xs text-zinc-500 leading-relaxed whitespace-pre-wrap">{`// Prisma.sql: variables become $1, $2 params
const query = req.params.q;

await prisma.$queryRaw\`
  SELECT * FROM posts
  WHERE plainto_tsquery('english', \${query})
\`
// Postgres receives: $1 = "attacker input"
// The query structure is fixed. Injection impossible.`}</pre>
          </div>
        </div>
      </div>

    </div>
  );
}