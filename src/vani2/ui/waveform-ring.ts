/**
 * Fixed-size ring buffer for waveform samples (Float32).
 * Hook writes; Waveform reads on RAF.
 */
const SIZE = 2048;

export interface WaveformRing {
  ring: Float32Array;
  writeIndex: number;
}

export function createWaveformRing(): WaveformRing {
  return {
    ring: new Float32Array(SIZE),
    writeIndex: 0,
  };
}

/** Push a single sample (e.g. RMS). */
export function pushSample(r: WaveformRing, value: number): void {
  r.ring[r.writeIndex % SIZE] = value;
  r.writeIndex = (r.writeIndex + 1) % SIZE;
}

/** Push a block of samples (e.g. from PCM); downsample by taking every nth or RMS. */
export function pushBlock(r: WaveformRing, samples: Float32Array): void {
  if (samples.length === 0) return;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += Math.abs(samples[i]);
  const rms = Math.sqrt(sum / samples.length);
  pushSample(r, rms);
}

/** Copy latest SIZE samples into out (oldest to newest). Used by canvas. */
export function copyTo(r: WaveformRing, out: Float32Array): void {
  const n = Math.min(SIZE, out.length);
  const wi = r.writeIndex;
  for (let i = 0; i < n; i++) {
    out[i] = r.ring[(wi + i) % SIZE];
  }
}
