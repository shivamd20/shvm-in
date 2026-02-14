import { createMcpHandler } from "agents/mcp";
import { createShvmMcpServer } from "./server";

/**
 * MCP request handler for the /mcp endpoint.
 *
 * Creates a new MCP server instance per request (required by MCP SDK 1.26.0+)
 * and delegates to the Cloudflare Agents SDK streamable HTTP handler.
 *
 * Usage in the main worker:
 *   if (pathname === "/mcp") {
 *     return handleMcpRequest(request, env, ctx);
 *   }
 */
export async function handleMcpRequest(
    request: Request,
    env: Env,
    ctx: ExecutionContext
): Promise<Response> {
    // Create a new server instance per request (MCP SDK 1.26.0+ requirement)
    const server = createShvmMcpServer(env as unknown as { MESSAGE_STORE?: DurableObjectNamespace });

    // Use the Cloudflare Agents SDK streamable HTTP handler
    const handler = createMcpHandler(server);
    return handler(request, env, ctx);
}

// Re-export the MessageStore Durable Object for wrangler binding
export { MessageStore } from "./message-store";
