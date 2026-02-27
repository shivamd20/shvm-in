/**
 * Vani 2 session WebSocket: transcript_final, LLM stream, TTS audio playback, interrupt.
 */
import { useRef, useState, useCallback, useEffect } from "react";
import { isBenchmarkEvent } from "../protocol";
import { benchmarkStore } from "./benchmark-store";

function buildSessionWsUrl(baseUrl: string, sessionId: string): string {
  const base = baseUrl.replace(/^http/, "ws");
  const path = base.endsWith("/") ? "" : "/";
  return `${base}${path}v2/ws/${sessionId}`;
}

export type SessionStatus = "disconnected" | "connecting" | "connected" | "error";

/** Server "still working" status (idea 7). */
export type ServerStatus = "thinking" | "synthesizing" | null;

export function useVani2Session(serverBaseUrl?: string, sessionId?: string) {
  const baseUrl = serverBaseUrl ?? (typeof window !== "undefined" ? window.location.origin : "");
  const sessionIdVal = sessionId ?? (typeof window !== "undefined" ? `v2-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : "v2-session");
  const [status, setStatus] = useState<SessionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus>(null);
  const [llmText, setLlmText] = useState("");
  const [llmCompleteText, setLlmCompleteText] = useState<string | null>(null);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [assistantHistory, setAssistantHistory] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const drainPlayback = useCallback(() => {
    const ctx = audioContextRef.current;
    const queue = playbackQueueRef.current;
    if (!ctx || isPlayingRef.current || queue.length === 0) return;
    const buffer = queue.shift()!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    currentSourceRef.current = source;
    isPlayingRef.current = true;
    setIsPlaying(true);
    source.onended = () => {
      isPlayingRef.current = false;
      currentSourceRef.current = null;
      setIsPlaying(false);
      drainPlayback();
    };
    source.start(0);
  }, []);

  const stopPlayback = useCallback(() => {
    const src = currentSourceRef.current;
    if (src) {
      try {
        src.stop();
      } catch {}
      currentSourceRef.current = null;
    }
    isPlayingRef.current = false;
    playbackQueueRef.current = [];
    setIsPlaying(false);
  }, []);

  const connect = useCallback(() => {
    setError(null);
    setLlmError(null);
    setServerStatus(null);
    setStatus("connecting");
    const url = buildSessionWsUrl(baseUrl, sessionIdVal);
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => {
      setStatus("connected");
      setError(null);
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
        audioContextRef.current.resume?.();
      }
    };
    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data) as { type: string; text?: string; reason?: string; value?: string };
          if (isBenchmarkEvent(msg)) {
            benchmarkStore.push(sessionIdVal, msg);
            return;
          }
          if (msg.type === "error" && typeof msg.reason === "string") {
            setError(msg.reason);
            console.error("[Vani2Session] Server error:", msg.reason);
            return;
          }
          if (msg.type === "status" && (msg.value === "thinking" || msg.value === "synthesizing")) {
            setServerStatus(msg.value);
            return;
          }
          if (msg.type === "llm_partial" && typeof msg.text === "string") {
            setServerStatus(null);
            setLlmText((prev) => prev + msg.text);
          }
          if (msg.type === "llm_complete" && typeof msg.text === "string") {
            setLlmCompleteText(msg.text);
            setAssistantHistory((prev) => [msg.text!, ...prev].slice(0, 20));
            setLlmText("");
            setServerStatus(null);
          }
          if (msg.type === "llm_error" && typeof msg.reason === "string") {
            setLlmError(msg.reason);
            setLlmText("");
            setServerStatus(null);
            console.error("[Vani2Session] LLM error:", msg.reason);
          }
        } catch (parseErr) {
          console.error("[Vani2Session] Failed to parse server message", parseErr instanceof Error ? parseErr.stack : parseErr);
          setError("Invalid server message");
        }
        return;
      }
      const data = event.data as ArrayBuffer | Blob;
      const getArrayBuffer = (): Promise<ArrayBuffer> =>
        data instanceof ArrayBuffer ? Promise.resolve(data) : (data as Blob).arrayBuffer();
      getArrayBuffer().then((ab) => {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        const ctx = audioContextRef.current;
        ctx.decodeAudioData(ab).then(
          (buffer) => {
            playbackQueueRef.current.push(buffer);
            drainPlayback();
          },
          (decodeErr) => {
            console.error("[Vani2Session] Audio decode failed", decodeErr instanceof Error ? decodeErr.stack : decodeErr);
            setError("Audio playback failed (decode error)");
          }
        );
      }).catch((e) => {
        console.error("[Vani2Session] Failed to read audio data", e instanceof Error ? e.stack : e);
        setError("Audio playback failed");
      });
    };
    ws.onclose = (ev: CloseEvent) => {
      setStatus("disconnected");
      wsRef.current = null;
      stopPlayback();
      if (ev.code !== 1000 && ev.code !== 1001 && ev.reason) {
        const reason = `Session closed: ${ev.code}${ev.reason ? " — " + ev.reason : ""}`;
        setError(reason);
        console.warn("[Vani2Session]", reason);
      }
    };
    ws.onerror = (ev) => {
      setStatus("error");
      const errMsg = "Session WebSocket error";
      setError(errMsg);
      console.error("[Vani2Session] WebSocket error", ev);
    };
  }, [baseUrl, sessionIdVal, drainPlayback, stopPlayback]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    stopPlayback();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setStatus("disconnected");
    setError(null);
    setServerStatus(null);
    setLlmText("");
    setLlmCompleteText(null);
    setLlmError(null);
  }, [stopPlayback]);

  const sendTranscriptFinal = useCallback((text: string, turnId?: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[Vani2Session] sendTranscriptFinal ignored: not connected");
      return;
    }
    setLlmText("");
    setLlmCompleteText(null);
    setLlmError(null);
    try {
      ws.send(JSON.stringify({ type: "transcript_final", text, ...(turnId != null ? { turnId } : {}) }));
    } catch (e) {
      console.error("[Vani2Session] sendTranscriptFinal failed", e instanceof Error ? e.stack : e);
      setError("Failed to send transcript");
    }
  }, []);

  const sendTranscriptSpeculative = useCallback((text: string, turnId?: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !text.trim()) return;
    try {
      ws.send(JSON.stringify({ type: "transcript_speculative", text: text.trim(), ...(turnId != null ? { turnId } : {}) }));
    } catch (e) {
      console.error("[Vani2Session] sendTranscriptSpeculative failed", e instanceof Error ? e.stack : e);
    }
  }, []);

  const sendInterrupt = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    stopPlayback();
    try {
      ws.send(JSON.stringify({ type: "control.interrupt" }));
    } catch (e) {
      console.error("[Vani2Session] sendInterrupt failed", e instanceof Error ? e.stack : e);
    }
  }, [stopPlayback]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    status,
    error,
    serverStatus,
    connect,
    disconnect,
    sendTranscriptFinal,
    sendTranscriptSpeculative,
    sendInterrupt,
    llmText,
    llmCompleteText,
    llmError,
    assistantHistory,
    isPlaying,
    sessionId: sessionIdVal,
  };
}
