import handler from "@tanstack/react-start/server-entry";
import { handleMcpRequest } from "./mcp";
import { getFluxWebSocketResponse } from "./vani2/server/stt-adapter";

// Re-export the MessageStore Durable Object for wrangler binding
export { MessageStore } from "./mcp/message-store";
export { Vani2SessionDO } from "./vani2/server/Vani2SessionDO";

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url);

        // Route /mcp to the MCP server
        if (url.pathname === "/mcp") {
            return handleMcpRequest(request, env, ctx);
        }

        // Vani 2 health check (idea 10): lightweight check for Workers AI availability
        if (url.pathname === "/v2/health") {
            try {
                if (!env.AI) {
                    return new Response(JSON.stringify({ ok: false, reason: "AI binding missing" }), {
                        status: 503,
                        headers: { "Content-Type": "application/json" },
                    });
                }
                // Optional: ping Workers AI with a trivial call to confirm it's reachable
                await env.AI.run("@cf/meta/llama-3.2-1b-instruct", {
                    prompt: "Hi",
                    max_tokens: 1,
                });
                return new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            } catch (e) {
                console.error("[Vani2] health check failed", e);
                return new Response(
                    JSON.stringify({ ok: false, reason: e instanceof Error ? e.message : String(e) }),
                    { status: 503, headers: { "Content-Type": "application/json" } }
                );
            }
        }

        // Vani 2 websocket route
        const ws2Match = url.pathname.match(/^\/v2\/ws\/([^/]+)$/);
        if (ws2Match) {
            const sessionId = ws2Match[1];
            const id = env.VANI2_SESSIONS.idFromName(sessionId);
            const stub = env.VANI2_SESSIONS.get(id);
            return stub.fetch(request);
        }

        // Vani 2 Flux transcription WebSocket (client connects directly to Flux)
        const fluxMatch = url.pathname.match(/^\/v2\/flux\/([^/]+)$/);
        if (fluxMatch && request.headers.get("Upgrade") === "websocket") {
            try {
                const resp = await getFluxWebSocketResponse(env as any);
                return resp;
            } catch (e) {
                console.error("[Flux] getFluxWebSocketResponse error:", e);
                return new Response(JSON.stringify({ error: "Flux unavailable" }), { status: 502 });
            }
        }

        // Everything else goes to TanStack Start
        // handler.fetch signature varies by runtime — Cloudflare docs confirm this pattern works
        return (handler.fetch as Function)(request, env, ctx);
    },
};
