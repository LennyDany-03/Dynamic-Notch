// Give the MSIX bundler the executable name it expects, without renaming the crate.
//
// `@choochmeque/tauri-windows-bundle` derives the packaged executable name from
// `productName` — "Crest" becomes `Crest.exe`, and the AppxManifest's
// `Application/@Executable` is written to match. Cargo, though, names the binary
// after the *package*, which here is `windows_dynamic_noich`: the typo from the
// original scaffold that `CLAUDE.md` says to leave alone because `[lib]` and
// `main.rs` both reference it. Normally the two agree and nobody notices; here
// they do not, so `--no-bundle` leaves `windows_dynamic_noich.exe` on disk and
// the bundler stops with "Executable not found: …\Crest.exe".
//
// The obvious fixes both reach further than they look. Renaming the package is
// the rename `CLAUDE.md` warns about. Adding a `[[bin]] name = "Crest"` is
// narrower but still changes what `cargo build` emits for *every* build, which
// includes the NSIS installer that ships to everyone who is not on the Store —
// and the one rule this whole MSIX branch is under is that it must not touch
// that path. Copying the file afterwards is the only version of this that the
// NSIS build cannot observe at all.
//
// A copy rather than a rename, deliberately: `tauri-windows-bundle` runs its own
// `tauri build` after this script, and cargo checks freshness by the name it
// knows. Move the file and that build re-links from scratch every time.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcTauri = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src-tauri');

/** The binary cargo actually wrote — `[[bin]]` if one is declared, else the package name. */
function cargoBinName() {
  const toml = fs.readFileSync(path.join(srcTauri, 'Cargo.toml'), 'utf8');
  // `[[bin]]` wins over `[package]`, and only the first block of each matters.
  const bin = toml.match(/\[\[bin\]\][\s\S]*?\bname\s*=\s*"([^"]+)"/);
  if (bin) return bin[1];
  const pkg = toml.match(/\[package\][\s\S]*?\bname\s*=\s*"([^"]+)"/);
  if (!pkg) throw new Error('Could not read a binary name out of Cargo.toml');
  return pkg[1];
}

/** The name the bundler will look for, by the same rule the bundler uses. */
function packagedExeName() {
  const conf = JSON.parse(fs.readFileSync(path.join(srcTauri, 'tauri.conf.json'), 'utf8'));
  return `${(conf.productName ?? 'App').replace(/\s+/g, '')}.exe`;
}

/** Honour `CARGO_TARGET_DIR` / `build.target-dir`, which the bundler also resolves. */
function targetDir() {
  if (process.env.CARGO_TARGET_DIR) return path.resolve(process.env.CARGO_TARGET_DIR);
  try {
    const meta = JSON.parse(
      execFileSync('cargo', ['metadata', '--format-version', '1', '--no-deps'], {
        cwd: srcTauri,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    );
    if (meta.target_directory) return meta.target_directory;
  } catch {
    // cargo missing or unhappy — the default below is right for this repo anyway.
  }
  return path.join(srcTauri, 'target');
}

const arch = process.argv[2] === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
const buildDir = path.join(targetDir(), arch, 'release');

const from = path.join(buildDir, `${cargoBinName()}.exe`);
const to = path.join(buildDir, packagedExeName());

if (path.resolve(from) === path.resolve(to)) {
  console.log(`stage-msix-exe: ${path.basename(to)} is already what cargo emits — nothing to do.`);
  process.exit(0);
}

if (!fs.existsSync(from)) {
  console.error(
    `stage-msix-exe: ${from} does not exist.\n` +
      `Run the release build for ${arch} first — the npm script does this for you.`,
  );
  process.exit(1);
}

fs.copyFileSync(from, to);
console.log(`stage-msix-exe: ${path.basename(from)} -> ${path.basename(to)}`);
