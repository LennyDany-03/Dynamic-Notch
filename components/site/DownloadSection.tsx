import Image from "next/image";
import Button from "./Button";
import { Check, Download, Github } from "./icons";
import mark from "@/public/crest-logo.png";
import { site } from "@/lib/site";

const included = [
  "Windows 10 & 11, 64-bit",
  "Served straight from GitHub",
  "Starts with Windows",
  "MIT licensed",
];

export default function DownloadSection() {
  return (
    <section id="download" className="relative py-[clamp(56px,9vw,104px)]">
      <div className="mx-auto max-w-[1080px] px-[22px]">
        <div
          className="relative overflow-hidden rounded-[var(--r-hero)] px-6 py-[clamp(48px,7vw,80px)] text-center shadow-[var(--sh-cta)] sm:px-14"
          style={{
            background:
              "linear-gradient(148deg, #4f8bff 0%, #2f6fed 42%, #0e2f8f 100%)",
          }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 left-[12%] h-64 w-64 rounded-full bg-white/25 blur-[50px]" />
            <div className="absolute -bottom-28 right-[8%] h-72 w-72 rounded-full bg-[#a8c8ff]/30 blur-[50px]" />
          </div>

          <div className="relative">
            <Image
              src={mark}
              alt=""
              width={68}
              height={68}
              className="mx-auto rounded-[22%] shadow-[0_12px_40px_-8px_rgba(0,0,0,.6)]"
            />

            <h2 className="t-title mt-7 text-white">
              Make the top of your screen useful.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[16px] leading-[1.6] text-white/75">
              One installer, no setup screen. It&rsquo;s running in about a
              minute, and by the second time you nudge the top edge you won&rsquo;t
              remember doing it on purpose.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              
              <Button href={site.download} variant="onColor" size="lg" external={false}>
                <Download width={18} height={18} />
                Download v{site.version}
              </Button>
              <Button href={site.repo} variant="onColorGhost" size="lg">
                <Github width={18} height={18} />
                Build from source
              </Button>
            </div>

            
            <ul className="mx-auto mt-10 flex max-w-xl flex-wrap justify-center gap-2">
              {included.map((item) => (
                <li
                  key={item}
                  className="glass-on-color inline-flex items-center gap-2 rounded-[var(--r-pill)] px-3.5 py-2 text-[13px] text-white/90"
                >
                  <Check width={14} height={14} className="shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <p className="mx-auto mt-9 max-w-lg text-[12.5px] leading-[1.7] text-white/55">
              Windows SmartScreen may warn on first run: the installer is not
              yet code-signed by a paid certificate. Choose{" "}
              <span className="text-white/80">More info → Run anyway</span>, or
              build it yourself from the repo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
