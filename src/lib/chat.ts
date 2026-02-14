// Custom adapter import logic handled by write_to_file in previous step but need to import it here
import { CustomWorkersAiAdapter } from "./worker-ai-adapter";

export const getChatAdapter = (env: ChatEnv) => {
    const model = "@cf/meta/llama-3-8b-instruct";
    console.log("[ChatAdapter] Using custom adapter with model:", model);
    return new CustomWorkersAiAdapter(
        model,
        env.AI
    );
};
import { introDefinition } from "../mcp/definitions/intro";
import { systemDesignProbeDefinition } from "../mcp/definitions/system-design-probe";
import { projectProbeDefinition } from "../mcp/definitions/project-probe";
import { behaviouralInterviewDefinition } from "../mcp/definitions/behavioural-interview";
import { profileFitAssessmentDefinition } from "../mcp/definitions/profile-fit-assessment";
import { casualChatContextDefinition } from "../mcp/definitions/casual-chat-context";
import { leaveMessageDefinition } from "../mcp/definitions/leave-message";

// Define the environment interface if it's not already globally available or for stricter typing here
interface ChatEnv {
    AI: any;
    MESSAGE_STORE?: any; // Relaxed type to avoid conflicts with generated Env
}

export const getTools = (env: ChatEnv) => [
    {
        name: introDefinition.name,
        description: introDefinition.description,
        parameters: introDefinition.schema,
        execute: async () => introDefinition.handler(),
    },
    {
        name: systemDesignProbeDefinition.name,
        description: systemDesignProbeDefinition.description,
        parameters: systemDesignProbeDefinition.schema,
        execute: async (args: any) => systemDesignProbeDefinition.handler(args),
    },
    {
        name: projectProbeDefinition.name,
        description: projectProbeDefinition.description,
        parameters: projectProbeDefinition.schema,
        execute: async (args: any) => projectProbeDefinition.handler(args),
    },
    {
        name: behaviouralInterviewDefinition.name,
        description: behaviouralInterviewDefinition.description,
        parameters: behaviouralInterviewDefinition.schema,
        execute: async () => behaviouralInterviewDefinition.handler(),
    },
    {
        name: profileFitAssessmentDefinition.name,
        description: profileFitAssessmentDefinition.description,
        parameters: profileFitAssessmentDefinition.schema,
        execute: async () => profileFitAssessmentDefinition.handler(),
    },
    {
        name: casualChatContextDefinition.name,
        description: casualChatContextDefinition.description,
        parameters: casualChatContextDefinition.schema,
        execute: async () => casualChatContextDefinition.handler(),
    },
    {
        name: leaveMessageDefinition.name,
        description: leaveMessageDefinition.description,
        parameters: leaveMessageDefinition.schema,
        execute: async (args: any) => {
            return leaveMessageDefinition.handler(args, env);
        },
    },
];


