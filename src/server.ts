import handler from "@tanstack/react-start/server-entry";
import { handleMcpRequest } from "./mcp";
import { chat } from "@tanstack/ai";
import { getChatAdapter, getTools } from "./lib/chat";

// Re-export the MessageStore Durable Object for wrangler binding
export { MessageStore } from "./mcp/message-store";

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url);

        // Route /mcp to the MCP server
        if (url.pathname === "/mcp") {
            return handleMcpRequest(request, env, ctx);
        }

        if (url.pathname === "/api/chat") {
            try {
                console.log("[Chat] Request received");

                // Debug Env
                const adapter = getChatAdapter(env as any);
                const tools = getTools(env as any);

                const body: any = await request.json();
                const messages = body.messages;

                const stream = await chat({
                    adapter,
                    messages,
                    tools: tools as any,
                });

                const { readable, writable } = new TransformStream();
                const writer = writable.getWriter();
                const encoder = new TextEncoder();

                (async () => {
                    try {
                        for await (const chunk of stream) {
                            // Handle text deltas
                            // @ts-ignore - access safe property
                            if (chunk.type === 'text-delta') {
                                // @ts-ignore
                                const text = chunk.text;
                                if (text) {
                                    await writer.write(encoder.encode(text));
                                }
                            }
                        }
                    } catch (e) {
                        console.error('[Chat] Chat stream error', e);
                        await writer.write(encoder.encode("\n[Error generating response]"));
                    } finally {
                        await writer.close();
                    }
                })();

                return new Response(readable, {
                    headers: { "Content-Type": "text/plain; charset=utf-8" },
                });
            } catch (err) {
                console.error("[Chat] Top-level handler error:", err);
                return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
            }
        }

        // Everything else goes to TanStack Start
        // handler.fetch signature varies by runtime — Cloudflare docs confirm this pattern works
        return (handler.fetch as Function)(request, env, ctx);
    },
};
