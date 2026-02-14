import { DurableObject } from "cloudflare:workers";

export type SessionStatus = "idle" | "listening" | "thinking" | "speaking" | "error";

interface WebSocketMessage {
    type: string;
    [key: string]: any;
}

interface Message {
    role: "user" | "assistant" | "system";
    content: string;
}

export class VoiceSessionDO extends DurableObject<Env> {
    private status: SessionStatus = "idle";
    private sessions: Map<WebSocket, any> = new Map();
    private audioBuffer: Uint8Array[] = [];
    private messages: Message[] = [];
    private readonly SYSTEM_PROMPT = "You are a helpful, concise voice assistant. Respond in short, conversational sentences.";

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.initializeStorage();
    }

    private async initializeStorage() {
        // Initialize SQLite tables
        const sql = this.ctx.storage.sql;
        sql.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
        `);
        // Load history
        const result = sql.exec(`SELECT role, content FROM messages ORDER BY created_at ASC`);
        // @ts-ignore
        this.messages = [];
        for (const row of result) {
            // @ts-ignore
            this.messages.push({ role: row.role as any, content: row.content as string });
        }

        if (this.messages.length === 0) {
            this.messages.push({ role: "system", content: this.SYSTEM_PROMPT });
        }
    }

    async fetch(request: Request): Promise<Response> {
        if (request.headers.get("Upgrade") === "websocket") {
            const pair = new WebSocketPair();
            const [client, server] = Object.values(pair);

            this.ctx.acceptWebSocket(server);
            this.sessions.set(server, { connectedAt: new Date() });

            // Close other existing sessions (Single device policy for now)
            for (const other of this.sessions.keys()) {
                if (other !== server) {
                    try {
                        other.close(1000, "Reconnected elsewhere");
                    } catch (e) { }
                    this.sessions.delete(other);
                }
            }

            console.log(`[VoiceDO] Accepted WebSocket connection`);

            // Send current state and history
            server.send(JSON.stringify({ type: "state", value: this.status }));
            // Maybe send history? For now let's just sync state.

            return new Response(null, { status: 101, webSocket: client });
        }

        return new Response("Not found", { status: 404 });
    }

    async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
        try {
            if (typeof message === "string") {
                const data = JSON.parse(message) as WebSocketMessage;
                await this.handleJsonMessage(ws, data);
            } else {
                await this.handleBinaryMessage(ws, message);
            }
        } catch (err) {
            console.error("[VoiceDO] Error handling message:", err);
            ws.send(JSON.stringify({ type: "error", reason: "Invalid message format" }));
        }
    }

    async webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean) {
        console.log(`[VoiceDO] WebSocket closed: ${code} ${reason}`);
        this.sessions.delete(ws);
    }

    async webSocketError(ws: WebSocket, error: unknown) {
        console.error("[VoiceDO] WebSocket error:", error);
        this.sessions.delete(ws);
    }

    private async handleJsonMessage(_ws: WebSocket, data: WebSocketMessage) {
        console.log(`[VoiceDO] Received JSON:`, data);

        switch (data.type) {
            case "start":
                this.updateStatus("listening");
                this.audioBuffer = []; // Clear buffer
                break;
            case "stop":
                if (this.status === "listening") {
                    // Force run turn if stopped manually while listening
                    await this.processTurn();
                } else {
                    this.updateStatus("idle");
                }
                break;
            case "text.message":
                // Optional: Handle text input as a turn
                if (data.content) {
                    this.messages.push({ role: "user", content: data.content });
                    await this.saveMessage("user", data.content);
                    await this.runLLMAndTTS();
                }
                break;
            default:
                break;
        }
    }

    private async handleBinaryMessage(_ws: WebSocket, data: ArrayBuffer) {
        if (this.status !== "listening") {
            // In PTT mode, we might want to just ignore late packets or log them
            return;
        }

        // Buffer audio
        this.audioBuffer.push(new Uint8Array(data));

        // No VAD check here. We rely entirely on the 'stop' event to trigger processing.
        // This implements "Push to Talk" strictly.
    }

    private async processTurn() {
        console.log(`[VoiceDO] Processing Turn. Buffer chunks: ${this.audioBuffer.length}`);
        if (this.audioBuffer.length === 0) {
            this.updateStatus("listening");
            return;
        }

        // 1. Concatenate audio
        const totalLength = this.audioBuffer.reduce((acc, chunk) => acc + chunk.length, 0);
        console.log(`[VoiceDO] Total audio size: ${totalLength} bytes`);

        const fullAudio = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of this.audioBuffer) {
            fullAudio.set(chunk, offset);
            offset += chunk.length;
        }
        this.audioBuffer = []; // Clear immediately to avoid double processing

        // 2. STT
        this.updateStatus("thinking");
        let transcript = "";
        try {
            console.log("[VoiceDO] Running STT (Whisper)...");
            // Convert Uint8Array to Array of numbers for Worker AI input
            // @ts-ignore
            const response = await this.env.AI.run("@cf/openai/whisper-tiny-en", {
                audio: [...fullAudio],
            });
            console.log("[VoiceDO] STT Response:", JSON.stringify(response));

            // @ts-ignore
            transcript = response.text || "";

            if (!transcript.trim()) {
                console.log("[VoiceDO] Empty transcript");
                this.broadcast({ type: "error", reason: "No speech detected" });
                this.updateStatus("listening");
                return;
            }

            console.log(`[VoiceDO] Transcript: "${transcript}"`);
            this.broadcast({ type: "transcript.final", text: transcript });

            // Save user message
            this.messages.push({ role: "user", content: transcript });
            await this.saveMessage("user", transcript);

            // 3. LLM + TTS
            await this.runLLMAndTTS();

        } catch (err) {
            console.error("[VoiceDO] Process turn error:", err);
            this.updateStatus("error");
            setTimeout(() => this.updateStatus("listening"), 1000);
        }
    }

    private async runLLMAndTTS() {
        this.updateStatus("speaking");
        console.log("[VoiceDO] Running LLM...");

        try {
            // LLM Stream
            // @ts-ignore
            const responseStream = await this.env.AI.run(
                "@cf/meta/llama-3.1-8b-instruct" as any,
                {
                    messages: this.messages,
                    stream: true
                }
            );

            let assistantText = "";
            let sentenceBuffer = "";

            // The stream from AI.run with stream:true yields Uint8Array chunks of SSE events (raw bytes)
            // We need to decode them and parse 'response' field from the "data: {...}" lines.

            // @ts-ignore
            const reader = responseStream.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                // Keep the last partial line in the buffer
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
                                assistantText += text;
                                sentenceBuffer += text;
                                this.broadcast({ type: "assistant.partial", text: text });

                                // Simple sentence detection
                                if (sentenceBuffer.match(/[.!?](\s+|\n)/)) {
                                    console.log(`[VoiceDO] Sentence completed: "${sentenceBuffer}"`);
                                    await this.streamTTS(sentenceBuffer);
                                    sentenceBuffer = "";
                                }
                            }
                        } catch (e) {
                            console.log("[VoiceDO] Error parsing SSE JSON:", e);
                        }
                    }
                }
            }

            // Flush remaining
            if (sentenceBuffer.trim()) {
                console.log(`[VoiceDO] Flushing remaining: "${sentenceBuffer}"`);
                await this.streamTTS(sentenceBuffer);
            }

            console.log(`[VoiceDO] LLM Done. Full response: "${assistantText}"`);
            this.broadcast({ type: "assistant.message", message: { role: "assistant", content: assistantText } });
            this.messages.push({ role: "assistant", content: assistantText });
            await this.saveMessage("assistant", assistantText);

        } catch (e: any) {
            console.error("[VoiceDO] LLM Error:", e);
            this.broadcast({ type: "error", reason: e.message || "LLM Error" });
        } finally {
            this.updateStatus("listening");
        }
    }

    private async streamTTS(text: string) {
        console.log(`[VoiceDO] Streaming TTS for: "${text}"`);
        try {
            // @ts-ignore
            const ttsResponse = await this.env.AI.run("@cf/myshell-ai/melotts", {
                prompt: text,
                language: "en-US"
            } as any);

            let audioData: ArrayBuffer;

            // Check if response is JSON with base64 audio (MeloTTS behavior)
            // @ts-ignore
            if (ttsResponse.audio) {
                // @ts-ignore
                const base64String = ttsResponse.audio;
                const binaryString = atob(base64String);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                audioData = bytes.buffer;
            } else {
                // Fallback for direct binary response
                // @ts-ignore
                audioData = await new Response(ttsResponse).arrayBuffer();
            }

            console.log(`[VoiceDO] TTS Audio Generated: ${audioData.byteLength} bytes`);

            if (audioData.byteLength < 1024) {
                console.warn("[VoiceDO] TTS Audio is very small, might be an error or empty:", new TextDecoder().decode(audioData));
            }

            // Send as binary
            for (const ws of this.sessions.keys()) {
                try {
                    ws.send(audioData);
                } catch (e) { }
            }
        } catch (e) {
            console.error("[VoiceDO] TTS Error:", e);
        }
    }

    private updateStatus(newStatus: SessionStatus) {
        this.status = newStatus;
        this.broadcast({ type: "state", value: this.status });
    }

    private broadcast(message: any) {
        const msg = JSON.stringify(message);
        for (const ws of this.sessions.keys()) {
            try {
                ws.send(msg);
            } catch (e) {
                this.sessions.delete(ws);
            }
        }
    }

    private async saveMessage(role: string, content: string) {
        const id = crypto.randomUUID();
        const created_at = Date.now();
        this.ctx.storage.sql.exec(
            `INSERT INTO messages (id, role, content, created_at) VALUES (?, ?, ?, ?)`,
            id, role, content, created_at
        );
    }
}
