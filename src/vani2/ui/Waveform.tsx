import { useEffect, useMemo, useRef } from "react";
import { copyTo, type WaveformRing } from "./waveform-ring";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function withAlpha(rgb: string, a: number) {
  const parts = rgb.trim().split(/\s+/).map((p) => Number(p));
  const [r, g, b] = parts.length >= 3 ? parts.map(Number) : [255, 255, 255];
  const alpha = clamp01(a);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return `rgba(255, 255, 255, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const RING_SIZE = 2048;

export function Waveform({
  active,
  samplesRef,
  color,
  className,
}: {
  active: boolean;
  samplesRef: React.RefObject<WaveformRing | null>;
  color: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const samples = useMemo(() => new Float32Array(RING_SIZE), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = new ResizeObserver(resize);
    resizeObserverRef.current.observe(canvas);

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawFrame = () => {
      rafRef.current = requestAnimationFrame(drawFrame);
      const { width, height } = canvas.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      ctx.clearRect(0, 0, width, height);

      const ring = samplesRef.current;
      let hasData = false;
      if (ring) {
        copyTo(ring, samples);
        for (let i = 0; i < samples.length; i++) {
          if (samples[i] !== 0) {
            hasData = true;
            break;
          }
        }
      }

      const midY = height / 2;
      const amplitude = height * 0.34;

      ctx.strokeStyle = withAlpha(color, active ? 0.35 : 0.18);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();

      if (!active || !hasData) return;

      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, withAlpha(color, 0.25));
      grad.addColorStop(0.5, withAlpha(color, 0.9));
      grad.addColorStop(1, withAlpha(color, 0.25));

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = withAlpha(color, 0.85);
      ctx.shadowBlur = 18;
      ctx.beginPath();
      for (let i = 0; i < samples.length; i += 1) {
        const x = (i / (samples.length - 1)) * width;
        const y = midY + samples[i] * amplitude;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = withAlpha(color, 0.9);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (let i = 0; i < samples.length; i += 2) {
        const x = (i / (samples.length - 1)) * width;
        const y = midY + samples[i] * amplitude;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    if (active) {
      rafRef.current = requestAnimationFrame(drawFrame);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      };
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [active, samplesRef, color, samples]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
