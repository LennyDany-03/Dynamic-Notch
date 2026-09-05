/**
 * Generates the MSIX tile assets into `src-tauri/gen/windows/Assets/`.
 *
 * Why this exists, and why it runs on every MSIX build:
 *
 * `tauri-windows-bundle` stages tile assets exactly once — at `init`, or when a
 * build is given `--regenerate-assets` — and its own generator can only copy
 * three of them. Its `TAURI_ICON_MAP` covers StoreLogo, Square44x44 and
 * Square150x150; everything else is either invented or missing. What it invents
 * for `Wide310x150Logo.png` is the reason for this file: `generateWideTile`
 * composites the square icon onto a fresh `new Image(310, 150, RGBA)` with
 * image-js `copyTo`, the copy does not land, and what is written out is a
 * **solid opaque black 310x150 rectangle**. Measured on 0.7.2: alpha 255 across
 * the whole tile, RGB 0 across the whole tile, 554 bytes.
 *
 * That is what failed Microsoft Store certification under policy 10.1.1.11 ("On
 * Device Tiles" — tile icons must uniquely represent the product): the wide
 * tile shipped as a black placeholder. Nothing errors in that path, which is
 * what let it ship — the bundler prints "Copied assets from icons" and counts
 * the black tile as a success.
 *
 * Square71x71Logo and Square310x310Logo are the other half: the bundler has no
 * entry for either, so the medium and large tiles were never staged at all and
 * the manifest could not reference them.
 *
 * So the assets are generated here, from the app's own art, and the npm script
 * runs this *before* `tauri-windows-bundle build`. The build itself only
 * `cpSync`s `gen/windows/Assets/` into the appx staging dir, so whatever this
 * writes is what ships. Do **not** pass `--regenerate-assets` to the bundler:
 * it would overwrite the wide tile with the black one again and drop the two
 * tiles it does not know about, i.e. re-create the certification failure.
 *
 * Nothing here touches the NSIS path — `src-tauri/icons/` is read, never
 * written, and the output directory is read by the MSIX build alone.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Image, read, write } from 'image-js';

const SRC_TAURI = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'src-tauri');
const ICONS_DIR = path.join(SRC_TAURI, 'icons');
const OUT_DIR = path.join(SRC_TAURI, 'gen', 'windows', 'Assets');

/**
 * The master is the iOS 1024x1024, not `icon.png` (512) and not
 * `Square310x310Logo.png` (310) — the bundler's own `VARIANT_SOURCE_CANDIDATES`.
 * Same art, four times the pixels, and the scale variants below need every one
 * of them: `Square150x150Logo.scale-400` alone is 600px, which a 512 master can
 * only reach by upscaling.
 */
const MASTER_CANDIDATES = [
  path.join(ICONS_DIR, 'ios', 'AppIcon-512@2x.png'), // 1024
  path.join(ICONS_DIR, 'icon.png'), // 512
  path.join(ICONS_DIR, 'Square310x310Logo.png'), // 310
];

/** Every tile the manifest references. `wide` is the one that is not square. */
const TILES = [
  { name: 'StoreLogo.png', width: 50, height: 50 },
  { name: 'Square44x44Logo.png', width: 44, height: 44 },
  { name: 'Square71x71Logo.png', width: 71, height: 71 },
  { name: 'Square150x150Logo.png', width: 150, height: 150 },
  { name: 'Square310x310Logo.png', width: 310, height: 310 },
  { name: 'Wide310x150Logo.png', width: 310, height: 150, wide: true },
];

const SCALE_FACTORS = [100, 125, 150, 200, 400];

/**
 * Target-size variants are the *app list and taskbar* icon, not a tile — they
 * are what Windows picks for the Start menu's all-apps row, Alt+Tab and the
 * jump list, and without them all five of those scale the plated 44x44 down.
 * `unplated` drops the background plate Windows would otherwise draw behind the
 * icon, which is right here because the mark is full-bleed and carries its own
 * field; `lightunplated` is the same art for a light-themed taskbar, where the
 * blue field is what keeps a white glyph legible.
 */
const TARGET_SIZES = [16, 24, 32, 48, 256];
const ALTFORMS = [null, 'unplated', 'lightunplated'];

function loadMaster() {
  for (const candidate of MASTER_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`No source icon found. Looked for:\n  ${MASTER_CANDIDATES.join('\n  ')}`);
}

/**
 * Area-average (box filter) resample.
 *
 * image-js `resize` defaults to bilinear, which point-samples: taking a 1024px
 * master down to the 16px target-size variant would read 256 of 1,048,576
 * source pixels and alias the curve of the mark into a smear. A box filter
 * integrates every source pixel that falls under the destination pixel,
 * fractional edge coverage included, which is what a proper image pipeline does
 * for a downscale this large.
 *
 * Only ever called for a downscale — `scaledSizes` refuses anything the master
 * cannot cover — where the filter is exact. It degenerates for an upscale.
 */
