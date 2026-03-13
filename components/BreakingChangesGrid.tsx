// Server Component — static content, no interactivity needed

const CHANGES = [
  {
    icon: "🦀",
    label: "REMOVED",
    labelColor: "text-red-400 bg-red-500/10 border-red-500/20",
    title: "Rust Query Engine Gone",
    before: 'provider = "prisma-client-js"',
    after: 'provider = "prisma-client"',
    detail: "Pure TypeScript Query Compiler replaces the Rust binary. 90% smaller bundle, 3× faster queries. No binary to ship or worry about platform compatibility.",
    border: "border-orange-500/15",
    bg: "bg-orange-500/[0.03]",
  },
  {
    icon: "📦",
    label: "REQUIRED",
    labelColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    title: "output Path Now Required",
    before: "Generated into node_modules (auto)",
    after: 'output = "../app/generated/prisma"',
    detail: "The generated client lives in YOUR source tree, not node_modules. File watchers, TypeScript, and build tools see changes immediately.",
    border: "border-amber-500/15",
    bg: "bg-amber-500/[0.03]",
  },
  {
    icon: "🔌",
    label: "REQUIRED",
    labelColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    title: "Driver Adapter Required",
    before: "new PrismaClient()",
    after: "new PrismaClient({ adapter })",
    detail: "You MUST pass a driver adapter. For Postgres: @prisma/adapter-pg. For Neon serverless: @prisma/adapter-neon. Without it you get PrismaClientConstructorValidationError.",
    border: "border-violet-500/15",
    bg: "bg-violet-500/[0.03]",
  },
  {
    icon: "📄",
    label: "MOVED",
    labelColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    title: "DB URL Moved to prisma.config.ts",
    before: "url = env('DATABASE_URL') in schema.prisma",
    after: "datasource.url in prisma.config.ts",
    detail: "If you put url in both places you get Error P1012. The schema file now only declares the provider type. All connection config lives in prisma.config.ts.",
    border: "border-blue-500/15",
    bg: "bg-blue-500/[0.03]",
  },
  {
    icon: "🔧",
    label: "REMOVED",
    labelColor: "text-red-400 bg-red-500/10 border-red-500/20",
    title: "$use() Middleware Removed",
    before: "prisma.$use(async (params, next) => { })",
    after: "prisma.$extends({ query: { … } })",
    detail: "Client Extensions ($extends) replace $use. They're type-safe, composable, and support result transforms (computed fields) that $use never could.",
    border: "border-emerald-500/15",
    bg: "bg-emerald-500/[0.03]",
  },
  {
    icon: "📥",
    label: "CHANGED",
    labelColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    title: "Import Path Changed",
    before: "import { PrismaClient } from '@prisma/client'",
    after: "import { PrismaClient } from '@/app/generated/prisma/client'",
    detail: "Import from /client specifically — not from the directory root or /index. The client file is where PrismaClient class is exported in v7.",
    border: "border-cyan-500/15",
    bg: "bg-cyan-500/[0.03]",
  },
  {
    icon: "🌱",
    label: "REMOVED",
    labelColor: "text-red-400 bg-red-500/10 border-red-500/20",
    title: "Auto-Seeding Removed",
    before: "prisma migrate dev → auto-seeds",
    after: "npx prisma db seed (explicit)",
    detail: "prisma migrate dev and migrate reset no longer auto-seed. Also --skip-generate flag removed (generate no longer auto-runs after migrate).",
    border: "border-pink-500/15",
    bg: "bg-pink-500/[0.03]",
  },
  {
    icon: "📦",
    label: "REQUIRED",
    labelColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    title: 'package.json "type": "module"',
    before: '{ "type": "commonjs" } (default)',
    after: '{ "type": "module" }',
    detail: 'Prisma 7 ships as ESM. Your project needs "type": "module" in package.json AND tsconfig module: "ESNext" + moduleResolution: "bundler".',
    border: "border-zinc-500/15",
    bg: "bg-zinc-500/[0.02]",
  },
  {
    icon: "⚠️",
    label: "REVERTED",
    labelColor: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    title: "Mapped Enums @map Was Reverted",
    before: "Announced: Role.USER = 'user' (mapped)",
    after: "Actual: Role.USER = 'USER' (unchanged from v6)",
    detail: "The changelog announced @map on enum members. This was REVERTED before v7 stable. TypeScript enum values are still schema names (uppercase). @map only affects DB storage.",
    border: "border-zinc-500/15",
    bg: "bg-zinc-500/[0.02]",
  },
];

export function BreakingChangesGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {CHANGES.map((c) => (
        <div key={c.title} className={`${c.bg} border ${c.border} rounded-xl p-5`}>
          <div className="flex items-center gap-2.5 mb-3">
            <span className="text-lg">{c.icon}</span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${c.labelColor}`}>
              {c.label}
            </span>
          </div>
          <h3 className="font-semibold text-white text-sm mb-3">{c.title}</h3>
          <div className="space-y-1.5 mb-3 font-mono text-xs">
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5 shrink-0">−</span>
              <span className="text-red-400/70 line-through break-all">{c.before}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5 shrink-0">+</span>
              <span className="text-emerald-400 break-all">{c.after}</span>
            </div>
          </div>
          <p className="text-xs text-zinc-600 leading-relaxed">{c.detail}</p>
        </div>
      ))}
    </div>
  );
}