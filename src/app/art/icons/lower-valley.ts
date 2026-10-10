/**
 * Item icons for the Lower Valley (grades 1-2): Pebble Brook's counting pebbles, a
 * will-o'-wisp light, a ten-frame and stepping stones; Hundred Hills' bundle of ten sticks and a
 * flagged hill; Market Square's striped stall (its coin is the shared coin icon). 64 x 64, full color, like the other
 * item icons; used on stickers and in content.
 */
import { M, L, Q, C, roundRectD } from '../svg/path';
import { h } from '../svg/xml';
import { outlineOf } from '../svg/color';
import { sparkleD } from '../glyphs';

export const LOWER_VALLEY_ICON_IDS = [
  'pebbles',
  'wisp',
  'ten-frame',
  'stepping-stones',
  'sticks-bundle',
  'hill',
  'market-stall',
] as const;

const INK = '#2a2140';
const OW = 3.5;

const st = (fill: string, w = OW): Record<string, string | number> => ({
  fill,
  stroke: outlineOf(fill, 0.5),
  'stroke-width': w,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
});

const shine = (x: number, y: number, rx: number, ry: number): string =>
  h('ellipse', { cx: x, cy: y, rx, ry, fill: '#ffffff', opacity: 0.6 });

/** Five smooth counting pebbles in a little heap (3 below, 2 on top). */
function pebbles(): string {
  const stones: Array<[number, number, number, string]> = [
    [16, 46, 11, '#c9c2b8'],
    [32, 48, 11, '#a9bccb'],
    [48, 46, 11, '#d8c7ae'],
    [24, 30, 10, '#b9b0c9'],
    [40, 30, 10, '#bfd3c0'],
  ];
  return stones
    .map(
      ([x, y, r, c]) =>
        h('ellipse', { cx: x, cy: y, rx: r, ry: r * 0.8, ...st(c, 3) }) +
        shine(x - r * 0.35, y - r * 0.3, r * 0.3, r * 0.16),
    )
    .join('');
}

/** A will-o'-wisp: a friendly little light with a smile. */
function wisp(p: (n: string) => string): string {
  const g = p('glow');
  const d =
    M(20, 40) +
    C(20, 28, 34, 22, 38, 8) +
    C(42, 20, 44, 30, 44, 40) +
    C(44, 56, 20, 56, 20, 40) +
    'Z';
  return (
    h(
      'defs',
      null,
      h(
        'radialGradient',
        { id: g },
        h('stop', { offset: '0', 'stop-color': '#fff6b8', 'stop-opacity': 0.95 }),
        h('stop', { offset: '1', 'stop-color': '#bff3ff', 'stop-opacity': 0 }),
      ),
    ) +
    h('circle', { cx: 32, cy: 38, r: 28, fill: `url(#${g})` }) +
    h('path', { d, ...st('#fff1a0', 3) }) +
    h('path', {
      d: M(25, 36) + Q(26, 28, 33, 22),
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': 3,
      'stroke-linecap': 'round',
      opacity: 0.8,
    }) +
    h('circle', { cx: 28, cy: 42, r: 2.4, fill: INK }) +
    h('circle', { cx: 37, cy: 42, r: 2.4, fill: INK }) +
    h('path', {
      d: M(29, 47) + Q(32.5, 50, 36, 47),
      fill: 'none',
      stroke: INK,
      'stroke-width': 2.2,
      'stroke-linecap': 'round',
    }) +
    h('path', { d: sparkleD(52, 16, 5) + sparkleD(12, 22, 4), fill: '#ffd23f' })
  );
}

/** A ten-frame with seven counters (two rows of five). */
function tenFrame(): string {
  const x0 = 6;
  const y0 = 18;
  const cell = 10.4;
  let grid = '';
  for (let k = 1; k < 5; k++) grid += M(x0 + k * cell, y0) + 'V' + (y0 + cell * 2);
  grid += M(x0, y0 + cell) + 'H' + (x0 + cell * 5);
  let dots = '';
  for (let i = 0; i < 7; i++) {
    const r = Math.floor(i / 5);
    const c = i % 5;
    const fill = r === 0 ? '#ff7f6b' : '#ffd23f';
    dots += h('circle', {
      cx: x0 + cell * (c + 0.5),
      cy: y0 + cell * (r + 0.5),
      r: cell * 0.34,
      ...st(fill, 2),
    });
  }
  return (
    h('path', { d: roundRectD(x0, y0, cell * 5, cell * 2, 3), ...st('#fffaf0', 3) }) +
    h('path', { d: grid, fill: 'none', stroke: '#b8a888', 'stroke-width': 2 }) +
    dots
  );
}

/** Stepping stones across a little brook. */
function steppingStones(): string {
  const water =
    h('path', {
      d: M(2, 24) + Q(32, 16, 62, 24) + 'V54' + Q(32, 62, 2, 54) + 'Z',
      fill: '#9fdcff',
      stroke: '#3a8cc0',
      'stroke-width': 2.5,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d: M(8, 34) + Q(14, 31, 20, 34) + M(44, 48) + Q(50, 45, 56, 48),
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': 2.5,
      'stroke-linecap': 'round',
    });
  const stones: Array<[number, number, string]> = [
    [12, 48, '#d9d2c6'],
    [26, 40, '#c9d6de'],
    [40, 34, '#e3d4bb'],
    [53, 28, '#d6cde2'],
  ];
  return (
    water +
    stones
      .map(
        ([x, y, c]) =>
          h('ellipse', { cx: x, cy: y, rx: 8, ry: 5.4, ...st(c, 2.6) }) +
          shine(x - 2.6, y - 1.8, 2.6, 1.3),
      )
      .join('')
  );
}

