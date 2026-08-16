# Releasing Crest

**Merging the version bump is the release.** There is no `git tag` step any more.

A push to `main` whose `product/src-tauri/tauri.conf.json` carries a version that
has never shipped makes the tag itself and builds it. Everything else on `main`
— features, fixes, docs, a hundred commits without a bump — runs the gate, finds
the tag already exists, and stops in about ten seconds.

That means the three edits below are the whole release, and the pull request that
carries them is where it gets reviewed.

---

## The flow

```
branch  ──edit 3 files──▶  PR  ──CI──▶  review  ──merge──▶  main  ──▶  tag + build + publish
```

### Step 1 — On a branch: `product/src-tauri/tauri.conf.json` (line 4)

```json
"version": "x.x.x",
```

This is the only number the updater compares. It is also what the tag, the
installer filename and the release page are built from.

### Step 2 — `lib/site.ts` (line 15)

```ts
const version = "x.x.x";
```

Must be identical to step 1. The site builds its download URL from its own copy,
so a mismatch is a 404 on the download button — **CI now fails on this**, so you
cannot ship it by accident any more.

> **Note:** once this lands on `main` and the site redeploys, the download button
> points at the new installer while the Actions run is still building. It will
> 404 for those few minutes. Not worth restructuring for — just don't be alarmed
> if you test it early.

### Step 3 — `CHANGELOG.md`

Paste the new section directly above the previous version's `##` heading.

```markdown
## x.x.x — 20xx-xx-xx

**One sentence on what changed, in the user's words.**

### New

- **Feature** — what it does for them

### Fixed

- What stopped being annoying
```

The workflow reads from your heading to the next `##`, so ordering only matters
for humans — but keep newest first anyway; CI prints a note if you don't. A
missing or empty section **fails CI**, and fails the release gate before the tag
is made.

### Step 4 — Open a pull request

```bash
git checkout -b release-x.x.x
git add product/src-tauri/tauri.conf.json lib/site.ts CHANGELOG.md
git commit -m "chore: release x.x.x"
git push -u origin release-x.x.x
```

CI runs four things, and only the ones your diff touched: **Site**, **Product
frontend**, **Rust**, and **Release metadata**. That last one is the pre-flight
for everything above — the same script the release gate runs, so a green PR
cannot become a red release for a metadata reason.

Everything up to here is free. Force-push it, abandon it, redo it — nothing has
touched `main`.

### Step 5 — Merge

That's the release. Watch it at
`https://github.com/LennyDany-03/Dynamic-Notch/actions`.

The **Decide** job resolves the version, checks the tag doesn't exist, validates
the metadata, then creates and pushes an annotated `vx.x.x` at the merge commit.
**Build and publish** then checks out that tag and does what it always did.

Cold Rust builds take ~10 minutes, cached ~2.

---

## Verify the update reached users

Once the run is green:

```bash
curl -L https://github.com/LennyDany-03/Dynamic-Notch/releases/latest/download/latest.json
```

If that returns **404**, the release was published as a draft — drafts aren't
reachable at that URL, and the app would silently see no update. The workflow
sets `releaseDraft: false`, so this shouldn't happen, but it's the one failure
mode that looks like success.

---

## If it fails

The gate does all its validation **before** it creates the tag, so a failure in
**Decide** leaves the repo exactly as it was — fix it and merge again as normal.

A failure in **Build and publish** is different: the tag already exists by then.
Pushing to `main` again will *not* rebuild it, because the gate correctly sees
that version as already tagged. You have two ways forward.

**The workflow hiccuped, the code is fine** — re-run against the existing tag:

> Actions → Release → Run workflow → enter `vx.x.x`

**The code needs a fix.** Simplest and most honest: bump to the next patch
version and go round again. A failed run publishes nothing, so the burnt number
just doesn't exist — no user ever saw it.

If you'd rather reuse the number, move the tag by hand and then dispatch:

```bash
git push origin :refs/tags/vx.x.x   # delete remote
git tag -d vx.x.x                   # delete local
```

Then merge the fix and re-run the workflow with `vx.x.x`. (Merging alone works
here too, since the tag no longer exists.)

---

## The manual escape hatch

Hand-tagging still works and still does exactly what it used to:

```bash
git tag vx.x.x
git push origin vx.x.x
```

A tag push is treated as an explicit instruction and always builds, skipping the
"has this shipped?" check. The gate still validates that the tag matches the
version in `tauri.conf.json` at that commit, so you can't tag `v0.7.0` on a
commit that says `0.6.9`.

---

## One-time repository setup

These are settings, not code, and the automation above is only as good as they
are.

**1. Make CI required.** Settings → Rules → the ruleset targeting `main` →
*Require status checks to pass* → **Add checks** → search for **`CI`**.

Add **only `CI`** — not `Site`, `Rust`, `Product frontend` or `Release
metadata`. Those are skipped when your diff doesn't touch their half, and a
skipped job reports no status at all, so a required check that never reports
would leave a docs-only PR permanently stuck on "Expected — waiting for status".
The `CI` job always runs and aggregates the rest.

The name only appears in that search **after it has reported once**, so merge
`.github/workflows/ci.yml` and let it run on one PR first.

**2. Require code-owner review.** Settings → Rules → same ruleset → *Require a
pull request before merging* → Show additional settings → **Require review from
Code Owners**.

`.github/CODEOWNERS` already lists the files that decide a release. Without this
setting ticked that file does nothing, and since merging a version bump now
publishes to every installed copy, this is what keeps that decision yours.

**3. Check the secret.** `TAURI_SIGNING_PRIVATE_KEY` must be set. There is
deliberately **no** `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the key has no
password and GitHub cannot store an empty secret, so the empty reference in the
workflow is correct. Do not "fix" it by inventing a value.

---

## Known gaps

Two checks are deliberately missing from CI, both because the codebase does not
pass them today and forcing it to in passing would mean reformatting
load-bearing code:

- **`cargo fmt --check`** — nine files under `product/src-tauri/src/` differ from
  rustfmt.
- **`cargo clippy -D warnings`** — the crate emits five clippy warnings. They are
  printed in the **Rust** job's log; `-D warnings` is the flag to add the day
  they're cleaned up.

Neither blocks a merge. Both are one-line changes in `.github/workflows/ci.yml`
once someone does the cleanup.
