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

export const getPostBySlugFromStore = createServerFn({ method: "POST" })
  .inputValidator((slug: string) => slug)
  .handler(async (ctx) => {
    const slug = ctx.data;
    // #region agent log
    fetch('http://127.0.0.1:7291/ingest/e6cf2584-6d8a-4079-a59c-682c51786aee',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b621a'},body:JSON.stringify({sessionId:'8b621a',location:'server-fns.ts:getPostBySlugFromStore',message:'entry',data:{slug},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    if (!slug?.trim()) return null;
    const store = (env as Env).BLOG_STORE;
    let doResOk = false;
    let doHasPost = false;
    let doPublished = false;
    if (store) {
      try {
        const id = store.idFromName(BLOG_STORE_NAME);
        const stub = store.get(id);
        const reqUrl = `https://_/posts/${encodeURIComponent(slug.trim())}`;
        const res = await stub.fetch(new Request(reqUrl));
        const data = (await res.json()) as BlogPost | { error?: string };
        doResOk = res.ok;
        if (res.ok && data && !("error" in data)) {
          const post = data as BlogPost;
          doHasPost = !!post?.meta;
          doPublished = !!post?.meta?.published;
          if (post.meta?.published) return post;
        }
      } catch (e) {
        // #region agent log
        fetch('http://127.0.0.1:7291/ingest/e6cf2584-6d8a-4079-a59c-682c51786aee',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b621a'},body:JSON.stringify({sessionId:'8b621a',location:'server-fns.ts:DO catch',message:'DO path threw',data:{err:String(e)},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
      }
    }
    // #region agent log
    fetch('http://127.0.0.1:7291/ingest/e6cf2584-6d8a-4079-a59c-682c51786aee',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b621a'},body:JSON.stringify({sessionId:'8b621a',location:'server-fns.ts:after DO',message:'after DO block',data:{hasStore:!!store,doResOk,doHasPost,doPublished},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    const request = (ctx as { request?: Request }).request;
    const hasRequest = !!request?.url;
    // #region agent log
    fetch('http://127.0.0.1:7291/ingest/e6cf2584-6d8a-4079-a59c-682c51786aee',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b621a'},body:JSON.stringify({sessionId:'8b621a',location:'server-fns.ts:fetch fallback',message:'before fetch',data:{hasRequest,requestUrl:request?.url?.slice(0,80)},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    if (request?.url) {
      try {
        const apiUrl = new URL(`/api/blog/posts/${encodeURIComponent(slug.trim())}`, request.url);
        const res = await fetch(apiUrl);
        const fetchOk = res.ok;
        let fetchPost = null;
        if (res.ok) {
          const post = (await res.json()) as BlogPost;
          fetchPost = post?.meta?.published ? post : null;
        }
        // #region agent log
        fetch('http://127.0.0.1:7291/ingest/e6cf2584-6d8a-4079-a59c-682c51786aee',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b621a'},body:JSON.stringify({sessionId:'8b621a',location:'server-fns.ts:after fetch',message:'after fetch fallback',data:{fetchOk,hasPost:!!fetchPost},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        if (fetchPost) return fetchPost;
      } catch (e) {
        // #region agent log
        fetch('http://127.0.0.1:7291/ingest/e6cf2584-6d8a-4079-a59c-682c51786aee',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b621a'},body:JSON.stringify({sessionId:'8b621a',location:'server-fns.ts:fetch catch',message:'fetch threw',data:{err:String(e)},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
      }
    }
    const staticPost = await getPostBySlug(slug);
    const staticHas = !!staticPost?.meta?.published;
    // #region agent log
    fetch('http://127.0.0.1:7291/ingest/e6cf2584-6d8a-4079-a59c-682c51786aee',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b621a'},body:JSON.stringify({sessionId:'8b621a',location:'server-fns.ts:static',message:'after static',data:{staticHas,staticSlug:staticPost?.meta?.slug},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    const final = staticPost?.meta?.published ? staticPost : null;
    // #region agent log
    fetch('http://127.0.0.1:7291/ingest/e6cf2584-6d8a-4079-a59c-682c51786aee',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8b621a'},body:JSON.stringify({sessionId:'8b621a',location:'server-fns.ts:return',message:'final return',data:{returningSlug:final?.meta?.slug,returningNull:!final},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    return final;
  });
