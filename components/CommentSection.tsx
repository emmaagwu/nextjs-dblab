"use client";

import { useState, useTransition, useOptimistic } from "react";
import { addComment } from "@/actions/posts";

type Comment = {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string };
};

export function CommentSection({ postId, authorId, authorName, initialComments }: {
  postId: string;
  authorId: string;
  authorName: string;
  initialComments: Comment[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // useOptimistic: instantly show new comments before server confirms
  // While the Server Action is in flight, optimisticComments includes the new one.
  // If the action fails, it rolls back to the real state.
  const [optimisticComments, addOptimistic] = useOptimistic(
    initialComments,
    (state, newComment: Comment) => [...state, newComment]
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = fd.get("body") as string;

    // Optimistically show the comment immediately (no waiting)
    addOptimistic({
      id: `optimistic-${Date.now()}`,
      body,
      createdAt: new Date(),
      author: { id: authorId, name: `${authorName} (posting…)` },
    });

    form.reset();

    startTransition(async () => {
      const result = await addComment(fd);
      if (!result.success) {
        setError(result.error);
      }
      // On success: revalidateTag in the action marks this post's comments
      // as stale. Next.js will re-render the Server Component tree in the
      // background, eventually replacing optimistic with real data.
    });
  }

  return (
    <div>
      <h3 className="text-lg font-bold mb-5">
        Comments{" "}
        <span className="text-zinc-600 font-normal text-base">({optimisticComments.length})</span>
      </h3>

      {optimisticComments.length === 0 ? (
        <p className="text-zinc-700 text-sm mb-6">No comments yet.</p>
      ) : (
        <div className="space-y-3 mb-6">
          {optimisticComments.map((c) => (
            <div
              key={c.id}
              className={`bg-zinc-900 border border-zinc-800 rounded-xl p-4 transition-opacity ${
                c.id.startsWith("optimistic-") ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-zinc-300">{c.author.name}</span>
                <span className="text-xs text-zinc-700">
                  {c.id.startsWith("optimistic-")
                    ? "posting…"
                    : new Date(c.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="hidden" name="postId" value={postId} />
        {/* In a real app: authorId comes from auth(). For this demo, use postId as placeholder. */}
        <input type="hidden" name="authorId" value={authorId} />

        <textarea
          name="body"
          required
          rows={3}
          placeholder="Add a comment…"
          className="w-full bg-zinc-900 border border-zinc-700 focus:border-violet-500/60 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition resize-none"
        />

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 border border-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isPending ? "Posting…" : "Post Comment"}
          </button>
          <span className="text-xs text-zinc-700 font-mono">
            → revalidateTag('comments-{postId.slice(0, 6)}…')
          </span>
        </div>
      </form>
    </div>
  );
}