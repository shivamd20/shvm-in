/**
 * Vani2 session lifecycle machine: connected | streaming | closed.
 * Handles binary audio (echo path) and cleanup. Turn pipeline (LLM/TTS) stays in the DO.
 */
import { setup } from "xstate";

export type SessionLifecycleState = "connected" | "streaming" | "closed";

export interface SessionMachineInput {
  sessionState: { get(): SessionLifecycleState; setStreaming(): void; setClosed(): void };
  ringBuffer: { push(chunk: ArrayBuffer): void; takeAll(): ArrayBuffer[] };
  echoEngine: { push(chunk: ArrayBuffer): void; flush(): void };
  cleanup: () => void;
}

export const sessionMachine = setup({
  types: {
    context: {} as SessionMachineInput,
    events: {} as
      | { type: "BINARY"; chunk: ArrayBuffer }
      | { type: "CLOSE" }
      | { type: "ERROR"; error?: unknown },
    input: {} as SessionMachineInput,
  },
  actions: {
    pushAudioAndEcho: ({ context, event }) => {
      if (event.type !== "BINARY") return;
      context.sessionState.setStreaming();
      context.ringBuffer.push(event.chunk);
      const chunks = context.ringBuffer.takeAll();
      for (const c of chunks) context.echoEngine.push(c);
    },
    doCleanup: ({ context }) => {
      context.cleanup();
    },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "connected",
  states: {
    connected: {
      on: {
        BINARY: { target: "streaming", actions: "pushAudioAndEcho" },
        CLOSE: "closed",
        ERROR: "closed",
      },
    },
    streaming: {
      on: {
        BINARY: { actions: "pushAudioAndEcho" },
        CLOSE: "closed",
        ERROR: "closed",
      },
    },
    closed: {
      type: "final",
      entry: "doCleanup",
    },
  },
});
