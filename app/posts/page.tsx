/**
 * app/posts/page.tsx
 *
 * DEMONSTRATES:
 *   - Next.js 15: searchParams is async (must be awaited)
 *   - Promise.all for parallel queries (posts + tags simultaneously)
 *   - getPublishedPosts() with tag filter and cursor pagination
 *   - select projection: only fetch what the list card needs
 *   - Cursor vs offset pagination (with visual explanation)
 */

import Link from "next/link";
import { getPublishedPosts, getAllTags } from "@/lib/queries";
import { PostCard } from "@/components/PostCard";

type Props = {
  searchParams: Promise<{ tag?: string; cursor?: string }>;
};

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
  viewCount: number;
  author: { id: string; name: string; email: string };
  _count: { comments: number };
  tags: { tag: { name: string; slug: string } }[];
};

type Tag = {
  id: string;
  name: string;
  slug: string;
  _count: { posts: number };
};

export default async function PostsPage({ searchParams }: Props) {
  const { tag, cursor } = await searchParams;

  const [posts, allTags] = await Promise.all([
    getPublishedPosts({ tag, cursor, limit: 6 }),
    getAllTags(),
  ]);

  const lastPost = posts.at(-1);
  const hasNextPage = posts.length === 6;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1.5">Posts</h1>
          <p className="text-zinc-500 text-sm font-mono">
            {tag
              ? <>filtered by <span className="text-violet-400">#{tag}</span> · <Link href="/posts" className="text-zinc-600 hover:text-zinc-400">clear</Link></>
              : "all published posts"
            }
          </p>
        </div>
        <Link
          href="/posts/create"
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <span className="text-base leading-none">+</span> New Post
        </Link>
      </div>

      {/* Active query panel */}
      <div className="mb-6 bg-zinc-900/60 border border-zinc-800 rounded-lg px-4 py-3 font-mono text-xs overflow-x-auto">
        <span className="text-zinc-600">// </span>
        <span className="text-blue-400">prisma.post.findMany</span>
        <span className="text-zinc-400">{"({ where: { status: "}</span>
        <span className="text-amber-300">&apos;PUBLISHED&apos;</span>
        <span className="text-zinc-400">, deletedAt: </span>
        <span className="text-amber-300">null</span>
        {tag && <><span className="text-zinc-400">{", tags: { some: { tag: { slug: "}</span><span className="text-amber-300">&apos;{tag}&apos;</span><span className="text-zinc-400">{" } } }"}</span></>}
        <span className="text-zinc-400">{" }, "}</span>
        {cursor && <><span className="text-zinc-400">{"cursor: { id: "}</span><span className="text-amber-300">&apos;{cursor.slice(0, 8)}…&apos;</span><span className="text-zinc-400">{" }, skip: 1, "}</span></>}
        <span className="text-zinc-400">take: <span className="text-amber-300">6</span>{", orderBy: { publishedAt: "}<span className="text-amber-300">&apos;desc&apos;</span>{", select: { … } })"}</span>
        <span className="text-zinc-600"> → {posts.length} rows</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* Post list */}
        <div className="lg:col-span-3 space-y-4">
          {posts.length === 0 ? (
            <div className="text-center py-20 text-zinc-600">
              <div className="text-5xl mb-4">○</div>
              <p className="font-medium text-zinc-500">No posts found</p>
              {tag && (
                <Link href="/posts" className="text-violet-400 text-sm mt-2 block">
                  Clear filter →
                </Link>
              )}
            </div>
          ) : (
            posts.map((post: Post) => <PostCard key={post.id} post={post} />)
          )}

          {/* Cursor pagination */}
          {(hasNextPage || cursor) && (
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              {cursor ? (
                <Link
                  href={tag ? `/posts?tag=${tag}` : "/posts"}
                  className="text-sm text-zinc-500 hover:text-white transition-colors"
                >
                  ← First page
                </Link>
              ) : <div />}
              {hasNextPage && lastPost && (
                <Link
                  href={`/posts?${tag ? `tag=${tag}&` : ""}cursor=${(lastPost as Post).id}`}
                  className="text-sm px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded-lg transition-colors"
                >
                  Next page →
                </Link>
              )}
            </div>
          )}

          {/* Pagination explainer */}
          <div className="mt-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs font-mono font-semibold text-zinc-400 mb-3 uppercase tracking-widest">
              Cursor vs Offset Pagination
            </p>
            <div className="grid grid-cols-2 gap-4 text-xs text-zinc-500 leading-relaxed">
              <div>
                <div className="text-red-400 font-semibold mb-2">❌ Offset (skip/take)</div>
                <code className="block text-zinc-600 mb-2">skip: page * 10, take: 10</code>
                <ul className="space-y-1">
                  <li>• Postgres scans all skipped rows</li>
                  <li>• Slow on large datasets (O(offset))</li>
                  <li>• New rows cause skips/duplicates</li>
                  <li>• Can jump to any page number</li>
                </ul>
              </div>
              <div>
                <div className="text-emerald-400 font-semibold mb-2">✅ Cursor (this page)</div>
                <code className="block text-zinc-600 mb-2">{"cursor: { id }, skip: 1"}</code>
                <ul className="space-y-1">
                  <li>• Index seek — O(1) regardless of size</li>
                  <li>• Consistent under concurrent writes</li>
                  <li>• No duplicates or missing rows</li>
                  <li>• Forward-only (ideal for feeds)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Tag filter sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-3">
              Tags
            </p>
            <nav className="space-y-0.5">
              <Link
                href="/posts"
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  !tag
                    ? "bg-violet-600/20 text-violet-300"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <span>All</span>
                <span className="text-xs text-zinc-700">{posts.length}</span>
              </Link>
              {(allTags as Tag[]).map((t: Tag) => (
                <Link
                  key={t.id}
                  href={`/posts?tag=${t.slug}`}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    tag === t.slug
                      ? "bg-violet-600/20 text-violet-300"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  <span>#{t.name}</span>
                  <span className="text-xs text-zinc-700">{t._count.posts}</span>
                </Link>
              ))}
            </nav>

            <div className="mt-4 pt-4 border-t border-zinc-800 font-mono text-xs text-zinc-700 space-y-1">
              <div className="text-zinc-600 font-semibold">Prisma filter:</div>
              <div>{"tags: { some: {"}</div>
              <div className="pl-3">{"tag: { slug: tag }"}</div>
              <div>{"} }"}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}