function resample(src, dstWidth, dstHeight) {
  const { width: sw, height: sh, channels, data } = src;
  const out = new Uint8Array(dstWidth * dstHeight * channels);
  const xRatio = sw / dstWidth;
  const yRatio = sh / dstHeight;
  const acc = new Float64Array(channels);

  for (let dy = 0; dy < dstHeight; dy++) {
    const y0 = dy * yRatio;
    const y1 = (dy + 1) * yRatio;
    const sy0 = Math.floor(y0);
    const sy1 = Math.min(sh, Math.ceil(y1));

    for (let dx = 0; dx < dstWidth; dx++) {
      const x0 = dx * xRatio;
      const x1 = (dx + 1) * xRatio;
      const sx0 = Math.floor(x0);
      const sx1 = Math.min(sw, Math.ceil(x1));

      acc.fill(0);
      let weight = 0;

      for (let sy = sy0; sy < sy1; sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        if (wy <= 0) continue;
        for (let sx = sx0; sx < sx1; sx++) {
          const wx = Math.min(x1, sx + 1) - Math.max(x0, sx);
          if (wx <= 0) continue;
          const w = wx * wy;
          const o = (sy * sw + sx) * channels;
          for (let c = 0; c < channels; c++) acc[c] += data[o + c] * w;
          weight += w;
        }
      }

      const o = (dy * dstWidth + dx) * channels;
      for (let c = 0; c < channels; c++) out[o + c] = Math.round(acc[c] / weight);
    }
  }

  return { width: dstWidth, height: dstHeight, channels, data: out };
}

/**
 * The wide tile is the mark centred at full tile height on the mark's own field
 * colour, sampled from a corner of the master rather than hard-coded — the art
 * is a full-bleed square, so the field and the composite are the same blue and
 * the tile reads as one rectangle with the C on its centre line.
 *
 * Composited by hand rather than with image-js `copyTo`, which is what produced
 * the black tile this script exists to replace.
 */
function wideTile(master, width, height) {
  const channels = 4;
  const mark = resample(master, height, height);
  const field = [master.data[0], master.data[1], master.data[2]];

  const out = new Uint8Array(width * height * channels);
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    out[o] = field[0];
    out[o + 1] = field[1];
    out[o + 2] = field[2];
    out[o + 3] = 255;
  }

  const left = Math.round((width - mark.width) / 2);
  for (let y = 0; y < mark.height; y++) {
    for (let x = 0; x < mark.width; x++) {
      const s = (y * mark.width + x) * mark.channels;
      const d = (y * width + (left + x)) * channels;
      // Source-over. The art is opaque today, so this is a copy — but a mark
      // that ever gains transparency must land on the field, not punch a hole.
      const a = mark.channels === 4 ? mark.data[s + 3] / 255 : 1;
      for (let c = 0; c < 3; c++) {
        out[d + c] = Math.round(mark.data[s + c] * a + out[d + c] * (1 - a));
      }
      out[d + 3] = 255;
    }
  }

  return { width, height, channels, data: out };
}

function toImage(buf) {
  return new Image(buf.width, buf.height, {
    data: buf.data,
    colorModel: buf.channels === 4 ? 'RGBA' : 'RGB',
  });
}

/**
 * A scale variant is only written when the master can cover it without being
 * upscaled — a blurry stretched asset is worse than letting Windows pick the
 * next size down, and every skip is reported so a future icon refresh at a
 * higher resolution shows up as sizes that start being written.
 *
 * At a 1024 master that skips exactly two: `Square310x310Logo.scale-400`
 * (1240px) and `Wide310x150Logo.scale-400` (1240x600).
 */
function scaledSizes(tile, masterSize) {
  const kept = [];
  const skipped = [];
  for (const factor of SCALE_FACTORS) {
    const width = Math.round((tile.width * factor) / 100);
    const height = Math.round((tile.height * factor) / 100);
    (Math.max(width, height) <= masterSize ? kept : skipped).push({ factor, width, height });
  }
  return { kept, skipped };
}

async function main() {
  const masterPath = loadMaster();
  const masterImage = await read(masterPath);
  const master = {
    width: masterImage.width,
    height: masterImage.height,
    channels: masterImage.channels,
    data: masterImage.data,
  };
  const masterSize = Math.min(master.width, master.height);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Crest MSIX assets');
  console.log(`  master  ${path.relative(SRC_TAURI, masterPath)} (${master.width}x${master.height})`);
  console.log(`  out     ${path.relative(SRC_TAURI, OUT_DIR)}`);

  let written = 0;
  const skippedAll = [];

  for (const tile of TILES) {
    const { kept, skipped } = scaledSizes(tile, masterSize);
    for (const { factor, width, height } of kept) {
      const buf = tile.wide ? wideTile(master, width, height) : resample(master, width, height);
      const stem = tile.name.replace(/\.png$/i, '');
      // scale-100 is written under the plain name as well: the manifest
      // references the unqualified file, and a package without a resource
      // index resolves that name literally.
      const names =
        factor === 100 ? [tile.name, `${stem}.scale-100.png`] : [`${stem}.scale-${factor}.png`];
      for (const name of names) {
        await write(path.join(OUT_DIR, name), toImage(buf));
        written++;
      }
    }
    for (const s of skipped) {
      skippedAll.push(`${tile.name} scale-${s.factor} (${s.width}x${s.height})`);
    }
  }

  for (const size of TARGET_SIZES) {
    const buf = resample(master, size, size);
    for (const altform of ALTFORMS) {
      const suffix = altform ? `targetsize-${size}_altform-${altform}` : `targetsize-${size}`;
      await write(path.join(OUT_DIR, `Square44x44Logo.${suffix}.png`), toImage(buf));
      written++;
    }
  }

  console.log(`  wrote   ${written} assets`);
  if (skippedAll.length > 0) {
    console.log(`  skipped ${skippedAll.length} (would upscale past the ${masterSize}px master):`);
    for (const s of skippedAll) console.log(`            ${s}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
