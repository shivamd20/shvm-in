import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerChatTool } from "./tools/chat";
import { registerPublishBlogTool } from "./tools/publish-blog";

export function createShvmMcpServer(env?: { AI?: unknown; BLOG_STORE?: unknown }) {
  const server = new McpServer({
    name: "shvm-mcp",
    version: "1.0.0",
  });

  registerChatTool(server, env ?? {});
  registerPublishBlogTool(server, env ?? {});

  return server;
}
