// @ts-check
/**
 * Review sheets and a size check for the strategy pictures (src/app/ui/models.ts), drawn by the
 * shell's own renderer and stylesheets in a browser (the installed Edge through Playwright, or
 * Playwright's Chromium).
 *
 * - `out/models-gallery/models.png`: every kind on its sample problems in a 306 px slot (the
 *   model slot of a 1280 × 800 round), after a miss, before answering and in the international
 *   notation; `zoom-<kind>.png` at true pixels.
 * - The size check: every sample (both notations, with and without the answer) in the model slot
 *   of the layout budget (`BUDGET`) at each child viewport, in a normal round and in a boss round.
 *   At 100 % text a figure must fit the slot's height; at 100 % and 200 % text nothing may reach
 *   out of the round's left column. Results go to `out/models-gallery/budget.json`, with
 *   `budget-<case>.png` sheets; the script fails when anything is over.
 *
 *   node scripts/art/models-gallery.mjs
 */
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib.mjs';

const OUT = join(ROOT, 'out', 'models-gallery');
const KINDS = ['place-shift', 'tens-groups', 'split-mul', 'split-div', 'order-steps'];

/**
 * The model slot at 100 % text in S3's round layout (PR D, measured in the real round with a
 * hatched dragon): the slot's width, which is the round's left column, and the height free for a
 * picture. A boss round's height is the Seven-Headed Dragon's, the tightest boss (its heads line
 * takes room), capped at 260 px at 1366 x 657 as S3 asked.
 */
const BUDGET = [
  { viewport: [1024, 768], normal: [246, 419], boss: [293, 355] },
  { viewport: [1180, 820], normal: [284, 453], boss: [339, 392] },
  { viewport: [1280, 800], normal: [311, 440], boss: [370, 378] },
  { viewport: [1366, 657], normal: [335, 347], boss: [400, 260] },
  { viewport: [1536, 730], normal: [379, 394], boss: [451, 328] },
];

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
const sheet = document.getElementById('sheet');

/** One model slot as the round builds it: the left column, and the slot under the dragon. */
function slot(problem, notation, solved, width, boss) {
  const round = document.createElement('div');
  round.className = boss ? 'dv-round--boss' : '';
  const cast = document.createElement('div');
  cast.className = 'dv-round__cast';
  cast.style.width = width + 'px';
  const model = document.createElement('div');
  model.className = 'dv-round__model';
  const made = modelFor(problem);
  if (made) model.append(modelFigure(made, { t, notation, solved }));
  cast.append(model);
  round.append(cast);
  return round;
}

function label(text) {
  const tag = document.createElement('p');
  tag.className = 'tag';
  tag.textContent = text;
  return tag;
}

/** The review sheet: every kind, the first sample before answering and international too. */
window.dvSheet = (only, limit, width) => {
  sheet.replaceChildren();
  sheet.className = 'sheet';
  for (const [kind, problems] of Object.entries(SAMPLES)) {
    if (only && kind !== only) continue;
    const row = document.createElement('section');
    row.className = 'row';
    const title = document.createElement('h2');
    title.textContent = kind;
    const cells = document.createElement('div');
    cells.className = 'cells';
    problems.forEach((problem, index) => {
      const variants = index === 0
        ? [['czech', false], ['czech', true], ['international', true]]
        : [['czech', true]];
      for (const [notation, solved] of variants) {
        if (cells.children.length >= limit) return;
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.append(
          label(formatProblem(problem, notation) + (solved ? '  after a miss' : '  before answering')),
          slot(problem, notation, solved, width, false),
        );
        cells.append(cell);
      }
    });
    row.append(title, cells);
    sheet.append(row);
  }
};

/** Every sample in a slot of the given size, for measuring. */
window.dvBudget = (width, boss) => {
  sheet.replaceChildren();
  sheet.className = 'budget';
  for (const [kind, problems] of Object.entries(SAMPLES)) {
    problems.forEach((problem, index) => {
      for (const [notation, solved] of [['czech', false], ['czech', true], ['international', true]]) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.id = kind + ' #' + (index + 1) + ' ' + notation + (solved ? ' solved' : ' before');
        cell.dataset.kind = kind;
        cell.append(label(formatProblem(problem, notation)), slot(problem, notation, solved, width, boss));
        sheet.append(cell);
      }
    });
  }
};

/** Per cell: the figure's size and how far anything in it reaches out of the left column. */
window.dvMeasure = () =>
  [...document.querySelectorAll('.budget > .cell')].map((cell) => {
    const cast = cell.querySelector('.dv-round__cast').getBoundingClientRect();
    const figure = cell.querySelector('[data-testid="model"]');
    const box = figure ? figure.getBoundingClientRect() : null;
    let spill = 0;
    for (const part of cell.querySelectorAll('.dv-round__cast *')) {
      const r = part.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      spill = Math.max(spill, r.right - cast.right, cast.left - r.left);
    }
    return {
      id: cell.dataset.id,
      kind: figure ? figure.dataset.kind : null,
      expected: cell.dataset.kind,
      width: box ? Math.round(box.width) : 0,
      height: box ? Math.round(box.height) : 0,
      spill: Math.round(spill * 10) / 10,
    };
  });
