import { DurableObject } from "cloudflare:workers";

interface StoredMessage {
    name: string;
    email: string;
    message: string;
    timestamp: string;
    id: string;
}

/**
 * MessageStore Durable Object
 *
 * Provides strongly consistent, ordered storage for messages left via the MCP server.
 * Each message is stored with a monotonically increasing key for ordered retrieval.
 */
export class MessageStore extends DurableObject<Env> {
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === "POST" && url.pathname === "/store") {
            return this.storeMessage(request);
        }

        if (request.method === "GET" && url.pathname === "/list") {
            return this.listMessages(url);
        }

        return new Response("Not found", { status: 404 });
    }

    private async storeMessage(request: Request): Promise<Response> {
        try {
            const body = (await request.json()) as Omit<StoredMessage, "id">;

            // Validate required fields
            if (!body.name || !body.email || !body.message) {
                return new Response(
                    JSON.stringify({ error: "Missing required fields: name, email, message" }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
            }

            // Generate a sortable ID: timestamp + random suffix
            const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

            const storedMessage: StoredMessage = {
                id,
                name: body.name,
                email: body.email,
                message: body.message,
                timestamp: body.timestamp || new Date().toISOString(),
            };

            // Store in Durable Object storage
            await this.ctx.storage.put(`message:${id}`, storedMessage);

            // Update counter
            const count = ((await this.ctx.storage.get<number>("message_count")) ?? 0) + 1;
            await this.ctx.storage.put("message_count", count);

            console.log(`[MessageStore] Stored message #${count} from ${body.name} (${body.email})`);

            return new Response(
                JSON.stringify({ success: true, id, count }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        } catch (err) {
            console.error("[MessageStore] Store error:", err);
            return new Response(
                JSON.stringify({ error: "Failed to store message" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }
    }

    private async listMessages(url: URL): Promise<Response> {
        try {
            const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);

            const entries = await this.ctx.storage.list<StoredMessage>({
                prefix: "message:",
                limit,
            });

            const messages: StoredMessage[] = [];
            entries.forEach((value) => {
                messages.push(value);
            });

            const count = (await this.ctx.storage.get<number>("message_count")) ?? 0;

            return new Response(
                JSON.stringify({ messages, total: count }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        } catch (err) {
            console.error("[MessageStore] List error:", err);
            return new Response(
                JSON.stringify({ error: "Failed to list messages" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }
    }
}
