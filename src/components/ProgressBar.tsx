import { useRef, useState } from "react";

interface Props {
  progressMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
}

export function ProgressBar({ progressMs, durationMs, onSeek }: Props) {
  const [hovered, setHovered] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const percent = durationMs > 0 ? Math.min((progressMs / durationMs) * 100, 100) : 0;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || durationMs === 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.round(ratio * durationMs));
  };

  return (
    <div
      ref={barRef}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute bottom-[6px] left-3 right-3 h-[2px] bg-white/[0.12] rounded-full cursor-pointer group"
    >
      <div
        className="absolute inset-y-0 left-0 bg-[#a78bfa] rounded-full"
        style={{ width: `${percent}%` }}
      />
      {hovered && (
        <div
          className="absolute top-1/2 -translate-y-1/2 w-[6px] h-[6px] rounded-full bg-[#a78bfa] -translate-x-1/2"
          style={{ left: `${percent}%` }}
        />
      )}
    </div>
  );
}
