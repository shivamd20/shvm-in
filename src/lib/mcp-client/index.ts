import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";


export interface LLMToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}

export interface ToolCall {
    name: string;
    arguments: unknown;
}

export interface ToolExecutionResult {
    success: boolean;
    output?: unknown;
    error?: string;
    durationMs: number;
}

export interface ExecutionTrace {
    toolName: string;
    input: unknown;
    output?: unknown;
    error?: string;
    durationMs: number;
    timestamp: number;
}

export interface MCPConsumer {
    getTools(): LLMToolDefinition[];
    execute(toolCall: ToolCall): Promise<ToolExecutionResult>;
    getTrace(): ExecutionTrace[];
}

export interface MCPConsumerConfig {
    servers: string[];
    timeoutMs?: number;
    maxTools?: number;
}

export async function createMCPConsumer(config: MCPConsumerConfig): Promise<MCPConsumer> {
    const { servers, timeoutMs = 10000, maxTools = 50 } = config;

    const mcpClients: { server: string; client: Client }[] = [];
    const tools: LLMToolDefinition[] = [];
    const serverToolMap = new Map<string, { server: string; originalName: string }>(); // normalized name -> server details
    const trace: ExecutionTrace[] = [];

    // 1. Connect to all servers and fetch tools
    for (const server of servers) {
        try {
            let client = new Client(
                { name: "mcp-consumer", version: "1.0.0" },
                { capabilities: {} }
            );

            try {
                const transport = new StreamableHTTPClientTransport(new URL(server));
                await client.connect(transport);
                mcpClients.push({ server, client });
            } catch (err) {
                console.warn(`[MCP Consumer] StreamableHTTPClientTransport failed for ${server}, falling back to SSEClientTransport.`, err);
                client = new Client(
                    { name: "mcp-consumer", version: "1.0.0" },
                    { capabilities: {} }
                );
                const fallbackTransport = new SSEClientTransport(new URL(server));
                await client.connect(fallbackTransport);
                mcpClients.push({ server, client });
            }

            const serverToolsResponse = await client.listTools();
            let serverTools = serverToolsResponse.tools || [];

            // Enforce maxTools limit per server (or total, let's just break if we exceed total)
            for (const t of serverTools) {
                if (tools.length >= maxTools) break;

                let normalizedName = t.name;
                // Collision handling: checking if already exists
                if (serverToolMap.has(t.name)) {
                    // simple auto-prefix
                    const urlStr = server.replace(/^https?:\/\//, '').replace(/:/g, '_').replace(/\//g, '_');
                    normalizedName = `${urlStr}__${t.name}`.replace(/[^a-zA-Z0-9_-]/g, '_');
                }

                serverToolMap.set(normalizedName, { server, originalName: t.name });

                // Truncate description length to 1024 to be safe with LLMs
                const safeDescription = (t.description || "").substring(0, 1024);

                tools.push({
                    name: normalizedName,
                    description: safeDescription,
                    parameters: t.inputSchema || { type: "object", properties: {} }
                });
            }
        } catch (err) {
            console.error(`[MCP Consumer] Failed to connect or load tools from ${server}:`, err);
        }
    }

    return {
        getTools() {
            return tools;
        },

        async execute(toolCall: ToolCall): Promise<ToolExecutionResult> {
            const start = Date.now();
            let result: ToolExecutionResult;

            try {
                const mapping = serverToolMap.get(toolCall.name);
                if (!mapping) {
                    throw new Error(`Tool unknown or not loaded: ${toolCall.name}`);
                }

                const mcpClientEntry = mcpClients.find(c => c.server === mapping.server);
                if (!mcpClientEntry || !mcpClientEntry.client) {
                    throw new Error(`MCP Client for ${mapping.server} not found or disconnected`);
                }

                // Execute tool with timeout
                const promise = mcpClientEntry.client.callTool({
                    name: mapping.originalName,
                    arguments: toolCall.arguments as Record<string, unknown>
                });

                const timeoutPromise = new Promise<{ isTimeout: true }>((_, reject) =>
                    setTimeout(() => reject(new Error("Tool execution timed out")), timeoutMs)
                );

                const rawResult = await Promise.race([promise, timeoutPromise]) as any;

                // Validation + Truncation
                let outputStr = JSON.stringify(rawResult.content) || "";
                if (outputStr.length > 50000) {
                    outputStr = outputStr.substring(0, 50000) + "... (truncated)";
                }

                result = {
                    success: !rawResult.isError,
                    output: rawResult.content,
                    durationMs: Date.now() - start
                };
                if (rawResult.isError) {
                    result.error = JSON.stringify(rawResult.content);
                }
            } catch (err: any) {
                result = {
                    success: false,
                    error: err.message || String(err),
                    durationMs: Date.now() - start
                };
            }

            trace.unshift({ // Add to newest start
                toolName: toolCall.name,
                input: toolCall.arguments,
                output: result.output,
                error: result.error,
                durationMs: result.durationMs,
                timestamp: Date.now()
            });
            // Limit trace length (e.g. 100)
            if (trace.length > 100) trace.pop();

            return result;
        },

        getTrace() {
            return [...trace];
        }
    };
}
