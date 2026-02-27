import { z } from "zod";
import profile from "../../data/profile.json";
import experience from "../../data/experience.json";
import projectsData from "../../data/projects.json";
import { getAllPosts } from "../../lib/blog";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const chatSchema = z.object({
  messages: z.array(messageSchema).describe("Conversation history: alternating user and assistant messages"),
});

export type ChatArgs = z.infer<typeof chatSchema>;

function buildContext(): string {
  const lines: string[] = [];

  lines.push(`# Profile\n${profile.name} — ${profile.title}. ${profile.tagline}`);
  lines.push(`\n## Focus\n${profile.current_focus.map((f: string) => `- ${f}`).join("\n")}`);
  lines.push(`\n## Engineering\n${profile.engineering_style.philosophy}`);
  lines.push(`\n## Experience`);
  for (const exp of experience.experience.slice(0, 5)) {
    lines.push(`- **${exp.role}** at **${exp.company}** (${exp.period})`);
  }
  lines.push(`\n## Projects (summary)`);
  for (const p of projectsData.projects.slice(0, 10)) {
    lines.push(`- **${p.name}**: ${p.summary}`);
  }
  const posts = getAllPosts().slice(0, 15);
  if (posts.length > 0) {
    lines.push(`\n## Blog posts`);
    for (const p of posts) {
      lines.push(`- ${p.title} (/${p.slug})`);
    }
  }
  lines.push(`\n---\nAnswer in 1–3 short paragraphs. Use only the context above.`);
  return lines.join("\n");
}

const SYSTEM_PROMPT = buildContext();

export const chatDefinition = {
  name: "chat",
  description: "Chat with Shivam's context: profile, projects, experience, and blog. Send conversation history; get the next assistant reply.",
  schema: chatSchema,
  getSystemPrompt: () => SYSTEM_PROMPT,
};
