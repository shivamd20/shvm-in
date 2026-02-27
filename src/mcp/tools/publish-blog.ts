import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { publishBlogDefinition, publishBlogSchema } from "../definitions/publish-blog";

const BLOG_STORE_NAME = "blog-store";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function registerPublishBlogTool(
  server: McpServer,
  env: { BLOG_STORE?: { idFromName: (name: string) => unknown; get: (id: unknown) => { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> } } }
) {
  server.registerTool(
    publishBlogDefinition.name,
    { description: publishBlogDefinition.description, inputSchema: publishBlogSchema },
    async (args) => {
      if (!env?.BLOG_STORE) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Blog store not configured (BLOG_STORE binding missing)." }) }],
        };
      }

      const parsed = publishBlogSchema.safeParse(args);
      if (!parsed.success) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Invalid input", details: parsed.error.flatten() }) }],
        };
      }

      const { title, markdown, tags, published } = parsed.data;
      const date = parsed.data.date ?? todayISO();
      const slug = parsed.data.slug ?? undefined;
      const body = { title, markdown, tags, published, date, ...(slug ? { slug } : {}) };

      const id = env.BLOG_STORE.idFromName(BLOG_STORE_NAME);
      const stub = env.BLOG_STORE.get(id);
      const res = await stub.fetch(new Request("https://_/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }));

      const data = await res.json() as { slug?: string; version?: number; url?: string; error?: string };
      if (!res.ok) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: data.error ?? "Publish failed", status: res.status }) }],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: true, slug: data.slug, version: data.version, url: data.url ?? `/blogs/${data.slug}` }),
          },
        ],
      };
    }
  );
}
