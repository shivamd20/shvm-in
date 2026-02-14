import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { projectProbeDefinition } from "../definitions/project-probe";

export function registerProjectProbeTool(server: McpServer) {
    server.tool(
        projectProbeDefinition.name,
        projectProbeDefinition.description,
        projectProbeDefinition.schema.shape,
        async (args) => {
            const result = await projectProbeDefinition.handler(args);
            return {
                content: [{ type: "text" as const, text: result }],
            };
        }
    );
}
