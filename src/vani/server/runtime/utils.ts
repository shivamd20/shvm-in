import { STT_MODELS, TTS_MODELS } from "@shvm/vani-client/shared";
import type { VoiceConfig } from "@shvm/vani-client/shared";
import { STT_TIMEOUT_MS, TTS_TIMEOUT_MS } from "./constants";

export const withTimeout = <T>(promise: Promise<T>, ms: number, errorMessage = "Operation timed out"): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(errorMessage)), ms);
        promise.then(
            (val) => { clearTimeout(timer); resolve(val); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
};

export async function runSTT(audioBuffer: Uint8Array[], env: any, model?: string): Promise<string> {
    if (audioBuffer.length === 0) return "";

    const totalLength = audioBuffer.reduce((acc, chunk) => acc + chunk.length, 0);
    console.log(`[STT] Processing audio buffer of length: ${totalLength}`);

    if (totalLength === 0) return "";

    const fullAudio = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioBuffer) {
        fullAudio.set(chunk, offset);
        offset += chunk.length;
    }

    try {
        const Model = model || STT_MODELS[0];
        console.log(`[STT] Invoking env.AI.run(${Model})`);

        // @ts-ignore
        const response = await withTimeout(
            env.AI.run(Model, { audio: [...fullAudio] }),
            STT_TIMEOUT_MS,
            "STT timed out"
        );
        console.log(`[STT] Response received:`, JSON.stringify(response));

        // @ts-ignore
        const text = response.text || "";
        return text.trim();
    } catch (e: any) {
        console.error("[STT] Error during AI run:", e);
        throw e; // Re-throw to be caught by actor
    }
}

export async function runTTS(text: string, env: any, config?: VoiceConfig['tts']): Promise<ArrayBuffer | null> {
    try {
        // Default to a specific model that is known to work
        const MODEL = config?.model || TTS_MODELS[0];

        // Options construction
        const options: any = {
            text: text // Default for standard models
        };

        // Deepgram specific handling
        if (MODEL.includes('deepgram') || MODEL.includes('aura')) {
            options.text = text;
        }

        if (config?.speaker) options.speaker = config.speaker;
        if (config?.sample_rate) options.sample_rate = config.sample_rate;
        if (config?.encoding) options.encoding = config.encoding;

        console.log(`[TTS] Generating with ${MODEL}`, JSON.stringify(options));

        // @ts-ignore
        const ttsResponse = await withTimeout(
            env.AI.run(MODEL, options),
            TTS_TIMEOUT_MS,
            "TTS timed out"
        );

        // @ts-ignore
        if (ttsResponse.audio) {
            // JSON response with base64
            // @ts-ignore
            const binaryString = atob(ttsResponse.audio);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
        } else {
            // Stream response
            // @ts-ignore
            return await new Response(ttsResponse).arrayBuffer();
        }
    } catch (e) {
        console.error("TTS Error", e);
        return null;
    }
}
