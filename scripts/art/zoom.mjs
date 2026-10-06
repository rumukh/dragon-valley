// @ts-check
/**
 * Quick zoom sheet for close review at true pixels (keep under 800 px wide):
 *   node scripts/art/zoom.mjs <name> <dragon:stage:expression[:framing]> ... [--size 190] [--cols 4]
 * Writes out/art-gallery/png/zoom-<name>.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadArt, screenshot } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (/** @type {string} */ k, /** @type {number} */ d) => {
  const i = args.indexOf(k);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const size = opt('--size', 190);
const cols = opt('--cols', 4);
const name = args[0] ?? 'x';
const specs = args
  .slice(1)
  .filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] ?? '').startsWith('--'));
const art = await loadArt();
let i = 0;
const cells = specs.map((spec) => {
  const [dragon, stage = 'adult', expression = 'idle', framing = 'fit', outfitSlot, outfitId] =
    spec.split(':');
  const outfit = outfitSlot && outfitId ? { [outfitSlot]: outfitId } : {};
  const svg = art.renderDragon({
    dragon,
    stage,
    expression,
    framing,
    outfit,
    idPrefix: `z${i++}`,
    size,
  });
  return `<div style="display:inline-block;margin:2px;background:#fff;border-radius:8px;text-align:center;font:11px sans-serif">${svg}<div>${spec}</div></div>`;
});
const OUT = join(ROOT, 'out', 'art-gallery');
mkdirSync(join(OUT, 'png'), { recursive: true });
const html = join(OUT, `zoom-${name}.html`);
const width = cols * (size + 8) + 16;
const rows = Math.ceil(cells.length / cols);
writeFileSync(
  html,
  `<!doctype html><html data-reduced-motion="true"><body style="margin:6px;background:#fff8ec;width:${width - 12}px">${cells.join('')}</body></html>`,
);
screenshot(html, join(OUT, 'png', `zoom-${name}.png`), width, rows * (size + 24) + 16);
console.log(`png/zoom-${name}.png`);
