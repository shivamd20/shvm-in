import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { profileFitAssessmentDefinition } from "../definitions/profile-fit-assessment";

export function registerProfileFitAssessmentTool(server: McpServer) {
    server.tool(
        profileFitAssessmentDefinition.name,
        profileFitAssessmentDefinition.description,
        profileFitAssessmentDefinition.schema.shape,
        async (_args) => {
            const result = await profileFitAssessmentDefinition.handler();
            return {
                content: [{ type: "text" as const, text: result }],
            };
        }
    );
}
