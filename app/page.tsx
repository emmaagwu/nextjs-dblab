/**
 * app/page.tsx — DBLab Home
 *
 * Server Component — runs on the server at request time.
 * Queries the DB directly using prisma. No API route needed.
 * This is the most basic Prisma pattern: call in an RSC.
 */

import Link from "next/link";
import { getDashboardStats } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { BreakingChangesGrid } from "@/components/BreakingChangesGrid";
import { ConnectionDiagram } from "@/components/ConnectionDiagram";

export const dynamic = "force-dynamic"; // always fresh stats

export default async function HomePage() {
  // Check DB connectivity
  let dbOnline = false;
  let stats = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOnline = true;
    stats = await getDashboardStats();
  } catch {
    // DB not yet connected — show setup instructions
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-16">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20 tracking-widest uppercase">
            Phase 4
          </span>
          <span className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-md border tracking-widest uppercase ${
            dbOnline
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
          }`}>
            {dbOnline ? "● Postgres Connected" : "○ DB Not Connected"}
          </span>
        </div>

        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Databases on Vercel
        </h1>
        <p className="text-zinc-400 text-xl max-w-2xl leading-relaxed">
          Prisma 7 + Neon (serverless Postgres) + Next.js 15.
          Every pattern from schema design through transactions and deployment.
        </p>

        {!dbOnline && (
          <div className="mt-6 bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 max-w-2xl">
            <p className="text-sm font-semibold text-amber-400 mb-3">Setup required before the lab runs:</p>
            <div className="space-y-1.5 font-mono text-xs text-zinc-400">
              <div><span className="text-zinc-600"># 1. Create a Neon project at neon.tech, then:</span></div>
              <div className="text-emerald-400">DATABASE_URL="postgres://...@ep-xxx-pooler.region.aws.neon.tech/mydb?sslmode=require"</div>
              <div className="text-emerald-400">DIRECT_URL="postgres://...@ep-xxx.region.aws.neon.tech/mydb?sslmode=require"</div>
              <div className="mt-2 text-zinc-600"># 2. Run:</div>
              <div className="text-blue-400">npm run db:generate   <span className="text-zinc-600"># generates the Prisma client</span></div>
              <div className="text-blue-400">npm run db:migrate    <span className="text-zinc-600"># creates tables</span></div>
              <div className="text-blue-400">npm run db:seed       <span className="text-zinc-600"># seeds data</span></div>
            </div>
          </div>
        )}
      </section>

      {/* ── Live Stats ────────────────────────────────────────── */}
      {dbOnline && stats && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest">
              Live DB stats — queried via getDashboardStats() in this Server Component
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Total Posts",   value: stats.totalPosts,                color: "text-white" },
              { label: "Published",     value: stats.publishedPosts,            color: "text-emerald-400" },
              { label: "Drafts",        value: stats.draftPosts,                color: "text-amber-400" },
              { label: "Users",         value: stats.totalUsers,                color: "text-blue-400" },
              { label: "Comments",      value: stats.totalComments,             color: "text-violet-400" },
              { label: "Total Views",   value: stats.totalViews.toLocaleString(), color: "text-cyan-400" },
              { label: "Avg Views",     value: stats.avgViews,                  color: "text-pink-400" },
            ].map((s) => (
              <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold font-mono mb-1 ${s.color}`}>{s.value}</div>
                <div className="text-xs text-zinc-600 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-3 font-mono text-xs text-zinc-600">
            <span className="text-zinc-500">getDashboardStats()</span>
            {" → "}
            <span className="text-blue-400">Promise.all([count(), count(), count(), count(), aggregate()])</span>
            {" → 5 queries in parallel"}
          </div>
        </section>
      )}

      {/* ── Navigation cards ──────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-widest mb-4">Explore the Lab</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              href: "/posts",
              icon: "◈",
              label: "Post List",
              color: "text-violet-400",
              badge: "findMany",
              desc: "Filtering, cursor pagination, select projection, relation counts",
            },
            {
              href: "/posts/create",
              icon: "⊕",
              label: "Create Post",
              color: "text-emerald-400",
              badge: "Server Action",
              desc: "Zod validation, nested creates, many-to-many, cache revalidation",
            },
            {
              href: "/db",
              icon: "⊞",
              label: "DB Explorer",
              color: "text-cyan-400",
              badge: "$queryRaw",
              desc: "Live indexes, EXPLAIN plans, table sizes, FTS search demo",
            },
          ].map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 rounded-xl p-6 transition-all duration-150"
            >
              <div className="flex items-center justify-between mb-4">
                <span className={`text-2xl ${card.color}`}>{card.icon}</span>
                <span className="text-xs font-mono text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                  {card.badge}
                </span>
              </div>
              <div className="font-semibold text-white mb-1.5 group-hover:text-violet-300 transition-colors">
                {card.label}
              </div>
              <div className="text-xs text-zinc-500 leading-relaxed">{card.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Breaking Changes Grid ─────────────────────────────── */}
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Prisma 7 — Breaking Changes</h2>
          <p className="text-zinc-400 max-w-2xl leading-relaxed">
            Every change you need to understand before writing a query. These are not
            preferences — they are hard requirements that will break your build if missed.
          </p>
        </div>
        <BreakingChangesGrid />
      </section>

      {/* ── Connection Architecture ───────────────────────────── */}
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">The Two-URL Architecture</h2>
          <p className="text-zinc-400 max-w-2xl leading-relaxed">
            Neon gives you two connection strings. Understanding which to use where —
            and why — is the foundation of everything else in this phase.
          </p>
        </div>
        <ConnectionDiagram />
      </section>

    </div>
  );
}