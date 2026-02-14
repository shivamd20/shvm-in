import { TextAdapter, StreamChunk, TextOptions } from "@tanstack/ai";

export class CustomWorkersAiAdapter implements TextAdapter<string, any, any, any> {
    kind: "text" = "text";
    name = "custom-workers-ai";
    model: string;
    binding: any;

    // @ts-ignore
    '~types': {
        model: string;
        input: any;
        config: any;
        result: any;
        providerOptions: any;
        inputModalities: any;
        messageMetadataByModality: any;
    };

    constructor(model: string, binding: any) {
        this.model = model;
        this.binding = binding;
        // @ts-ignore
        this['~types'] = {};
    }

    async *chatStream(options: TextOptions<any>): AsyncIterable<StreamChunk> {
        const { messages, tools } = options;

        const runOptions: any = {
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            stream: true
        };

        if (tools && tools.length > 0) {
            runOptions.tools = tools.map((t: any) => ({
                name: t.name,
                description: t.description,
                parameters: t.inputSchema
            }));
        }

        const responseStream = await this.binding.run(this.model, runOptions);

        if (!responseStream) {
            console.error("[CustomAdapter] No response stream returned from binding");
            throw new Error("No response stream");
        }

        // @ts-ignore
        const reader = responseStream.getReader();
        const decoder = new TextDecoder();

        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            const lines = buffer.split("\n");
            // Keep the last part in buffer
            const lastPart = lines.pop();
            buffer = lastPart !== undefined ? lastPart : "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (!trimmed.startsWith("data: ")) continue;

                const dataStr = trimmed.slice(6);
                if (dataStr === "[DONE]") continue;

                try {
                    const data = JSON.parse(dataStr);

                    // Handle Tool Calls (Llama 3 style)
                    if (data.tool_calls) {
                        for (const tc of data.tool_calls) {
                            const toolCallId = tc.id || `call_${Math.random().toString(36).substring(7)}`;
                            yield {
                                type: 'tool-call-start',
                                toolCallId,
                                toolName: tc.name
                            } as any;
                            yield {
                                type: 'tool-call-args',
                                toolCallId,
                                args: JSON.stringify(tc.arguments)
                            } as any;
                            yield {
                                type: 'tool-call-end',
                                toolCallId
                            } as any;
                        }
                    }
                    // Handle Text Response
                    else if (data.response) {
                        yield {
                            type: 'text-delta',
                            text: data.response
                        } as any;
                    }
                } catch (e) {
                    console.error("[CustomAdapter] Error parsing SSE JSON:", e);
                }
            }
        }
    }

    async structuredOutput(_options: any): Promise<any> {
        throw new Error("Not implemented in custom adapter");
    }
}
