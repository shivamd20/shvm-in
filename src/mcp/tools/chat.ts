import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { chatDefinition, chatSchema } from "../definitions/chat";
import { streamLlmResponse } from "../../vani2/server/llm-adapter";

export function registerChatTool(
  server: McpServer,
  env: { AI?: unknown }
) {
  server.registerTool(
    chatDefinition.name,
    { description: chatDefinition.description, inputSchema: chatSchema },
    async (args) => {
      const { messages } = args as { messages: { role: string; content: string }[] };
      const systemPrompt = chatDefinition.getSystemPrompt();
      const history = messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      if (!env?.AI) {
        return {
          content: [{ type: "text" as const, text: "AI not configured. Set env.AI in the worker." }],
        };
      }

      let text = "";
      try {
        for await (const delta of streamLlmResponse({
          binding: env.AI,
          systemPrompt,
          messages: history,
        })) {
          text += delta;
        }
      } catch (e) {
        text = `Error: ${e instanceof Error ? e.message : String(e)}`;
      }

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
