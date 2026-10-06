import { polar } from '../svg/num';
import { M, L, Q, C, A, eggD, roundRectD, roundStarD, circleD, polyD } from '../svg/path';
import { h, svgDoc, ids as scoped } from '../svg/xml';
import { lighten, outlineOf } from '../svg/color';
import { gearD, sparkleD } from '../glyphs';
import { emblemArt, REGION_EMBLEM_IDS } from './emblems';

/** Icon design grid: 64 x 64 units. Item icons are full color; glyphs use `currentColor`. */
const S = 64;
const INK = '#2a2140';
const OW = 3.5;

export const ITEM_ICON_IDS = [
  'coin',
  'star-filled',
  'star-empty',
  'chest-closed',
  'chest-open',
  'egg',
  'apple',
  'plum',
  'pear',
  'cherries',
  'berries',
  'badge-correct',
  'badge-almost',
  'node-locked',
  'node-open',
  'node-current',
  'node-stars-1',
  'node-stars-2',
  'node-stars-3',
] as const;

export const GLYPH_ICON_IDS = [
  'lock',
  'check',
  'question',
  'speaker',
  'settings',
  'parent',
  'home',
  'back',
  'next',
  'close',
  'print',
  'hint',
  'music',
  'sound-off',
] as const;

export const FRUIT_IDS = ['apple', 'plum', 'pear', 'cherries', 'berries'] as const;

export const ICON_IDS: readonly string[] = [
  ...ITEM_ICON_IDS,
  ...GLYPH_ICON_IDS,
  ...REGION_EMBLEM_IDS,
];

export interface IconOptions {
  size?: number;
  idPrefix?: string;
  /** Accessible name; decorative (aria-hidden) when omitted. */
  title?: string;
  /** Accent for map nodes and badges (defaults to the brand primary). */
  accent?: string;
  className?: string;
}

const st = (fill: string, line = INK, w = OW): Record<string, string | number> => ({
  fill,
  stroke: line,
  'stroke-width': w,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
});
const glyph = (w = 5.5): Record<string, string | number> => ({
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': w,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
});

function grad(id: string, stops: Array<[number, string]>, x1 = 0, y1 = 0, x2 = 0, y2 = 1): string {
  return h(
    'linearGradient',
    { id, x1, y1, x2, y2 },
    ...stops.map(([o, c]) => h('stop', { offset: String(o), 'stop-color': c })),
  );
}

function shine(x: number, y: number, len: number): string {
  return h('path', {
    d: M(x, y) + Q(x + len * 0.3, y - len * 0.45, x + len, y - len * 0.6),
    fill: 'none',
    stroke: '#ffffff',
    'stroke-width': 3.5,
    'stroke-linecap': 'round',
    opacity: 0.85,
  });
}

function coin(p: (n: string) => string): string {
  const g = p('coin');
  const toe = (x: number, y: number, r: number): string =>
    h('ellipse', {
      cx: x,
      cy: y,
      rx: r,
      ry: r * 1.15,
      fill: '#fff3b0',
      stroke: '#b97a00',
      'stroke-width': 1.8,
    });
  return (
    h(
      'defs',
      null,
      grad(g, [
        [0, '#fff1a1'],
        [0.5, '#ffcf33'],
        [1, '#e39b12'],
      ]),
    ) +
    h('circle', { cx: 32, cy: 33, r: 26, ...st(`url(#${g})`, '#8a5a00') }) +
    h('circle', { cx: 32, cy: 33, r: 19.5, fill: 'none', stroke: '#e0a020', 'stroke-width': 2.5 }) +
    h('path', {
      d: M(24, 41) + C(22, 33, 42, 33, 40, 41) + C(39, 45, 25, 45, 24, 41) + 'Z',
      fill: '#fff3b0',
      stroke: '#b97a00',
      'stroke-width': 1.8,
    }) +
    toe(23, 32, 3.2) +
    toe(32, 28.5, 3.4) +
    toe(41, 32, 3.2) +
    shine(15, 27, 12)
  );
}

