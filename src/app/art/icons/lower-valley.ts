/**
 * Item icons for the Lower Valley (grades 1-2): Pebble Brook's counting pebbles, a
 * will-o'-wisp light, a ten-frame and stepping stones. 64 x 64, full color, like the other
 * item icons; used on stickers and in content.
 */
import { M, Q, C, roundRectD } from '../svg/path';
import { h } from '../svg/xml';
import { outlineOf } from '../svg/color';
import { sparkleD } from '../glyphs';

export const LOWER_VALLEY_ICON_IDS = ['pebbles', 'wisp', 'ten-frame', 'stepping-stones'] as const;

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
    default:
      throw new Error(`Unknown icon id: ${id}`);
  }
}
