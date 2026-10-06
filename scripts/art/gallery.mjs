// @ts-check
/**
 * Review gallery for all art: writes out/art-gallery/index.html plus focused contact sheets and
 * renders each sheet to PNG with headless Edge (out/art-gallery/png/*.png).
 *
 *   node scripts/art/gallery.mjs                 all sheets + PNGs
 *   node scripts/art/gallery.mjs --only roster   sheets whose name starts with "roster"
 *   node scripts/art/gallery.mjs --no-png        HTML only
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadArt, screenshot } from './lib.mjs';

const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? (args[onlyIdx + 1] ?? '').split(',') : [];
const noPng = args.includes('--no-png');
const animate = args.includes('--animate');

const OUT = join(ROOT, 'out', 'art-gallery');
const PNG = join(OUT, 'png');
mkdirSync(PNG, { recursive: true });

const art = await loadArt();
const P = art.PALETTE;

const BASE_CSS = `
* { box-sizing: border-box; }
body { margin: 0; padding: 18px; background: ${P.surface.paper}; color: ${P.ink.ink}; font: 14px/1.3 system-ui, sans-serif; }
h1 { font-size: 22px; margin: 0 0 12px; }
h2 { font-size: 17px; margin: 18px 0 8px; }
.grid { display: grid; gap: 8px; align-items: start; }
.cell { background: #fff; border: 1px solid ${P.surface.line}; border-radius: 12px; padding: 6px; text-align: center; }
.cell.dark { background: ${P.surface.night}; color: ${P.ink.inkInverse}; }
.cell .lbl { font-size: 12px; color: ${P.ink.inkSoft}; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cell.dark .lbl { color: #d6d0ef; }
.cell svg { display: block; margin: 0 auto; }
.row-label { writing-mode: vertical-rl; transform: rotate(180deg); font-weight: 600; color: ${P.ink.inkSoft}; text-align: center; }
.swatch { display: inline-block; width: 90px; margin: 3px; font-size: 11px; }
.swatch i { display: block; height: 40px; border-radius: 8px; border: 1px solid #0002; }
`;

/** @param {string} title @param {string} body @param {boolean} [motion] */
function page(title, body, motion = animate) {
  return `<!doctype html><html lang="en"${motion ? '' : ' data-reduced-motion="true"'}><head><meta charset="utf-8"><title>${title}</title><style>${BASE_CSS}${art.ANIMATIONS_CSS}</style></head><body><h1>${title}</h1>${body}</body></html>`;
}

/** @param {string} svg @param {string} label @param {string} [cls] */
function cell(svg, label, cls = '') {
  return `<div class="cell ${cls}">${svg}<div class="lbl">${label}</div></div>`;
}

/** @param {number} cols @param {string[]} cells @param {number} [size] */
function grid(cols, cells, size = 200) {
  return `<div class="grid" style="grid-template-columns: repeat(${cols}, ${size + 14}px)">${cells.join('')}</div>`;
}

let counter = 0;
const uid = (/** @type {string} */ s) =>
  `g${(counter++).toString(36)}-${s.replace(/[^a-z0-9]/gi, '')}`.slice(0, 60);

const STAGES = art.DRAGON_STAGES;
const EXPR = art.DRAGON_EXPRESSIONS;
const DRAGONS = [...art.DRAGON_RECIPES.keys()];

/** @type {Array<{ name: string; title: string; width: number; height: number; body: () => string }>} */
const sheets = [];

