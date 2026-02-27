import { useRef, useState, useCallback, useEffect } from "react";
import {
  createWaveformRing,
  pushSample as pushSampleRing,
  pushBlock as pushBlockRing,
  type WaveformRing,
} from "./waveform-ring";
import {
  createPlaybackRing,
  pushFrame as pushFramePlayback,
  takeFrame as takeFramePlayback,
  type PlaybackRing,
} from "./playback-ring";
import { encodeAudioFrame, decodeAudioFrame, PAYLOAD_TYPE_PCM, PAYLOAD_TYPE_OPUS } from "../protocol";
import { OpusDecoder } from "opus-decoder";
import { OpusEncoder, OpusApplication } from "@minceraftmc/opus-encoder";

const SAMPLE_RATE = 48000;

const SEND_GUARD_HIGH_BYTES = 256 * 1024;
const SEND_GUARD_PAUSE_BYTES = 128 * 1024;

export type EchoStatus = "disconnected" | "connecting" | "connected" | "error";

function buildWsUrl(baseUrl: string, sessionId: string): string {
  const base = baseUrl.replace(/^http/, "ws");
  const path = base.endsWith("/") ? "" : "/";
  return `${base}${path}v2/ws/${sessionId}`;
}

function int16ToFloat32(int16: ArrayBuffer): Float32Array {
  const view = new Int16Array(int16);
  const out = new Float32Array(view.length);
  for (let i = 0; i < view.length; i++) {
    out[i] = view[i] / (view[i] < 0 ? 0x8000 : 0x7fff);
  }
  return out;
}

function float32ToInt16(float32: Float32Array): ArrayBuffer {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out.buffer;
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
  const playbackRingRef = useRef<PlaybackRing>(createPlaybackRing());
  const isPlayingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const opusDecoderRef = useRef<OpusDecoder | null>(null);
  const opusEncoderRef = useRef<InstanceType<typeof OpusEncoder> | null>(null);

  const drainPlayback = useCallback(() => {
    const ctx = audioContextRef.current;
    const ring = playbackRingRef.current;
    if (!ctx || isPlayingRef.current) return;

    const frame = takeFramePlayback(ring);
    if (!frame) return;

    const float32 = int16ToFloat32(frame);
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
      const opusDecoder = new OpusDecoder();
      await opusDecoder.ready;
      opusDecoderRef.current = opusDecoder;

      const opusEncoder = new OpusEncoder({
        sampleRate: 48000,
        application: OpusApplication.RESTRICTED_LOWDELAY,
      });
      await opusEncoder.ready;
      opusEncoderRef.current = opusEncoder;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();

      const workletUrl = new URL("./capture-worklet.js", import.meta.url).href;
      await ctx.audioWorklet.addModule(workletUrl);

      const url = buildWsUrl(baseUrl, sessionIdRef.current);
      if (typeof console !== "undefined" && console.debug) {
        console.debug("[Echo] Connecting to", url, "(baseUrl:", baseUrl + ")");
      }
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (typeof console !== "undefined" && console.debug) {
          console.debug("[Echo] Connected", url);
        }
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
        const pushBuf = async (buf: ArrayBuffer) => {
          const decoded = decodeAudioFrame(buf);
          if (!decoded) {
            pushFramePlayback(playbackRingRef.current, buf);
            drainPlayback();
            return;
          }
          if (decoded.payloadType === PAYLOAD_TYPE_OPUS && opusDecoderRef.current) {
            try {
              const { channelData, samplesDecoded } = opusDecoderRef.current.decodeFrame(decoded.payload);
              if (samplesDecoded > 0 && channelData[0]) {
                const pcm = float32ToInt16(channelData[0]);
                pushFramePlayback(playbackRingRef.current, pcm);
              }
            } catch {
              // On decode error, skip frame
            }
          } else {
            const ab = decoded.payload.buffer.slice(
              decoded.payload.byteOffset,
              decoded.payload.byteOffset + decoded.payload.byteLength
            ) as ArrayBuffer;
            pushFramePlayback(playbackRingRef.current, ab);
          }
          drainPlayback();
        };
        if (event.data instanceof ArrayBuffer) {
          pushBuf(event.data);
        } else {
          (event.data as Blob).arrayBuffer().then(pushBuf);
        }
      };

      ws.onclose = (ev: CloseEvent) => {
        if (typeof console !== "undefined" && console.debug) {
          console.debug("[Echo] Closed", url, "code:", ev.code, "reason:", ev.reason || "(none)");
        }
        setStatus("disconnected");
        wsRef.current = null;
        if (ev.code !== 1000 && !ev.wasClean) {
          setError(`WebSocket closed (${ev.code}${ev.reason ? ": " + ev.reason : ""}).`);
        }
      };

      ws.onerror = () => {
        if (typeof console !== "undefined" && console.debug) {
          console.debug("[Echo] Error", url);
        }
        setStatus("error");
        setError("WebSocket error");
      };

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const workletNode = new AudioWorkletNode(ctx, "capture-processor");
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (e: MessageEvent) => {
        const { pcm, rms } = e.data as { pcm: ArrayBuffer; rms: number };
        pushSampleRing(incomingRef.current, rms);

        if (isMutedRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          return;
        }
        const buffered = wsRef.current.bufferedAmount;
        if (buffered > SEND_GUARD_HIGH_BYTES) return;
        if (buffered > SEND_GUARD_PAUSE_BYTES) return;
        const encoder = opusEncoderRef.current;
        if (encoder) {
          const float32 = int16ToFloat32(pcm);
          const opusPayload = encoder.encodeFrame(float32);
          const frame = encodeAudioFrame(Date.now(), opusPayload, PAYLOAD_TYPE_OPUS);
          wsRef.current.send(frame);
        } else {
          const frame = encodeAudioFrame(Date.now(), new Uint8Array(pcm), PAYLOAD_TYPE_PCM);
          wsRef.current.send(frame);
        }
      };

      source.connect(workletNode);
      workletNode.connect(ctx.destination);
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
      workletNodeRef.current?.disconnect();
      sourceRef.current?.disconnect();
      audioContextRef.current?.close();
      opusDecoderRef.current?.free();
      opusDecoderRef.current = null;
      opusEncoderRef.current?.free();
      opusEncoderRef.current = null;
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
