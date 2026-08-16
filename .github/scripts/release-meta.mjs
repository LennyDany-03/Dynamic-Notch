#!/usr/bin/env node
/**
 * The three release numbers, validated in one place.
 *
 * A release is described by three files that have to agree, and nothing in the
 * repo enforced that until this script existed:
 *
 *   product/src-tauri/tauri.conf.json  the number the updater compares — the
 *                                      only one that decides what ships
 *   lib/site.ts                        builds the marketing site's download URL
 *   CHANGELOG.md                       becomes the GitHub release body
 *
 * A mismatch in the second is a 404 on the download button that you find out
 * about from a user. A missing section in the third used to fail the release
 * *after* the tag was pushed. Both are cheap to catch on a pull request, so
 * this runs there (via ci.yml) and again in the release gate (release.yml) —
 * one implementation, so CI passing and the release failing cannot diverge.
 *
 * Usage:
 *   node .github/scripts/release-meta.mjs
 *   node .github/scripts/release-meta.mjs --expect 0.6.7
 *
 * `--expect` additionally asserts that a tag's version matches the version in
 * the working tree, which catches `git tag v0.6.7` on a commit whose
 * tauri.conf.json still says 0.6.6.
 *
 * On success, writes `version`, `tag` and `notes` to $GITHUB_OUTPUT when that
 * variable is set. On any failure it prints what is wrong and exits 1.
 */

import { readFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const problems = [];
const fail = (message) => problems.push(message);

/* ------------------------------------------------------------------ *
 * 1. The number that decides what ships.
 * ------------------------------------------------------------------ */

const TAURI_CONF = "product/src-tauri/tauri.conf.json";
const SITE_TS = "lib/site.ts";
const CHANGELOG = "CHANGELOG.md";

let version = null;
try {
  version = JSON.parse(read(TAURI_CONF)).version ?? null;
  if (!version) fail(`${TAURI_CONF} has no "version" field.`);
} catch (error) {
  fail(`Could not read ${TAURI_CONF}: ${error.message}`);
}

/* ------------------------------------------------------------------ *
 * 2. The site's copy of it.
 *
 * Matched by regex rather than imported, because lib/site.ts is TypeScript
 * that a plain node script cannot evaluate, and adding a transpile step to
 * read one string would be a build system in a validator.
 * ------------------------------------------------------------------ */

let siteVersion = null;
try {
  const match = read(SITE_TS).match(/^const version = "([^"]+)";/m);
  if (!match) {
    fail(
      `${SITE_TS} has no \`const version = "x.y.z";\` line. If that declaration ` +
        `was renamed or reformatted, update the pattern in this script too.`,
    );
  } else {
    siteVersion = match[1];
  }
} catch (error) {
  fail(`Could not read ${SITE_TS}: ${error.message}`);
}

if (version && siteVersion && version !== siteVersion) {
  fail(
    `Version mismatch:\n` +
      `  ${TAURI_CONF} says ${version}\n` +
      `  ${SITE_TS} says ${siteVersion}\n` +
      `They must be identical — the site builds its download URL from its own ` +
      `copy, so a mismatch ships a download button pointing at a release that ` +
      `does not exist.`,
  );
}

/* ------------------------------------------------------------------ *
 * 3. The release notes.
 *
 * Same rules the release workflow used to apply on its own: the section runs
 * from its heading to the next heading of the same level, or to EOF, and an
 * empty one is a failure because an empty release page is worse than a red
 * build you can re-run.
 * ------------------------------------------------------------------ */

let notes = "";
if (version) {
  try {
    const lines = read(CHANGELOG).split(/\r?\n/);
    const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const heading = new RegExp(`^##\\s+\\[?${escaped}\\]?(\\s|$)`);

    const start = lines.findIndex((line) => heading.test(line));
    if (start < 0) {
      fail(
        `${CHANGELOG} has no "## ${version}" section. The release body is read ` +
          `from it, so add one before releasing ${version}.`,
      );
    } else {
      let end = lines.length;
      for (let i = start + 1; i < lines.length; i++) {
        if (/^##\s/.test(lines[i])) {
          end = i;
          break;
        }
      }
      notes = lines.slice(start + 1, end).join("\n").trim();
      if (!notes) fail(`The "## ${version}" section in ${CHANGELOG} is empty.`);

      // Not a failure — the workflow reads by heading, not by position — but
      // newest-first is the convention and a section that drifted down the
      // file is usually a bad paste.
      const firstHeading = lines.findIndex((line) => /^##\s/.test(line));
      if (start !== firstHeading) {
        console.log(
          `Note: "## ${version}" is not the topmost section in ${CHANGELOG}. ` +
            `That still releases correctly, but newest-first is the convention.`,
        );
      }
    }
  } catch (error) {
    fail(`Could not read ${CHANGELOG}: ${error.message}`);
  }
}

/* ------------------------------------------------------------------ *
 * 4. The tag, when one was named.
 * ------------------------------------------------------------------ */

const expectIndex = process.argv.indexOf("--expect");
const expected =
  expectIndex >= 0 ? (process.argv[expectIndex + 1] ?? "").replace(/^v/, "") : null;

if (expected && version && expected !== version) {
  fail(
    `Tag/version mismatch:\n` +
      `  the tag says ${expected}\n` +
      `  ${TAURI_CONF} says ${version}\n` +
      `The tag must name the version the code at that commit actually is.`,
  );
}

/* ------------------------------------------------------------------ *
 * Report.
 * ------------------------------------------------------------------ */

if (problems.length > 0) {
  console.error("\nRelease metadata is not consistent:\n");
  for (const problem of problems) console.error(`  • ${problem}\n`);
  process.exit(1);
}

console.log(`Version:   ${version}`);
console.log(`Tag:       v${version}`);
console.log(`Notes:     ${notes.length} chars from ${CHANGELOG}`);
console.log(`\n${notes}\n`);

if (process.env.GITHUB_OUTPUT) {
  // A delimiter that cannot collide with the note text itself.
  const delimiter = `NOTES_EOF_${crypto.randomUUID().replace(/-/g, "")}`;
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `version=${version}\n` +
      `tag=v${version}\n` +
      `notes<<${delimiter}\n${notes}\n${delimiter}\n`,
    "utf8",
  );
}
