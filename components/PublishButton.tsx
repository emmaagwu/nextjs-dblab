"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishPostAction } from "@/actions/posts";
import { useState } from "react";

export function PublishButton({ postId, authorId }: { postId: string; authorId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handlePublish() {
    setError(null);
    startTransition(async () => {
      const result = await publishPostAction(postId, authorId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handlePublish}
        disabled={isPending}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
      >
        {isPending && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
        {isPending ? "Publishing…" : "Publish Post"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}