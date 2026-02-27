import handler from "@tanstack/react-start/server-entry";
import { handleMcpRequest } from "./mcp";
import { getFluxWebSocketResponse } from "./vani2/server/stt-adapter";
import { renderMarkdown } from "./blog/markdown";

// Re-export Durable Objects for wrangler binding
export { MessageStore } from "./mcp/message-store";
export { Vani2SessionDO } from "./vani2/server/Vani2SessionDO";
export { BlogStoreDO } from "./blog/BlogStoreDO";

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url);

        // Route /mcp to the MCP server
        if (url.pathname === "/mcp") {
            return handleMcpRequest(request, env, ctx);
        }

        // Vani 2 create session: POST /v2/sessions returns { sessionId } for joining via WS /v2/ws/:sessionId
        if (url.pathname === "/v2/sessions" && request.method === "POST") {
            const sessionId = `v2-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            return new Response(JSON.stringify({ sessionId }), {
                status: 201,
                headers: { "Content-Type": "application/json" },
            });
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

        // Blog API (singleton DO; structured errors; pagination on list)
        const blogPostsMatch = url.pathname.match(/^\/api\/blog\/posts\/?([^/]*)$/);
        if (blogPostsMatch && env.BLOG_STORE) {
            const slug = blogPostsMatch[1];
            const stub = env.BLOG_STORE.get(env.BLOG_STORE.idFromName("blog-store"));
            if (request.method === "GET" && !slug) {
                const listUrl = new URL(request.url);
                return stub.fetch(new Request(new URL(`/posts${listUrl.search}`, request.url)));
            }
            if (request.method === "GET" && slug) {
                return stub.fetch(new Request(new URL(`/posts/${slug}`, request.url)));
            }
            if (request.method === "POST" && !slug) {
                return stub.fetch(new Request(new URL("/posts", request.url), { method: "POST", body: request.body, headers: request.headers }));
            }
            return jsonResp({ error: "Method not allowed" }, 405);
        }
        if (url.pathname === "/api/blog/preview" && request.method === "POST") {
            try {
                const body = (await request.json()) as { markdown?: string };
                const markdown = typeof body?.markdown === "string" ? body.markdown : "";
                const out = renderMarkdown(markdown);
                return jsonResp(out);
            } catch (e) {
                return jsonResp({ error: e instanceof Error ? e.message : "Preview failed" }, 400);
            }
        }

        // Everything else goes to TanStack Start
        // handler.fetch signature varies by runtime — Cloudflare docs confirm this pattern works
        return (handler.fetch as Function)(request, env, ctx);
    },
};

function jsonResp(data: object, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
