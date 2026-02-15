import { setup, assign, fromPromise, fromCallback } from "xstate";

// --- Types ---

// --- Types ---

// Keep in sync with client/machine.tsx
export const STT_MODELS = [
    "@cf/openai/whisper",
    "@cf/openai/whisper-tiny-en"
] as const;

export const LLM_MODELS = [
    "@cf/meta/llama-3.1-8b-instruct",
    "@cf/meta/llama-3-8b-instruct",
    "@cf/meta/llama-2-7b-chat-int8",
    "@cf/mistral/mistral-7b-instruct-v0.1"
] as const;

export const TTS_MODELS = [
    "@cf/deepgram/aura-2-en",
    "@cf/deepgram/aura-1"
] as const;

// Voice options per model
export const TTS_MODEL_VOICES = {
    "@cf/deepgram/aura-2-en": [
        "asteria",
        "luna",
        "arcas",
        "athena",
        "helios",
        "orpheus",
        "perseus",
        "angus"
    ],
    "@cf/deepgram/aura-1": [
        "asteria",
        "luna",
        "stella",
        "athena",
        "hera",
        "orion",
        "arcas",
        "perseus",
        "angus",
        "orpheus",
        "helios",
        "zeus"
    ]
} as const;

// Helper type to get voices for a specific model
export type VoicesForModel<T extends typeof TTS_MODELS[number]> = typeof TTS_MODEL_VOICES[T][number];

// All possible voices across all models
export type TTS_VOICE = VoicesForModel<typeof TTS_MODELS[number]>;

export interface VoiceConfig {
    sttModel?: typeof STT_MODELS[number];
    llmModel?: typeof LLM_MODELS[number];
    tts?: {
        speaker?: TTS_VOICE;
        encoding?: "mp3" | "opus" | "aac" | "lossless";
        container?: "mp3" | "ogg" | "aac" | "wav";
        sample_rate?: 16000 | 24000 | 44100 | 48000;
        bit_rate?: number;
        model?: typeof TTS_MODELS[number];
    };
}
export interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    created_at: number;
}

export type SessionStatus = "idle" | "listening" | "thinking" | "speaking" | "error";

export interface ServerContext {
    status: SessionStatus;
    messages: Message[];
    audioBuffer: Uint8Array[];
    env: any; // Cloudflare Env
    storage: any; // Durable Object Storage
    broadcast: (msg: any) => void;
    sendBinary: (data: ArrayBuffer) => void;
    config: VoiceConfig;
}

export type ServerEvent =
    | { type: "START"; config?: VoiceConfig }
    | { type: "STOP" }
    | { type: "AUDIO_CHUNK"; data: ArrayBuffer }
    | { type: "TEXT_MESSAGE"; content: string }
    | { type: "TRANSCRIPT_READY"; text: string }
    | { type: "LLM_PARTIAL"; text: string }
    | { type: "TTS_AUDIO"; data: ArrayBuffer }
    | { type: "llm.complete"; output: string }
    | { type: "error.platform.stt"; data: unknown }
    | { type: "error.platform.llm"; data: unknown }
    | { type: "RESET" };

// --- Logic Helpers ---

const SYSTEM_PROMPT = "You are a helpful, concise voice assistant. Respond in short, conversational sentences. NEVER MORE THAN 2 sentence.";

const withTimeout = <T>(promise: Promise<T>, ms: number, errorMessage = "Operation timed out"): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(errorMessage)), ms);
        promise.then(
            (val) => { clearTimeout(timer); resolve(val); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
};

async function runSTT(audioBuffer: Uint8Array[], env: any, model?: string): Promise<string> {
    if (audioBuffer.length === 0) return "";

    const totalLength = audioBuffer.reduce((acc, chunk) => acc + chunk.length, 0);
    console.log(`[STT] Processing audio buffer of length: ${totalLength}`);

    if (totalLength === 0) return "";

    const fullAudio = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioBuffer) {
        fullAudio.set(chunk, offset);
        offset += chunk.length;
    }

    try {
        const Model = model || "@cf/openai/whisper";
        console.log(`[STT] Invoking env.AI.run(${Model})`);

        // @ts-ignore
        const response = await withTimeout(
            env.AI.run(Model, { audio: [...fullAudio] }),
            15000,
            "STT timed out"
        );
        console.log(`[STT] Response received:`, JSON.stringify(response));

        // @ts-ignore
        const text = response.text || "";
        return text.trim();
    } catch (e: any) {
        console.error("[STT] Error during AI run:", e);
        throw e; // Re-throw to be caught by actor
    }
}

