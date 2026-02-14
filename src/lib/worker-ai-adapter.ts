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
        const { messages } = options;

        const responseStream = await this.binding.run(this.model, {
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            stream: true
        });

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
            // If the buffer ends with newline, we get empty string at end which is fine.
            // If it doesn't, we keep the last part.
            // But split behavior: "a\nb".split("\n") -> ["a", "b"].
            // We want to process "a" and keep "b".
            const lastPart = lines.pop();
            buffer = lastPart !== undefined ? lastPart : "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data: ")) continue;

                const dataStr = trimmed.slice(6);
                if (dataStr === "[DONE]") continue;

                try {
                    const data = JSON.parse(dataStr);
                    const text = data.response; // Common for Llama models

                    if (text) {
                        yield {
                            type: 'text-delta',
                            text: text
                        } as any;
                    }
                } catch (e) {
                    console.error("Error parsing SSE JSON:", e);
                }
            }
        }
    }
    async structuredOutput(_options: any): Promise<any> {
        throw new Error("Not implemented in custom adapter");
    }
}
