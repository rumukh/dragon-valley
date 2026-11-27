// @ts-check
/**
 * The Android launcher icon and the Google Play graphics, drawn from the game's own art
 * (src/app/art, the same renderers the game uses) and photographed with headless Edge
 * (scripts/art/lib.mjs):
 *
 *   node scripts/android/art.mjs
 *
 * - android/app/src/main/res/mipmap-*dpi/ic_launcher_foreground.png: Bubbles, newly hatched and
 *   happy, on a transparent 108 dp layer inside the adaptive icon's safe circle; the background
 *   layer is the sun colour (res/values/colors.xml).
 * - docs/play/graphics/icon-512.png: the Play Store icon, the same picture full bleed.
 * - docs/play/graphics/feature-graphic.png: 1024 x 500, opaque, Sunny Meadow with five dragons
 *   and the game's name in its reading font.
 *
 * The PNGs are committed. Edge's rasteriser is not byte-identical across machines, so they are
 * checked by eye, not by digest (docs/assets.md, "Android and Google Play").
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, loadArt, screenshot } from '../art/lib.mjs';
import { pngInfo, toOpaquePng } from './png.mjs';

const art = await loadArt();
const palette = JSON.parse(readFileSync(join(ROOT, 'assets', 'art', 'palette.json'), 'utf8'));
const SUN = palette.brand.sun;
const INK = palette.ink.ink;
const WORK = join(ROOT, 'out', 'android', 'art');
const RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');
const PLAY = join(ROOT, 'docs', 'play', 'graphics');
mkdirSync(WORK, { recursive: true });
mkdirSync(PLAY, { recursive: true });

let ids = 0;
/** @param {string} dragon @param {string} stage @param {string} expression @param {number} size */
const dragonSvg = (dragon, stage, expression, size) =>
  art.renderDragon({
    dragon,
    stage,
    expression,
    framing: 'fit',
    animated: false,
    idPrefix: `play${ids++}`,
    size,
  });

/**
 * Photograph `body` on a `width` x `height` page.
 * @param {string} name
 * @param {number} width
 * @param {number} height
 * @param {string} body
 * @param {{ transparent?: boolean; background?: string; head?: string }} [options]
 */
function photograph(name, width, height, body, options = {}) {
  const html = join(WORK, `${name}.html`);
  const background = options.transparent ? 'transparent' : (options.background ?? '#fff');
  writeFileSync(
    html,
    `<!doctype html><html data-reduced-motion="true"><head><meta charset="utf-8">${options.head ?? ''}
<style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:${background}}
.stage{position:relative;width:${width}px;height:${height}px}
.center{position:absolute;inset:0;display:grid;place-items:center}</style></head>
<body><div class="stage">${body}</div></body></html>`,
  );
  const png = join(WORK, `${name}.png`);
  screenshot(html, png, width, height, { transparent: options.transparent ?? false });
  return png;
}

// ---- Launcher icon: the adaptive icon's foreground layer -------------------------------------
// 108 dp per side; the launcher shows the middle 72 dp and keeps the middle 66 dp circle whole.
const DENSITIES = /** @type {const} */ ([
  ['mdpi', 108],
  ['hdpi', 162],
  ['xhdpi', 216],
  ['xxhdpi', 324],
  ['xxxhdpi', 432],
]);
for (const [density, size] of DENSITIES) {
  const dragon = dragonSvg('bubbles', 'hatchling', 'happy', Math.round(size * 0.6));
  const png = photograph(
    `foreground-${density}`,
    size,
    size,
    `<div class="center">${dragon}</div>`,
    {
      transparent: true,
    },
  );
  const target = join(RES, `mipmap-${density}`, 'ic_launcher_foreground.png');
  mkdirSync(join(RES, `mipmap-${density}`), { recursive: true });
  writeFileSync(target, readFileSync(png));
}

// ---- Play Store icon: 512 x 512, full bleed (Google Play rounds the corners) ------------------
const icon = photograph(
  'icon-512',
  512,
  512,
  `<div class="center" style="background:radial-gradient(circle at 50% 42%, #ffe08a 0%, ${SUN} 58%, #f5a623 100%)">${dragonSvg('bubbles', 'hatchling', 'happy', 392)}</div>`,
);
writeFileSync(join(PLAY, 'icon-512.png'), readFileSync(icon));

// ---- Feature graphic: 1024 x 500, no transparency ----------------------------------------------
const fonts = pathToFileURL(join(ROOT, 'assets', 'fonts', 'dv-reading')).href;
const meadow = pathToFileURL(join(ROOT, 'assets', 'backgrounds', 'sunny-meadow.svg')).href;
const cast = [
  ['puff', 'youngling', 'happy', 150],
  ['sunny', 'youngling', 'happy', 176],
  ['bubbles', 'hatchling', 'happy', 214],
  ['ember', 'youngling', 'happy', 176],
  ['rainbow', 'adult', 'proud', 150],
];
const feature = photograph(
  'feature-graphic',
  1024,
  500,
  `<img src="${meadow}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 78%">
<div style="position:absolute;left:24px;right:24px;top:34px;text-align:center;font-family:'DV Reading';color:${INK};
  -webkit-text-stroke:10px #fff;paint-order:stroke fill;line-height:1">
  <div style="font-size:96px;font-weight:700">Dragon Valley</div>
  <div style="margin-top:10px;font-size:46px;font-weight:700;color:${palette.brand.primaryDeep}">Math Adventure</div>
</div>
<div style="position:absolute;left:0;right:0;bottom:18px;display:flex;justify-content:center;align-items:flex-end;gap:6px">
  ${cast.map(([dragon, stage, expression, size]) => dragonSvg(String(dragon), String(stage), String(expression), Number(size))).join('')}
</div>`,
  {
    head: `<style>@font-face{font-family:'DV Reading';src:url('${fonts}/DVReading-Bold.woff2') format('woff2');font-weight:700}</style>`,
  },
);
writeFileSync(join(PLAY, 'feature-graphic.png'), toOpaquePng(readFileSync(feature)));

for (const file of [
  ...DENSITIES.map(([density]) => join(RES, `mipmap-${density}`, 'ic_launcher_foreground.png')),
  join(PLAY, 'icon-512.png'),
  join(PLAY, 'feature-graphic.png'),
]) {
  const { width, height, colorType } = pngInfo(readFileSync(file));
  console.log(`${relative(ROOT, file)}  ${width} x ${height}  ${colorType === 6 ? 'RGBA' : 'RGB'}`);
}