function starIcon(p: (n: string) => string, filled: boolean): string {
  const d = roundStarD(32, 34, 5, 27, 13.5, -90, 0.2);
  if (!filled)
    return (
      h('path', { d, ...st('#f6ecd9', '#b8a888', 3.5) }) +
      h('path', {
        d: roundStarD(32, 34, 5, 19, 9.5, -90, 0.2),
        fill: 'none',
        stroke: '#e6d8bd',
        'stroke-width': 2.5,
      })
    );
  const g = p('star');
  return (
    h(
      'defs',
      null,
      grad(g, [
        [0, '#fff3a6'],
        [0.55, '#ffd23f'],
        [1, '#f2a516'],
      ]),
    ) +
    h('path', { d, ...st(`url(#${g})`, '#8a5a00') }) +
    shine(20, 30, 9) +
    h('circle', { cx: 40, cy: 24, r: 2.2, fill: '#ffffff', opacity: 0.8 })
  );
}

function chest(open: boolean): string {
  const wood = '#c47a3a';
  const woodDark = '#9a5422';
  const gold = '#ffcf33';
  const body =
    h('path', { d: roundRectD(9, 30, 46, 26, 4), ...st(wood) }) +
    h('path', {
      d: M(10, 40) + L(54, 40) + M(10, 48) + L(54, 48),
      stroke: woodDark,
      'stroke-width': 2,
      opacity: 0.6,
    }) +
    h('rect', { x: 9, y: 30, width: 7, height: 26, rx: 2, ...st(gold, '#8a5a00', 2.5) }) +
    h('rect', { x: 48, y: 30, width: 7, height: 26, rx: 2, ...st(gold, '#8a5a00', 2.5) });
  if (!open) {
    const lid = M(9, 32) + L(9, 22) + C(9, 12, 55, 12, 55, 22) + L(55, 32) + 'Z';
    return (
      body +
      h('path', { d: lid, ...st('#d98a46') }) +
      h('path', {
        d: M(16, 31) + L(16, 17) + M(48, 31) + L(48, 17),
        stroke: gold,
        'stroke-width': 6,
        'stroke-linecap': 'round',
      }) +
      h('path', {
        d: lid,
        fill: 'none',
        stroke: INK,
        'stroke-width': OW,
        'stroke-linejoin': 'round',
      }) +
      h('path', { d: roundRectD(26.5, 26, 11, 13, 3), ...st(gold, '#8a5a00', 2.5) }) +
      h('circle', { cx: 32, cy: 31, r: 1.8, fill: '#8a5a00' }) +
      h('path', {
        d: M(31.2, 32) + L(32.8, 32) + L(32.5, 35) + L(31.5, 35) + 'Z',
        fill: '#8a5a00',
      }) +
      shine(14, 22, 10)
    );
  }
  const lidOpen = M(11, 28) + L(5, 12) + C(3, 4, 49, 0, 51, 8) + L(55, 26) + 'Z';
  return (
    h('path', { d: lidOpen, ...st('#b8682e') }) +
    h('path', { d: M(11, 26) + Q(32, 18, 54, 25) + L(55, 31) + L(10, 31) + 'Z', fill: '#5a2f12' }) +
    h('circle', { cx: 32, cy: 22, r: 15, fill: '#fff3a6', opacity: 0.7 }) +
    h('ellipse', { cx: 24, cy: 29, rx: 7, ry: 3.5, ...st(gold, '#8a5a00', 2) }) +
    h('ellipse', { cx: 38, cy: 28, rx: 7, ry: 3.5, ...st(gold, '#8a5a00', 2) }) +
    h('path', {
      d: polyD([
        { x: 31, y: 21 },
        { x: 35, y: 16 },
        { x: 39, y: 21 },
        { x: 35, y: 26 },
      ]),
      ...st('#4ad0ff', INK, 2),
    }) +
    h('path', { d: sparkleD(18, 14, 5) + sparkleD(47, 13, 4), fill: '#ffffff' }) +
    body +
    h('path', { d: roundRectD(26.5, 34, 11, 11, 3), ...st(gold, '#8a5a00', 2.5) })
  );
}

function eggIcon(): string {
  const d = eggD(32, 34, 38, 50);
  return (
    h('path', { d, ...st('#fff1d6', '#8a6a4a') }) +
    h('circle', { cx: 25, cy: 38, r: 4.5, fill: '#ffb3c8' }) +
    h('circle', { cx: 39, cy: 30, r: 3.5, fill: '#9fd8ff' }) +
    h('circle', { cx: 36, cy: 46, r: 3.2, fill: '#b7e48c' }) +
    h('circle', { cx: 28, cy: 24, r: 2.6, fill: '#ffd76a' }) +
    h('path', { d, fill: 'none', stroke: '#8a6a4a', 'stroke-width': OW }) +
    shine(20, 26, 8)
  );
}

