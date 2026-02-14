import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerIntroTool } from "./tools/intro";
import { registerSystemDesignProbeTool } from "./tools/system-design-probe";
import { registerProjectProbeTool } from "./tools/project-probe";
import { registerBehaviouralInterviewTool } from "./tools/behavioural-interview";
import { registerProfileFitAssessmentTool } from "./tools/profile-fit-assessment";
import { registerCasualChatContextTool } from "./tools/casual-chat-context";
import { registerLeaveMessageTool } from "./tools/leave-message";

/**
 * Creates a new MCP server instance with all tools registered.
 *
 * IMPORTANT: A new server instance must be created per request (MCP SDK 1.26.0+).
 * This prevents cross-client data leaks.
 *
 * @param env - Cloudflare Worker environment bindings (for Durable Object access)
 */
export function createShvmMcpServer(env?: { MESSAGE_STORE?: DurableObjectNamespace }) {
    const server = new McpServer({
        name: "shvm-mcp",
        version: "1.0.0",
    });

    // Register all tools
    registerIntroTool(server);
    registerSystemDesignProbeTool(server);
    registerProjectProbeTool(server);
    registerBehaviouralInterviewTool(server);
    registerProfileFitAssessmentTool(server);
    registerCasualChatContextTool(server);
    registerLeaveMessageTool(server, env);

    return server;
}
