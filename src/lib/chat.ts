import { createWorkersAiChat } from "@cloudflare/tanstack-ai";
import { chat, toolDefinition, maxIterations } from "@tanstack/ai";

// Define the environment interface if it's not already globally available or for stricter typing here
export interface ChatEnv {
    AI: any;
    MESSAGE_STORE?: any; // Relaxed type to avoid conflicts with generated Env
}

export const getChatAdapter = (env: ChatEnv) => {
    const model = "@cf/openai/gpt-oss-120b";
    console.log("[ChatAdapter] Using Cloudflare adapter with model:", model);
    return createWorkersAiChat(model, {
        binding: env.AI,
    });
};

export async function runAgentWithMCP(env: ChatEnv, messages: any[], mcp: any) {
    const adapter = getChatAdapter(env);

    let activeTools: any[] = [];
    if (mcp) {
        const mcpTools = mcp.getTools();
        activeTools = mcpTools.map((t: any) => toolDefinition({
            name: t.name,
            description: t.description,
            inputSchema: t.parameters as any
        }).server(async (args) => {
            console.log(`[Agent] Executing tool ${t.name}...`);
            const result = await mcp.execute({ name: t.name, arguments: args });
            return result.success ? result.output : { error: result.error };
        }));
    }

    return await chat({
        adapter,
        messages,
        tools: activeTools as any,
        agentLoopStrategy: maxIterations(5),
    });
}
