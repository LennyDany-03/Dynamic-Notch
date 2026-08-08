/**
 * Release notes for the site, read from the repo's `CHANGELOG.md`.
 *
 * That file is already load-bearing: the release workflow extracts the section
 * for the tag being built and uses it as the GitHub release body, and fails the
 * build if it is missing. Parsing the same file here means the "What's new"
 * dialog cannot describe a different release from the one users are installing
 * — there is no second copy of the notes to forget to update.
 *
 * **Server-only.** This touches the filesystem, so it may only be imported from
 * Server Components. `WhatsNew` is a Client Component and takes the parsed
 * result as props (`import type` from here is fine — types are erased).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export type ChangeGroup = {
  /** The `###` heading — "New", "Fixed", "Changed". */
  title: string;
  items: string[];
};

export type Release = {
  version: string;
  /** Already formatted for display; `null` when the heading carried no date. */
  date: string | null;
  /** Paragraphs between the version heading and the first `###` group. */
  summary: string[];
  groups: ChangeGroup[];
};

/*
  The heading shape the changelog uses: `## 0.3.0 — 2026-08-08`. The date is
  optional and either dash is accepted, because a hand-written entry that used
  a plain hyphen should still render rather than silently lose its date.
*/
const HEADING = /^(\S+)(?:\s+[—–-]\s+(\S+))?/;

/**
 * Markdown wraps at the author's whim, so a bullet or paragraph can span lines.
 * Rejoin each block into one string and drop the blank separators.
 */
function paragraphs(block: string): string[] {
  return block
    .split(/\n\s*\n/)
    .map((p) => p.trim().replace(/\s*\n\s*/g, " "))
    .filter(Boolean);
}

function bullets(block: string): string[] {
  const items: string[] = [];

  for (const line of block.split("\n")) {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      items.push(bullet[1].trim());
    } else if (line.trim() && items.length) {
      // A continuation of the bullet above, indented under it.
      items[items.length - 1] += ` ${line.trim()}`;
    }
  }

  return items;
}

function formatDate(raw: string | undefined): string | null {
  if (!raw) return null;

  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return raw;

  // UTC throughout, so the build machine's timezone can't shift the date by a
  // day. en-GB to match the site's copy.
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function parseRelease(section: string): Release | null {
  const [headingLine, ...rest] = section.split("\n");
  const heading = headingLine.match(HEADING);
  if (!heading) return null;

  /*
    `### ` never matches this split: `^##` is followed by a third `#`, not the
    space the pattern requires, and `m` only lets `^` match at line starts.
  */
  const [intro = "", ...groupBlocks] = rest.join("\n").split(/^### /m);

  return {
    version: heading[1],
    date: formatDate(heading[2]),
    summary: paragraphs(intro),
    groups: groupBlocks
      .map((block) => {
        const [title, ...body] = block.split("\n");
        return { title: title.trim(), items: bullets(body.join("\n")) };
      })
      .filter((group) => group.items.length > 0),
  };
}

/**
 * Newest first — the order the changelog already keeps them in, not a sort.
 * Version strings are not comparable numerically ("0.10.0" < "0.9.0" as text),
 * and re-deriving an order the file already states would only add a way to
 * disagree with it.
 */
export function getReleases(): Release[] {
  // Read per call rather than at module scope so `next dev` picks up an edit to
  // the changelog. At build this runs once, for one statically rendered page.
  const markdown = readFileSync(path.join(process.cwd(), "CHANGELOG.md"), "utf8")
    /*
      The working copy on Windows is CRLF and a CI checkout is LF. Every pattern
      below is line-anchored, and a stray `\r` sitting where `$` expects the end
      of a line makes bullets silently vanish — so normalise once, here, rather
      than teaching each regex about carriage returns.
    */
    .replace(/\r\n?/g, "\n");

  return markdown
    .split(/^## /m)
    .slice(1) // Anything before the first heading is preamble, not a release.
    .map(parseRelease)
    .filter((release): release is Release => release !== null);
}
