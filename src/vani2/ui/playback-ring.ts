/**
 * Bounded ring buffer for playback frames (200ms cap, drop oldest when full).
 * Each frame is an ArrayBuffer (e.g. Int16 PCM 960 samples = 1920 bytes).
 */
const FRAME_MS = 20;
const MAX_MS = 200;
const MAX_FRAMES = Math.ceil(MAX_MS / FRAME_MS); // 10

export interface PlaybackRing {
  frames: ArrayBuffer[];
  maxFrames: number;
}

export function createPlaybackRing(): PlaybackRing {
  return {
    frames: [],
    maxFrames: MAX_FRAMES,
  };
}

/** Push a frame; if full, drop oldest then push. */
export function pushFrame(ring: PlaybackRing, frame: ArrayBuffer): void {
  if (ring.frames.length >= ring.maxFrames) {
    ring.frames.shift();
  }
  ring.frames.push(frame);
}

/** Take oldest frame, or null if empty. */
export function takeFrame(ring: PlaybackRing): ArrayBuffer | null {
  return ring.frames.shift() ?? null;
}

/** Current buffered duration in ms (approximate). */
export function bufferedMs(ring: PlaybackRing): number {
  return ring.frames.length * FRAME_MS;
}

/** Hard cap: drop oldest until buffered <= 200ms (already enforced by maxFrames). */
export function enforceCap(ring: PlaybackRing): void {
  while (ring.frames.length > ring.maxFrames) {
    ring.frames.shift();
  }
}