/** Ten sticks tied into one bundle with a red ribbon (one ten), and a single loose stick. */
function sticksBundle(): string {
  let sticks = '';
  for (let i = 0; i < 10; i++) {
    const x = 13 + i * 3.6;
    const tilt = (i - 4.5) * 2.2;
    sticks += h('path', {
      d: roundRectD(x - 2.2, 10, 4.4, 44, 2.2),
      ...st(i % 2 ? '#d9a45a' : '#e8b86e', 1.6),
      transform: `rotate(${tilt} ${x} 54)`,
    });
  }
  return (
    h('ellipse', { cx: 30, cy: 56, rx: 22, ry: 3, fill: INK, opacity: 0.15 }) +
    sticks +
    h('path', { d: roundRectD(10, 30, 40, 7, 3.5), ...st('#e0533a', 2.4) }) +
    h('path', {
      d: M(30, 33) + Q(22, 22, 18, 28) + Q(20, 34, 30, 33) + Q(38, 22, 42, 28) + Q(40, 34, 30, 33),
      ...st('#ff7a6b', 2),
    }) +
    h('path', {
      d: roundRectD(48, 26, 4.4, 30, 2.2),
      ...st('#e8b86e', 1.6),
      transform: 'rotate(14 50 56)',
    })
  );
}

/** A round grassy hill with a little pennant flag on top. */
function hill(p: (n: string) => string): string {
  const g = p('hill');
  return (
    h(
      'defs',
      null,
      h(
        'linearGradient',
        { id: g, x1: 0, y1: 0, x2: 0, y2: 1 },
        h('stop', { offset: '0', 'stop-color': '#9be06a' }),
        h('stop', { offset: '1', 'stop-color': '#4fa83a' }),
      ),
    ) +
    h('path', {
      d: M(4, 56) + C(10, 26, 54, 26, 60, 56) + 'Z',
      fill: `url(#${g})`,
      stroke: '#2f6b2a',
      'stroke-width': OW,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d: M(32, 32) + L(32, 8),
      stroke: '#7a4f2a',
      'stroke-width': 3,
      'stroke-linecap': 'round',
    }) +
    h('path', { d: M(33, 9) + L(48, 14) + L(33, 19) + 'Z', ...st('#ffd23f', 2.4) }) +
    h('path', {
      d: M(16, 46) + Q(19, 42, 22, 46) + M(42, 44) + Q(45, 40, 48, 44),
      fill: 'none',
      stroke: '#2f6b2a',
      'stroke-width': 2,
      'stroke-linecap': 'round',
    }) +
    h('circle', { cx: 24, cy: 52, r: 2.6, fill: '#ff9fbf' }) +
    h('circle', { cx: 44, cy: 52, r: 2.6, fill: '#ffffff' }) +
    shine(20, 36, 5, 2.4)
  );
}

/** A market stall with a striped awning and a counter of round fruit. */
function marketStall(): string {
  const scallops =
    M(6, 24) +
    Q(11, 32, 16.4, 24) +
    Q(21.6, 32, 26.8, 24) +
    Q(32, 32, 37.2, 24) +
    Q(42.4, 32, 47.6, 24) +
    Q(52.8, 32, 58, 24);
  let stripes = '';
  for (let i = 0; i < 5; i++) {
    const top = 9 + i * 9.2;
    const bot = 6 + i * 10.4;
    stripes += h('path', {
      d: M(top, 10) + L(top + 9.2, 10) + L(bot + 10.4, 24) + L(bot, 24) + 'Z',
      fill: i % 2 ? '#fffaf0' : '#e0533a',
    });
  }
  return (
    h('path', { d: roundRectD(9, 22, 4, 34, 2), ...st('#c98a4a', 2) }) +
    h('path', { d: roundRectD(51, 22, 4, 34, 2), ...st('#c98a4a', 2) }) +
    h('path', { d: roundRectD(6, 40, 52, 16, 3), ...st('#d9a45a', OW) }) +
    h('circle', { cx: 18, cy: 38, r: 5, ...st('#ff6b5a', 2) }) +
    h('circle', { cx: 29, cy: 37, r: 5, ...st('#ffd23f', 2) }) +
    h('circle', { cx: 40, cy: 38, r: 5, ...st('#8ccf3f', 2) }) +
    h('circle', { cx: 49, cy: 39, r: 4, ...st('#b98cff', 2) }) +
    stripes +
    h('path', {
      d: M(6, 24) + L(9, 10) + L(55, 10) + L(58, 24) + 'Z',
      fill: 'none',
      stroke: outlineOf('#e0533a', 0.5),
      'stroke-width': 3,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d: M(6, 24) + scallops.slice(scallops.indexOf('Q')) + 'Z',
      ...st('#e0533a', 2.4),
    }) +
    h('path', { d: M(10, 48) + L(54, 48), stroke: '#b07a3a', 'stroke-width': 2, opacity: 0.6 })
  );
}

export function lowerValleyIcon(id: string, p: (n: string) => string): string {
  switch (id) {
    case 'pebbles':
      return pebbles();
    case 'wisp':
      return wisp(p);
    case 'ten-frame':
      return tenFrame();
    case 'stepping-stones':
      return steppingStones();
    case 'sticks-bundle':
      return sticksBundle();
    case 'hill':
      return hill(p);
    case 'market-stall':
      return marketStall();
    default:
      throw new Error(`Unknown icon id: ${id}`);
  }
}
