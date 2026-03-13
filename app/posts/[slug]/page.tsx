/**
 * app/posts/[slug]/page.tsx
 *
 * DEMONSTRATES:
 *   - generateStaticParams: pre-render known routes at build time
 *   - ISR: export const revalidate = 3600
 *   - findUnique on @unique field (slug)
 *   - Fire-and-forget atomic increment (viewCount)
 *   - Suspense boundary for streaming
 *   - notFound() for 404 handling
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getPostBySlug, getDemoUser, incrementViewCount } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { CommentSection } from "@/components/CommentSection";
import { PublishButton } from "@/components/PublishButton";

type Props = { params: Promise<{ slug: string }> };

// Pre-render all published posts at build time.
// When ISR revalidates (or revalidateTag fires), Next.js re-renders on demand.
export async function generateStaticParams() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED", deletedAt: null },
    select: { slug: true },
  });
  return posts.map((p: {slug: string}) => ({ slug: p.slug }));
}

// ISR: serve cached version, revalidate in background every hour.
// Surgical revalidation via revalidateTag() in Server Actions is faster —
// happens immediately when content changes, not waiting for the timer.
export const revalidate = 3600;

export default async function PostPage({ params }: Props) {
  const { slug } = await params;

  // findUnique: slug is @unique → one index lookup, TypeScript knows it's T | null
  const [post, demoUser] = await Promise.all([
    getPostBySlug(slug),
    getDemoUser(),
  ]);
  if (!post) notFound();

  // Fire-and-forget: increment view count WITHOUT blocking page render.
  // The user gets the page immediately. The DB write happens concurrently.
  //
  // Why not await? Because the user doesn't need to wait for the counter
  // to increment before seeing the page. It's a non-critical side effect.
  //
  // Why not use a Server Action? This runs during SSR, not on user interaction.
  // A Server Action would require a client-side call.
  //
  // The serverless function stays alive long enough to complete the write.
  incrementViewCount(post.id).catch((err) =>
    console.error("Failed to increment view count:", err)
  );

  const statusColors = {
    DRAFT:     "bg-amber-500/10 text-amber-400 border-amber-500/20",
    PUBLISHED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    ARCHIVED:  "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">

      <Link href="/posts" className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-300 mb-8 transition-colors">
        ← Posts
      </Link>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-md border uppercase tracking-widest ${statusColors[post.status as keyof typeof statusColors]}`}>
          {post.status}
        </span>
        {post.tags.map(({ tag }: { tag: { id: string; name: string; slug: string } }) => (
          <Link
            key={tag.id}
            href={`/posts?tag=${tag.slug}`}
            className="text-xs px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-white hover:border-zinc-600 transition-colors"
          >
            #{tag.name}
          </Link>
        ))}
      </div>

      <h1 className="text-4xl font-bold tracking-tight mb-4 leading-tight">{post.title}</h1>

      {post.excerpt && (
        <p className="text-xl text-zinc-400 leading-relaxed mb-6">{post.excerpt}</p>
      )}

      {/* Byline */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-zinc-600 mb-8 pb-8 border-b border-zinc-800">
        <span className="text-zinc-400">{post.author.name}</span>
        {post.publishedAt && (
          <span>{new Date(post.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
        )}
        <span>{post.viewCount.toLocaleString()} views</span>
        <span>{post.comments.length} comments</span>
        {/* Computed field from Prisma Extension — not in DB */}
        <span className="font-mono text-xs text-zinc-700">{post.readingTime}</span>
      </div>

      {/* Admin actions for drafts */}
      {post.status === "DRAFT" && (
        <div className="mb-8 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-400">This post is a draft</p>
            <p className="text-xs text-zinc-500 mt-0.5">Publishing will make it visible in the post list</p>
          </div>
          <PublishButton postId={post.id} authorId={post.author.id} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

        {/* Content */}
        <article className="lg:col-span-2 space-y-4">
          {post.content.split("\n\n").map((block: string, i: number) => {
            if (block.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold mt-8 mb-3">{block.slice(2)}</h1>;
            if (block.startsWith("## ")) return <h2 key={i} className="text-xl font-bold mt-6 mb-2 text-zinc-200">{block.slice(3)}</h2>;
            if (block.startsWith("```")) {
              const code = block.replace(/^```\w*\n?/, "").replace(/```$/, "");
              return (
                <pre key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 overflow-x-auto font-mono text-xs text-zinc-300 my-4 leading-relaxed">
                  <code>{code}</code>
                </pre>
              );
            }
            return <p key={i} className="text-zinc-300 leading-relaxed">{block}</p>;
          })}

          {/* Comments */}
          <div className="mt-12 pt-10 border-t border-zinc-800">
            <Suspense fallback={
              <div className="h-8 bg-zinc-800 rounded animate-pulse w-32" />
            }>
              <CommentSection
                postId={post.id}
                authorId={demoUser?.id ?? ""}
                authorName={demoUser?.name ?? "Guest"}
                initialComments={post.comments}
              />
            </Suspense>
          </div>
        </article>

        {/* Sidebar: patterns panel */}
        <aside className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">

            {/* Prisma patterns used on this page */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-4">Patterns on this page</p>
              <div className="space-y-4 text-xs font-mono">
                <div>
                  <div className="text-emerald-400 font-semibold mb-1">findUnique</div>
                  <div className="text-zinc-600">where: {"{ slug }"}</div>
                  <div className="text-zinc-500 font-sans leading-relaxed mt-1">
                    slug is @unique → Prisma uses index seek. Return type is Post | null.
                  </div>
                </div>
                <div className="pt-3 border-t border-zinc-800">
                  <div className="text-blue-400 font-semibold mb-1">increment</div>
                  <div className="text-zinc-600">{"{ viewCount: { increment: 1 } }"}</div>
                  <div className="text-zinc-500 font-sans leading-relaxed mt-1">
                    Atomic SQL: UPDATE SET count = count + 1. No race condition possible.
                    Called without await (fire-and-forget).
                  </div>
                </div>
                <div className="pt-3 border-t border-zinc-800">
                  <div className="text-violet-400 font-semibold mb-1">include</div>
                  <div className="text-zinc-600">author, comments, tags</div>
                  <div className="text-zinc-500 font-sans leading-relaxed mt-1">
                    Single query with JOINs. All relations loaded in one round-trip.
                  </div>
                </div>
                <div className="pt-3 border-t border-zinc-800">
                  <div className="text-cyan-400 font-semibold mb-1">Computed Field</div>
                  <div className="text-zinc-600">post.readingTime</div>
                  <div className="text-zinc-500 font-sans leading-relaxed mt-1">
                    Added by the result Extension in lib/prisma.ts. Runs in JS, not SQL.
                  </div>
                </div>
              </div>
            </div>

            {/* Author card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-3">Author</p>
              <div className="font-semibold text-white mb-0.5">{post.author.name}</div>
              <div className="text-xs text-zinc-600">{post.author.email}</div>
              {post.author.bio && (
                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{post.author.bio}</p>
              )}
            </div>

          </div>
        </aside>
      </div>
    </div>
  );
}