// Build a sideloadable copy of the Store package, for local testing only.
//
// Windows will not install an unsigned MSIX unless the package says, in its own
// identity, that being unsigned is deliberate: the Publisher must carry the
// marker OID `2.25.311729368913984317654407730594956997722=1`, and only then does
// `Add-AppxPackage -AllowUnsigned` accept it. That marker cannot go on the real
// package, because Partner Center pins Publisher to the exact string it reserved
// (`CN=4E27AC9C-…`) and anything appended to it no longer matches. So the two
// requirements are mutually exclusive by construction and the answer is two
// packages: the real one for upload, and this one, which is that same package
// with one attribute changed.
//
// **This script never writes to `gen/windows/bundle.config.json`.** The obvious
// implementation — swap in a test config, build, swap back — has a window where
// the committed Store identity is sitting on disk replaced by a test one, and a
// build interrupted in that window leaves the repo quietly poisoned in exactly
// the way `CLAUDE.md` warns about for `tauri.windows.conf.json`. Instead the
// normal build runs untouched, and this copies what it staged and edits the copy.
// The real-identity path cannot be affected by anything below, because nothing
// below opens any of its files for writing.
//
// Editing the staged manifest rather than generating a second one is also what
// keeps the test meaningful: the package that gets sideloaded is byte-identical
// to the one that goes to Partner Center apart from the Publisher string, so a
// bug found here is a bug that would have shipped, and a bug that would have
// shipped cannot hide behind "well, the test build was configured differently".

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcTauri = path.join(projectRoot, 'src-tauri');

/// The marker that makes `-AllowUnsigned` work. Not ours and not arbitrary — it is
/// the OID Windows looks for, and the value has to be exactly `1`.
const UNSIGNED_OID = 'OID.2.25.311729368913984317654407730594956997722=1';

/// The CN is free text precisely because this identity is never submitted
/// anywhere. It is written to be unmistakable in `Get-AppxPackage` output, since
/// the Name stays the same as the real package and Publisher is the only thing
/// telling the two apart on a machine that has both.
const TEST_PUBLISHER = `CN=Crest Local Test, ${UNSIGNED_OID}`;

const arch = process.argv[2] === 'arm64' ? 'arm64' : 'x64';

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
    // cargo unavailable — the default below is right for this repo anyway.
  }
  return path.join(srcTauri, 'target');
}

const target = targetDir();
const stagedDir = path.join(target, 'appx', arch);
const testDir = path.join(target, 'appx', `${arch}-localtest`);
const outDir = path.join(target, 'msix-localtest');

const stagedManifest = path.join(stagedDir, 'AppxManifest.xml');
if (!fs.existsSync(stagedManifest)) {
  console.error(
    `build-msix-local: nothing staged at ${stagedDir}.\n` +
      `Run \`npm run tauri:msix:build\` first — the npm script chains them for you.`,
  );
  process.exit(1);
}

// Fresh copy every time. A stale one would be packaged without complaint and the
// thing under test would be whatever was last built, which is the failure mode
// this whole script exists to avoid.
fs.rmSync(testDir, { recursive: true, force: true });
fs.cpSync(stagedDir, testDir, { recursive: true });

const manifestPath = path.join(testDir, 'AppxManifest.xml');
const manifest = fs.readFileSync(manifestPath, 'utf8');

// Scoped to the Identity element. `Publisher="` appears once in a valid manifest —
// `PublisherDisplayName` is an element, not an attribute — but an unanchored
// replace on a file this important should not depend on that staying true.
const identity = manifest.match(/<Identity\b[^>]*>/);
if (!identity) {
  console.error('build-msix-local: no <Identity> element in the staged manifest.');
  process.exit(1);
}

const patchedIdentity = identity[0].replace(/\bPublisher="[^"]*"/, `Publisher="${TEST_PUBLISHER}"`);
if (patchedIdentity === identity[0]) {
  console.error('build-msix-local: <Identity> has no Publisher attribute to replace.');
  process.exit(1);
}

fs.writeFileSync(manifestPath, manifest.replace(identity[0], patchedIdentity), 'utf8');

const cli = path.join(
  projectRoot,
  'node_modules',
  '@choochmeque',
  'msixbundle-cli-win32',
  'bin',
  arch,
  'msixbundle-cli.exe',
);
if (!fs.existsSync(cli)) {
  console.error(`build-msix-local: packer not found at ${cli}. Run \`npm install\`.`);
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
execFileSync(cli, ['--force', '--out-dir', outDir, `--dir-${arch}`, testDir], {
  stdio: 'inherit',
});

const built = fs
  .readdirSync(outDir)
  .filter((f) => f.endsWith('.msix'))
  .map((f) => path.join(outDir, f));

console.log('\nLocal test package (NOT for Partner Center):');
for (const file of built) console.log(`  ${file}`);
console.log(`\n  Publisher: ${TEST_PUBLISHER}`);
console.log('\nSideload it with:\n');
console.log(`  Add-AppxPackage -Path "${built[0] ?? '<package>.msix'}" -AllowUnsigned`);
console.log('\nRemove it again with:\n');
console.log('  Get-AppxPackage *CrestNotch* | Remove-AppxPackage');
