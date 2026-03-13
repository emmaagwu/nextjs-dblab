import { redirect } from "next/navigation";
import { getAllTags, getDemoUser } from "@/lib/queries";
import { CreatePostForm } from "@/components/CreatePostForm";

export const metadata = { title: "Create Post" };

export default async function CreatePostPage() {
  const [tags, demoUser] = await Promise.all([
    getAllTags(),
    getDemoUser(),
  ]);

  if (!demoUser) redirect("/?error=no-user-found");

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono text-violet-400 uppercase tracking-widest mb-2">
          Server Action + Zod + Prisma
        </div>
        <h1 className="text-3xl font-bold mb-2">Create New Post</h1>
        <p className="text-zinc-400 leading-relaxed">
          Submitting this form calls a Server Action directly — no API route, no fetch().
          The action validates input with Zod, creates the post with a nested tag write,
          then revalidates the post list cache.
        </p>
      </div>

      {/* Flow explainer */}
      <div className="mb-8 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 font-mono text-xs">
        <div className="text-zinc-600 mb-2">{"// Submission flow:"}</div>
        <div className="space-y-0.5 text-zinc-400">
          <div><span className="text-blue-400">1.</span> Browser POSTs FormData to Server Action (no client-side fetch needed)</div>
          <div><span className="text-blue-400">2.</span> <span className="text-yellow-400">CreatePostSchema.safeParse(raw)</span> — validate title, content, tags</div>
          <div><span className="text-blue-400">3.</span> <span className="text-yellow-400">prisma.post.create({"{ data: { …, tags: { create: tagIds.map(…) } } }"})</span></div>
          <div><span className="text-blue-400">4.</span> <span className="text-yellow-400">revalidateTag('posts')</span> — marks post list cache as stale</div>
          <div><span className="text-blue-400">5.</span> <span className="text-yellow-400">redirect('/posts/[slug]')</span> — navigates to the new post</div>
        </div>
      </div>

      <div className="mb-4 text-xs text-zinc-600 font-mono">
        Demo user: <span className="text-zinc-400">{demoUser.name}</span>
        {" ("}role: <span className="text-violet-400">{demoUser.role}</span>{")"}
      </div>

      <CreatePostForm tags={tags} authorId={demoUser.id} />
    </div>
  );
}