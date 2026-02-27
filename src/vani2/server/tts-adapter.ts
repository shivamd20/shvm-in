/**
 * Vani 2 TTS adapter: Workers AI @cf/deepgram/aura-2-en.
 * Context-aware TTS; returns MPEG audio as ArrayBuffer.
 */
const AURA2_MODEL = "@cf/deepgram/aura-2-en";
const TTS_TIMEOUT_MS = 30_000;

export interface Aura2Options {
  text: string;
  speaker?: string;
}

/**
 * Generate speech for the given text. Returns MPEG audio or null on error.
 */
export async function runAura2(
  env: { AI: { run: (model: string, input: unknown) => Promise<unknown> } },
  options: Aura2Options
): Promise<ArrayBuffer | null> {
  const { text, speaker = "luna" } = options;
  if (!text?.trim()) return null;
  try {
    const result = await Promise.race([
      env.AI.run(AURA2_MODEL, { text: text.trim(), speaker }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TTS timed out")), TTS_TIMEOUT_MS)
      ),
    ]);
    // #region agent log
    const resType = result == null ? "null" : typeof result;
    const hasArrayBuffer = result && typeof (result as any).arrayBuffer === "function";
    const hasAudio = result && typeof (result as any).audio === "string";
    const hasBody = result && typeof (result as any).body === "object";
    const hasGetReader = result && typeof (result as any).getReader === "function";
    fetch("http://127.0.0.1:7291/ingest/e6cf2584-6d8a-4079-a59c-682c51786aee",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"0774b7"},body:JSON.stringify({sessionId:"0774b7",location:"tts-adapter.ts:result",message:"TTS result type",data:{resType,hasArrayBuffer,hasAudio,hasBody,hasGetReader,textLen:text.trim().length},hypothesisId:"H1",timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // Workers AI may return Response or { audio: base64 } or ReadableStream depending on model
    if (result && typeof (result as any).arrayBuffer === "function") {
      const buf = await (result as Response).arrayBuffer();
      // #region agent log
      fetch("http://127.0.0.1:7291/ingest/e6cf2584-6d8a-4079-a59c-682c51786aee",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"0774b7"},body:JSON.stringify({sessionId:"0774b7",location:"tts-adapter.ts:arrayBuffer",message:"TTS returned arrayBuffer",data:{byteLength:buf.byteLength},hypothesisId:"H1",timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return buf;
    }
    if (result && typeof (result as any).audio === "string") {
      const binaryString = atob((result as { audio: string }).audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      // #region agent log
      fetch("http://127.0.0.1:7291/ingest/e6cf2584-6d8a-4079-a59c-682c51786aee",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"0774b7"},body:JSON.stringify({sessionId:"0774b7",location:"tts-adapter.ts:audioBase64",message:"TTS returned audio base64",data:{byteLength:bytes.length},hypothesisId:"H1",timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return bytes.buffer;
    }
    // ReadableStream (e.g. body of Response or direct stream)
    if (result && typeof (result as any).getReader === "function") {
      const stream = result as ReadableStream<Uint8Array>;
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value), (total += value.length);
      }
      const out = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) out.set(c, off), (off += c.length);
      // #region agent log
      fetch("http://127.0.0.1:7291/ingest/e6cf2584-6d8a-4079-a59c-682c51786aee",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"0774b7"},body:JSON.stringify({sessionId:"0774b7",location:"tts-adapter.ts:stream",message:"TTS returned stream read",data:{byteLength:out.byteLength},hypothesisId:"H1",timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return out.buffer;
    }
    if (result && typeof (result as any).body === "object" && (result as Response).body != null) {
      const buf = await new Response((result as Response).body).arrayBuffer();
      // #region agent log
      fetch("http://127.0.0.1:7291/ingest/e6cf2584-6d8a-4079-a59c-682c51786aee",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"0774b7"},body:JSON.stringify({sessionId:"0774b7",location:"tts-adapter.ts:body",message:"TTS returned body stream",data:{byteLength:buf.byteLength},hypothesisId:"H1",timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return buf;
    }
    // #region agent log
    fetch("http://127.0.0.1:7291/ingest/e6cf2584-6d8a-4079-a59c-682c51786aee",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"0774b7"},body:JSON.stringify({sessionId:"0774b7",location:"tts-adapter.ts:null",message:"TTS result unhandled, returning null",data:{},hypothesisId:"H1",timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return null;
  } catch (e) {
    console.error("[TTS] Aura-2 error:", e);
    return null;
  }
}
