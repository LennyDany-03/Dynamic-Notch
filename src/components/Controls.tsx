import { SkipBack, Play, Pause, SkipForward } from "lucide-react";

interface Props {
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function ControlButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-white/80 hover:text-white"
    >
      {children}
    </button>
  );
}

export function Controls({ isPlaying, onPlayPause, onPrev, onNext }: Props) {
  return (
    <div className="flex items-center gap-4 flex-shrink-0">
      <ControlButton onClick={onPrev}>
        <SkipBack size={16} />
      </ControlButton>
      <ControlButton onClick={onPlayPause}>
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </ControlButton>
      <ControlButton onClick={onNext}>
        <SkipForward size={16} />
      </ControlButton>
    </div>
  );
}