`;

/** @param {string} file @param {number} weight */
const font = (file, weight) =>
  `@font-face { font-family: 'DV Reading'; font-weight: ${weight}; src: url('${pathToFileURL(join(ROOT, 'assets', 'fonts', 'dv-reading', file)).href}') format('woff2'); }`;

function page() {
  const backdrop = pathToFileURL(join(ROOT, 'assets', 'backgrounds', 'giants-peaks.svg')).href;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Strategy pictures</title>
<link rel="stylesheet" href="models.css">
<style>
${font('DVReading-Regular.woff2', 400)}
${font('DVReading-Bold.woff2', 700)}
body { margin: 0; padding: 16px 20px; background: url('${backdrop}') center / cover fixed; }
.row { margin: 0 0 14px; }
.row h2 { margin: 0 0 6px; font: 700 18px system-ui; color: #2a2140; background: #fff8ecd0; display: inline-block; padding: 2px 10px; border-radius: 8px; }
.cells, .budget { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; }
.cell { display: grid; gap: 4px; }
.tag { margin: 0; font: 600 12px/1.2 system-ui; color: #2a2140; background: #fff8ecd0; padding: 2px 6px; border-radius: 6px; justify-self: start; }
</style></head><body><main id="sheet"></main><script src="models.js"></script></body></html>`;
}

async function launch() {
  try {
    return await chromium.launch({ channel: 'msedge' });
  } catch {
    return chromium.launch();
  }
}

/** @typedef {{ id: string, kind: string | null, expected: string, width: number, height: number, spill: number }} Measure */

async function main() {
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
  const html = join(OUT, 'index.html');
  writeFileSync(html, page());

  const browser = await launch();
  const tab = await browser.newPage({ viewport: { width: 2300, height: 1750 } });
  await tab.goto(pathToFileURL(html).href);
  await tab.evaluate(() => /** @type {any} */ (globalThis).document.fonts.ready);

  // Review sheets at the model slot of a 1280 x 800 round.
  await tab.evaluate(() => /** @type {any} */ (globalThis).dvSheet(null, 7, 306));
  await tab.screenshot({ path: join(OUT, 'models.png'), fullPage: true });
  await tab.setViewportSize({ width: 700, height: 640 });
  for (const kind of KINDS) {
    await tab.evaluate((k) => /** @type {any} */ (globalThis).dvSheet(k, 4, 306), kind);
    await tab.screenshot({ path: join(OUT, `zoom-${kind}.png`) });
  }

  // The size check.
  const cases = [
    ...BUDGET.flatMap((b) => [
      { name: `normal-${b.viewport.join('x')}`, viewport: b.viewport, slot: b.normal, boss: false },
      { name: `boss-${b.viewport.join('x')}`, viewport: b.viewport, slot: b.boss, boss: true },
    ]),
  ];
  /** @type {Array<Measure & { case: string, text: number, budget: number, over: string[] }>} */
  const results = [];
  for (const item of cases) {
    const [width, height] = item.viewport;
    await tab.setViewportSize({ width, height });
    for (const text of [1, 2]) {
      await tab.evaluate((size) => {
        /** @type {any} */ (globalThis).document.documentElement.style.fontSize = `${size}px`;
      }, 24 * text);
      await tab.evaluate(
        ([w, boss]) => /** @type {any} */ (globalThis).dvBudget(w, boss),
        [item.slot[0], item.boss],
      );
      /** @type {Measure[]} */
      const measures = await tab.evaluate(() => /** @type {any} */ (globalThis).dvMeasure());
      for (const m of measures) {
        const over = [];
        if (m.kind !== m.expected) over.push(`drew ${m.kind} for ${m.expected}`);
        if (m.spill > 0.5) over.push(`reaches ${m.spill} px out of the column`);
        if (text === 1 && m.height > item.slot[1])
          over.push(`${m.height} px tall in ${item.slot[1]}`);
        results.push({ ...m, case: item.name, text, budget: item.slot[1], over });
      }
      if (text === 1 && (item.boss || item.name === 'normal-1366x657')) {
        await tab.screenshot({ path: join(OUT, `budget-${item.name}.png`), fullPage: true });
      }
    }
  }
  await browser.close();
  writeFileSync(join(OUT, 'budget.json'), JSON.stringify(results, null, 2));

  const tallest = new Map();
  for (const r of results.filter((x) => x.text === 1)) {
    const key = `${r.case}`;
    const best = tallest.get(key);
    if (!best || r.height > best.height) tallest.set(key, r);
  }
  console.log('tallest figure per case (100 % text): height / budget, width');
  for (const [key, r] of tallest)
    console.log(`  ${key.padEnd(20)} ${r.height} / ${r.budget}  ${r.width} px  (${r.id})`);
  const failures = results.filter((r) => r.over.length > 0);
  console.log(`checked ${results.length} figures; ${failures.length} over budget`);
  for (const f of failures.slice(0, 30)) {
    console.log(`  ${f.case} at ${f.text * 100} %: ${f.id}: ${f.over.join('; ')}`);
  }
  console.log(`models gallery: ${html}`);
  if (failures.length > 0) process.exitCode = 1;
}

await main();
