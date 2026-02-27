import { z } from "zod";

export const publishBlogSchema = z.object({
  title: z.string().min(1).describe("Post title"),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional().describe("URL slug (optional; derived from title if omitted)"),
  markdown: z.string().min(1).describe("Markdown body of the post"),
  tags: z.array(z.string()).optional().default([]).describe("Tags (e.g. system-design, meta)"),
  published: z.boolean().optional().default(true).describe("Publish immediately (true) or save as draft (false)"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Publication date YYYY-MM-DD (default: today)"),
});

export type PublishBlogArgs = z.infer<typeof publishBlogSchema>;

export const publishBlogDefinition = {
  name: "shvm_publish_post",
  description:
    "Publish a new blog post to shvm.in. Each call creates a new version (insert only). Returns the post URL on success. Use when the user wants to publish or save a draft post.",
  schema: publishBlogSchema,
};
