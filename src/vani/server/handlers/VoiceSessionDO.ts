import { DurableObject } from "cloudflare:workers";
import { createActor, type ActorRefFrom } from "xstate";
import { serverMachine } from "@vani/server/runtime/machine";
import type { AnyClientToServerJson, ServerToClientJson } from "@shvm/vani-client/shared";
import type { ServerMessage } from "@shvm/vani-client/shared";

export class VoiceSessionDO extends DurableObject<any> {
    private sessions: Map<WebSocket, any> = new Map();
    private actor: ActorRefFrom<typeof serverMachine>;

    constructor(ctx: DurableObjectState, env: any) {
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
        const messages: ServerMessage[] = [];
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
                broadcast: (msg: ServerToClientJson) => this.broadcast(msg),
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
            const msg: ServerToClientJson = { type: "state", value: snapshot.context.status };
            server.send(JSON.stringify(msg));

            return new Response(null, { status: 101, webSocket: client });
        }

        return new Response("Not found", { status: 404 });
    }

    async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
        try {
            if (typeof message === "string") {
                const data = JSON.parse(message) as AnyClientToServerJson;
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

    private handleJsonMessage(data: AnyClientToServerJson) {
        console.log(`[VoiceDO] Received JSON:`, data);

        switch (data.type) {
            case "start":
                this.actor.send({ type: "START", config: data.config });
                break;
            case "stop":
                this.actor.send({ type: "STOP" });
                break;
            case "reset":
                this.actor.send({ type: "RESET" });
                break;
            case "text":
                if (data.value) {
                    this.actor.send({ type: "TEXT_MESSAGE", content: data.value });
                }
                break;
            case "text.message":
                if (data.content) {
                    this.actor.send({ type: "TEXT_MESSAGE", content: data.content });
                }
                break;
            case "tool.execute.response":
                this.actor.send({
                    type: "TOOL_EXECUTE_RESPONSE",
                    callId: data.callId,
                    result: data.result
                });
                break;
            case "tool.execute.error":
                this.actor.send({
                    type: "TOOL_EXECUTE_ERROR",
                    callId: data.callId,
                    error: data.error
                });
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

    private broadcast(message: ServerToClientJson) {
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
