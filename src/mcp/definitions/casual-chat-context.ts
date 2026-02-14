import { z } from "zod";
import experience from "../../data/experience.json";
import profile from "../../data/profile.json";

export const casualChatContextDefinition = {
    name: "casual_chat_context",
    description: "Provide lightweight personal context for informal discussion — interests, communication style, and conversation-safe topics. This is a context provider, not a chat tool. No server-side memory or persistent state.",
    schema: z.object({}),
    handler: async () => {
        const casual = experience.casual_context;

        const output = `# Casual Chat Context

## About
${profile.name} — ${profile.title} based in ${profile.location}.

## Interests
${casual.interests.map((i: string) => `- ${i}`).join("\n")}

## Communication Style
${casual.communication_style}

## Good Conversation Topics
${casual.conversation_safe_topics.map((t: string) => `- ${t}`).join("\n")}

## Links
- Website: ${profile.website}
- GitHub: ${profile.github}
- X: ${profile.x}

---
*This is a context provider. The host manages conversation flow. No state is stored server-side.*`;

        return output;
    }
};
