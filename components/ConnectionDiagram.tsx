// Server Component — visual diagram of the Neon + Prisma two-URL pattern

export function ConnectionDiagram() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
        <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
          Neon + Prisma 7 — Connection Architecture
        </p>
      </div>

      <div className="p-6 space-y-8">

        {/* Two URLs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Pooled URL */}
          <div className="bg-zinc-950 border border-blue-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-widest">DATABASE_URL — Pooled</span>
            </div>
            <div className="font-mono text-xs text-zinc-400 mb-3 break-all leading-relaxed">
              postgres://user:pass@ep-abc
              <span className="text-blue-400 font-bold">-pooler</span>
              .us-east-2.aws.neon.tech/db
            </div>
            <div className="space-y-2">
              {[
                ["Used by", "Next.js app at RUNTIME"],
                ["Configured in", "lib/prisma.ts → new Pool(...)"],
                ["Routes through", "PgBouncer (Neon's connection pooler)"],
                ["Why", "Serverless creates a new process per invocation. Without pooling, 200 concurrent requests = 200 new Postgres connections = connection limit hit."],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start gap-2 text-xs">
                  <span className="text-blue-400/60 shrink-0 mt-0.5">→</span>
                  <div>
                    <span className="text-zinc-600">{k}: </span>
                    <span className="text-zinc-400">{v}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Direct URL */}
          <div className="bg-zinc-950 border border-amber-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">DIRECT_URL — Direct</span>
            </div>
            <div className="font-mono text-xs text-zinc-400 mb-3 break-all leading-relaxed">
              postgres://user:pass@ep-abc.us-east-2.aws.neon.tech/db
            </div>
            <div className="space-y-2">
              {[
                ["Used by", "Prisma CLI ONLY (migrate, db push, studio)"],
                ["Configured in", "prisma.config.ts → datasource.url"],
                ["Routes through", "Direct TCP to Postgres (bypasses pooler)"],
                ["Why", "PgBouncer uses transaction mode pooling which blocks advisory locks. Prisma migrations need advisory locks. Migrations must use a direct connection."],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start gap-2 text-xs">
                  <span className="text-amber-400/60 shrink-0 mt-0.5">→</span>
                  <div>
                    <span className="text-zinc-600">{k}: </span>
                    <span className="text-zinc-400">{v}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* .env.local snippet */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs text-zinc-600 font-mono mb-3"># .env.local</p>
          <div className="font-mono text-xs space-y-1.5">
            <div className="text-zinc-600"># ← Pooled: -pooler in hostname. Used by lib/prisma.ts at runtime.</div>
            <div>
              <span className="text-emerald-400">DATABASE_URL</span>
              <span className="text-zinc-600">=</span>
              <span className="text-amber-300">"postgres://user:pass@ep-abc-pooler.us-east-2.aws.neon.tech/mydb?sslmode=require"</span>
            </div>
            <div className="pt-1 text-zinc-600"># ← Direct: no -pooler. Used by prisma.config.ts for CLI / migrations.</div>
            <div>
              <span className="text-emerald-400">DIRECT_URL</span>
              <span className="text-zinc-600">=</span>
              <span className="text-amber-300">"postgres://user:pass@ep-abc.us-east-2.aws.neon.tech/mydb?sslmode=require"</span>
            </div>
          </div>
        </div>

        {/* Architecture flow */}
        <div>
          <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-4">Request flow</p>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center text-xs font-mono text-center">
            {[
              { label: "Next.js App", sub: "Server Component\nor Route Handler", color: "bg-violet-500/10 border-violet-500/20 text-violet-300" },
              { label: "→ lib/prisma.ts\nPrismaPg adapter", sub: "new Pool({ DATABASE_URL })", color: "bg-zinc-800 border-zinc-700 text-zinc-400", arrow: false },
              { label: "PgBouncer", sub: "Neon connection pool\n(multiplexes many → few)", color: "bg-blue-500/10 border-blue-500/20 text-blue-300" },
              { label: "→ Postgres", sub: "Direct TCP (few real connections)", color: "bg-zinc-800 border-zinc-700 text-zinc-400", arrow: false },
              { label: "Neon DB", sub: "Your data", color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" },
            ].map((node, i) => (
              <div key={i} className={`border rounded-lg px-3 py-2.5 whitespace-pre-line leading-tight ${node.color}`}>
                <div className="font-semibold">{node.label}</div>
                <div className="text-[10px] opacity-70 mt-0.5">{node.sub}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-2 items-center text-xs font-mono text-center text-zinc-700">
            <div />
            <div>← DATABASE_URL</div>
            <div />
            <div />
            <div />
          </div>
          <div className="mt-6 border-t border-zinc-800 pt-4">
            <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-3">CLI (migrate) flow — bypasses pooler</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center text-xs font-mono text-center max-w-lg">
              {[
                { label: "prisma migrate dev", sub: "reads prisma.config.ts", color: "bg-amber-500/10 border-amber-500/20 text-amber-300" },
                { label: "DIRECT_URL", sub: "no -pooler in hostname", color: "bg-zinc-800 border-zinc-700 text-zinc-400" },
                { label: "Neon DB", sub: "direct TCP connection\n(advisory locks work)", color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" },
              ].map((n, i) => (
                <div key={i} className={`border rounded-lg px-3 py-2.5 whitespace-pre-line leading-tight ${n.color}`}>
                  <div className="font-semibold">{n.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{n.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}