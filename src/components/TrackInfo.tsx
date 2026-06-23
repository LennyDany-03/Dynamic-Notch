interface Props {
  title: string;
  artist: string;
}

export function TrackInfo({ title, artist }: Props) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0 flex-1 px-3">
      <p className="text-[13px] font-medium text-white truncate max-w-[180px]">
        {title || "Nothing playing"}
      </p>
      <p className="text-[11px] text-[#888899] truncate max-w-[180px]">
        {artist || "—"}
      </p>
    </div>
  );
}
