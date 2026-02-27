/**
 * AudioWorklet: captures 20ms (960 samples @ 48kHz), outputs Int16 PCM + RMS.
 * No imports; runs in worklet scope.
 */
const FRAME_SIZE = 960; // 20ms @ 48kHz

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(FRAME_SIZE);
    this.offset = 0;
  }

  process(inputs, _outputs, _params) {
    const input = inputs[0]?.[0];
    if (!input || input.length === 0) return true;

    let inIdx = 0;
    while (inIdx < input.length) {
      const toCopy = Math.min(FRAME_SIZE - this.offset, input.length - inIdx);
      this.buffer.set(input.subarray(inIdx, inIdx + toCopy), this.offset);
      this.offset += toCopy;
      inIdx += toCopy;

      if (this.offset === FRAME_SIZE) {
        // Float32 -> Int16
        const pcm = new Int16Array(FRAME_SIZE);
        let sumSq = 0;
        for (let i = 0; i < FRAME_SIZE; i++) {
          const s = Math.max(-1, Math.min(1, this.buffer[i]));
          sumSq += s * s;
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const rms = Math.sqrt(sumSq / FRAME_SIZE);
        this.port.postMessage({ pcm: pcm.buffer, rms }, [pcm.buffer]);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("capture-processor", CaptureProcessor);
