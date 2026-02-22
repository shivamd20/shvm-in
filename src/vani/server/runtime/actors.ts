import { fromCallback, fromPromise } from "xstate";
import { runSTT, runTTS, withTimeout } from "./utils";
import type { ServerMessage, VoiceConfig } from "@shvm/vani-client/shared";
import type { ServerEvent } from "./types";

import { STREAM_TIMEOUT_MS, LLM_START_TIMEOUT_MS } from "./constants";
import { runAgentWithMCP } from "../../../lib/chat";
import { createMCPConsumer } from "../../../lib/mcp-client";
import { toHttpStream } from "@tanstack/ai";
import { getSystemPrompt } from "../../../lib/system-prompt";

export const sttActor = fromPromise<string, { audioBuffer: Uint8Array[]; env: any; model?: string }>(
    async ({ input }) => {
        return await runSTT(input.audioBuffer, input.env, input.model);
    }
);

export const llmActor = fromCallback<ServerEvent, { messages: ServerMessage[]; env: any; config: VoiceConfig }>(
    ({ input, sendBack }) => {
        const { messages, env, config } = input;

        (async () => {
            try {
                // Determine MCP if provided
                let mcp = null;
                if (config.mcpServer) {
                    mcp = await createMCPConsumer({ servers: [config.mcpServer] });
                }

                const systemPrompt = getSystemPrompt("voice");
                const aiMessages = [{ role: 'system', content: systemPrompt }, ...messages.map(m => ({ role: m.role, content: m.content }))];

                // Map config LLM Model but currently getChatAdapter in lib/chat uses hardcoded gpt-oss.
                // runAgentWithMCP uses what's in lib/chat.

                const responseStreamRaw = await withTimeout(
                    runAgentWithMCP(env as any, aiMessages, mcp),
                    LLM_START_TIMEOUT_MS,
                    "LLM start timed out"
                );

                const responseStream = toHttpStream(responseStreamRaw);
                const reader = responseStream.getReader();
                const decoder = new TextDecoder();

                let buffer = "";
                let sentenceBuffer = "";
                let fullResponse = "";
                const streamStart = Date.now();

                while (true) {
                    if (Date.now() - streamStart > STREAM_TIMEOUT_MS) throw new Error("LLM Streaming timed out");

                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;

                        try {
                            const chunk = JSON.parse(trimmed);

                            if (chunk.type === 'TEXT_MESSAGE_CONTENT' && chunk.delta) {
                                fullResponse += chunk.delta;
                                sentenceBuffer += chunk.delta;
                                sendBack({ type: "LLM_PARTIAL", text: chunk.delta });

                                if (sentenceBuffer.match(/[.!?](\s+|\n)/)) {
                                    const audio = await runTTS(sentenceBuffer, env, config.tts);
                                    if (audio) sendBack({ type: "TTS_AUDIO", data: audio });
                                    sentenceBuffer = "";
                                }
                            }

                            if (chunk.type === 'TOOL_CALL_START') {
                                sendBack({ type: "TOOL_CALL_START", toolName: chunk.toolName });
                            }

                            if (chunk.type === 'TOOL_CALL_END') {
                                sendBack({ type: "TOOL_CALL_END", toolName: chunk.toolName });
                            }

                        } catch (e) {
                            // Non-parseable is fine
                        }
                    }
                }

                if (sentenceBuffer.trim()) {
                    const audio = await runTTS(sentenceBuffer, env, config.tts);
                    if (audio) sendBack({ type: "TTS_AUDIO", data: audio });
                }

                sendBack({ type: "llm.complete", output: fullResponse });

            } catch (e) {
                console.error("LLM Error", e);
                sendBack({ type: "error.platform.llm", data: e });
            }
        })();

        return () => {
        };
    }
);
