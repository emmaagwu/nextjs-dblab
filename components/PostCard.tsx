// components/PostCard.tsx
import Link from "next/link";

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
  viewCount: number;
  author: { name: string };
  _count: { comments: number };
  tags: { tag: { name: string; slug: string } }[];
};

export function PostCard({ post }: { post: Post }) {
  return (
    <Link
      href={`/posts/${post.slug}`}
      className="group block bg-zinc-900 hover:bg-zinc-800/70 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 transition-all duration-150"
    >
      <div className="flex flex-wrap gap-1.5 mb-3">
        {post.tags.map(({ tag }) => (
          <span key={tag.slug} className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-600 border border-zinc-700">
            #{tag.name}
          </span>
        ))}
      </div>
      <h2 className="text-lg font-semibold text-white group-hover:text-violet-300 transition-colors mb-2 leading-snug">
        {post.title}
      </h2>
      {post.excerpt && (
        <p className="text-sm text-zinc-500 leading-relaxed mb-4 line-clamp-2">{post.excerpt}</p>
      )}
      <div className="flex items-center gap-4 text-xs text-zinc-700">
        <span className="text-zinc-500">{post.author.name}</span>
        {post.publishedAt && (
          <span>{new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        )}
        <span>{post.viewCount.toLocaleString()} views</span>
        <span>{post._count.comments} comments</span>
      </div>
    </Link>
  );
}