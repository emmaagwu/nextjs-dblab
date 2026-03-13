/**
 * actions/posts.ts
 * ─────────────────────────────────────────────────────────────────────────
 * SERVER ACTIONS — Data mutations
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Server Actions are async functions that run on the server and can be
 * called directly from Client Components via normal JS function calls.
 * No API route needed. No fetch() needed. Just call the function.
 *
 * Next.js compiles Server Actions into POST endpoints automatically.
 * The client-side call becomes a fetch() to that endpoint under the hood.
 *
 * ── SECURITY: ALWAYS VALIDATE ON THE SERVER ──────────────────────────────
 *
 * Server Actions are POST endpoints. An attacker can call them directly
 * from curl/Postman, bypassing any client-side validation entirely.
 *
 * NEVER trust: form data, params, anything from the request
 * ALWAYS validate with Zod before touching the database
 *
 * ── ERROR HANDLING PATTERN ───────────────────────────────────────────────
 *
 * We never throw errors from Server Actions. Throwing causes Next.js to
 * show a generic error UI and potentially expose stack traces.
 *
 * Instead, we return a typed discriminated union:
 *   | { success: true; data: T }
 *   | { success: false; error: string; fieldErrors?: ... }
 *
 * The client checks result.success and handles both cases gracefully.
 *
 * ── CACHE INVALIDATION ───────────────────────────────────────────────────
 *
 * After mutations, we revalidate affected cache entries.
 * Always use revalidateTag with 'max' profile (stale-while-revalidate).
 * See Phase 2 notes on why 'max' is preferred over the deprecated 1-arg form.
 * ─────────────────────────────────────────────────────────────────────────
 */

"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, PostStatus } from "@/lib/prisma";
import { publishPost } from "@/lib/queries";

// ── SHARED RESULT TYPE ────────────────────────────────────────────────────
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// ── ZOD SCHEMAS ───────────────────────────────────────────────────────────
// Define once. Used for both client-side hints and server-side enforcement.
// The server ALWAYS re-validates regardless of what the client did.

const CreatePostSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title must be under 200 characters"),
  excerpt: z
    .string()
    .max(500, "Excerpt must be under 500 characters")
    .optional()
    .or(z.literal("")),
  content: z
    .string()
    .min(50, "Content must be at least 50 characters"),
  authorId: z
    .string()
    .cuid("Invalid author ID"),
  tagIds: z
    .array(z.string().cuid())
    .optional()
    .default([]),
});

const UpdatePostSchema = z.object({
  id: z.string().cuid("Invalid post ID"),
  title: z.string().min(5).max(200).optional(),
  excerpt: z.string().max(500).optional().or(z.literal("")),
  content: z.string().min(50).optional(),
  tagIds: z.array(z.string().cuid()).optional(),
});

const CommentSchema = z.object({
  postId: z.string().cuid(),
  authorId: z.string().cuid(),
  body: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(1000, "Comment must be under 1000 characters"),
});

// ─────────────────────────────────────────────────────────────────────────
// CREATE POST
// ─────────────────────────────────────────────────────────────────────────

