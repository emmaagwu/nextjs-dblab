"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

export function SearchBox({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const path = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q") as string;
    startTransition(() => {
      router.push(q ? `${path}?q=${encodeURIComponent(q)}` : path);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 max-w-lg">
      <input
        name="q"
        type="text"
        defaultValue={defaultValue}
        placeholder="Search posts with Postgres FTS…"
        className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-violet-500/60 rounded-lg px-4 py-2.5 text-white placeholder:text-zinc-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition"
      />
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {isPending ? "…" : "Search"}
      </button>
    </form>
  );
}