import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { systemDesignProbeDefinition } from "../definitions/system-design-probe";

export function registerSystemDesignProbeTool(server: McpServer) {
    server.tool(
        systemDesignProbeDefinition.name,
        systemDesignProbeDefinition.description,
        systemDesignProbeDefinition.schema.shape,
        async (args) => {
            const result = await systemDesignProbeDefinition.handler(args);
            return {
                content: [{ type: "text" as const, text: result }],
            };
        }
    );
}
