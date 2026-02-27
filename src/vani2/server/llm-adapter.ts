/**
 * Vani 2 LLM adapter: Workers AI streaming chat (no tools).
 * Supports retry with backoff (idea 6).
 */
import { chat } from "@tanstack/ai";
import { createWorkersAiChat } from "@cloudflare/tanstack-ai";

const DEFAULT_LLM_MODEL = "@cf/meta/llama-3.1-8b-instruct";

const VANI2_SYSTEM_PROMPT = `You are a helpful voice assistant. Reply in short, clear sentences. Be concise. Start with a brief acknowledgment or one short phrase when appropriate. If the previous assistant message was interrupted by the user, respond naturally (e.g. acknowledge and continue or pivot to the new question).`;

const LLM_RETRY_MAX = 3;
const LLM_RETRY_BASE_MS = 500;
const LLM_RETRY_MAX_MS = 5000;

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

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Stream LLM response tokens with retry (idea 6). Yields each text delta.
 * Throws on RUN_ERROR or after retries exhausted.
 */
export async function* streamLlmResponse(
  options: StreamLlmOptions
): AsyncGenerator<string, string, void> {
  const {
    binding,
    model: modelOpt,
    systemPrompt = VANI2_SYSTEM_PROMPT,
    messages,
  } = options;
  const model = modelOpt ?? DEFAULT_LLM_MODEL;
  const historyMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < LLM_RETRY_MAX; attempt++) {
    try {
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
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < LLM_RETRY_MAX - 1) {
        const backoff = Math.min(LLM_RETRY_BASE_MS * Math.pow(2, attempt), LLM_RETRY_MAX_MS);
        await delay(backoff);
      } else {
        throw lastError;
      }
    }
  }
  throw lastError ?? new Error("LLM error");
}
