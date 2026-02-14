import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { casualChatContextDefinition } from "../definitions/casual-chat-context";

export function registerCasualChatContextTool(server: McpServer) {
    server.tool(
        casualChatContextDefinition.name,
        casualChatContextDefinition.description,
        casualChatContextDefinition.schema.shape,
        async (_args) => {
            const result = await casualChatContextDefinition.handler();
            return {
                content: [{ type: "text" as const, text: result }],
            };
        }
    );
}
