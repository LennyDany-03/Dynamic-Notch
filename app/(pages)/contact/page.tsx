import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Discord,
  Github,
  List,
  Mail,
  Users,
} from "@/components/site/icons";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch about ${site.name}: email, the Discord server, GitHub issues and discussions. Bug reports and feature requests all get read.`,
  openGraph: {
    title: `Contact · ${site.name}`,
    description: `Get in touch about ${site.name} — email, Discord, or GitHub.`,
  },
};

/**
 * Ordered by how fast you will get an answer, not by how official the channel
 * looks. Discord is genuinely first: it is where the person who writes the app
 * reads, which is what the FAQ already tells people.
 */
const channels = [
  {
    id: "discord",
    label: "Discord",
    blurb:
      "The fastest route. Bug reports, changelogs and feature requests, read by the person who writes the app.",
    meta: "Fastest",
    href: site.discord,
    icon: Users,
    external: true,
  },
  {
    id: "issues",
    label: "GitHub issues",
    blurb:
      "For anything that should outlive a conversation: a reproducible bug, a crash, a feature worth tracking.",
    meta: "Bugs and requests",
    href: `${site.repo}/issues/new`,
    icon: Github,
    external: true,
  },
  {
    id: "discussions",
    label: "GitHub discussions",
    blurb:
      "Questions, ideas and half-formed suggestions that are not quite a bug report yet.",
    meta: "Questions and ideas",
    href: `${site.repo}/discussions`,
    icon: List,
    external: true,
  },
  {
    id: "email",
    label: site.email,
    blurb:
      "For anything private, anything about this site, or anything you would rather not post in public.",
    meta: "Email",
    href: `mailto:${site.email}`,
    icon: Mail,
    external: false,
  },
] as const;

/** Worth a look before writing — most questions already have an answer here. */
const beforeYouWrite = [
  {
    label: "The FAQ",
    detail:
      "Multi-monitor setup, which music apps work, notification permissions, how updates install, and how to get rid of it.",
    href: "/#faq",
    external: false,
  },
  {
    label: "Release notes",
    detail:
      "What changed in each version, and anything known to be broken in the current one.",
    href: site.releases,
    external: true,
  },
  {
    label: "Open issues",
    detail:
      "Someone may have reported it already — and that thread is where the fix will be posted.",
    href: `${site.repo}/issues`,
    external: true,
  },
] as const;

const inlineLink =
  "text-[var(--accent-bright)] underline-offset-4 hover:underline";

export default function Contact() {
  return (
    <section className="relative py-[clamp(56px,9vw,104px)]">
      <div className="mx-auto max-w-[1080px] px-[22px]">
        <div className="max-w-2xl">
          <p className="t-eyebrow">Contact</p>
          <h2 className="t-title mt-3">
            Get in touch,
            <span className="text-[var(--heading-tint)]">
              {" "}
              and get an actual reply.
            </span>
          </h2>
          <p className="t-lede mt-5">
            Found a bug, want a panel that does not exist yet, or just stuck on
            something? There is no support portal and no ticket queue — pick
            whichever of these suits, and it gets read.
          </p>
        </div>

        <ul className="panel mt-11 flex flex-col divide-y divide-[var(--hairline)] overflow-hidden">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <li key={channel.id} className="flex">
                <a
                  href={channel.href}
                  {...(channel.external
                    ? { target: "_blank", rel: "noreferrer noopener" }
                    : {})}
                  className="group flex flex-1 items-center gap-4 px-6 py-6 transition-colors duration-200 hover:bg-[var(--surface-raised)] sm:px-7"
                >
                  <span className="shrink-0 text-[var(--text-tertiary)] transition-colors duration-200 group-hover:text-[var(--accent-bright)]">
                    <Icon width={20} height={20} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="t-heading break-all">
                        {channel.label}
                      </span>
                      <span className="rounded-[var(--r-pill)] border border-[var(--hairline)] px-2 py-0.5 text-[11.5px] text-[var(--text-tertiary)]">
                        {channel.meta}
                      </span>
                    </span>
                    <span className="mt-1 block text-[13.5px] leading-[1.6] text-[var(--text-secondary)]">
                      {channel.blurb}
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

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <div className="card p-7">
            <h3 className="t-heading">Before you write</h3>
            <p className="mt-2 text-[13.5px] leading-[1.65] text-[var(--text-secondary)]">
              Three places worth a minute first — most questions have already
              been answered in one of them.
            </p>

            <ul className="mt-6 grid gap-4">
              {beforeYouWrite.map((item) => {
                const inner = (
                  <>
                    <span
                      aria-hidden
                      className="mt-[.6em] h-1 w-1 shrink-0 rounded-full bg-[var(--text-faint)] transition-colors duration-200 group-hover:bg-[var(--accent-bright)]"
                    />
                    <span className="min-w-0">
                      <span className="text-[14px] font-medium text-[var(--text)] underline-offset-4 group-hover:underline">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[13.5px] leading-[1.6] text-[var(--text-secondary)]">
                        {item.detail}
                      </span>
                    </span>
                  </>
                );
                const rowClass = "group flex items-start gap-3";

                return (
                  <li key={item.label}>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={rowClass}
                      >
                        {inner}
                      </a>
                    ) : (
                      <Link href={item.href} className={rowClass}>
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card flex flex-col p-7">
            <span className="text-[var(--text-tertiary)]">
              <Discord width={22} height={22} />
            </span>

            <h3 className="t-heading mt-5">One person, not a company</h3>
            <p className="mt-2 text-[13.5px] leading-[1.7] text-[var(--text-secondary)]">
              {site.name} is written and maintained by one developer,{" "}
              {site.publisher}, and given away free under the MIT license. There
              is nobody on a rota — so replies usually take a few days, and
              occasionally longer. Everything does get read.
            </p>
            <p className="mt-4 text-[13.5px] leading-[1.7] text-[var(--text-secondary)]">
              If you would rather see how it handles your data before writing at
              all, that is on the{" "}
              <Link href="/privacy" className={inlineLink}>
                privacy page
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
