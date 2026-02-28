/**
 * Vani 2 LLM adapter: Workers AI or Gemini (configurable via env).
 * Supports retry with backoff (idea 6). No LLM first-token timeout.
 */
import { chat } from "@tanstack/ai";
import { createWorkersAiChat } from "@cloudflare/tanstack-ai";
import { createGeminiChat } from "@tanstack/ai-gemini";

const DEFAULT_WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";
/** Same flash model as Liva (gemini-2.0-flash). */
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

const VANI2_SYSTEM_PROMPT = `You are a helpful voice assistant. Reply in short, clear sentences. Be concise. Start with a brief acknowledgment or one short phrase when appropriate. If the previous assistant message was interrupted by the user, respond naturally (e.g. acknowledge and continue or pivot to the new question).`;

const LLM_RETRY_MAX = 3;
const LLM_RETRY_BASE_MS = 500;
const LLM_RETRY_MAX_MS = 5000;

export interface LlmMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Env shape for configurable LLM: Workers AI (binding) or Gemini (api key). */
export interface VaniLlmEnv {
  AI?: unknown;
  GEMINI_API_KEY?: string | { get(): Promise<string> };
  LLM_PROVIDER?: "workers-ai" | "gemini";
}

export interface StreamLlmOptions {
  /** Workers AI binding (env.AI). Used when env is not provided or provider is workers-ai. */
  binding?: unknown;
  /** Full env for provider selection. When set, LLM_PROVIDER or GEMINI_API_KEY choose Gemini vs Workers AI. */
  env?: VaniLlmEnv;
  /** Chat model ID. Workers AI default: @cf/meta/llama-3.1-8b-instruct; Gemini: gemini-2.0-flash */
  model?: string;
  systemPrompt?: string;
  messages: LlmMessage[];
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function resolveGeminiApiKey(
  key: string | { get(): Promise<string> } | undefined
): Promise<string> {
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  if (typeof key === "string") return key;
  return key.get();
}

function useGemini(env: VaniLlmEnv | undefined): boolean {
  if (!env) return false;
  if (env.LLM_PROVIDER === "gemini") return true;
  if (env.LLM_PROVIDER === "workers-ai") return false;
  return !!env.GEMINI_API_KEY;
}

/**
 * Stream LLM response tokens with retry (idea 6). Yields each text delta.
 * Throws on RUN_ERROR or after retries exhausted.
 * No first-token timeout: we wait for the stream.
 */
export async function* streamLlmResponse(
  options: StreamLlmOptions
): AsyncGenerator<string, string, void> {
  const {
    binding: bindingOpt,
    env,
    model: modelOpt,
    systemPrompt = VANI2_SYSTEM_PROMPT,
    messages,
  } = options;

  const historyMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const gemini = useGemini(env);
  const binding = bindingOpt ?? env?.AI;
  const model = modelOpt ?? (gemini ? DEFAULT_GEMINI_MODEL : DEFAULT_WORKERS_AI_MODEL);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < LLM_RETRY_MAX; attempt++) {
    try {
      if (gemini) {
        const apiKey = await resolveGeminiApiKey(env!.GEMINI_API_KEY);
        const adapter = createGeminiChat(
          model as "gemini-2.0-flash",
          apiKey
        );
        const stream = adapter.chatStream({
          model,
          messages: historyMessages as any,
          systemPrompts: [systemPrompt],
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

      if (!binding) {
        throw new Error("AI binding or GEMINI_API_KEY is required");
      }
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
