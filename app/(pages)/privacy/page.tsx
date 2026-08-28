import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `How ${site.name} handles your data: no accounts, no telemetry, no analytics. Everything stays on your machine, and the only two things that ever leave it are the update check and the forecast for the place you set yourself.`,
  openGraph: {
    title: `Privacy · ${site.name}`,
    description: `How ${site.name} handles your data. No accounts, no telemetry, no analytics.`,
  },
};

/**
 * The date this policy last changed, as it is shown.
 *
 * The "Changes to this policy" section below promises a revised date on every
 * revision, so this string is part of the policy rather than decoration —
 * change it whenever any of the copy in `sections` changes.
 */
const EFFECTIVE = "August 28, 2026";

/** A labelled point: the thing on the left, what happens to it on the right. */
function Point({ term, children }: { term: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-1 sm:flex-row sm:gap-3">
      <span className="shrink-0 font-medium text-[var(--text)] sm:w-44">
        {term}
      </span>
      <span className="flex-1 text-[var(--text-body)]">{children}</span>
    </li>
  );
}

const listClass = "mt-4 grid gap-3.5 text-[14.5px] leading-[1.7]";

const inlineLink =
  "text-[var(--accent-bright)] underline-offset-4 hover:underline";

const sections: { heading: string; body: ReactNode }[] = [
  {
    heading: "The short version",
    body: (
      <>
        <p className="t-body">
          {site.name} has no account, no sign-in, no sync service, no telemetry
          and no analytics. It does not profile you, does not show you
          advertising, and has nothing about you to sell or share, because it
          never collects anything in the first place.
        </p>
        <p className="t-body mt-4">
          Everything {site.name} makes — your notes, your reminders, your
          shelved files, your preferences — is written to a folder on your own
          machine and stays there. Two things leave it, both described below and
          neither one carrying anything about you: a check for a new version,
          and the forecast for a place you typed in yourself.
        </p>
      </>
    ),
  },
  {
    heading: "What Crest stores on your device",
    body: (
      <>
        <p className="t-body">
          These are written as ordinary files in {site.name}&rsquo;s own app-data
          folder, which on a standard install is{" "}
          <code className="rounded-[var(--r-chip)] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--text)]">
            %APPDATA%\com.lenny.crest
          </code>
          . They are plain text you can open, copy or delete yourself.
        </p>
        <ul className={listClass}>
          <Point term="Quick notes">
            The notes you write in the notch, and their titles.
          </Point>
          <Point term="Calendar reminders">
            What you asked to be reminded about, and when.
          </Point>
          <Point term="Timer">
            The end time of a running countdown, so an update installing in the
            background does not lose it.
          </Point>
          <Point term="File shelf">
            The <em>paths</em> of the files you dragged in — not the files. A
            shelved item is a pointer to a file that is already yours, sitting
            where you already keep it. Nothing is copied or duplicated.
          </Point>
          <Point term="Preferences">
            Your theme, accent, position, display choice, shortcut, and the rest
            of what is in Settings.
          </Point>
          <Point term="Banner memo">
            If you switch on &ldquo;silence Windows&rsquo; own banners&rdquo;,{" "}
            {site.name} records which apps it changed, purely so it can hand
            every one of them back when you switch it off or quit.
          </Point>
        </ul>
      </>
    ),
  },
  {
    heading: "What Crest reads but never stores",
    body: (
      <>
        <p className="t-body">
          Most of what the notch shows you is read live, drawn, and then
          forgotten. None of it is written to disk and none of it is sent
          anywhere.
        </p>
        <ul className={listClass}>
          <Point term="Clipboard history">
            Held in memory only, capped at a small number of recent entries, and
            gone the moment {site.name} closes. It is never written to disk. On
            top of that, capture is skipped entirely while a known password
            manager is the focused window, so a password you copy out of one is
            not picked up at all.
          </Point>
          <Point term="Screenshots">
            {site.name} does not take screenshots. It <em>reads</em> the folders
            Windows already saves them to — your Screenshots and Captures
            folders — and shows you the most recent ones. Nothing is captured,
            copied, moved or deleted; the card is a window onto files that are
            already yours.
          </Point>
          <Point term="Notifications">
            Read from the Windows notification centre so the notch can show
            them. {site.name} keeps no copy of its own once one leaves the
            centre, and it cannot see notifications that never arrived there.
          </Point>
          <Point term="What is playing">
            Title, artist and artwork from the same Windows media session your
            volume flyout reads. Displayed, not recorded.
          </Point>
          <Point term="System readings">
            CPU, memory, GPU, disk, temperature, battery, network and Bluetooth
            status, read from Windows for the meters and the pill. No history is
            kept.
          </Point>
          <Point term="Installed apps and audio devices">
            The launcher lists what is installed on your machine and Quick
            Access lists your sound devices, both read from Windows when the
            card is open.
          </Point>
        </ul>
      </>
    ),
  },
  {
    heading: "The two services Crest talks to",
    body: (
      <>
        <p className="t-body">
          This is the whole of {site.name}&rsquo;s outbound network traffic.
          There is no third service, and both of these are listed in the source.
        </p>
        <ul className={listClass}>
          <Point term="Open-Meteo">
            The weather card talks to{" "}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer noopener"
              className={inlineLink}
            >
              Open-Meteo
            </a>
            , and nothing happens there until you go looking for a place.
            Searching for one in Settings sends the text you typed, so it can be
            turned into coordinates. Once you have picked one, the card sends
            those coordinates and the time zone they resolved to, and gets a
            forecast back. Neither request carries an account, an API key or any
            identifier — they name {site.name} and its version, the way every
            browser sends a user agent, and nothing about you or your machine.
            There is deliberately no automatic location and no IP lookup:{" "}
            {site.name} does not know where you are unless you tell it, and
            until you do, nothing is fetched at all. Clearing the location in
            Settings stops it.
          </Point>
          <Point term="GitHub">
            {site.name} checks{" "}
            <a
              href={site.releases}
              target="_blank"
              rel="noreferrer noopener"
              className={inlineLink}
            >
              GitHub
            </a>{" "}
            shortly after starting and periodically after that to see whether a
            newer version has been published, and downloads the installer if one
            has. It is an ordinary web request for a public file, with nothing
            attached identifying you or your machine.
          </Point>
        </ul>
        <p className="t-body mt-4">
          Neither request carries a user id, a device id, a licence key, or
          anything about how you use the app. Nothing you write, copy, shelve or
          open is ever transmitted.
        </p>
      </>
    ),
  },
  {
    heading: "What Crest does not do",
    body: (
      <ul className={listClass}>
        <Point term="No telemetry">
          There is no analytics, usage-tracking or crash-reporting library in
          the app. Nothing reports back on what you opened or how often.
        </Point>
        <Point term="No accounts">
          There is nothing to sign up for, so there is no email, password or
          profile to hold.
        </Point>
        <Point term="No advertising">
          No ads, no ad identifiers, no tracking pixels, no third-party scripts.
        </Point>
        <Point term="No sale or sharing">
          Nothing is sold, rented, shared or handed to advertisers, data brokers
          or anyone else — there is no collected data for any of that to apply
          to.
        </Point>
        <Point term="No hidden copies">
          {site.name} does not upload, back up or sync your notes, files,
          clipboard or screenshots anywhere.
        </Point>
      </ul>
    ),
  },
  {
    heading: "What Crest asks Windows for, and why",
    body: (
      <>
        <p className="t-body">
          A few features need permission from Windows itself. Each one is used
          for exactly the feature it belongs to, and nothing more.
        </p>
        <ul className={listClass}>
          <Point term="Notification access">
            Needed to show your notifications in the notch. Windows asks you to
            allow this the first time, and you can revoke it at any point in
            Windows Settings; {site.name} simply stops showing them.
          </Point>
          <Point term="Start with Windows">
            Only if you switch it on. {site.name} registers a scheduled task
            that runs at logon, without elevation, and removes it when you
            switch the setting off or uninstall the app.
          </Point>
          <Point term="Silencing Windows banners">
            Only if you switch it on. {site.name} turns off the per-app
            notification banner for apps that raise one, so a notification
            appears in the notch rather than twice. Delivery is never blocked —
            everything still lands in the notification centre as usual — and
            every banner is handed straight back when you switch it off, or when
            you quit {site.name}.
          </Point>
        </ul>
      </>
    ),
  },
  {
    heading: "Keeping and deleting your data",
    body: (
      <>
        <p className="t-body">
          {site.name} keeps what you make until you remove it. There is no
          retention schedule to describe, because nothing is held anywhere you
          cannot reach.
        </p>
        <p className="t-body mt-4">
          Notes, reminders and shelved items can be deleted from inside the app.
          Clipboard history clears itself every time {site.name} closes.
          Everything else lives in the app-data folder named above, which you can
          open and delete by hand. Uninstalling {site.name} from Windows Settings
          removes the app and that folder together, along with the startup task
          if you had it on.
        </p>
      </>
    ),
  },
  {
    heading: "Children's privacy",
    body: (
      <p className="t-body">
        {site.name} is a general-purpose desktop utility. It is not directed at
        children, and it does not knowingly collect information from anyone —
        children under 13 included — because it does not collect personal
        information at all.
      </p>
    ),
  },
  {
    heading: "Changes to this policy",
    body: (
      <p className="t-body">
        If this policy changes, the new version is posted on this page with a
        revised effective date at the top. Continuing to use {site.name} after a
        change means you accept the revised policy. Because {site.name} is open
        source, you can also read the exact change in the{" "}
        <a
          href={site.repo}
          target="_blank"
          rel="noreferrer noopener"
          className={inlineLink}
        >
          repository history
        </a>
        .
      </p>
    ),
  },
  {
    heading: "Contact",
    body: (
      <p className="t-body">
        Questions about this policy, or about how {site.name} handles anything on
        your machine, go to{" "}
        <a href={`mailto:${site.email}`} className={inlineLink}>
          {site.email}
        </a>
        . Every other way to reach us is on the{" "}
        <Link href="/contact" className={inlineLink}>
          contact page
        </Link>
        .
      </p>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <section className="relative py-[clamp(56px,9vw,104px)]">
      <div className="mx-auto max-w-[1080px] px-[22px]">
        <div className="max-w-2xl">
          <p className="t-eyebrow">Privacy</p>
          <h2 className="t-title mt-3">
            Nothing to collect,
            <span className="text-[var(--heading-tint)]">
              {" "}
              so nothing collected.
            </span>
          </h2>
          <p className="t-lede mt-5">
            {site.name} is a Windows desktop utility from {site.publisher}. This
            is a plain account of what it touches on your machine, what it
            keeps, and the only two services it ever talks to.
          </p>
          <p className="mt-5 text-[13px] text-[var(--text-faint)]">
            Effective {EFFECTIVE} · Version {site.version}
          </p>
        </div>

        <div className="panel mt-11 divide-y divide-[var(--hairline)] overflow-hidden">
          {sections.map((section) => (
            <section key={section.heading} className="px-6 py-8 sm:px-9">
              <h3 className="text-[19px] font-semibold tracking-[-0.018em] text-[var(--text)]">
                {section.heading}
              </h3>
              <div className="mt-3 max-w-[68ch]">{section.body}</div>
            </section>
          ))}
        </div>

        <p className="mt-8 max-w-[68ch] text-[13.5px] leading-[1.7] text-[var(--text-tertiary)]">
          {site.name} is open source under the MIT license. If you would rather
          check than take our word for it, the entire source — every network call
          included — is on{" "}
          <a
            href={site.repo}
            target="_blank"
            rel="noreferrer noopener"
            className={inlineLink}
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </section>
  );
}
