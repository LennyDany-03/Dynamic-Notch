import Button from "./Button";
import NotchDemo from "./NotchDemo";
import { Download, Play, Windows } from "./icons";
import { WhatsNewTrigger } from "./WhatsNew";
import { site } from "@/lib/site";

const facts = [
  ["600ms", "Typical response time"],
  ["7", "Built-in modules"],
  ["0", "Accounts required"],
  ["MIT", "Open-source license"],
];

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-16 pb-[clamp(56px,9vw,96px)]">
      <div className="relative mx-auto max-w-[1080px] px-[22px]">
        <div className="mx-auto max-w-3xl text-center">
          
          <WhatsNewTrigger className="rise press group inline-flex items-center gap-2 rounded-[var(--r-pill)] border border-[var(--hairline)] bg-[var(--surface)] py-1.5 pr-4 pl-1.5 text-[13px] tracking-[-0.005em] text-[var(--text-secondary)] transition-colors duration-200 hover:border-[var(--hairline-strong)] hover:text-[var(--text)]">
            <span className="tnum rounded-[var(--r-pill)] bg-[var(--accent)] px-2.5 py-0.5 text-[11.5px] font-semibold text-white">
              v{site.version}
            </span>
            See what&rsquo;s new
          </WhatsNewTrigger>

          <h1 className="rise t-display mt-8 text-[var(--text)]" style={{ animationDelay: "60ms" }}>
            The space at the top
            <br />
            of your screen{" "}
            
            <span className="text-[var(--heading-tint)]">
              finally{" "}
              <br className="hidden sm:inline" />
              does something.
            </span>
          </h1>

          
          <p
            className="rise t-lede mx-auto mt-6 max-w-[34rem]"
            style={{ animationDelay: "140ms" }}
          >
            Crest turns that dead strip above your desktop into a small panel.
            Music, a timer, your battery, a notification. It shows up when one
            of those needs you, and gets out of the way the second it doesn&rsquo;t.
          </p>

          <div
            className="rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: "220ms" }}
          >
            <Button href={site.download} size="lg" external={false}>
              <Download width={18} height={18} />
              Try Crest for Windows
            </Button>
            
            <Button href="#preview" variant="secondary" size="lg" external={false}>
              <Play width={16} height={16} />
              See it in action
            </Button>
          </div>

          <p
            className="rise mt-5 flex items-center justify-center gap-2 text-[13px] text-[var(--text-tertiary)]"
            style={{ animationDelay: "300ms" }}
          >
            <Windows width={14} height={14} />
            Free for Windows 10 &amp; 11 · No account required
          </p>
        </div>

        <div
          id="preview"
          className="rise mt-[clamp(48px,7vw,72px)] scroll-mt-24"
          style={{ animationDelay: "380ms" }}
        >
          <NotchDemo />
        </div>

        <dl
          className="rise panel mx-auto mt-[clamp(40px,6vw,64px)] flex max-w-2xl flex-col divide-y divide-[var(--hairline)] sm:flex-row sm:divide-x sm:divide-y-0"
          style={{ animationDelay: "460ms" }}
        >
          {facts.map(([value, label]) => (
            <div key={label} className="flex-1 px-6 py-7 text-center">
              <dt className="tnum text-[28px] leading-none font-semibold tracking-[-0.03em] text-[var(--text)]">
                {value}
              </dt>
              <dd className="mt-2 text-[13px] text-[var(--text-tertiary)]">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
