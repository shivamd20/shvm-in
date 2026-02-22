import { fromCallback, fromPromise } from "xstate";
import { runSTT, runTTS } from "./utils";
import type { ServerMessage, VoiceConfig } from "@shvm/vani-client/shared";
import type { ServerEvent } from "./types";

import { VOICE_SYSTEM_PROMPT } from "../../../lib/voice-system-prompt";
import { chat, toolDefinition } from "@tanstack/ai";
import { createWorkersAiChat } from "@cloudflare/tanstack-ai";

// ────────────────────────────────────────────────────────────────────────────
// STT Actor
// ────────────────────────────────────────────────────────────────────────────

export const sttActor = fromPromise<string, { audioBuffer: Uint8Array[]; env: any; model?: string }>(
    async ({ input }) => {
        console.log(`[STT] Starting transcription. Audio chunks: ${input.audioBuffer.length}`);
        const result = await runSTT(input.audioBuffer, input.env, input.model);
        console.log(`[STT] Transcription complete: "${result}"`);
        return result;
    }
);

// ────────────────────────────────────────────────────────────────────────────
// LLM Actor
//
// THE AG-UI CHUNK TYPES emitted by @cloudflare/tanstack-ai WorkersAiTextAdapter:
//   RUN_STARTED          – stream began
//   TEXT_MESSAGE_START   – text portion of response is starting
//   TEXT_MESSAGE_CONTENT – delta/content text chunk  (NOT "text-delta"!)
//   TEXT_MESSAGE_END     – text portion finished
//   TOOL_CALL_START      – LLM decided to call a tool (toolName, toolCallId)
//   TOOL_CALL_ARGS       – streaming arguments delta for the current tool call
//   TOOL_CALL_END        – tool arguments finalised (input: parsed args object)
//   STEP_FINISHED        – reasoning/thinking step
//   RUN_FINISHED         – entire run done (finishReason: "stop" | "tool_calls")
//   RUN_ERROR            – error from the adapter
//
// The @tanstack/ai `chat()` TextEngine handles the agent agentic loop itself:
//   1. It calls adapter.chatStream() → gets chunks
//   2. When finishReason === "tool_calls", it calls executeToolCalls()
//   3. For server tools (.server(fn)), it calls the `execute` fn directly
//   4. It appends tool results to messages and loops back to the LLM
//
// OUR ROLE: register our server tools with `.server(execute)` so TanStack
// calls them in its own loop. Inside execute, forward the call over the WS
// to the browser client and await the result via a Promise.
// ────────────────────────────────────────────────────────────────────────────

