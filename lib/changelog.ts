
import { readFileSync } from "node:fs";
import path from "node:path";

export type ChangeGroup = {
  title: string;
  items: string[];
};

export type Release = {
  version: string;
  
  date: string | null;
  
  summary: string[];
  groups: ChangeGroup[];
};

const HEADING = /^(\S+)(?:\s+[—–-]\s+(\S+))?/;

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
      items[items.length - 1] += ` ${line.trim()}`;
    }
  }

  return items;
}

function formatDate(raw: string | undefined): string | null {
  if (!raw) return null;

  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return raw;

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

export function getReleases(): Release[] {
  const markdown = readFileSync(path.join(process.cwd(), "CHANGELOG.md"), "utf8")
    
    .replace(/\r\n?/g, "\n");

  return markdown
    .split(/^## /m)
    .slice(1)
    .map(parseRelease)
    .filter((release): release is Release => release !== null);
}
