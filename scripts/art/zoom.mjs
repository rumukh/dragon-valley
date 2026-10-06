// @ts-check
/**
 * Quick zoom sheet for close review at true pixels (keep under 800 px wide):
 *   node scripts/art/zoom.mjs <name> <dragon:stage:expression[:framing]> ... [--size 190] [--cols 4]
 * Writes out/art-gallery/png/zoom-<name>.png
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  const box = (/** @type {string} */ svg) =>
    `<div style="display:inline-block;margin:2px;background:#fff;border-radius:8px;text-align:center;font:11px sans-serif">${svg}<div>${spec}</div></div>`;
  const [kind, a1 = '', a2 = ''] = spec.split(':');
  if (kind === 'boss') return box(art.renderBoss(a1, a2, { idPrefix: `z${i++}`, size }));
  if (kind === 'icon') return box(art.renderIcon(a1, { idPrefix: `z${i++}`, size }));
  if (kind === 'cos') return box(art.renderCosmeticIcon(a1, { idPrefix: `z${i++}`, size }));
  if (kind === 'avatar') return box(art.renderAvatar(a1, { idPrefix: `z${i++}`, size }));
  if (kind === 'bg') {
    const svg = readFileSync(join(ROOT, 'assets', 'backgrounds', `${a1}.svg`), 'utf8').replace(
      / width="1600" height="1000"/,
      ` width="${size}" height="${Math.round((size * 1000) / 1600)}"`,
    );
    let overlay = '';
    if (a2 === 'hot') {
      const hot = art.MAP_HOTSPOTS;
      overlay = `<svg viewBox="0 0 1600 1000" width="${size}" height="${Math.round((size * 1000) / 1600)}" style="position:absolute;left:0;top:0">${hot.hotspots.map((/** @type {any} */ s) => `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="none" stroke="#ff2d55" stroke-width="4" stroke-dasharray="12 8"/>`).join('')}${Object.values(
        hot.regions,
      )
        .flatMap((/** @type {any} */ r) => [
          ...r.nodes.map(
            (/** @type {any} */ n) =>
              `<circle cx="${n.x}" cy="${n.y}" r="13" fill="#fff" stroke="#2a2140" stroke-width="4"/>`,
          ),
          `<circle cx="${r.boss.x}" cy="${r.boss.y}" r="18" fill="#ff2d55" stroke="#2a2140" stroke-width="4"/>`,
        ])
        .join('')}</svg>`;
    }
    return `<div style="position:relative;display:inline-block;margin:2px">${svg}${overlay}</div>`;
  }
  if (kind === 'hall') {
    const w = art.HALL_WINDOW;
    const k = size / 1600;
    const bg = readFileSync(join(ROOT, 'assets', 'backgrounds', 'castle-hall.svg'), 'utf8').replace(
      / width="1600" height="1000"/,
      ` width="${size}" height="${Math.round(size * 0.625)}"`,
    );
    const win = art
      .renderMagicWindow({
        ...art.magicWindowSamples()[Number(a1 || 2)].options,
        idPrefix: `z${i++}`,
        size: w.width * k,
      })
      .replace(/ height="[\d.]+"/, ` height="${w.height * k}"`);
    return `<div style="position:relative;display:inline-block;margin:2px">${bg}<div style="position:absolute;left:${w.x * k}px;top:${w.y * k}px">${win}</div></div>`;
  }
  if (kind === 'sticker')
    return box(
      art.renderSticker({ ...art.stickerSamples()[Number(a1)], idPrefix: `z${i++}`, size }),
    );
  if (kind === 'window')
    return box(
      art.renderMagicWindow({
        ...art.magicWindowSamples()[Number(a1)].options,
        idPrefix: `z${i++}`,
        size,
      }),
    );
  if (kind === 'grid')
    return box(
      art.renderMasteryGrid({
        op: a1,
        cells:
          art.magicWindowSamples()[Number(a2)].options[
            a1 === 'mul' ? 'multiplication' : 'division'
          ],
        idPrefix: `z${i++}`,
        size,
      }),
    );
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
const cellH = specs.every((s) => s.startsWith('bg:') || s.startsWith('hall'))
  ? Math.round((size * 1000) / 1600) + 6
  : size + 24;
screenshot(html, join(OUT, 'png', `zoom-${name}.png`), width, rows * cellH + 16);
console.log(`png/zoom-${name}.png`);
