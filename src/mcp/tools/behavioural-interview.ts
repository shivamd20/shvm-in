import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { behaviouralInterviewDefinition } from "../definitions/behavioural-interview";

export function registerBehaviouralInterviewTool(server: McpServer) {
    server.tool(
        behaviouralInterviewDefinition.name,
        behaviouralInterviewDefinition.description,
        behaviouralInterviewDefinition.schema.shape,
        async (_args) => {
            const result = await behaviouralInterviewDefinition.handler();
            return {
                content: [{ type: "text" as const, text: result }],
            };
        }
    );
}