function leafPath(x: number, y: number, len: number, ang: number): string {
  const tip = polar(x, y, len, ang);
  const n = polar(0, 0, len * 0.32, ang - 90);
  const m = polar(x, y, len * 0.5, ang);
  return M(x, y) + Q(m.x + n.x, m.y + n.y, tip.x, tip.y) + Q(m.x - n.x, m.y - n.y, x, y) + 'Z';
}

function fruit(id: string): string {
  const stem = (x1: number, y1: number, x2: number, y2: number): string =>
    h('path', {
      d: M(x1, y1) + Q((x1 + x2) / 2 + 2, (y1 + y2) / 2, x2, y2),
      fill: 'none',
      stroke: '#7a5230',
      'stroke-width': 3.5,
      'stroke-linecap': 'round',
    });
  const leaf = (x: number, y: number, len: number, ang: number): string =>
    h('path', { d: leafPath(x, y, len, ang), ...st('#5cbf5a', '#2f6b2a', 2.5) });
  switch (id) {
    case 'apple': {
      const d =
        M(32, 20) +
        C(40, 13, 56, 18, 54, 34) +
        C(53, 48, 44, 58, 36, 56) +
        Q(32, 54, 28, 56) +
        C(20, 58, 10, 48, 10, 34) +
        C(8, 18, 24, 13, 32, 20) +
        'Z';
      return (
        h('path', { d, ...st('#e8423f', '#7a1d1d') }) +
        h('path', {
          d: M(30, 21) + Q(32, 24, 34, 21),
          fill: 'none',
          stroke: '#7a1d1d',
          'stroke-width': 2.5,
          'stroke-linecap': 'round',
        }) +
        stem(32, 21, 34, 9) +
        leaf(34, 13, 14, -30) +
        shine(17, 33, 9) +
        h('ellipse', { cx: 44, cy: 44, rx: 5, ry: 3, fill: '#ff7a6b', opacity: 0.6 })
      );
    }
    case 'plum': {
      const d =
        M(32, 16) +
        C(46, 16, 53, 28, 52, 38) +
        C(51, 50, 42, 57, 32, 57) +
        C(21, 57, 12, 49, 12, 37) +
        C(12, 26, 19, 16, 32, 16) +
        'Z';
      return (
        h('path', { d, ...st('#6a3f9e', '#2e1650') }) +
        h('path', {
          d: M(32, 18) + C(28, 30, 28, 44, 33, 55),
          fill: 'none',
          stroke: '#4a2478',
          'stroke-width': 2.5,
          'stroke-linecap': 'round',
        }) +
        h('ellipse', { cx: 22, cy: 30, rx: 5, ry: 8, fill: '#b9a4dc', opacity: 0.45 }) +
        stem(32, 17, 31, 8) +
        leaf(32, 11, 13, -20)
      );
    }
    case 'pear': {
      const d =
        M(32, 12) +
        C(38, 12, 39, 22, 41, 27) +
        C(48, 32, 52, 40, 50, 47) +
        C(48, 55, 40, 58, 32, 58) +
        C(24, 58, 16, 55, 14, 47) +
        C(12, 40, 16, 32, 23, 27) +
        C(25, 22, 26, 12, 32, 12) +
        'Z';
      return (
        h('path', { d, ...st('#c9d64a', '#5a6512') }) +
        h('ellipse', { cx: 40, cy: 46, rx: 6, ry: 4, fill: '#f2b33d', opacity: 0.55 }) +
        stem(32, 13, 34, 5) +
        leaf(34, 8, 12, -10) +
        shine(21, 42, 8) +
        h('circle', { cx: 26, cy: 36, r: 1.2, fill: '#5a6512' }) +
        h('circle', { cx: 37, cy: 52, r: 1.2, fill: '#5a6512' })
      );
    }
    case 'cherries':
      return (
        h('path', {
          d: M(21, 40) + Q(22, 22, 36, 9) + M(43, 44) + Q(40, 24, 36, 9),
          fill: 'none',
          stroke: '#5f7a2a',
          'stroke-width': 3,
          'stroke-linecap': 'round',
        }) +
        leaf(36, 10, 15, -15) +
        h('circle', { cx: 20, cy: 45, r: 11, ...st('#d7263d', '#6b0f1c') }) +
        h('circle', { cx: 43, cy: 47, r: 11, ...st('#e8303f', '#6b0f1c') }) +
        shine(14, 44, 6) +
        shine(37, 46, 6)
      );
    case 'berries': {
      const berry = (x: number, y: number, r: number): string =>
        h('circle', { cx: x, cy: y, r, ...st('#4f5fd0', '#1f2470') }) +
        h('path', {
          d:
            M(x - 2.5, y - r * 0.55) +
            L(x + 2.5, y - r * 0.55) +
            M(x, y - r * 0.55 - 2.5) +
            L(x, y - r * 0.55 + 2.5),
          stroke: '#1f2470',
          'stroke-width': 2,
          'stroke-linecap': 'round',
        }) +
        h('circle', {
          cx: x - r * 0.4,
          cy: y + r * 0.15,
          r: r * 0.22,
          fill: '#ffffff',
          opacity: 0.7,
        });
      return (
        leaf(30, 22, 18, -140) +
        leaf(34, 22, 18, -40) +
        berry(22, 40, 11) +
        berry(42, 40, 11) +
        berry(32, 28, 10) +
        berry(32, 50, 9.5)
      );
    }
    default:
      return '';
  }
}

