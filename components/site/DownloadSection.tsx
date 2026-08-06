import Image from "next/image";
import Button from "./Button";
import { Check, Download, Github } from "./icons";
import mark from "@/public/crest-logo.png";
import { site } from "@/lib/site";

const included = [
  "Windows 10 & 11, 64-bit",
  "Installer served straight from GitHub",
  "Starts with Windows automatically",
  "MIT licensed — read or fork the source",
];

export default function DownloadSection() {
  return (
    <section id="download" className="relative overflow-hidden border-t border-white/[.06] py-24">
      <div className="aurora" aria-hidden />

      <div className="relative mx-auto max-w-4xl px-5">
        <div className="pane overflow-hidden rounded-3xl p-8 text-center sm:p-14">
          <div className="relative z-[1]">
            <Image
              src={mark}
              alt=""
              width={72}
              height={72}
              className="mx-auto rounded-[22%] shadow-[0_12px_40px_-8px_rgba(27,0,181,1)]"
            />

            <h2 className="mt-7 text-[clamp(2rem,4.6vw,3rem)] leading-[1.1] font-semibold tracking-[-0.03em]">
              Get Crest for Windows
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[16px] leading-relaxed text-[var(--muted)]">
              One installer, about a minute, and the top of your screen starts
              being useful. Free, and it stays free.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {/* Not `external`: the asset comes back as an attachment, so a
                  same-tab link downloads it and leaves the page in place —
                  target="_blank" would just flash an empty tab. */}
              <Button href={site.download} size="lg" external={false}>
                <Download width={18} height={18} />
                Download v{site.version}
              </Button>
              <Button href={site.repo} variant="ghost" size="lg">
                <Github width={18} height={18} />
                Build from source
              </Button>
            </div>

            <ul className="mx-auto mt-10 grid max-w-lg gap-3 text-left sm:grid-cols-2">
              {included.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[14px] text-[var(--muted)]"
                >
                  <span className="mt-0.5 shrink-0 text-[var(--accent-bright)]">
                    <Check width={16} height={16} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <p className="mt-9 text-[13px] text-[var(--faint)]">
              Windows SmartScreen may warn on first run — the installer is not
              yet code-signed by a paid certificate. Choose{" "}
              <span className="text-[var(--muted)]">More info → Run anyway</span>
              , or build it yourself from the repo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
