"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/",            label: "Home",    note: "Architecture" },
  { href: "/posts",       label: "Posts",   note: "findMany" },
  { href: "/posts/create",label: "Create",  note: "Server Action" },
  { href: "/db",          label: "Explorer",note: "$queryRaw" },
];

export function NavBar() {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800/80">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-md bg-linear-to-br from-violet-500 to-blue-500 flex items-center justify-center">
            <span className="text-xs font-black text-white">DB</span>
          </div>
          <span className="font-bold text-sm text-white">DBLab</span>
          <span className="hidden sm:block text-xs font-mono text-zinc-700">/ Phase 4 / Prisma 7</span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {NAV.map((item) => {
            const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.note}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-violet-500/15 text-violet-300"
                    : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}