function badge(kind: 'correct' | 'almost'): string {
  const fill = kind === 'correct' ? '#22a45d' : '#f08a24';
  const line = kind === 'correct' ? '#126b3b' : '#a85400';
  const mark =
    kind === 'correct'
      ? h('path', {
          d: M(19, 33) + L(28, 42) + L(45, 23),
          fill: 'none',
          stroke: '#ffffff',
          'stroke-width': 7,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        })
      : h('path', {
          d: M(24, 25) + C(24, 14, 41, 14, 41, 24) + C(41, 31, 32, 31, 32, 38),
          fill: 'none',
          stroke: '#ffffff',
          'stroke-width': 6.5,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }) + h('circle', { cx: 32, cy: 48, r: 4, fill: '#ffffff' });
  return (
    h('circle', { cx: 32, cy: 32, r: 27, ...st(fill, line) }) +
    h('path', {
      d: M(13, 26) + A(20, 20, 0, 0, 1, 26, 12),
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': 3,
      opacity: 0.45,
      'stroke-linecap': 'round',
    }) +
    mark
  );
}

function node(state: string, accent: string): string {
  const stone = (fill: string, line: string): string =>
    h('ellipse', { cx: 32, cy: 42, rx: 22, ry: 13, ...st(fill, line) }) +
    h('ellipse', { cx: 32, cy: 39, rx: 18, ry: 8, fill: '#ffffff', opacity: 0.35 });
  const starRow = (n: number): string =>
    [-1, 0, 1]
      .map((k, i) => {
        const x = 32 + k * 15;
        const y = 17 + Math.abs(k) * 5;
        const d = roundStarD(x, y, 5, 8.5, 4.2, -90, 0.2);
        return i < n
          ? h('path', { d, ...st('#ffd23f', '#8a5a00', 2.2) })
          : h('path', { d, ...st('#f6ecd9', '#b8a888', 2.2) });
      })
      .join('');
  switch (state) {
    case 'node-locked':
      return (
        stone('#c9c2d6', '#6b6385') +
        h('path', {
          d: M(26, 37) + L(26, 32) + A(6, 6, 0, 0, 1, 38, 32) + L(38, 37),
          fill: 'none',
          stroke: '#6b6385',
          'stroke-width': 3.5,
          'stroke-linecap': 'round',
        }) +
        h('path', { d: roundRectD(23, 35, 18, 13, 3), ...st('#8f86a8', '#4f4669', 2.5) }) +
        h('circle', { cx: 32, cy: 41, r: 2, fill: '#4f4669' })
      );
    case 'node-open':
      return (
        h('ellipse', {
          cx: 32,
          cy: 42,
          rx: 27,
          ry: 17,
          fill: 'none',
          stroke: accent,
          'stroke-width': 4,
          opacity: 0.5,
        }) +
        stone('#fffaf0', outlineOf(accent, 0.45)) +
        h('circle', { cx: 32, cy: 40, r: 5, fill: accent })
      );
    case 'node-current':
      return (
        h('ellipse', { cx: 32, cy: 42, rx: 30, ry: 19, fill: lighten(accent, 0.6), opacity: 0.8 }) +
        stone('#fffaf0', outlineOf(accent, 0.45)) +
        h('path', {
          d:
            M(32, 30) +
            C(26, 22, 18, 16, 18, 10) +
            C(18, 4, 26, 2, 32, 8) +
            C(38, 2, 46, 4, 46, 10) +
            C(46, 16, 38, 22, 32, 30) +
            'Z',
          ...st(accent, outlineOf(accent, 0.5), 2.5),
        }) +
        h('circle', { cx: 32, cy: 40, r: 5, fill: accent })
      );
    default: {
      const n = Number(state.slice(-1));
      return (
        stone('#fff3c4', '#b8862b') +
        h('circle', {
          cx: 32,
          cy: 41,
          r: 5,
          fill: '#ffcf33',
          stroke: '#8a5a00',
          'stroke-width': 2,
        }) +
        starRow(n)
      );
    }
  }
}

