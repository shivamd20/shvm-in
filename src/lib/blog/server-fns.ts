import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import type { BlogPost, BlogPostMeta } from "@/lib/blog/types";
import { getPostBySlug, getAllPosts } from "@/lib/blog";

const BLOG_STORE_NAME = "blog-store";

async function getPostsFromStore(): Promise<BlogPostMeta[]> {
  const store = (env as Env).BLOG_STORE;
  if (!store) return [];
  const id = store.idFromName(BLOG_STORE_NAME);
  const stub = store.get(id);
  const res = await stub.fetch(new Request("https://_/posts?published=true&limit=100&offset=0"));
  const data = (await res.json()) as { posts?: BlogPostMeta[] };
  return data.posts ?? [];
}

export const getBlogPosts = createServerFn()
  .inputValidator((opts?: { publishedOnly?: boolean; limit?: number; offset?: number }) => opts ?? {})
  .handler(async (ctx) => {
    const opts = ctx.data;
    const fromStore = await getPostsFromStore();
    const fromStatic = getAllPosts();
    const bySlug = new Map<string, BlogPostMeta>();
    for (const p of fromStatic) bySlug.set(p.slug, p);
    for (const p of fromStore) bySlug.set(p.slug, p);
    const merged = Array.from(bySlug.values()).sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : a.slug.localeCompare(b.slug)));
    const limit = Math.min(opts?.limit ?? 50, 100);
    const offset = Math.max(0, opts?.offset ?? 0);
    const publishedOnly = opts?.publishedOnly !== false;
    const filtered = publishedOnly ? merged.filter((p) => p.published) : merged;
    const posts = filtered.slice(offset, offset + limit);
    return { posts };
  });

export const getPostBySlugFromStore = createServerFn()
  .inputValidator((slug: string) => slug)
  .handler(async (ctx) => {
    const slug = ctx.data;
    if (!slug?.trim()) return null;
    const store = (env as Env).BLOG_STORE;
    if (store) {
      try {
        const id = store.idFromName(BLOG_STORE_NAME);
        const stub = store.get(id);
        const reqUrl = `https://_/posts/${encodeURIComponent(slug.trim())}`;
        const res = await stub.fetch(new Request(reqUrl));
        const data = (await res.json()) as BlogPost | { error?: string };
        if (res.ok && data && !("error" in data)) {
          const post = data as BlogPost;
          if (post.meta?.published) return post;
        }
      } catch {
        /* fall through to static */
      }
    }
    const staticPost = await getPostBySlug(slug);
    return staticPost?.meta?.published ? staticPost : null;
  });
