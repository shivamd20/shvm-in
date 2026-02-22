import { createWorkersAiChat } from "@cloudflare/tanstack-ai";

export const getChatAdapter = (env: ChatEnv) => {
    const model = "@cf/openai/gpt-oss-120b";
    console.log("[ChatAdapter] Using Cloudflare adapter with model:", model);
    return createWorkersAiChat(model, {
        binding: env.AI,
    });
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

import { toolDefinition } from "@tanstack/ai";

export const getTools = (env: ChatEnv) => [
    toolDefinition({
        name: introDefinition.name,
        description: introDefinition.description,
        inputSchema: introDefinition.schema,
    }).server(async () => introDefinition.handler()),
    toolDefinition({
        name: systemDesignProbeDefinition.name,
        description: systemDesignProbeDefinition.description,
        inputSchema: systemDesignProbeDefinition.schema,
    }).server(async (args: any) => systemDesignProbeDefinition.handler(args)),
    toolDefinition({
        name: projectProbeDefinition.name,
        description: projectProbeDefinition.description,
        inputSchema: projectProbeDefinition.schema,
    }).server(async (args: any) => projectProbeDefinition.handler(args)),
    toolDefinition({
        name: behaviouralInterviewDefinition.name,
        description: behaviouralInterviewDefinition.description,
        inputSchema: behaviouralInterviewDefinition.schema,
    }).server(async () => behaviouralInterviewDefinition.handler()),
    toolDefinition({
        name: profileFitAssessmentDefinition.name,
        description: profileFitAssessmentDefinition.description,
        inputSchema: profileFitAssessmentDefinition.schema,
    }).server(async () => profileFitAssessmentDefinition.handler()),
    toolDefinition({
        name: casualChatContextDefinition.name,
        description: casualChatContextDefinition.description,
        inputSchema: casualChatContextDefinition.schema,
    }).server(async () => casualChatContextDefinition.handler()),
    toolDefinition({
        name: leaveMessageDefinition.name,
        description: leaveMessageDefinition.description,
        inputSchema: leaveMessageDefinition.schema,
    }).server(async (args: any) => leaveMessageDefinition.handler(args, env)),
];