export const llmActor = fromCallback<ServerEvent, { messages: ServerMessage[]; env: any; config: VoiceConfig }>(
    ({ input, sendBack, receive }) => {
        const { messages, env, config } = input;

        console.log(`[LLM] Actor started. Messages: ${messages.length}, Tools: ${config.tools?.length ?? 0}`);
        if (config.systemPrompt) {
            console.log(`[LLM] System prompt: ${config.systemPrompt.slice(0, 120)}...`);
        }
        if (config.tools && config.tools.length > 0) {
            console.log(`[LLM] Tools config:`, JSON.stringify(config.tools.map((t: any) => {
                const fn = t.type === "function" && t.function ? t.function : t;
                return { name: fn.name, description: fn.description?.slice(0, 60) };
            })));
        }

        // Map to hold pending promise resolvers for tool executions that are
        // proxied to the browser client over the WebSocket.
        const pendingTools = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

        // Receive TOOL_EXECUTE_RESPONSE / TOOL_EXECUTE_ERROR from the machine
        // (forwarded from the WebSocket client)
        receive((event: any) => {
            console.log(`[LLM] receive() event:`, event.type, event.callId ?? "");
            if (event.type === "TOOL_EXECUTE_RESPONSE") {
                const pending = pendingTools.get(event.callId);
                if (pending) {
                    console.log(`[LLM] Resolving tool promise callId=${event.callId}, result:`, JSON.stringify(event.result));
                    pending.resolve(event.result);
                    pendingTools.delete(event.callId);
                } else {
                    console.warn(`[LLM] TOOL_EXECUTE_RESPONSE for unknown callId=${event.callId}`);
                }
            } else if (event.type === "TOOL_EXECUTE_ERROR") {
                const pending = pendingTools.get(event.callId);
                if (pending) {
                    console.warn(`[LLM] Rejecting tool promise callId=${event.callId}, error:`, event.error);
                    pending.reject(new Error(event.error));
                    pendingTools.delete(event.callId);
                } else {
                    console.warn(`[LLM] TOOL_EXECUTE_ERROR for unknown callId=${event.callId}`);
                }
            }
        });

        (async () => {
            try {
                const systemPrompt = config.systemPrompt || VOICE_SYSTEM_PROMPT;

                // Build the messages array — system prompt first because the Workers AI
                // adapter uses the `systemPrompts` option on chatStream.
                // We pass messages WITHOUT a system role message here; system is passed separately.
                const historyMessages = messages
                    .filter(m => m.role !== "system")
                    .map(m => ({ role: m.role, content: m.content }));

                console.log(`[LLM] History messages (excl. system): ${historyMessages.length}`);
                console.log(`[LLM] Last user message: "${historyMessages.filter(m => m.role === "user").at(-1)?.content?.slice(0, 100)}"`);

                const adapter = createWorkersAiChat(
                    config.llmModel as any || "@cf/meta/llama-3.1-8b-instruct",
                    { binding: env.AI }
                );

                // ── Build Tool Definitions ──────────────────────────────────────
                // Tools arrive from the browser in OpenAI format:
                //   { type: "function", function: { name, description, parameters } }
                //
                // We normalise to TanStack toolDefinition, then attach a .server()
                // execute function that proxies the call back to the browser client.

                let activeTools: any[] | undefined = undefined;

                if (config.tools && config.tools.length > 0) {
                    activeTools = config.tools.map((t: any) => {
                        // Support both OpenAI-format { type, function: {...} } and flat { name, description, parameters }
                        const fn = (t.type === "function" && t.function) ? t.function : t;
                        console.log(`[LLM] Registering server-side proxy for tool: "${fn.name}"`);

                        return toolDefinition({
                            name: fn.name,
                            description: fn.description,
                            inputSchema: fn.parameters || {}
                        }).server(async (args: any) => {
                            const callId = crypto.randomUUID();
                            console.log(`[LLM] Tool "${fn.name}" called by LLM. callId=${callId}, args:`, JSON.stringify(args));

                            // Proxy the execution to the browser client via WebSocket.
                            // The client will run the actual JS, return a result, and
                            // we'll resolve this Promise via the receive() handler above.
                            return new Promise<any>((resolve, reject) => {
                                const TOOL_TIMEOUT_MS = 15_000;

                                const timer = setTimeout(() => {
                                    if (pendingTools.has(callId)) {
                                        pendingTools.delete(callId);
                                        console.error(`[LLM] Tool "${fn.name}" callId=${callId} timed out after ${TOOL_TIMEOUT_MS}ms`);
                                        reject(new Error(`Tool "${fn.name}" timed out waiting for client response`));
                                    }
                                }, TOOL_TIMEOUT_MS);

                                pendingTools.set(callId, {
                                    resolve: (val: any) => { clearTimeout(timer); resolve(val); },
                                    reject: (err: any) => { clearTimeout(timer); reject(err); }
                                });

                                // Tell the server machine to broadcast a tool.execute.request
                                // to the connected browser client over the WebSocket.
                                sendBack({
                                    type: "TOOL_EXECUTE_REQUEST" as any,
                                    toolName: fn.name,
                                    callId,
                                    parameters: args
                                });

                                console.log(`[LLM] tool.execute.request sent to client for "${fn.name}" callId=${callId}`);
                            });
                        });
                    });

                    console.log(`[LLM] ${activeTools.length} tool(s) registered:`, activeTools.map((t: any) => t.name).join(", "));
                } else {
                    console.log(`[LLM] No tools configured for this session.`);
                }

                // ── Run the agentic chat loop ───────────────────────────────────
                // The TanStack TextEngine handles the full agent loop internally:
                //   stream → detect tool_calls → execute execute() → append result → re-call LLM → ...
                // We only need to iterate the yielded AG-UI events.

                const stream = chat({
                    adapter,
                    // NOTE: system prompt goes in systemPrompts[], NOT in messages[]
                    // to avoid the Workers AI adapter double-sending it.
                    systemPrompts: [systemPrompt],
                    messages: historyMessages as any,
                    tools: activeTools
                });

                let sentenceBuffer = "";
                let fullResponse = "";

                console.log(`[LLM] Starting stream iteration...`);

                let chunkCount = 0;
                for await (const chunkRaw of stream) {
                    const chunk = chunkRaw as any;
                    chunkCount++;

                    // Log every chunk type for debugging (remove in production)
                    console.log(`[LLM] chunk[${chunkCount}] type=${chunk.type}`, chunk.type === "TEXT_MESSAGE_CONTENT" ? `delta="${chunk.delta}"` : "");

                    switch (chunk.type) {
                        // ── Text content ─────────────────────────────────────────
                        case "TEXT_MESSAGE_CONTENT": {
                            const delta: string = chunk.delta || "";
                            if (!delta) break;

                            fullResponse += delta;
                            sentenceBuffer += delta;
                            sendBack({ type: "LLM_PARTIAL", text: delta });

                            // Flush to TTS on sentence boundaries
                            if (sentenceBuffer.match(/[.!?](\s+|\n|$)/)) {
                                console.log(`[LLM] Flushing sentence to TTS: "${sentenceBuffer.trim()}"`);
                                const audio = await runTTS(sentenceBuffer, env, config.tts);
                                if (audio) {
                                    sendBack({ type: "TTS_AUDIO", data: audio });
                                    console.log(`[LLM] TTS audio sent (${audio.byteLength} bytes)`);
                                }
                                sentenceBuffer = "";
                            }
                            break;
                        }

                        // ── Tool events ──────────────────────────────────────────
                        case "TOOL_CALL_START": {
                            console.log(`[LLM] TOOL_CALL_START: toolName="${chunk.toolName}" toolCallId="${chunk.toolCallId}"`);
                            sendBack({ type: "TOOL_CALL_START", toolName: chunk.toolName });
                            break;
                        }

                        case "TOOL_CALL_ARGS": {
                            console.log(`[LLM] TOOL_CALL_ARGS: toolCallId="${chunk.toolCallId}" delta="${chunk.delta}"`);
                            break;
                        }

                        case "TOOL_CALL_END": {
                            console.log(`[LLM] TOOL_CALL_END: toolName="${chunk.toolName}" toolCallId="${chunk.toolCallId}" input=`, JSON.stringify(chunk.input));
                            sendBack({ type: "TOOL_CALL_END", toolName: chunk.toolName });
                            break;
                        }

                        // ── Run events ───────────────────────────────────────────
                        case "RUN_STARTED": {
                            console.log(`[LLM] RUN_STARTED runId="${chunk.runId}"`);
                            break;
                        }

                        case "RUN_FINISHED": {
                            console.log(`[LLM] RUN_FINISHED finishReason="${chunk.finishReason}"`);
                            break;
                        }

                        case "RUN_ERROR": {
                            const errMsg = chunk.error?.message || "Unknown LLM error";
                            console.error(`[LLM] RUN_ERROR:`, errMsg);
                            throw new Error(errMsg);
                        }

                        case "TEXT_MESSAGE_START":
                        case "TEXT_MESSAGE_END":
                        case "STEP_STARTED":
                        case "STEP_FINISHED":
                            // No special handling needed
                            break;

                        default:
                            console.log(`[LLM] Unhandled chunk type: ${chunk.type}`);
                    }
                }

                console.log(`[LLM] Stream complete. Total chunks: ${chunkCount}, fullResponse length: ${fullResponse.length}`);
                console.log(`[LLM] Full response: "${fullResponse.slice(0, 200)}${fullResponse.length > 200 ? "..." : ""}"`);

                // Flush any remaining text in the sentence buffer to TTS
                if (sentenceBuffer.trim()) {
                    console.log(`[LLM] Flushing remaining buffer to TTS: "${sentenceBuffer.trim()}"`);
                    const audio = await runTTS(sentenceBuffer, env, config.tts);
                    if (audio) {
                        sendBack({ type: "TTS_AUDIO", data: audio });
                        console.log(`[LLM] Final TTS audio sent (${audio.byteLength} bytes)`);
                    }
                }

                sendBack({ type: "llm.complete", output: fullResponse });
                console.log(`[LLM] llm.complete sent.`);

            } catch (e) {
                console.error("[LLM] Fatal error in llmActor:", e);
                sendBack({ type: "error.platform.llm", data: e });
            }
        })();

        // Cleanup — nothing to dispose since the async IIFE manages its own lifecycle
        return () => {
            console.log(`[LLM] Actor disposed.`);
        };
    }
);
