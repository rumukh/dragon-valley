// @ts-check
/**
 * Review sheets for the strategy pictures (src/app/ui/models.ts): every model kind on its sample
 * problems, drawn by the shell's own renderer and stylesheets at gameplay size (the model slot
 * under the dragon, about 300 px wide at 1280 × 800). Each kind shows the picture after a miss
 * (`solved`), before answering (a hint, a re-ask: the line ends in an empty box) and in the
 * international notation.
 *
 *   node scripts/art/models-gallery.mjs            -> out/models-gallery/index.html and PNGs
 *   node scripts/art/models-gallery.mjs --no-png   HTML only
 */
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, screenshot } from './lib.mjs';

const OUT = join(ROOT, 'out', 'models-gallery');
const SLOT = 300;
const KINDS = ['place-shift', 'tens-groups', 'split-mul', 'split-div', 'order-steps'];

/** Sample problems per kind, as `[left operator right]` or a whole expression in contract terms. */
const ENTRY = `
import { applyTokens } from '../../src/app/design/tokens';
import { createTranslator } from '../../src/app/i18n/messages';
import { modelFor } from '../../src/app/math/model';
import { formatProblem } from '../../src/app/math/notation';
import { modelFigure } from '../../src/app/ui/models';
import { BLANK, group, num, op } from '../../src/rules/contract';
import '../../src/app/styles/base.css';
import '../../src/app/styles/components.css';
import '../../src/app/styles/screens.css';
import '../../src/app/styles/models.css';

const t = createTranslator();
const eq = (left) => ({ kind: 'equation', left, right: BLANK });
const mul = (a, b) => eq(op('mul', num(a), num(b)));
const div = (a, b) => eq(op('div', num(a), num(b)));
const SAMPLES = {
  'place-shift': [mul(34, 10), mul(7, 100), div(340, 10), mul(10, 100), div(700, 100)],
  'tens-groups': [mul(30, 3), mul(4, 20), mul(50, 4), mul(20, 9), mul(90, 9)],
  'split-mul': [mul(38, 8), mul(11, 6), mul(8, 47), mul(91, 2), mul(99, 9)],
  'split-div': [div(96, 8), div(48, 3), div(69, 3), div(80, 8), div(99, 9)],
  'order-steps': [
    eq(op('sub', op('mul', num(4), num(6)), num(8))),
    eq(op('div', group(op('add', num(16), num(8))), num(3))),
    eq(op('sub', op('add', num(12), op('mul', num(4), num(6))), num(8))),
    eq(op('add', op('mul', num(2), num(3)), op('mul', num(4), num(5)))),
    eq(op('sub', num(60), op('div', group(op('add', num(12), num(8))), num(4)))),
  ],
};

applyTokens(document.documentElement);
const params = new URLSearchParams(globalThis.DV_PARAMS ?? location.hash.slice(1));
const only = params.get('kind');
const limit = Number(params.get('limit') ?? 99);
if (params.get('cols')) document.documentElement.style.setProperty('--cols', params.get('cols'));
const sheet = document.getElementById('sheet');
for (const [kind, problems] of Object.entries(SAMPLES)) {
  if (only && kind !== only) continue;
  const row = document.createElement('section');
  row.className = 'row';
  const title = document.createElement('h2');
  title.textContent = kind;
  row.append(title);
  const cells = document.createElement('div');
  cells.className = 'cells';
  problems.forEach((problem, index) => {
    const variants = index === 0
      ? [['czech', false], ['czech', true], ['international', true]]
      : [['czech', true]];
    for (const [notation, solved] of variants) {
      if (cells.children.length >= limit) break;
      const model = modelFor(problem);
      const cell = document.createElement('div');
      cell.className = 'cell';
      const caption = document.createElement('p');
      caption.className = 'tag';
      caption.textContent = formatProblem(problem, notation) + (solved ? '  (after a miss)' : '  (before answering)') + (notation === 'czech' ? '' : '  international');
      const slot = document.createElement('div');
      slot.className = 'dv-round__model';
      if (model) slot.append(modelFigure(model, { t, notation, solved }));
      else slot.textContent = 'NO MODEL for ' + kind;
      if (model && model.kind !== kind) slot.prepend('WRONG KIND ' + model.kind);
      cell.append(caption, slot);
      cells.append(cell);
    }
  });
  row.append(cells);
  sheet.append(row);
}
`;

async function main() {
  const png = !process.argv.includes('--no-png');
  mkdirSync(OUT, { recursive: true });
  await build({
    stdin: { contents: ENTRY, resolveDir: join(ROOT, 'scripts', 'art'), loader: 'ts' },
    bundle: true,
    format: 'iife',
    outdir: OUT,
    entryNames: 'models',
    loader: { '.woff2': 'file', '.svg': 'file' },
    logLevel: 'warning',
  });
  const font = (/** @type {string} */ file, /** @type {number} */ weight) =>
    `@font-face { font-family: 'DV Reading'; font-weight: ${weight}; src: url('${pathToFileURL(join(ROOT, 'assets', 'fonts', 'dv-reading', file)).href}') format('woff2'); }`;
  const backdrop = pathToFileURL(join(ROOT, 'assets', 'backgrounds', 'giants-peaks.svg')).href;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Strategy pictures</title>
<link rel="stylesheet" href="models.css">
<style>
${font('DVReading-Regular.woff2', 400)}
${font('DVReading-Bold.woff2', 700)}
body { margin: 0; padding: 16px 20px; background: url('${backdrop}') center / cover fixed; }
.row { margin: 0 0 14px; }
.row h2 { margin: 0 0 6px; font-size: 18px; color: #2a2140; background: #fff8ecd0; display: inline-block; padding: 2px 10px; border-radius: 8px; }
.cells { display: grid; grid-template-columns: repeat(var(--cols, 7), ${SLOT}px); gap: 10px; align-items: start; }
.cell { display: grid; gap: 4px; }
.tag { margin: 0; font: 600 12px/1.2 system-ui; color: #2a2140; background: #fff8ecd0; padding: 2px 6px; border-radius: 6px; justify-self: start; }
</style></head><body><main id="sheet"></main><script src="models.js"></script></body></html>`;
  const page = join(OUT, 'index.html');
  writeFileSync(page, html);
  if (png) {
    screenshot(page, join(OUT, 'models.png'), 2200, 1700);
    // True-pixel close-ups, one kind each (two cells across, four cells).
    for (const kind of KINDS) {
      const zoom = join(OUT, `zoom-${kind}.html`);
      writeFileSync(
        zoom,
        html.replace(
          '<script src="models.js">',
          `<script>globalThis.DV_PARAMS = 'kind=${kind}&cols=2&limit=4';</script><script src="models.js">`,
        ),
      );
      screenshot(zoom, join(OUT, `zoom-${kind}.png`), 680, 640);
    }
  }
  console.log(`models gallery: ${page}`);
}

await main();
