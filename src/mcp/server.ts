import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerChatTool } from "./tools/chat";

export function createShvmMcpServer(env?: { AI?: unknown }) {
  const server = new McpServer({
    name: "shvm-mcp",
    version: "1.0.0",
  });

  registerChatTool(server, env ?? {});

  return server;
}
