/**
 * Simple concentric-rings visualization for the homepage Vani.
 * Status is shown only by ring color and subtle motion (no overlay text).
 */

export type HomeVizStatus =
  | "idle"
  | "connecting"
  | "thinking"
  | "assistant_speaking"
  | "listening"
  | "error";

const STATUS_COLORS: Record<HomeVizStatus, string> = {
  idle: "rgba(161, 161, 170, 0.35)",
  connecting: "rgba(255, 107, 43, 0.6)",
  thinking: "rgba(99, 102, 241, 0.5)",
  assistant_speaking: "rgba(255, 107, 43, 0.65)",
  listening: "rgba(34, 197, 94, 0.5)",
  error: "rgba(239, 68, 68, 0.5)",
};

export interface HomeAudioVizProps {
  status: HomeVizStatus;
  className?: string;
}

const RING_COUNT = 3;

export function HomeAudioViz({ status, className = "" }: HomeAudioVizProps) {
  const color = STATUS_COLORS[status];
  const isActive = status !== "idle" && status !== "error";
  const pulse = status === "connecting" || status === "listening";

  return (
    <div
      className={`flex items-center justify-center pointer-events-none ${className}`}
      aria-hidden
    >
      <div
        className="relative rounded-full border-2 transition-colors duration-500 flex items-center justify-center"
        style={{
          width: "min(60vmin, 280px)",
          height: "min(60vmin, 280px)",
          borderColor: color,
          boxShadow: isActive ? `0 0 40px ${color}` : "none",
          animation: pulse ? "home-ring-pulse 2s ease-in-out infinite" : "none",
        }}
      >
        {Array.from({ length: RING_COUNT - 1 }, (_, i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full border transition-colors duration-500"
            style={{
              borderColor: color,
              opacity: 0.35 - i * 0.08,
              transform: `scale(${0.4 + (i + 1) * 0.25})`,
              animation: isActive ? `home-ring-breathe 3s ease-in-out infinite` : "none",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
