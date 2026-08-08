## Release steps

Steps 1–3 (the actual file edits) happen on `lenny`. `main` only enters the picture at step 4, to receive the finished merge and the tag.

### Step 1 — On `lenny`: edit `product/src-tauri/tauri.conf.json` (line 4)

```bash
git checkout lenny
git pull origin lenny
```

```json
"version": "x.x.x",
```

### Step 2 — On `lenny`: edit `lib/site.ts` (line 15)

```ts
const version = "x.x.x";
```

> **Note:** bumping `lib/site.ts` changes the marketing site's download button to point at the new installer. Once this lands on `main` and the site redeploys, that button will 404 for the few minutes between the merge and the Actions run finishing. Not worth restructuring for — just don't be alarmed if you test it early.

### Step 3 — On `lenny`: add to `CHANGELOG.md`, then commit and push

Paste the new section directly above the previous version's `##` heading. The workflow reads from the heading to the next `##`, so ordering only matters for humans — but keep newest first anyway.

```markdown
## x.x.x — 20xx-xx-xx

**Crest can stay on screen now.** A new Settings window lets you keep the notch
pinned above everything else instead of hiding when you move the cursor away.

### New

- **Settings window** — open it from the tray menu to change how Crest behaves
- **Always on top** — the pill rests on screen and stays above other windows,
  including full-screen apps

### Fixed

- Crest no longer slips behind other windows after a game or video goes
  full-screen — it re-asserts its position every time the notch opens
```

```bash
git add product/src-tauri/tauri.conf.json lib/site.ts CHANGELOG.md
git add .
git commit -m "chore: prep release x.x.x"
git push origin lenny
```

Everything up to here can be redone, force-pushed, or abandoned on `lenny` with zero consequences — nothing has touched `main` yet.

### Step 4 — Merge `lenny` into `main`

```bash
git checkout main
git pull origin main
git merge lenny
git push origin main
```

Use a PR instead of a local merge if you want a review/CI gate before code lands on `main` — either way, `main` should end up holding exactly the three edits from steps 1–3, nothing more.

### Step 5 — Tag and push from `main`

```bash
git tag vx.x.x
git push origin vx.x.x
```

That last line is what fires the build. Watch it at:
`https://github.com/LennyDany-03/Dynamic-Notch/actions`

Cold Rust builds take ~10 minutes, cached ~2.

---

## If it fails

Fix the problem on `lenny` as usual, merge into `main` again, then **move the tag** — a failed run publishes nothing, so reusing the version number is fine:

```bash
git tag -d vx.x.x
git push origin :refs/tags/vx.x.x
git tag vx.x.x
git push origin vx.x.x
```

If the code was fine and only the workflow hiccuped, re-run without touching the tag:
**Actions tab → Release → Run workflow → enter `vx.x.x`**

---

## Verify the update reached users

Once the run is green, check that `latest.json` is live and points at the new version:

```bash
curl -L https://github.com/LennyDany-03/Dynamic-Notch/releases/latest/download/latest.json
```

If that returns **404**, the release was published as a draft — drafts aren't reachable at that URL, and the app would silently see no update. The workflow sets `releaseDraft: false`, so this shouldn't happen, but it's the one failure mode that looks like success.