import handler from "@tanstack/react-start/server-entry";
import { handleMcpRequest } from "./mcp";
import { toHttpStream } from "@tanstack/ai";
import { runAgentWithMCP } from "./lib/chat";
import { createMCPConsumer } from "./lib/mcp-client";
import { getSystemPrompt } from "./lib/system-prompt";

// Re-export the MessageStore Durable Object for wrangler binding
export { MessageStore } from "./mcp/message-store";
export { VoiceSessionDO } from "./vani/server/handlers/VoiceSessionDO";
export { Vani2SessionDO } from "./vani2/server/Vani2SessionDO";

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url);

        // Route /mcp to the MCP server
        if (url.pathname === "/mcp") {
            return handleMcpRequest(request, env, ctx);
        }

        // Voice session websocket route (Vani 1)
        const wsMatch = url.pathname.match(/^\/ws\/([^/]+)$/);
        if (wsMatch) {
            const sessionId = wsMatch[1];
            const id = env.VOICE_SESSIONS.idFromName(sessionId);
            const stub = env.VOICE_SESSIONS.get(id);
            return stub.fetch(request);
        }

        // Vani 2 websocket route
        const ws2Match = url.pathname.match(/^\/v2\/ws\/([^/]+)$/);
        if (ws2Match) {
            const sessionId = ws2Match[1];
            const id = env.VANI2_SESSIONS.idFromName(sessionId);
            const stub = env.VANI2_SESSIONS.get(id);
            return stub.fetch(request);
        }

        if (url.pathname === "/api/chat") {
            try {
                console.log("[Chat] Request received");

                const body: any = await request.json();
                let messages = body.messages;
                // Currently defaults to 'engineer'
                const mode = body.mode || 'engineer';

                const systemPrompt = getSystemPrompt(mode);
                messages = [{ role: 'system', content: systemPrompt }, ...messages];

                // Initialize MCP consumer in the backend pointing to its own /mcp origin
                const protocol = request.url.startsWith("https") ? "https" : "http";
                const mcpUrl = `${protocol}://${new URL(request.url).host}/mcp`;
                const mcp = await createMCPConsumer({ servers: [mcpUrl] });

                const stream = await runAgentWithMCP(env as any, messages, mcp);

                return new Response(toHttpStream(stream), {
                    headers: { "Content-Type": "application/x-ndjson" },
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
