import { assign, setup } from "xstate";
import type { ServerToClientJson } from "@shvm/vani-client/shared";
import type { ServerMessage } from "@shvm/vani-client/shared";
import type { ServerContext, ServerEvent } from "./types";
import { sttActor, llmActor } from "./actors";
import { SYSTEM_PROMPT } from "./constants";

export const serverMachine = setup({
    types: {
        context: {} as ServerContext,
        events: {} as ServerEvent,
        input: {} as {
            env: any;
            storage: any;
            broadcast: (msg: ServerToClientJson) => void;
            sendBinary: (data: ArrayBuffer) => void;
            initialMessages: ServerMessage[];
        }
    },
    actors: {
        sttActor,
        llmActor
    },
    actions: {
        broadcastState: ({ context }) => {
            context.broadcast({ type: "state", value: context.status });
        },
        appendAudio: assign({
            audioBuffer: ({ context, event }) => {
                if (event.type !== 'AUDIO_CHUNK') return context.audioBuffer;
                return [...context.audioBuffer, new Uint8Array(event.data)];
            }
        }),
        clearAudio: assign({
            audioBuffer: []
        }),
        updateConfig: assign({
            config: ({ context, event }) => {
                if (event.type === 'START' && event.config) {
                    return { ...context.config, ...event.config };
                }
                return context.config;
            }
        }),
        sendFeedbackBusy: ({ context }) => {
            context.broadcast({ type: "feedback", message: "Hang on, I'm thinking..." });
        },
        addSystemMessage: assign({
            messages: ({ context }) => {
                if (context.messages.length > 0) return context.messages;
                const msg: ServerMessage = {
                    id: crypto.randomUUID(),
                    role: "system",
                    content: SYSTEM_PROMPT,
                    created_at: Date.now()
                };
                return [msg];
            }
        }),
        addUserMessage: assign({
            messages: ({ context, event }) => {
                const text = event.type === 'TEXT_MESSAGE' ? event.content : '';
                // Note: STT transcript is handled in thinking state logic
                if (!text) return context.messages;

                const msg: ServerMessage = {
                    id: crypto.randomUUID(),
                    role: "user",
                    content: text,
                    created_at: Date.now()
                };

                context.storage.sql.exec(
                    `INSERT INTO messages (id, role, content, created_at) VALUES (?, ?, ?, ?)`,
                    msg.id, msg.role, msg.content, msg.created_at
                );

                return [...context.messages, msg];
            }
        }),
        addAssistantMessage: assign({
            messages: ({ context, event }) => {
                if (event.type !== 'llm.complete') return context.messages;
                const text = event.output;
                if (!text) return context.messages;

                const msg: ServerMessage = {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: text,
                    created_at: Date.now()
                };

                context.storage.sql.exec(
                    `INSERT INTO messages (id, role, content, created_at) VALUES (?, ?, ?, ?)`,
                    msg.id, msg.role, msg.content, msg.created_at
                );

                context.broadcast({
                    type: "assistant.message",
                    message: { role: "assistant", content: text }
                });

                return [...context.messages, msg];
            }
        }),
        emitPartial: ({ context, event }) => {
            if (event.type === 'LLM_PARTIAL') {
                context.broadcast({ type: "assistant.partial", text: event.text });
            }
        },
        emitToolCallStart: ({ context, event }) => {
            if (event.type === 'TOOL_CALL_START') {
                context.broadcast({ type: "tool.call.start", toolName: event.toolName });
            }
        },
        emitToolCallEnd: ({ context, event }) => {
            if (event.type === 'TOOL_CALL_END') {
                context.broadcast({ type: "tool.call.end", toolName: event.toolName });
            }
        },
        emitAudio: ({ context, event }) => {
            if (event.type === 'TTS_AUDIO') {
                context.sendBinary(event.data);
            }
        },
        emitError: ({ context, event }) => {
            const errData = (event as any).error || (event as any).data;
            const reason = errData ? String(errData) : "An error occurred";

            console.error("Error", {
                context,
                event,
                reason
            });

            context.broadcast({ type: "error", reason });
        }
    }
}).createMachine({
    id: "server",
    initial: "idle",
    context: ({ input }) => ({
        status: "idle",
        messages: input.initialMessages || [],
        audioBuffer: [],
        env: input.env,
        storage: input.storage,
        broadcast: input.broadcast,
        sendBinary: input.sendBinary,
        config: {}
    }),
    states: {
        idle: {
            entry: [assign({ status: 'idle' }), 'broadcastState', 'addSystemMessage'],
            on: {
                START: { target: 'listening', actions: 'updateConfig' },
                TEXT_MESSAGE: {
                    target: 'speaking',
                    actions: ['addUserMessage']
                },
                RESET: { target: 'idle', actions: 'clearAudio' },
                AUDIO_CHUNK: { actions: 'clearAudio' } // Ignore or clear leaks
            }
        },
        listening: {
            // @ts-ignore
            entry: [assign({ status: 'listening' }), 'broadcastState', 'clearAudio'],
            on: {
                STOP: { target: 'thinking' },
                AUDIO_CHUNK: { actions: 'appendAudio' },
                TEXT_MESSAGE: {
                    target: 'speaking',
                    actions: 'addUserMessage'
                },
                RESET: { target: 'idle', actions: 'clearAudio' },
                START: { actions: 'updateConfig' } // Allow re-start or config update?
            }
        },
        thinking: {
            // @ts-ignore
            entry: [assign({ status: 'thinking' }), 'broadcastState'],
            invoke: {
                src: 'sttActor',
                input: ({ context }) => ({
                    audioBuffer: context.audioBuffer,
                    env: context.env,
                    model: context.config.sttModel
                }),
                onDone: [
                    {
                        guard: ({ event }) => !!event.output,
                        target: 'speaking',
                        actions: [
                            ({ context, event }) => {
                                context.broadcast({ type: "transcript.final", text: event.output });
                            },
                            assign({
                                messages: ({ context, event }) => {
                                    const msg: ServerMessage = {
                                        id: crypto.randomUUID(),
                                        role: 'user',
                                        content: event.output,
                                        created_at: Date.now()
                                    };
                                    // Side effect in assign is bad practice but kept for now as per original
                                    context.storage.sql.exec(
                                        `INSERT INTO messages (id, role, content, created_at) VALUES (?, ?, ?, ?)`,
                                        msg.id, msg.role, msg.content, msg.created_at
                                    );
                                    return [...context.messages, msg];
                                }
                            })
                        ]
                    },
                    {
                        target: 'listening',
                        actions: ({ context }) => { context.broadcast({ type: "error", reason: "No speech detected" }); }
                    }
                ],
                onError: {
                    target: 'listening',
                    actions: 'emitError'
                }
            },
            on: {
                RESET: { target: 'idle', actions: 'clearAudio' },
                AUDIO_CHUNK: { actions: 'sendFeedbackBusy' },
                START: { actions: 'sendFeedbackBusy' }
            }
        },
        speaking: {
            entry: [assign({ status: 'speaking' }), 'broadcastState'],
            invoke: {
                src: 'llmActor',
                input: ({ context }) => ({
                    messages: context.messages,
                    env: context.env,
                    config: context.config
                })
            },
            on: {
                LLM_PARTIAL: { actions: 'emitPartial' },
                TOOL_CALL_START: { actions: 'emitToolCallStart' },
                TOOL_CALL_END: { actions: 'emitToolCallEnd' },
                TTS_AUDIO: { actions: 'emitAudio' },
                "llm.complete": {
                    target: 'listening',
                    actions: 'addAssistantMessage'
                },
                "error.platform.llm": {
                    target: 'listening',
                    actions: 'emitError'
                },
                RESET: { target: 'idle', actions: 'clearAudio' },
                AUDIO_CHUNK: { actions: 'sendFeedbackBusy' },
                START: { actions: 'sendFeedbackBusy' }
            }
        },
        error: {
            entry: [assign({ status: 'error' }), 'broadcastState', 'emitError'],
            after: {
                2000: 'listening' // Increased error recovery time a bit to read message
            },
            on: {
                RESET: { target: 'idle', actions: 'clearAudio' }
            }
        }
    }
});