async function runTTS(text: string, env: any, config?: VoiceConfig['tts']): Promise<ArrayBuffer | null> {
    try {
        // Default to a specific model that is known to work
        const MODEL = config?.model || '@cf/deepgram/aura-2-en';

        // Options construction
        const options: any = {
            text: text // Default for standard models
        };

        // Deepgram specific handling
        if (MODEL.includes('deepgram') || MODEL.includes('aura')) {
            // Deepgram aura models use 'text' property? Or prompt?
            // Cloudflare AI docs say inputs: { text: "string" } for aura models. 
            // Previous code used 'prompt', let's stick to 'text' as standard, but confirm?
            // Actually standard for text-generation is prompt, but for TTS it is text usually.
            // Let's use 'text'.
            options.text = text;
        }

        if (config?.speaker) options.speaker = config.speaker;
        if (config?.sample_rate) options.sample_rate = config.sample_rate;
        if (config?.encoding) options.encoding = config.encoding;

        console.log(`[TTS] Generating with ${MODEL}`, JSON.stringify(options));

        // @ts-ignore
        const ttsResponse = await withTimeout(
            env.AI.run(MODEL, options),
            15000,
            "TTS timed out"
        );

        // @ts-ignore
        if (ttsResponse.audio) {
            // JSON response with base64
            // @ts-ignore
            const binaryString = atob(ttsResponse.audio);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
        } else {
            // Stream response
            // @ts-ignore
            return await new Response(ttsResponse).arrayBuffer();
        }
    } catch (e) {
        console.error("TTS Error", e);
        return null;
    }
}

// --- Actors ---

const sttActor = fromPromise<string, { audioBuffer: Uint8Array[]; env: any; model?: string }>(
    async ({ input }) => {
        return await runSTT(input.audioBuffer, input.env, input.model);
    }
);

const llmActor = fromCallback<ServerEvent, { messages: Message[]; env: any; config: VoiceConfig }>(
    ({ input, sendBack }) => {
        const { messages, env, config } = input;

        const aiMessages = messages.map(m => ({ role: m.role, content: m.content }));
        const Model = config.llmModel || "@cf/meta/llama-3.1-8b-instruct";

        (async () => {
            try {
                // @ts-ignore
                const responseStream = await withTimeout(
                    env.AI.run(
                        Model,
                        {
                            messages: aiMessages,
                            stream: true
                        }
                    ),
                    20000, // 20s timeout for initial response
                    "LLM start timed out"
                );

                // @ts-ignore
                const reader = responseStream.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                let sentenceBuffer = "";
                let fullResponse = "";
                // Safety watchdog for stream processing
                const STREAM_TIMEOUT_MS = 60 * 1000;
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
                        if (!trimmed || trimmed === "data: [DONE]") continue;
                        if (trimmed.startsWith("data: ")) {
                            try {
                                const jsonStr = trimmed.slice(6);
                                const data = JSON.parse(jsonStr);
                                const text = data.response;

                                if (text) {
                                    fullResponse += text;
                                    sentenceBuffer += text;
                                    sendBack({ type: "LLM_PARTIAL", text });

                                    if (sentenceBuffer.match(/[.!?](\s+|\n)/)) {
                                        const audio = await runTTS(sentenceBuffer, env, config.tts);
                                        if (audio) sendBack({ type: "TTS_AUDIO", data: audio });
                                        sentenceBuffer = "";
                                    }
                                }
                            } catch (e) { console.error("SSE Parse Error", e); }
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
                // Send specific error so machine can handle it
                sendBack({ type: "error.platform.llm", data: e });
            }
        })();

        return () => {
            // cleanup
        };
    }
);

// --- Machine ---

export const serverMachine = setup({
    types: {
        context: {} as ServerContext,
        events: {} as ServerEvent,
        input: {} as { env: any; storage: any; broadcast: (msg: any) => void; sendBinary: (data: ArrayBuffer) => void; initialMessages: Message[] }
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
                const msg: Message = {
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

                const msg: Message = {
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

                const msg: Message = {
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
        emitAudio: ({ context, event }) => {
            if (event.type === 'TTS_AUDIO') {
                context.sendBinary(event.data);
            }
        },
        emitError: ({ context, event }) => {
            const reason = (event as any).data ? String((event as any).data) : "An error occurred";

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
                                    const msg: Message = {
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
