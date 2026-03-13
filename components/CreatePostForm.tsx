"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPost } from "@/actions/posts";

type Tag = { id: string; name: string; slug: string };

export function CreatePostForm({ tags, authorId }: { tags: Tag[]; authorId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  function toggleTag(id: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setGlobalError(null);

    const fd = new FormData(e.currentTarget);
    fd.set("authorId", authorId);
    fd.delete("tagIds");
    selectedTags.forEach((id) => fd.append("tagIds", id));

    startTransition(async () => {
      const result = await createPost(fd);
      if (result.success) {
        router.push(`/posts/${result.data.slug}`);
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        setGlobalError(result.error);
      }
    });
  }

  const inputCls = (field: string) =>
    `w-full bg-zinc-900 border rounded-lg px-4 py-3 text-white placeholder:text-zinc-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition ${
      fieldErrors[field] ? "border-red-500/60" : "border-zinc-700 focus:border-violet-500/60"
    }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {globalError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">{globalError}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Title <span className="text-red-400">*</span>
        </label>
        <input name="title" type="text" required placeholder="Prisma 7 connection pooling on Neon" className={inputCls("title")} />
        {fieldErrors.title && <p className="mt-1 text-xs text-red-400">{fieldErrors.title[0]}</p>}
        <p className="mt-1 text-xs text-zinc-700">Min 5 chars. A URL slug will be generated automatically.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Excerpt <span className="text-zinc-600 font-normal">(optional)</span>
        </label>
        <input name="excerpt" type="text" placeholder="One sentence summary shown in the post list" className={inputCls("excerpt")} />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Content <span className="text-red-400">*</span>
          <span className="text-zinc-600 font-normal ml-2 text-xs">— # for h1, ## for h2, ``` for code blocks</span>
        </label>
        <textarea
          name="content"
          required
          rows={14}
          placeholder={"# My Post\n\nWrite your content here...\n\n## Section\n\n```typescript\nconst prisma = new PrismaClient({ adapter })\n```"}
          className={`${inputCls("content")} resize-y`}
        />
        {fieldErrors.content && <p className="mt-1 text-xs text-red-400">{fieldErrors.content[0]}</p>}
        <p className="mt-1 text-xs text-zinc-700">Min 50 characters</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Tags <span className="text-zinc-600 font-normal">(optional — multiple)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const on = selectedTags.has(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                  on
                    ? "bg-violet-600/25 border-violet-500/50 text-violet-300"
                    : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
                }`}
              >
                #{tag.name}
              </button>
            );
          })}
        </div>
        {selectedTags.size > 0 && (
          <p className="mt-2 text-xs text-zinc-600 font-mono">
            Prisma: tags: {"{ create: ["}{[...selectedTags].map(id => `{ tag: { connect: { id: "${id.slice(0,8)}…" } } }`).join(", ")}{"] }"}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          {isPending && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {isPending ? "Creating…" : "Create Post (Draft)"}
        </button>
        <p className="text-xs text-zinc-600">Saves as draft. Use the Publish button on the post page to make it live.</p>
      </div>
    </form>
  );
}