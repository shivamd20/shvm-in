/**
 * STT adapter: returns a Flux WebSocket upgrade Response for live transcription.
 * Used by the /v2/flux/:sessionId route. No Durable Object; client talks directly to Flux.
 *
 * Note: Flux (Deepgram) closes the WebSocket after ~10s with no data (1006). The client
 * must send a keep-alive (e.g. 20ms silence frame every ~4s) when the mic is silent.
 */

const FLUX_MODEL = "@cf/deepgram/flux";

export interface FluxRunInput {
  encoding: "linear16";
  sample_rate: string;
  eager_eot_threshold?: string;
  eot_threshold?: string;
  eot_timeout_ms?: string;
}

const DEFAULT_FLUX_INPUT: FluxRunInput = {
  encoding: "linear16",
  sample_rate: "16000",
  eager_eot_threshold: "0.5",
  eot_threshold: "0.6",
  eot_timeout_ms: "1200",
};

/**
 * Returns the Response from Workers AI Flux WebSocket upgrade.
 * Caller must use this as the response to a WebSocket upgrade request.
 */
export function getFluxWebSocketResponse(
  env: { AI: { run: (model: string, input: FluxRunInput, options?: { websocket?: boolean }) => Promise<Response> } },
  input: Partial<FluxRunInput> = {}
): Promise<Response> {
  const options = { ...DEFAULT_FLUX_INPUT, ...input };
  return env.AI.run(FLUX_MODEL, options, { websocket: true });
}
