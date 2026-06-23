import { Music2 } from "lucide-react";

interface Props {
  base64: string | null;
}

export function AlbumArt({ base64 }: Props) {
  if (base64) {
    return (
      <img
        src={`data:image/jpeg;base64,${base64}`}
        alt="Album art"
        className="w-10 h-10 rounded-[8px] object-cover flex-shrink-0"
      />
    );
  }

  return (
    <div className="w-10 h-10 rounded-[8px] bg-[#1a1a1f] flex items-center justify-center flex-shrink-0">
      <Music2 size={20} className="text-white/40" />
    </div>
  );
}
