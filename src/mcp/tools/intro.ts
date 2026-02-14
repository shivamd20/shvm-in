import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { introDefinition } from "../definitions/intro";

export function registerIntroTool(server: McpServer) {
    server.tool(
        introDefinition.name,
        introDefinition.description,
        introDefinition.schema.shape,
        async (_args) => {
            const result = await introDefinition.handler();
            return {
                content: [{ type: "text" as const, text: result }],
            };
        }
    );
}
