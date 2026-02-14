import handler from "@tanstack/react-start/server-entry";
import { handleMcpRequest } from "./mcp";

// Re-export the MessageStore Durable Object for wrangler binding
export { MessageStore } from "./mcp/message-store";

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // Route /mcp to the MCP server
        if (url.pathname === "/mcp") {
            return handleMcpRequest(request, env, ctx);
        }

        // Everything else goes to TanStack Start
        // handler.fetch signature varies by runtime — Cloudflare docs confirm this pattern works
        return (handler.fetch as Function)(request, env, ctx);
    },
};