for (const id of DRAGONS) {
  sheets.push({
    name: `dragon-${id}`,
    title: `${id}: stages x expressions`,
    width: 1480,
    height: 1300,
    body: () => {
      const cells = [];
      for (const stage of STAGES) {
        if (stage === 'egg') {
          for (const [w, lbl] of /** @type {const} */ ([
            [undefined, 'egg'],
            [0.05, 'egg cold'],
            [0.6, 'egg warm'],
            [0.95, 'egg cracking'],
          ])) {
            cells.push(
              cell(
                art.renderDragon({
                  dragon: id,
                  stage: 'egg',
                  warmth: w,
                  idPrefix: uid(id),
                  size: 200,
                  framing: 'fit',
                }),
                lbl,
              ),
            );
          }
          cells.push(
            cell(
              art.renderHatch({ dragon: id, idPrefix: uid(id), size: 200 }),
              'hatch (end state)',
            ),
          );
          cells.push(
            cell(
              art.renderDragon({
                dragon: id,
                stage: 'egg',
                idPrefix: uid(id),
                size: 200,
                outfit: { nest: 'nest-pillow' },
              }),
              'egg + pillow',
            ),
          );
          continue;
        }
        for (const expression of EXPR) {
          cells.push(
            cell(
              art.renderDragon({
                dragon: id,
                stage,
                expression,
                idPrefix: uid(id),
                size: 200,
                framing: 'fit',
              }),
              `${stage} ${expression}`,
            ),
          );
        }
      }
      return grid(6, cells, 200);
    },
  });
}

sheets.push({
  name: 'roster',
  title: 'Roster: adult idle (fit) and eggs',
  width: 1720,
  height: 1100,
  body: () => {
    const adults = DRAGONS.map((id) =>
      cell(
        art.renderDragon({
          dragon: id,
          stage: 'adult',
          idPrefix: uid(id),
          size: 190,
          framing: 'fit',
        }),
        id,
      ),
    );
    const eggs = DRAGONS.map((id) =>
      cell(
        art.renderDragon({ dragon: id, stage: 'egg', idPrefix: uid(id), size: 90, framing: 'fit' }),
        id,
      ),
    );
    return grid(8, adults, 190) + '<h2>Eggs</h2>' + grid(16, eggs, 90);
  },
});

sheets.push({
  name: 'mnemonics',
  title: 'Mnemonics at gameplay size (160 px, fit): hatchling, youngling, adult',
  width: 1640,
  height: 1180,
  body: () => {
    const cells = [];
    for (const id of DRAGONS.filter((d) => d !== 'glimmer')) {
      for (const stage of /** @type {const} */ (['hatchling', 'youngling', 'adult'])) {
        cells.push(
          cell(
            art.renderDragon({ dragon: id, stage, idPrefix: uid(id), size: 160, framing: 'fit' }),
            `${id} ${stage}`,
          ),
        );
      }
    }
    return grid(9, cells, 160);
  },
});

sheets.push({
  name: 'roster-small',
  title: 'Readability at 64 px (hatchling, adult) and 128 px',
  width: 1500,
  height: 760,
  body: () => {
    const h64 = DRAGONS.map((id) =>
      cell(
        art.renderDragon({
          dragon: id,
          stage: 'hatchling',
          idPrefix: uid(id),
          size: 64,
          framing: 'fit',
        }),
        id,
      ),
    );
    const a64 = DRAGONS.map((id) =>
      cell(
        art.renderDragon({
          dragon: id,
          stage: 'adult',
          idPrefix: uid(id),
          size: 64,
          framing: 'fit',
        }),
        id,
      ),
    );
    const h128 = DRAGONS.map((id) =>
      cell(
        art.renderDragon({
          dragon: id,
          stage: 'youngling',
          expression: 'happy',
          idPrefix: uid(id),
          size: 128,
          framing: 'fit',
        }),
        id,
      ),
    );
    return (
      '<h2>Hatchlings 64 px</h2>' +
      grid(16, h64, 64) +
      '<h2>Adults 64 px</h2>' +
      grid(16, a64, 64) +
      '<h2>Younglings 128 px</h2>' +
      grid(10, h128, 128)
    );
  },
});

sheets.push({
  name: 'growth',
  title: 'Growth on the shared stage canvas (egg to crowned)',
  width: 1300,
  height: 1500,
  body: () => {
    const cells = [];
    for (const id of DRAGONS)
      for (const stage of STAGES)
        cells.push(
          cell(
            art.renderDragon({ dragon: id, stage, idPrefix: uid(id), size: 130 }),
            `${id} ${stage}`,
          ),
        );
    return grid(10, cells, 110);
  },
});

