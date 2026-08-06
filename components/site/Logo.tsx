import Image from "next/image";
import mark from "@/public/crest-logo.png";
import { site } from "@/lib/site";

/**
 * The app icon, reused verbatim as the site mark — same asset that ships in the
 * installer, the tray and the favicon, so the download the visitor ends up with
 * looks like the page they downloaded it from.
 */
export default function Logo({
  size = 28,
  withWordmark = true,
  className = "",
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src={mark}
        alt={withWordmark ? "" : `${site.name} logo`}
        width={size}
        height={size}
        priority
        className="rounded-[22%] shadow-[0_2px_12px_-2px_rgba(27,0,181,.9)]"
        style={{ width: size, height: size }}
      />
      {withWordmark && (
        <span className="text-[17px] font-semibold tracking-tight">
          {site.name}
        </span>
      )}
    </span>
  );
}