function glyphArt(id: string): string {
  switch (id) {
    case 'lock':
      return (
        h('path', {
          d: M(21, 29) + L(21, 22) + A(11, 11, 0, 0, 1, 43, 22) + L(43, 29),
          ...glyph(6),
        }) +
        h('path', {
          d: roundRectD(13, 28, 38, 28, 7) + circleD(32, 39, 4) + roundRectD(30, 40, 4, 9, 2),
          fill: 'currentColor',
          'fill-rule': 'evenodd',
        })
      );
    case 'check':
      return h('path', { d: M(13, 34) + L(26, 47) + L(51, 18), ...glyph(8) });
    case 'question':
      return (
        h('path', {
          d:
            M(32, 8) +
            C(48, 8, 58, 17, 58, 29) +
            C(58, 41, 48, 49, 34, 49) +
            L(22, 57) +
            L(24, 47) +
            C(13, 44, 6, 37, 6, 29) +
            C(6, 17, 16, 8, 32, 8) +
            'Z',
          ...glyph(4.5),
        }) +
        h('path', {
          d: M(25, 23) + C(25, 15, 39, 15, 39, 23) + C(39, 28, 32, 28, 32, 33),
          ...glyph(5),
        }) +
        h('circle', { cx: 32, cy: 40.5, r: 3.2, fill: 'currentColor' })
      );
    case 'speaker':
      return (
        h('path', {
          d: M(10, 25) + L(20, 25) + L(32, 14) + L(32, 50) + L(20, 39) + L(10, 39) + 'Z',
          fill: 'currentColor',
          stroke: 'currentColor',
          'stroke-width': 3,
          'stroke-linejoin': 'round',
        }) +
        h('path', { d: M(40, 24) + Q(45, 32, 40, 40) + M(46, 17) + Q(56, 32, 46, 47), ...glyph(5) })
      );
    case 'sound-off':
      return (
        h('path', {
          d: M(8, 25) + L(18, 25) + L(30, 14) + L(30, 50) + L(18, 39) + L(8, 39) + 'Z',
          fill: 'currentColor',
          stroke: 'currentColor',
          'stroke-width': 3,
          'stroke-linejoin': 'round',
        }) + h('path', { d: M(39, 24) + L(55, 40) + M(55, 24) + L(39, 40), ...glyph(5) })
      );
    case 'music':
      return (
        h('path', { d: M(26, 46) + L(26, 14) + L(50, 9) + L(50, 40), ...glyph(5) }) +
        h('ellipse', { cx: 19, cy: 47, rx: 8, ry: 6.5, fill: 'currentColor' }) +
        h('ellipse', { cx: 43, cy: 42, rx: 8, ry: 6.5, fill: 'currentColor' })
      );
    case 'settings':
      return h('path', {
        d: gearD(32, 32, 25, 8, 0.36),
        fill: 'currentColor',
        'fill-rule': 'evenodd',
        stroke: 'currentColor',
        'stroke-width': 3,
        'stroke-linejoin': 'round',
      });
    case 'parent':
      return (
        h('circle', { cx: 23, cy: 17, r: 8, fill: 'currentColor' }) +
        h('path', {
          d:
            M(9, 54) +
            L(9, 40) +
            C(9, 31, 15, 28, 23, 28) +
            C(31, 28, 37, 31, 37, 40) +
            L(37, 54) +
            'Z',
          fill: 'currentColor',
        }) +
        h('circle', { cx: 46, cy: 30, r: 6.5, fill: 'currentColor' }) +
        h('path', {
          d:
            M(36, 56) +
            L(36, 48) +
            C(36, 42, 40, 39, 46, 39) +
            C(52, 39, 56, 42, 56, 48) +
            L(56, 56) +
            'Z',
          fill: 'currentColor',
        })
      );
    case 'home':
      return (
        h('path', { d: M(8, 31) + L(32, 10) + L(56, 31), ...glyph(6) }) +
        h('path', {
          d:
            M(15, 28) +
            L(15, 54) +
            L(27, 54) +
            L(27, 40) +
            L(37, 40) +
            L(37, 54) +
            L(49, 54) +
            L(49, 28),
          ...glyph(5.5),
        })
      );
    case 'back':
      return h('path', {
        d: M(52, 32) + L(14, 32) + M(28, 17) + L(13, 32) + L(28, 47),
        ...glyph(7),
      });
    case 'next':
      return h('path', {
        d: M(12, 32) + L(50, 32) + M(36, 17) + L(51, 32) + L(36, 47),
        ...glyph(7),
      });
    case 'close':
      return h('path', { d: M(16, 16) + L(48, 48) + M(48, 16) + L(16, 48), ...glyph(7) });
    case 'print':
      return (
        h('path', { d: M(18, 22) + L(18, 8) + L(46, 8) + L(46, 22), ...glyph(5) }) +
        h('path', {
          d: roundRectD(8, 22, 48, 24, 6) + roundRectD(20, 38, 24, 18, 2),
          fill: 'currentColor',
          'fill-rule': 'evenodd',
        }) +
        h('path', { d: M(24, 44) + L(40, 44) + M(24, 50) + L(36, 50), ...glyph(3) }) +
        h('circle', { cx: 47, cy: 30, r: 2.5, fill: '#ffffff' })
      );
    case 'hint':
      return (
        h('path', {
          d:
            M(32, 7) +
            C(45, 7, 52, 16, 52, 26) +
            C(52, 35, 44, 39, 42, 46) +
            L(22, 46) +
            C(20, 39, 12, 35, 12, 26) +
            C(12, 16, 19, 7, 32, 7) +
            'Z',
          ...glyph(5),
        }) +
        h('path', { d: M(23, 52) + L(41, 52) + M(26, 58) + L(38, 58), ...glyph(5) }) +
        h('path', { d: M(27, 28) + L(32, 36) + L(37, 28), ...glyph(3.5) })
      );
    default:
      return '';
  }
}