const COSMETIC_TEST_DRAGONS = ['bubbles', 'sunny', 'goldie', 'clover', 'petal', 'starry'];
for (const slot of art.COSMETIC_SLOTS) {
  sheets.push({
    name: `cosmetics-${slot}`,
    title: `Cosmetics: ${slot} (rows) on dragons x stages`,
    width: 1900,
    height: 1500,
    body: () => {
      const items = art.COSMETICS.filter((/** @type {{slot: string}} */ c) => c.slot === slot);
      const cells = [];
      for (const item of items) {
        for (const [i, id] of COSMETIC_TEST_DRAGONS.entries()) {
          const stage = /** @type {const} */ ([
            'hatchling',
            'youngling',
            'adult',
            'crowned',
            'hatchling',
            'adult',
          ])[i];
          const expression = /** @type {const} */ ([
            'idle',
            'happy',
            'curious',
            'idle',
            'sleepy',
            'proud',
          ])[i];
          cells.push(
            cell(
              art.renderDragon({
                dragon: id,
                stage,
                expression,
                idPrefix: uid(id),
                size: 150,
                framing: 'fit',
                outfit: { [slot]: item.id },
              }),
              `${item.id} / ${id} ${stage}`,
            ),
          );
        }
      }
      return grid(12, cells, 136);
    },
  });
}

if (typeof art.renderIcon === 'function') {
  sheets.push({
    name: 'icons',
    title: 'Icons',
    width: 1500,
    height: 1100,
    body: () => {
      const ids = art.ICON_IDS;
      const big = ids.map((/** @type {string} */ id) =>
        cell(art.renderIcon(id, { size: 96, idPrefix: uid(id) }), id),
      );
      const small = ids.map((/** @type {string} */ id) =>
        cell(art.renderIcon(id, { size: 32, idPrefix: uid(id) }), ''),
      );
      return grid(12, big, 96) + '<h2>32 px</h2>' + grid(30, small, 32);
    },
  });
}

if (typeof art.renderAvatar === 'function') {
  sheets.push({
    name: 'avatars',
    title: 'Keeper avatars',
    width: 1300,
    height: 560,
    body: () => {
      const big = art.KEEPER_AVATARS.map((/** @type {string} */ id) =>
        cell(art.renderAvatar(id, { size: 140, idPrefix: uid(id) }), id),
      );
      const small = art.KEEPER_AVATARS.map((/** @type {string} */ id) =>
        cell(art.renderAvatar(id, { size: 56, idPrefix: uid(id) }), id),
      );
      return grid(8, big, 140) + '<h2>56 px</h2>' + grid(8, small, 56);
    },
  });
}

if (typeof art.renderBoss === 'function') {
  sheets.push({
    name: 'bosses',
    title: 'Bosses: start, warming, won',
    width: 1500,
    height: 1900,
    body: () => {
      const cells = [];
      for (const id of art.BOSS_IDS)
        for (const state of art.BOSS_STATES)
          cells.push(
            cell(art.renderBoss(id, state, { size: 220, idPrefix: uid(id) }), `${id} ${state}`),
          );
      cells.push(
        cell(
          art.renderDragon({
            dragon: 'glimmer',
            stage: 'adult',
            expression: 'idle',
            size: 220,
            idPrefix: uid('gl'),
            framing: 'fit',
          }),
          'glimmer',
        ),
      );
      cells.push(
        cell(
          art.renderDragon({
            dragon: 'glimmer',
            stage: 'adult',
            expression: 'happy',
            size: 220,
            idPrefix: uid('gl'),
            framing: 'fit',
          }),
          'glimmer happy',
        ),
      );
      cells.push(
        cell(
          art.renderDragon({
            dragon: 'glimmer',
            stage: 'adult',
            expression: 'curious',
            size: 220,
            idPrefix: uid('gl'),
            framing: 'fit',
          }),
          'glimmer curious',
        ),
      );
      return grid(6, cells, 220);
    },
  });
}

if (typeof art.renderSticker === 'function') {
  sheets.push({
    name: 'stickers',
    title: 'Sticker composer samples',
    width: 1500,
    height: 900,
    body: () =>
      art
        .stickerSamples()
        .map((/** @type {any} */ s, /** @type {number} */ i) =>
          cell(
            art.renderSticker({ ...s, idPrefix: uid(`st${i}`), size: 120 }),
            `${s.frame}/${s.icon}${s.dragon ? '/' + s.dragon : ''}`,
          ),
        )
        .join(''),
  });
}

