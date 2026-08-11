import Image from "next/image";
import Button from "./Button";
import { ArrowRight, Discord, SOCIAL_ICONS } from "./icons";
import mark from "@/public/crest-logo.png";
import { activeSocials, site } from "@/lib/site";

/*
  Community.

  The Discord server is the headline and everything else is a row beneath it —
  a grid of five equal tiles would put the one place people can actually talk
  to each other on the same footing as a follow button.

  The tiles come from `activeSocials`, which is `socials` minus the accounts
  that have no URL yet, so an unfilled handle renders nothing rather than a
  dead link. Fill in `href` in `lib/site.ts` and a tile appears here and a
  footer link with it.
*/
const reasons = [
  "Report a bug and watch it get fixed",
  "See what is being built before it ships",
  "Ask for a panel you want",
  "Say when something feels wrong",
];

export default function Community() {
  return (
    <section
      id="community"
      className="relative overflow-hidden border-t border-white/[.06] py-24"
    >
      <div className="aurora" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-5">
        <div className="max-w-2xl">
          <p className="section-label">Community</p>
          <h2 className="mt-4 text-[clamp(2rem,4.4vw,3rem)] leading-[1.1] font-semibold tracking-[-0.03em]">
            Crest is built in the open,
            <span className="text-[var(--faint)]"> with the people using it.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-[var(--muted)]">
            There is no support portal and no ticket queue. There is a Discord
            server where the person who writes the app reads what you post, and a
            public issue tracker for anything that outlives a conversation.
          </p>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          {/*
            The invite card. Styled as a Discord embed on purpose — it is the
            shape people already recognise as "a server you can join", and the
            page is asking them to do exactly that.
          */}
          <div className="pane overflow-hidden rounded-3xl">
            <div className="h-24 bg-gradient-to-b from-[#5865F2] to-[#3d47c9]" />

            <div className="relative z-[1] px-7 pb-7">
              <Image
                src={mark}
                alt=""
                width={80}
                height={80}
                className="-mt-10 rounded-[22%] border-4 border-[#0a0a10] shadow-[0_12px_40px_-8px_rgba(27,0,181,1)]"
              />

              <h3 className="mt-5 text-[22px] font-semibold tracking-tight">
                Crest: Windows Dynamic Notch
              </h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--muted)]">
                Fully open source, and free. Bug reports, changelogs, feature
                requests, and early looks at panels that are not out yet.
              </p>

              <ul className="mt-6 grid gap-2.5">
                {reasons.map((reason) => (
                  <li
                    key={reason}
                    className="flex items-start gap-2.5 text-[14px] text-[var(--muted)]"
                  >
                    <span
                      aria-hidden
                      className="mt-[.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#5865F2]"
                    />
                    {reason}
                  </li>
                ))}
              </ul>

              <Button
                href={site.discord}
                size="lg"
                className="mt-7 w-full !bg-[#5865F2] !shadow-[0_8px_28px_-8px_rgba(88,101,242,.9)] hover:!bg-[#6b76f5] hover:!shadow-[0_12px_34px_-8px_rgba(88,101,242,.95)]"
              >
                <Discord width={19} height={19} />
                Join the Discord
              </Button>

              <p className="mt-3 text-center text-[12.5px] text-[var(--faint)]">
                Free, no account beyond Discord&rsquo;s own.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {activeSocials.map((social) => {
              const Icon = SOCIAL_ICONS[social.id];
              return (
                <a
                  key={social.id}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="pane group flex flex-1 items-center gap-4 rounded-2xl p-6 transition-colors duration-300 hover:border-[var(--hairline-bright)]"
                >
                  <span className="relative z-[1] inline-grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--hairline)] bg-white/[.05] text-[var(--accent-bright)] transition-colors duration-300 group-hover:bg-[var(--accent)] group-hover:text-white">
                    <Icon width={20} height={20} />
                  </span>

                  <span className="relative z-[1] min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold tracking-tight">
                      {social.label}
                    </span>
                    <span className="mt-1 block text-[14px] leading-relaxed text-[var(--muted)]">
                      {social.blurb}
                    </span>
                  </span>

                  <ArrowRight
                    width={16}
                    height={16}
                    className="relative z-[1] shrink-0 text-[var(--faint)] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white"
                  />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
