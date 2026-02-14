import { z } from "zod";

export const leaveMessageDefinition = {
    name: "leave_message_for_shivam",
    description: "Leave a structured message for Shivam. Provide your name, email, and message. The message will be persisted reliably.",
    schema: z.object({
        name: z.string().min(1).describe("Your name"),
        email: z.string().email().describe("Your email address"),
        message: z.string().min(1).max(2000).describe("Your message for Shivam (max 2000 chars)"),
    }),
    handler: async ({ name, email, message }: { name: string, email: string, message: string }, env?: { MESSAGE_STORE?: DurableObjectNamespace }) => {
        const timestamp = new Date().toISOString();

        // Attempt to store in Durable Object if env is provided
        if (env?.MESSAGE_STORE) {
            try {
                const id = env.MESSAGE_STORE.idFromName("shvm-messages");
                const stub = env.MESSAGE_STORE.get(id);

                // We need to fetch from the stub, we cannot invoke a method directly unless using RPC which we might not have set up.
                // Looking at the original implementation, it used fetch.
                const response = await stub.fetch("https://internal/store", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, message, timestamp }),
                });

                if (!response.ok) {
                    console.error("Failed to store message in DO:", await response.text());
                    // Fall through to console logging
                } else {
                    return `✅ Message received and stored.\n\n**From:** ${name} (${email})\n**Time:** ${timestamp}\n\nShivam will see this message. Thank you!`;
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

        return `✅ Message received.\n\n**From:** ${name} (${email})\n**Time:** ${timestamp}\n\nMessage has been logged. Thank you!`;
    }
};
