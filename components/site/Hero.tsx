import Button from "./Button";
import NotchDemo from "./NotchDemo";
import { Download, Github, Windows } from "./icons";
import { site } from "@/lib/site";

const stats = [
  ["0", "icons in your taskbar"],
  ["600ms", "hover before it opens"],
  ["5", "panels, one gesture"],
  ["MIT", "free and open source"],
];

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-16 pb-24 sm:pt-24">
      <div className="aurora" aria-hidden />
      <div className="grid-floor" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-3xl text-center">
          <a
            href={site.releases}
            target="_blank"
            rel="noreferrer noopener"
            className="rise inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white/[.04] py-1.5 pr-4 pl-2 text-[13px] text-[var(--muted)] backdrop-blur transition-colors hover:border-[var(--hairline-bright)] hover:text-white"
          >
            <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-white">
              v{site.version}
            </span>
            First public release is out
          </a>

          <h1
            className="rise gradient-text mt-7 text-[clamp(2.6rem,7vw,4.6rem)] leading-[1.03] font-semibold tracking-[-0.035em]"
            style={{ animationDelay: "60ms" }}
          >
            The dynamic notch,
            <br />
            built for Windows.
          </h1>

          <p
            className="rise mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-[var(--muted)]"
            style={{ animationDelay: "140ms" }}
          >
            Crest hides a Mica-glass panel at the top of your screen. Nudge it
            and your music, your apps, your clipboard, your files and your notes
            slide down. Move away and the desktop is yours again.
          </p>

          <div
            className="rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: "220ms" }}
          >
            <Button href={site.download} size="lg" external={false}>
              <Download width={18} height={18} />
              Download for Windows
            </Button>
            <Button href={site.repo} variant="ghost" size="lg">
              <Github width={18} height={18} />
              View source
            </Button>
          </div>

          <p
            className="rise mt-5 flex items-center justify-center gap-2 text-[13px] text-[var(--faint)]"
            style={{ animationDelay: "300ms" }}
          >
            <Windows width={14} height={14} />
            Windows 10 & 11 (x64) · free forever · no account
          </p>
        </div>

        <div className="rise mt-16" style={{ animationDelay: "380ms" }}>
          <NotchDemo />
        </div>

        <dl className="rise mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--hairline)] bg-white/[.06] sm:grid-cols-4" style={{ animationDelay: "460ms" }}>
          {stats.map(([value, label]) => (
            <div key={label} className="bg-[#0a0a10] px-5 py-6 text-center">
              <dt className="text-[26px] font-semibold tracking-tight text-white">
                {value}
              </dt>
              <dd className="mt-1 text-[13px] text-[var(--faint)]">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
