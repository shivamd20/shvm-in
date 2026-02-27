/**
 * Vani 2 minimal headless hook: plug in system prompt, start/mute/stop. No pause.
 *
 * Usage: provide systemPrompt and optional options; call start() to begin. Vani handles
 * listening (Flux STT) and talking (LLM + TTS). Use mute() to mute the microphone and
 * stop() to end the session. The hook sends interrupt automatically when the user
 * starts speaking while the assistant is speaking ("turn already in progress" is handled).
 *
 * Microphone permission and AudioContext: the browser may prompt for microphone access on start().
 * When the tab becomes visible again, the underlying transcription hook resumes the AudioContext
 * if it was suspended (e.g. after backgrounding the tab).
 */
import { useRef, useState, useCallback, useEffect } from "react";
import { useVani2Session } from "./useVani2Session";
import { useVani2Transcription } from "./useVani2Transcription";
import type { VaniStatus, VaniSession, VaniActions } from "../client/types";

function deriveStatus(
  sessionStatus: string,
  transcriptionStatus: string
): VaniStatus {
  if (sessionStatus === "error" || transcriptionStatus === "error") return "error";
  if (sessionStatus === "connecting" || transcriptionStatus === "connecting")
    return "connecting";
  if (sessionStatus === "connected" && transcriptionStatus === "connected")
    return "connected";
  if (sessionStatus === "disconnected" && transcriptionStatus === "disconnected")
    return "idle";
  return "connecting";
}

export interface UseVaniOptions {
  serverBaseUrl?: string;
  sessionId?: string;
}

export interface UseVaniResult extends VaniSession, VaniActions {
  status: VaniStatus;
  error: string | null;
  /** "thinking" | "synthesizing" when assistant is working; null otherwise. */
  serverStatus: "thinking" | "synthesizing" | null;
  /** Assistant is currently playing TTS. */
  isPlaying: boolean;
  /** Current partial LLM response (streaming). */
  llmText: string;
  /** Last complete assistant reply (for minimal transcript UI). */
  llmCompleteText: string | null;
  /** Live user transcript (STT). */
  liveTranscript: string;
}

/**
 * Headless hook for Vani 2: system prompt + start, mute, stop (no pause).
 *
 * @param systemPrompt - Instructs the assistant. Sent on connect and after reconnection.
 * @param options - Optional serverBaseUrl and sessionId (join existing session).
 * @returns status, error, sessionId, start, stop, mute
 */
export function useVani(
  systemPrompt: string,
  options?: UseVaniOptions
): UseVaniResult {
  const serverBaseUrl = options?.serverBaseUrl;
  const sessionIdOpt = options?.sessionId;
  const generatedIdRef = useRef<string | null>(null);
  const resolvedSessionId =
    sessionIdOpt ??
    (generatedIdRef.current ??=
      typeof window !== "undefined"
        ? `v2-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        : "v2-session");

  const {
    status: sessionStatus,
    error: sessionError,
    serverStatus,
    connect: connectSession,
    disconnect: disconnectSession,
    sendTranscriptFinal,
    sendInterrupt,
    sendMute,
    llmText,
    llmCompleteText,
    isPlaying,
  } = useVani2Session(serverBaseUrl, resolvedSessionId, systemPrompt);

  const {
    status: transcriptionStatus,
    error: transcriptionError,
    connect: connectTranscription,
    disconnect: disconnectTranscription,
    lastEvent,
    liveTranscript,
  } = useVani2Transcription(serverBaseUrl, resolvedSessionId);

  const lastSentTranscriptRef = useRef<string | null>(null);
  const turnIdRef = useRef(0);

  const status: VaniStatus = deriveStatus(sessionStatus, transcriptionStatus);
  const error = sessionError ?? transcriptionError;

  useEffect(() => {
    if (lastEvent?.type === "StartOfTurn" || lastEvent?.type === "TurnResumed") {
      turnIdRef.current += 1;
    }
  }, [lastEvent?.type]);

  useEffect(() => {
    if (lastEvent?.type !== "EndOfTurn" || !lastEvent.payload.transcript) return;
    const t = lastEvent.payload.transcript.trim();
    if (!t || t === lastSentTranscriptRef.current) return;
    lastSentTranscriptRef.current = t;
    if (llmText || isPlaying) sendInterrupt();
    sendTranscriptFinal(t, String(turnIdRef.current));
  }, [lastEvent, sendTranscriptFinal, sendInterrupt, llmText, isPlaying]);

  useEffect(() => {
    if (lastEvent?.type !== "StartOfTurn" && lastEvent?.type !== "TurnResumed") return;
    if (llmText || isPlaying) sendInterrupt();
  }, [lastEvent?.type, lastEvent?.payload, llmText, isPlaying, sendInterrupt]);

  const start = useCallback(() => {
    if (sessionStatus === "connected" && transcriptionStatus === "connected") return;
    connectSession();
    connectTranscription();
  }, [sessionStatus, transcriptionStatus, connectSession, connectTranscription]);

  const stop = useCallback(() => {
    if (sessionStatus === "disconnected" && transcriptionStatus === "disconnected") return;
    disconnectTranscription();
    disconnectSession();
    lastSentTranscriptRef.current = null;
  }, [sessionStatus, transcriptionStatus, disconnectSession, disconnectTranscription]);

  const mute = useCallback(
    (muted: boolean) => {
      sendMute(muted);
    },
    [sendMute]
  );

  return {
    status,
    error,
    sessionId: resolvedSessionId,
    start,
    stop,
    mute,
    serverStatus,
    isPlaying,
    llmText,
    llmCompleteText,
    liveTranscript,
  };
}
