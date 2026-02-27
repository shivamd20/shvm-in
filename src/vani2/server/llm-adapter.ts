/**
 * Vani 2 LLM adapter: Workers AI streaming chat (no tools).
 * Used by Vani2SessionDO when client sends transcript_final.
 */
import { chat } from "@tanstack/ai";
import { createWorkersAiChat } from "@cloudflare/tanstack-ai";

const DEFAULT_LLM_MODEL = "@cf/meta/llama-3.1-8b-instruct";

const VANI2_SYSTEM_PROMPT = `You are a helpful voice assistant. Reply in short, clear sentences. Be concise.`;

export interface LlmMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StreamLlmOptions {
  /** Workers AI binding (env.AI) */
  binding: unknown;
  /** Chat model ID. Default: @cf/meta/llama-3.1-8b-instruct */
  model?: string;
  systemPrompt?: string;
  messages: LlmMessage[];
}

/**
 * Stream LLM response tokens. Yields each text delta, then returns full response.
 * Throws on RUN_ERROR from the adapter.
 */
export async function* streamLlmResponse(
  options: StreamLlmOptions
): AsyncGenerator<string, string, void> {
  const { binding, model = DEFAULT_LLM_MODEL, systemPrompt = VANI2_SYSTEM_PROMPT, messages } = options;
  const historyMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const adapter = createWorkersAiChat(model as any, { binding: binding as any });
  const stream = chat({
    adapter,
    systemPrompts: [systemPrompt],
    messages: historyMessages as any,
  });

  let fullResponse = "";
  for await (const chunkRaw of stream) {
    const chunk = chunkRaw as { type: string; delta?: string; error?: { message?: string } };
    if (chunk.type === "TEXT_MESSAGE_CONTENT" && chunk.delta) {
      fullResponse += chunk.delta;
      yield chunk.delta;
    }
    if (chunk.type === "RUN_ERROR") {
      const msg = chunk.error?.message ?? "LLM error";
      throw new Error(msg);
    }
  }
  return fullResponse;
}
