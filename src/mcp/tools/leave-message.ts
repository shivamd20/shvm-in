import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { leaveMessageDefinition } from "../definitions/leave-message";

export function registerLeaveMessageTool(server: McpServer, env?: { MESSAGE_STORE?: DurableObjectNamespace }) {
    server.tool(
        leaveMessageDefinition.name,
        leaveMessageDefinition.description,
        leaveMessageDefinition.schema.shape,
        async (args) => {
            const result = await leaveMessageDefinition.handler(args, env);
            return {
                content: [{ type: "text" as const, text: result }],
            };
        }
    );
}
