import handler from "@tanstack/react-start/server-entry";
import { handleMcpRequest } from "./mcp";
import { chat, toolDefinition, toHttpStream, maxIterations } from "@tanstack/ai";
import { getChatAdapter } from "./lib/chat";
import { createMCPConsumer } from "./lib/mcp-client";
import { getSystemPrompt } from "./lib/system-prompt";

// Re-export the MessageStore Durable Object for wrangler binding
export { MessageStore } from "./mcp/message-store";
export { VoiceSessionDO } from "./vani/server/handlers/VoiceSessionDO";

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url);

        // Route /mcp to the MCP server
        if (url.pathname === "/mcp") {
            return handleMcpRequest(request, env, ctx);
        }

        // Voice session websocket route
        const wsMatch = url.pathname.match(/^\/ws\/([^/]+)$/);
        if (wsMatch) {
            const sessionId = wsMatch[1];
            // Get the Durable Object stub
            const id = env.VOICE_SESSIONS.idFromName(sessionId);
            const stub = env.VOICE_SESSIONS.get(id);
            // Forward the request
            return stub.fetch(request);
        }

        if (url.pathname === "/api/chat") {
            try {
                console.log("[Chat] Request received");

                // Debug Env
                const adapter = getChatAdapter(env as any);
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

                const mcpTools = mcp.getTools();
                const activeTools = mcpTools.map(t => toolDefinition({
                    name: t.name,
                    description: t.description,
                    inputSchema: t.parameters as any
                }).server(async (args) => {
                    const result = await mcp.execute({ name: t.name, arguments: args });
                    return result.success ? result.output : { error: result.error };
                }));

                const stream = await chat({
                    adapter,
                    messages,
                    tools: activeTools as any,
                    agentLoopStrategy: maxIterations(5),
                });

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
