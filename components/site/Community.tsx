import Image from "next/image";
import Button from "./Button";
import { ArrowRight, Discord, SOCIAL_ICONS } from "./icons";
import mark from "@/public/crest-logo.png";
import { activeSocials, site } from "@/lib/site";

const reasons = [
  "Report a bug and watch it get fixed",
  "See what is being built before it ships",
  "Ask for a panel you want",
  "Say when something feels wrong",
];

export default function Community() {
  return (
    <section id="community" className="relative py-[clamp(56px,9vw,104px)]">
      <div className="mx-auto max-w-[1080px] px-[22px]">
        <div className="max-w-2xl">
          <p className="t-eyebrow">Community</p>
          <h2 className="t-title mt-3">
            Built in the open,
            <span className="text-[var(--heading-tint)]">
              {" "}
              with the people using it.
            </span>
          </h2>
          <p className="t-lede mt-5">
            There is no support portal and no ticket queue. There is a Discord
            server where the person who writes the app reads what you post, and a
            public issue tracker for anything that outlives a conversation.
          </p>
        </div>

        <div className="mt-11 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          
          <div className="card overflow-hidden">
            <div className="h-24 bg-[var(--discord)]" />

            <div className="px-7 pb-7">
              <Image
                src={mark}
                alt=""
                width={76}
                height={76}
                className="-mt-10 rounded-[22%] border-4 border-[var(--surface)] shadow-[var(--sh-card)]"
              />

              <h3 className="mt-5 text-[21px] font-semibold tracking-[-0.02em]">
                Crest: Windows Dynamic Notch
              </h3>
              <p className="mt-2.5 text-[14.5px] leading-[1.65] text-[var(--text-secondary)]">
                Fully open source, and free. Bug reports, changelogs, feature
                requests, and early looks at panels that are not out yet.
              </p>

              <ul className="mt-6 grid gap-2.5">
                {reasons.map((reason) => (
                  <li
                    key={reason}
                    className="flex items-start gap-3 text-[14px] text-[var(--text-body)]"
                  >
                    <span
                      aria-hidden
                      className="mt-[.6em] h-1 w-1 shrink-0 rounded-full bg-[var(--text-faint)]"
                    />
                    {reason}
                  </li>
                ))}
              </ul>

              <Button
                href={site.discord}
                size="lg"
                className="mt-7 w-full !bg-[var(--discord)] !shadow-none hover:!bg-[#6b76f5]"
              >
                <Discord width={19} height={19} />
                Join the Discord
              </Button>

              <p className="mt-3 text-center text-[12.5px] text-[var(--text-faint)]">
                Free, no account beyond Discord&rsquo;s own.
              </p>
            </div>
          </div>

          
          <ul className="panel flex flex-col divide-y divide-[var(--hairline)] overflow-hidden">
            {activeSocials.map((social) => {
              const Icon = SOCIAL_ICONS[social.id];
              return (
                <li key={social.id} className="flex flex-1">
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group flex flex-1 items-center gap-4 px-6 py-6 transition-colors duration-200 hover:bg-[var(--surface-raised)]"
                  >
                    <span className="shrink-0 text-[var(--text-tertiary)] transition-colors duration-200 group-hover:text-[var(--accent-bright)]">
                      <Icon width={20} height={20} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="t-heading block">{social.label}</span>
                      <span className="mt-0.5 block text-[13.5px] leading-[1.6] text-[var(--text-secondary)]">
                        {social.blurb}
                      </span>
                    </span>

                    <ArrowRight
                      width={16}
                      height={16}
                      className="shrink-0 text-[var(--text-faint)] transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--text)]"
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
