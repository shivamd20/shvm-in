import { DurableObject } from "cloudflare:workers";
import { createActor, type ActorRefFrom } from "xstate";
import { serverMachine, type Message } from "./machine";

interface WebSocketMessage {
    type: string;
    [key: string]: any;
}

export class VoiceSessionDO extends DurableObject<Env> {
    private sessions: Map<WebSocket, any> = new Map();
    private actor: ActorRefFrom<typeof serverMachine>;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);

        // 1. Initialize Schema
        this.ctx.storage.sql.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
        `);

        // 2. Load History
        const messages: Message[] = [];
        const result = this.ctx.storage.sql.exec(`SELECT id, role, content, created_at FROM messages ORDER BY created_at ASC`);
        for (const row of result) {
            messages.push({
                id: row.id as string,
                role: row.role as any,
                content: row.content as string,
                created_at: row.created_at as number
            });
        }

        if (messages.length === 0) {
            // Note: Machine adds system prompt on idle entry if empty.
        }

        // 3. Start Machine
        this.actor = createActor(serverMachine, {
            input: {
                env: this.env,
                storage: this.ctx.storage,
                initialMessages: messages,
                broadcast: (msg: any) => this.broadcast(msg),
                sendBinary: (data: ArrayBuffer) => this.broadcastBinary(data)
            }
        });

        // Error logging
        this.actor.subscribe({
            error: (err: any) => console.error("[VoiceDO] Machine Error:", err)
        });

        this.actor.start();
    }

    async fetch(request: Request): Promise<Response> {
        if (request.headers.get("Upgrade") === "websocket") {
            const pair = new WebSocketPair();
            const [client, server] = Object.values(pair);

            this.ctx.acceptWebSocket(server);
            this.sessions.set(server, { connectedAt: new Date() });

            // Close other existing sessions (Single device policy)
            for (const other of this.sessions.keys()) {
                if (other !== server) {
                    try {
                        other.close(1000, "Reconnected elsewhere");
                    } catch (e) { }
                    this.sessions.delete(other);
                }
            }

            console.log(`[VoiceDO] Accepted WebSocket connection`);

            // Send current state
            const snapshot = this.actor.getSnapshot();
            server.send(JSON.stringify({ type: "state", value: snapshot.context.status }));

            return new Response(null, { status: 101, webSocket: client });
        }

        return new Response("Not found", { status: 404 });
    }

    async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
        try {
            if (typeof message === "string") {
                const data = JSON.parse(message) as WebSocketMessage;
                this.handleJsonMessage(data);
            } else {
                this.handleBinaryMessage(message);
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

    private handleJsonMessage(data: WebSocketMessage) {
        console.log(`[VoiceDO] Received JSON:`, data);

        switch (data.type) {
            case "start":
                this.actor.send({ type: "START" });
                break;
            case "stop":
                this.actor.send({ type: "STOP" });
                break;
            case "reset":
                this.actor.send({ type: "RESET" });
                break;
            case "text.message":
                if (data.content) {
                    this.actor.send({ type: "TEXT_MESSAGE", content: data.content });
                }
                break;
            default:
                break;
        }
    }

    private handleBinaryMessage(data: ArrayBuffer) {
        // We just forward chunks. The machine state determines if we are 'listening' and should accept them.
        // But machine logic: AUDIO_CHUNK only handled in 'listening'.
        this.actor.send({ type: "AUDIO_CHUNK", data });
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

    private broadcastBinary(data: ArrayBuffer) {
        for (const ws of this.sessions.keys()) {
            try {
                ws.send(data);
            } catch (e) {
                this.sessions.delete(ws);
            }
        }
    }
}