/** Renders any icon id (item icons, UI glyphs, region emblems) as an SVG string. */
export function renderIcon(id: string, opts: IconOptions = {}): string {
  const prefix = opts.idPrefix ?? `dv-icon-${id}`;
  const sc = scoped(prefix);
  const p = (n: string): string => sc.id(n);
  const accent = opts.accent ?? '#6a4ce0';
  let body: string;
  if ((GLYPH_ICON_IDS as readonly string[]).includes(id)) body = glyphArt(id);
  else if ((REGION_EMBLEM_IDS as readonly string[]).includes(id)) body = emblemArt(id, p);
  else if ((FRUIT_IDS as readonly string[]).includes(id)) body = fruit(id);
  else if (id === 'coin') body = coin(p);
  else if (id === 'star-filled') body = starIcon(p, true);
  else if (id === 'star-empty') body = starIcon(p, false);
  else if (id === 'chest-closed') body = chest(false);
  else if (id === 'chest-open') body = chest(true);
  else if (id === 'egg') body = eggIcon();
  else if (id === 'badge-correct') body = badge('correct');
  else if (id === 'badge-almost') body = badge('almost');
  else if (id.startsWith('node-')) body = node(id, accent);
  else throw new Error(`Unknown icon id: ${id}`);
  return svgDoc(
    {
      viewBox: [0, 0, S, S],
      width: opts.size,
      height: opts.size,
      className: ['dv-icon', `dv-icon-${id}`, opts.className].filter(Boolean).join(' '),
      title: opts.title,
      idPrefix: prefix,
    },
    body,
  );
}