export async function createPost(
  formData: FormData
): Promise<ActionResult<{ slug: string }>> {
  // ── 1. Parse raw form data ─────────────────────────────────────────
  // FormData values are always strings or File objects.
  // getAll() collects multiple values with the same name (multi-select).
  const raw = {
    title: formData.get("title"),
    excerpt: formData.get("excerpt") || undefined,
    content: formData.get("content"),
    authorId: formData.get("authorId"),
    tagIds: formData.getAll("tagIds").filter(Boolean).map(String),
  };

  // ── 2. Validate ────────────────────────────────────────────────────
  const parsed = CreatePostSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed. Check the fields below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { title, excerpt, content, authorId, tagIds } = parsed.data;

  // ── 3. Generate unique slug ────────────────────────────────────────
  // Slug = URL-safe version of the title.
  // Handle collisions: if "my-post" exists, try "my-post-2", "my-post-3", etc.
  const baseSlug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")     // remove non-word chars (except spaces/dashes)
    .replace(/\s+/g, "-")          // replace spaces with dashes
    .replace(/-+/g, "-")           // collapse multiple dashes
    .replace(/^-|-$/g, "");        // strip leading/trailing dashes

  // Find all existing slugs that start with this base
  const existingSlugs = await prisma.post.findMany({
    where: { slug: { startsWith: baseSlug } },
    select: { slug: true },
  });

  let slug = baseSlug;
  if (existingSlugs.some((p: { slug: string }) => p.slug === baseSlug)) {
    slug = `${baseSlug}-${existingSlugs.length + 1}`;
  }

  // ── 4. Create post with nested tag assignments ─────────────────────
  try {
    const post = await prisma.post.create({
      data: {
        title,
        slug,
        excerpt: excerpt || null,
        content,
        status: PostStatus.DRAFT,
        authorId,
        // Nested create: inserts into tags_on_posts join table in same query.
        // This is more efficient than creating the post then inserting tags
        // separately — it's a single round-trip to the database.
        tags: tagIds.length > 0
          ? {
              create: tagIds.map((tagId) => ({
                tag: { connect: { id: tagId } },
              })),
            }
          : undefined,
      },
      select: { slug: true },
    });

    // ── 5. Revalidate cache ────────────────────────────────────────
    // New post created → post list is stale
    revalidateTag("posts", 'max');
    revalidatePath("/posts");

    return { success: true, data: { slug: post.slug } };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return { success: false, error: "A post with this slug already exists. Try a different title." };
    }
    console.error("[createPost]", error);
    return { success: false, error: "Failed to create post. Please try again." };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// UPDATE POST
// ─────────────────────────────────────────────────────────────────────────

export async function updatePost(
  formData: FormData
): Promise<ActionResult<{ slug: string }>> {
  const raw = {
    id: formData.get("id"),
    title: formData.get("title") || undefined,
    excerpt: formData.get("excerpt") || undefined,
    content: formData.get("content") || undefined,
    tagIds: formData.getAll("tagIds").filter(Boolean).map(String),
  };

  const parsed = UpdatePostSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { id, tagIds, ...fields } = parsed.data;

  try {
    const post = await prisma.post.update({
      where: { id, deletedAt: null },
      data: {
        ...fields,
        // ── TAG REPLACE PATTERN ────────────────────────────────────
        // For M:M relations, updating tags means replacing them all.
        // Delete all existing tag associations, then create new ones.
        //
        // Alternative (compute diff): find added/removed tags separately
        // and issue targeted create/delete. More complex, same result.
        // The replace pattern is simpler and correct for most cases.
        ...(tagIds !== undefined && {
          tags: {
            deleteMany: {},
            create: tagIds.map((tagId) => ({
              tag: { connect: { id: tagId } },
            })),
          },
        }),
      },
      select: { slug: true, id: true },
    });

    // Surgical revalidation — only this post's cache, not all posts
    revalidateTag(`post-${post.id}`, 'max');
    revalidatePath(`/posts/${post.slug}`);

    return { success: true, data: { slug: post.slug } };
  } catch (error) {
    console.error("[updatePost]", error);
    return { success: false, error: "Failed to update post." };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLISH POST
// ─────────────────────────────────────────────────────────────────────────

export async function publishPostAction(
  postId: string,
  authorId: string
): Promise<ActionResult<{ slug: string }>> {
  try {
    // publishPost uses $transaction internally (see lib/queries.ts)
    const post = await publishPost(postId, authorId);

    revalidateTag("posts", 'max');
    revalidateTag(`post-${postId}`, 'max');
    revalidatePath("/posts");
    revalidatePath(`/posts/${post.slug}`);

    return { success: true, data: { slug: post.slug } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to publish";
    return { success: false, error: message };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// DELETE POST (soft delete via Extension)
// ─────────────────────────────────────────────────────────────────────────

export async function deletePost(
  postId: string,
  requestingUserId: string
): Promise<ActionResult> {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
      select: { authorId: true, slug: true },
    });

    if (!post) return { success: false, error: "Post not found" };
    if (post.authorId !== requestingUserId) {
      return { success: false, error: "You can only delete your own posts" };
    }

    // This calls the soft-delete Extension defined in lib/prisma.ts.
    // Prisma intercepts post.delete() and converts it to:
    //   UPDATE posts SET deleted_at = NOW() WHERE id = ?
    // The row is NOT physically removed from the database.
    await prisma.post.delete({ where: { id: postId } });

    revalidateTag("posts", 'max');
    revalidatePath("/posts");

    return { success: true, data: undefined };
  } catch (error) {
    console.error("[deletePost]", error);
    return { success: false, error: "Failed to delete post." };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ADD COMMENT
// ─────────────────────────────────────────────────────────────────────────

export async function addComment(
  formData: FormData
): Promise<ActionResult<{ id: string; body: string }>> {
  const parsed = CommentSchema.safeParse({
    postId: formData.get("postId"),
    authorId: formData.get("authorId"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const comment = await prisma.comment.create({
      data: parsed.data,
      select: { id: true, body: true },
    });

    // Surgical revalidation — only comments for this specific post.
    // The post content cache is completely unaffected.
    // This is the key principle: invalidate the MINIMUM required scope.
    revalidateTag(`comments-${parsed.data.postId}`, 'max');

    return { success: true, data: comment };
  } catch (error) {
    console.error("[addComment]", error);
    return { success: false, error: "Failed to add comment." };
  }
}