import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { streamLlmResponse } from "@/vani2/server/llm-adapter";
import { HUMANIZER_SYSTEM_PROMPT } from "@/blog/humanizer-prompt";

const BLOG_WRITING_SYSTEM_PROMPT = `You are helping the user write a blog post. They will ask for intros, sections, rewrites, or ideas. When they ask for content, reply with markdown-ready text only (no "Here's a draft:" or meta). When they ask for ideas or feedback, be brief. You have access to the current draft context (title, optional summary) to stay on topic.`;

async function runLlm(systemPrompt: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<string> {
  const ai = (env as Env).AI;
  if (!ai) return "";
  let out = "";
  for await (const delta of streamLlmResponse({
    binding: ai,
    systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  })) {
    out += delta;
  }
  return out;
}

export const blogChat = createServerFn()
  .inputValidator(
    (opts: {
      messages: { role: "user" | "assistant"; content: string }[];
      context?: { title?: string; draftSummary?: string };
    }) => opts
  )
  .handler(async (ctx) => {
    const { messages, context } = ctx.data;
    const contextLine =
      context?.title || context?.draftSummary
        ? `\nCurrent post title: ${context.title ?? "(none)"}. ${context.draftSummary ? `Draft summary: ${context.draftSummary.slice(0, 200)}...` : ""}`
        : "";
    const systemPrompt = BLOG_WRITING_SYSTEM_PROMPT + contextLine;
    return runLlm(systemPrompt, messages);
  });

export const humanizeDraft = createServerFn()
  .inputValidator((markdown: string) => markdown)
  .handler(async (ctx) => {
    const markdown = ctx.data;
    const messages = [{ role: "user" as const, content: `Rewrite this blog draft to sound more human. Keep the same structure and markdown.\n\n${markdown}` }];
    return runLlm(HUMANIZER_SYSTEM_PROMPT, messages);
  });