if (typeof art.renderMagicWindow === 'function') {
  sheets.push({
    name: 'window',
    title: 'Magic Window states',
    width: 1700,
    height: 1150,
    body: () =>
      art
        .magicWindowSamples()
        .map((/** @type {any} */ s, /** @type {number} */ i) =>
          cell(art.renderMagicWindow({ ...s.options, idPrefix: uid(`w${i}`), size: 520 }), s.label),
        )
        .join(''),
  });
}

const bgDir = join(ROOT, 'assets', 'backgrounds');
const hotspotsPath = join(bgDir, 'map-hotspots.json');
if (existsSync(join(bgDir, 'valley-map.svg'))) {
  sheets.push({
    name: 'backgrounds',
    title: 'Backgrounds (map with hotspot overlay)',
    width: 1700,
    height: 2400,
    body: () => {
      const ids = art.BACKGROUND_IDS;
      const hot = existsSync(hotspotsPath) ? JSON.parse(readFileSync(hotspotsPath, 'utf8')) : null;
      return ids
        .map((/** @type {string} */ id) => {
          const svg = readFileSync(join(bgDir, `${id}.svg`), 'utf8').replace(
            '<svg ',
            '<svg width="800" height="500" ',
          );
          let overlay = '';
          if (id === 'castle-hall') {
            const w = art.HALL_WINDOW;
            const sample = art.magicWindowSamples()[2].options;
            overlay = `<div style="position:absolute;left:${6 + w.x / 2}px;top:${6 + w.y / 2}px;width:${w.width / 2}px;height:${w.height / 2}px">${art.renderMagicWindow({ ...sample, idPrefix: 'hallwin', size: w.width / 2 }).replace(/ height="[\d.]+"/, ` height="${w.height / 2}"`)}</div>`;
          }
          if (id === 'valley-map' && hot) {
            overlay = `<svg viewBox="0 0 ${hot.logical.width} ${hot.logical.height}" width="800" height="500" style="position:absolute;left:6px;top:6px">${hot.hotspots
              .map(
                (/** @type {any} */ s) =>
                  `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="none" stroke="#ff2d55" stroke-width="3" stroke-dasharray="10 6"/>`,
              )
              .join('')}${Object.values(hot.regions)
              .flatMap((/** @type {any} */ r) =>
                [...r.nodes, r.boss].map(
                  (/** @type {any} */ n, /** @type {number} */ i, /** @type {any[]} */ all) =>
                    `<circle cx="${n.x}" cy="${n.y}" r="${i === all.length - 1 ? 16 : 11}" fill="${i === all.length - 1 ? '#ff2d55' : '#fff'}" stroke="#2a2140" stroke-width="3"/>`,
                ),
              )
              .join('')}</svg>`;
          }
          return `<div class="cell" style="position:relative;display:inline-block;margin:4px">${svg}${overlay}<div class="lbl">${id}</div></div>`;
        })
        .join('');
    },
  });
}

const selected = sheets.filter((s) => only.length === 0 || only.some((o) => s.name.startsWith(o)));
const links = [];
for (const s of selected) {
  const file = join(OUT, `${s.name}.html`);
  writeFileSync(file, page(s.title, s.body()));
  links.push(
    `<li><a href="${s.name}.html">${s.title}</a> &middot; <a href="png/${s.name}.png">png</a></li>`,
  );
  if (!noPng) {
    screenshot(file, join(PNG, `${s.name}.png`), s.width, s.height);
    console.log(`png/${s.name}.png`);
  }
}
if (only.length === 0) {
  const swatches = Object.entries(P.regions)
    .map(
      ([id, r]) =>
        `<span class="swatch"><i style="background:${/** @type {any} */ (r).accent}"></i>${id}</span>`,
    )
    .join('');
  writeFileSync(
    join(OUT, 'index.html'),
    page(
      'Dragon Valley art gallery',
      `<h2>Region accents</h2>${swatches}<h2>Sheets</h2><ul>${links.join('')}</ul>`,
      true,
    ),
  );
}
console.log(`gallery: ${join(OUT, 'index.html')}`);
