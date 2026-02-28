import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerChatTool } from "./tools/chat";
import { registerPublishBlogTool } from "./tools/publish-blog";

type PublishBlogEnv = {
  BLOG_STORE?: { idFromName: (name: string) => unknown; get: (id: unknown) => { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> } };
};

export function createShvmMcpServer(env?: { AI?: unknown; BLOG_STORE?: unknown }) {
  const server = new McpServer({
    name: "shvm-mcp",
    version: "1.0.0",
  });

  registerChatTool(server, env ?? {});
  registerPublishBlogTool(server, (env ?? {}) as PublishBlogEnv);

  return server;
}
