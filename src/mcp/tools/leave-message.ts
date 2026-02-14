import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Env type will be injected at server creation time
export function registerLeaveMessageTool(server: McpServer, env?: { MESSAGE_STORE?: DurableObjectNamespace }) {
    server.tool(
        "leave_message_for_shivam",
        "Leave a structured message for Shivam. Provide your name, email, and message. The message will be persisted reliably.",
        {
            name: z.string().min(1).describe("Your name"),
            email: z.string().email().describe("Your email address"),
            message: z.string().min(1).max(2000).describe("Your message for Shivam (max 2000 chars)"),
        },
        async ({ name, email, message }) => {
            const timestamp = new Date().toISOString();

            // Attempt to store in Durable Object
            if (env?.MESSAGE_STORE) {
                try {
                    const id = env.MESSAGE_STORE.idFromName("shvm-messages");
                    const stub = env.MESSAGE_STORE.get(id);

                    const response = await stub.fetch(new Request("https://internal/store", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name, email, message, timestamp }),
                    }));

                    if (!response.ok) {
                        console.error("Failed to store message in DO:", await response.text());
                        // Fall through to console logging
                    } else {
                        return {
                            content: [{
                                type: "text" as const,
                                text: `✅ Message received and stored.\n\n**From:** ${name} (${email})\n**Time:** ${timestamp}\n\nShivam will see this message. Thank you!`,
                            }],
                        };
                    }
                } catch (err) {
                    console.error("DO storage error:", err);
                    // Fall through to console logging
                }
            }

            // Fallback: console log (MVP mode)
            console.log("=== MESSAGE FOR SHIVAM ===");
            console.log(JSON.stringify({ name, email, message, timestamp }, null, 2));
            console.log("=== END MESSAGE ===");

            return {
                content: [{
                    type: "text" as const,
                    text: `✅ Message received.\n\n**From:** ${name} (${email})\n**Time:** ${timestamp}\n\nMessage has been logged. Thank you!`,
                }],
            };
        }
    );
}
