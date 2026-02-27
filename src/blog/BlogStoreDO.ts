import { DurableObject } from "cloudflare:workers";
import type { BlogPost, BlogPostMeta, BlogTocItem } from "@/lib/blog/types";
import { renderMarkdown } from "./markdown";

const BLOG_STORE_NAME = "blog-store";

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export class BlogStoreDO extends DurableObject {
  private sql: DurableObjectStorage["sql"];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL,
        version INTEGER NOT NULL,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        tags TEXT NOT NULL,
        summary TEXT NOT NULL,
        reading_time INTEGER NOT NULL,
        published INTEGER NOT NULL,
        markdown TEXT NOT NULL,
        html TEXT NOT NULL,
        toc TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(slug, version)
      );
      CREATE INDEX IF NOT EXISTS idx_posts_slug_version ON posts(slug, version DESC);
      CREATE INDEX IF NOT EXISTS idx_posts_published_date ON posts(published, date DESC);
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/posts") {
      return this.listPosts(url);
    }
    const slugMatch = url.pathname.match(/^\/posts\/([^/]+)$/);
    if (request.method === "GET" && slugMatch) {
      return this.getPostBySlug(slugMatch[1]);
    }
    if (request.method === "POST" && url.pathname === "/posts") {
      return this.insertPost(request);
    }

    return jsonResponse({ error: "Not found" }, 404);
  }

  private listPosts(url: URL): Response {
    const publishedOnly = url.searchParams.get("published") !== "false";
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 100);
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
    const includeDrafts = publishedOnly ? 0 : 1;

    const cursor = this.sql.exec(
      `SELECT slug, title, date, tags, summary, reading_time, published
       FROM posts p
       WHERE p.version = (SELECT MAX(version) FROM posts WHERE slug = p.slug)
         AND (? = 1 OR published = 1)
       ORDER BY date DESC, slug ASC
       LIMIT ? OFFSET ?`,
      includeDrafts,
      limit,
      offset
    );

    const rows = cursor.toArray() as Array<{
      slug: string;
      title: string;
      date: string;
      tags: string;
      summary: string;
      reading_time: number;
      published: number;
    }>;

    const metas: BlogPostMeta[] = rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      date: r.date,
      tags: JSON.parse(r.tags) as string[],
      summary: r.summary,
      readingTime: r.reading_time,
      published: r.published === 1,
    }));

    return jsonResponse({ posts: metas });
  }

  private getPostBySlug(slug: string): Response {
    const cursor = this.sql.exec(
      `SELECT slug, version, title, date, tags, summary, reading_time, published, html, toc, created_at, updated_at
       FROM posts WHERE slug = ? ORDER BY version DESC LIMIT 1`,
      slug
    );
    const rows = cursor.toArray();
    const row = rows[0] as
      | {
          slug: string;
          version: number;
          title: string;
          date: string;
          tags: string;
          summary: string;
          reading_time: number;
          published: number;
          html: string;
          toc: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;
    if (!row) return jsonResponse({ error: "Post not found" }, 404);

    const meta: BlogPostMeta = {
      slug: row.slug,
      title: row.title,
      date: row.date,
      tags: JSON.parse(row.tags) as string[],
      summary: row.summary,
      readingTime: row.reading_time,
      published: row.published === 1,
    };
    const toc = JSON.parse(row.toc) as BlogTocItem[];
    const post: BlogPost = { meta, html: row.html, toc };
    return jsonResponse(post);
  }

  private async insertPost(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const slug = typeof (body as any).slug === "string" ? (body as any).slug.trim() : null;
    const title = typeof (body as any).title === "string" ? (body as any).title.trim() : null;
    const markdown = typeof (body as any).markdown === "string" ? (body as any).markdown : null;
    if (!title || !markdown) {
      return jsonResponse({ error: "Missing required fields: title, markdown" }, 400);
    }
    const slugFinal = slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : slugFromTitle(title);
    const dateRaw = (body as any).date;
    const date = typeof dateRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : todayISO();
    const tags = Array.isArray((body as any).tags) ? (body as any).tags.filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase().replace(/\s+/g, "-")) : [];
    const published = (body as any).published !== false;

    const { summary, readingTime, html, toc } = renderMarkdown(markdown);
    const now = new Date().toISOString();

    const nextVersionCursor = this.sql.exec(
      `SELECT COALESCE(MAX(version), 0) + 1 AS v FROM posts WHERE slug = ?`,
      slugFinal
    );
    const nextVersion = (nextVersionCursor.one() as { v: number }).v;

    this.sql.exec(
      `INSERT INTO posts (slug, version, title, date, tags, summary, reading_time, published, markdown, html, toc, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      slugFinal,
      nextVersion,
      title,
      date,
      JSON.stringify(tags),
      summary,
      readingTime,
      published ? 1 : 0,
      markdown,
      html,
      JSON.stringify(toc),
      now,
      now
    );

    return jsonResponse(
      { slug: slugFinal, version: nextVersion, url: `/blogs/${slugFinal}` },
      201
    );
  }
}

function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";
}

function jsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
