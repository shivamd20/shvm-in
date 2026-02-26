import { useRef, useState, useCallback, useEffect } from "react";
import {
  createWaveformRing,
  pushBlock as pushBlockRing,
  type WaveformRing,
} from "./waveform-ring";

const SAMPLE_RATE = 48000;
const BUFFER_SIZE = 1024;

export type EchoStatus = "disconnected" | "connecting" | "connected" | "error";

function buildWsUrl(baseUrl: string, sessionId: string): string {
  const base = baseUrl.replace(/^http/, "ws");
  const path = base.endsWith("/") ? "" : "/";
  return `${base}${path}v2/ws/${sessionId}`;
}

export function useVani2Echo(serverBaseUrl?: string) {
  const baseUrl = serverBaseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");
  const [status, setStatus] = useState<EchoStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  isMutedRef.current = isMuted;

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>(`echo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  const incomingRef = useRef<WaveformRing>(createWaveformRing());
  const outgoingRef = useRef<WaveformRing>(createWaveformRing());
  const playbackQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const drainPlayback = useCallback(() => {
    const ctx = audioContextRef.current;
    const queue = playbackQueueRef.current;
    if (!ctx || queue.length === 0 || isPlayingRef.current) return;

    const buf = queue.shift()!;
    const float32 = new Float32Array(buf);
    pushBlockRing(outgoingRef.current, float32);

    const audioBuffer = ctx.createBuffer(1, float32.length, SAMPLE_RATE);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    isPlayingRef.current = true;
    source.onended = () => {
      isPlayingRef.current = false;
      drainPlayback();
    };
    source.start(0);
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();

      const url = buildWsUrl(baseUrl, sessionIdRef.current);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        setError(null);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === "string") {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "error") setError(msg.reason ?? "Unknown error");
          } catch {}
          return;
        }
        const pushBuf = (buf: ArrayBuffer) => {
          playbackQueueRef.current.push(buf);
          drainPlayback();
        };
        if (event.data instanceof ArrayBuffer) {
          pushBuf(event.data);
        } else {
          (event.data as Blob).arrayBuffer().then(pushBuf);
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        wsRef.current = null;
      };

      ws.onerror = () => {
        setStatus("error");
        setError("WebSocket error");
      };

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const samples = new Float32Array(input.length);
        samples.set(input);
        pushBlockRing(incomingRef.current, samples);
        if (!isMutedRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(samples.buffer);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus("error");
    }
  }, [baseUrl, drainPlayback]);

  useEffect(() => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "control.mute", value: isMuted }));
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => !m);
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      audioContextRef.current?.close();
    };
  }, []);

  return {
    status,
    error,
    isMuted,
    toggleMute,
    connect,
    incomingSamplesRef: incomingRef,
    outgoingSamplesRef: outgoingRef,
  };
}
