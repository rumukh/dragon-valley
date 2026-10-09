import { M, L, Q, C, polyD, circleD } from '../svg/path';
import { h } from '../svg/xml';
import { darken, lighten, outlineOf } from '../svg/color';
import { flower, sparkleD } from '../glyphs';
import paletteJson from '../../../../assets/art/palette.json';

export const REGION_EMBLEM_IDS = [
  'emblem-pebble-brook',
  'emblem-mushroom-hollow',
  'emblem-rainbow-ford',
  'emblem-hundred-hills',
  'emblem-market-square',
  'emblem-sunny-meadow',
  'emblem-whispering-woods',
  'emblem-fire-mountain',
  'emblem-crystal-caves',
  'emblem-sharing-lake',
  'emblem-leftover-lagoon',
  'emblem-giants-peaks',
  'emblem-riddle-ruins',
  'emblem-dragon-castle',
] as const;

const INK = '#2a2140';

/** Region emblem: a round badge in the region accent with a pictogram (64 x 64). */
export function emblemArt(id: string, p: (n: string) => string): string {
  const region = id.replace(/^emblem-/, '');
  const accent = (paletteJson.regions as Record<string, { accent: string }>)[region]?.accent;
  if (!accent) throw new Error(`Unknown emblem: ${id}`);
  const g = p('em');
  const line = outlineOf(accent, 0.55);
  const cream = '#fffaf0';
  const st = (fill: string, w = 2.5): Record<string, string | number> => ({
    fill,
    stroke: line,
    'stroke-width': w,
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round',
  });
  const clip = p('emc');
  let pic = '';
  switch (region) {
    case 'pebble-brook':
      // Stepping stones across a brook: count the stones to cross.
      pic =
        h('path', {
          d:
            M(2, 30) +
            Q(18, 22, 32, 30) +
            Q(46, 38, 62, 30) +
            L(62, 52) +
            Q(46, 60, 32, 52) +
            Q(18, 44, 2, 52) +
            'Z',
          fill: lighten(accent, 0.45),
          stroke: 'none',
        }) +
        h('path', {
          d: M(6, 40) + Q(14, 36, 22, 40) + M(40, 44) + Q(48, 40, 56, 44),
          fill: 'none',
          stroke: cream,
          'stroke-width': 2.6,
          'stroke-linecap': 'round',
        }) +
        [
          [14, 48, 7],
          [26, 38, 6],
          [38, 46, 6.5],
          [50, 36, 6],
        ]
          .map(([x, y, r], i) =>
            h('ellipse', {
              cx: x!,
              cy: y!,
              rx: r!,
              ry: r! * 0.66,
              ...st(['#d9d2c6', '#c9d6de', '#e3d4bb', '#d6cde2'][i]!),
            }),
          )
          .join('') +
        h('path', { d: sparkleD(46, 16, 6) + sparkleD(18, 20, 4), fill: '#fff6b8' });
      break;
    case 'mushroom-hollow':
      pic =
        h('path', {
          d: M(26, 34) + L(24, 54) + Q(32, 58, 40, 54) + L(38, 34) + 'Z',
          ...st(cream),
        }) +
        h('path', {
          d: M(8, 36) + C(8, 14, 56, 14, 56, 36) + Q(32, 42, 8, 36) + 'Z',
          ...st('#e2554a'),
        }) +
        h('circle', { cx: 22, cy: 26, r: 3.6, fill: cream }) +
        h('circle', { cx: 36, cy: 21, r: 3, fill: cream }) +
        h('circle', { cx: 46, cy: 30, r: 3.2, fill: cream }) +
        h('path', {
          d: M(4, 58) + Q(32, 50, 60, 58),
          fill: 'none',
          stroke: '#5c9a3a',
          'stroke-width': 4,
          'stroke-linecap': 'round',
        });
      break;
    case 'rainbow-ford': {
      const cols = ['#ff5a5f', '#ffd93d', '#5ccc6b', '#4aa8ff'];
      pic =
        cols
          .map((c, i) =>
            h('path', {
              d: M(10 + i * 4, 44) + Q(32, 4 + i * 8, 54 - i * 4, 44),
              fill: 'none',
              stroke: c,
              'stroke-width': 4,
              'stroke-linecap': 'round',
            }),
          )
          .join('') +
        h('path', {
          d: M(2, 50) + Q(16, 44, 32, 50) + Q(48, 56, 62, 50),
          fill: 'none',
          stroke: cream,
          'stroke-width': 4,
          'stroke-linecap': 'round',
        });
      break;
    }
    case 'hundred-hills':
      pic =
        h('path', {
          d: M(0, 50) + Q(14, 30, 28, 46) + Q(40, 26, 64, 44) + L(64, 64) + L(0, 64) + 'Z',
          ...st('#9ad35f'),
        }) +
        h('path', {
          d: M(0, 58) + Q(20, 44, 40, 56) + Q(52, 48, 64, 54) + L(64, 64) + L(0, 64) + 'Z',
          ...st('#6fb43c'),
        }) +
        h('path', {
          d: M(14, 34) + L(14, 22) + M(42, 30) + L(42, 16),
          stroke: line,
          'stroke-width': 2.2,
          'stroke-linecap': 'round',
        }) +
        h('path', {
          d: polyD([
            { x: 14, y: 22 },
            { x: 24, y: 25 },
            { x: 14, y: 28 },
          ]),
          ...st('#ffd23f', 1.8),
        }) +
        h('path', {
          d: polyD([
            { x: 42, y: 16 },
            { x: 52, y: 19 },
            { x: 42, y: 22 },
          ]),
          ...st(cream, 1.8),
        });
      break;
    case 'market-square':
      pic =
        h('path', { d: M(12, 34) + L(52, 34) + L(52, 56) + L(12, 56) + 'Z', ...st('#e9c79a') }) +
        h('path', {
          d: M(8, 34) + L(14, 16) + L(50, 16) + L(56, 34) + 'Z',
          ...st(cream),
        }) +
        h('path', {
          d: M(20, 16) + L(18, 34) + M(32, 16) + L(32, 34) + M(44, 16) + L(46, 34),
          stroke: '#e2554a',
          'stroke-width': 5,
        }) +
        h('circle', { cx: 24, cy: 44, r: 5, ...st('#ff7a59', 1.8) }) +
        h('circle', { cx: 40, cy: 44, r: 5, ...st('#ffd23f', 1.8) });
      break;
    case 'sunny-meadow':
      pic =
        h('circle', { cx: 40, cy: 24, r: 8, ...st('#fff3a6') }) +
        h('path', {
          d:
            M(40, 11) +
            L(40, 14) +
            M(51, 24) +
            L(54, 24) +
            M(48, 16) +
            L(50, 14) +
            M(48, 32) +
            L(50, 34) +
            M(32, 16) +
            L(30, 14),
          stroke: '#fff3a6',
          'stroke-width': 3,
          'stroke-linecap': 'round',
        }) +
        h('path', {
          d: M(4, 46) + Q(20, 32, 36, 42) + Q(48, 36, 60, 44) + L(60, 64) + L(4, 64) + 'Z',
          ...st('#7ccf5a'),
        }) +
        flower(20, 44, 7, 5, '#ffffff', '#ffd23f', line, 1.8);
      break;
    case 'whispering-woods': {
      const pine = (x: number, y: number, s: number, fill: string): string =>
        h('path', {
          d: polyD([
            { x, y: y - s * 1.5 },
            { x: x + s * 0.55, y: y - s * 0.75 },
            { x: x + s * 0.32, y: y - s * 0.75 },
            { x: x + s * 0.8, y },
            { x: x - s * 0.8, y },
            { x: x - s * 0.32, y: y - s * 0.75 },
            { x: x - s * 0.55, y: y - s * 0.75 },
          ]),
          ...st(fill),
        }) + h('rect', { x: x - 2.5, y, width: 5, height: s * 0.3, ...st('#8a5a2e', 2) });
      pic =
        pine(23, 44, 16, '#2f8a4c') +
        pine(41, 48, 19, '#3fae5a') +
        h('path', { d: sparkleD(48, 18, 4) + sparkleD(14, 22, 3), fill: cream });
      break;
    }
    case 'fire-mountain':
      pic =
        h('path', {
          d: M(6, 54) + L(24, 26) + Q(32, 22, 40, 26) + L(58, 54) + 'Z',
          ...st('#a8553a'),
        }) +
        h('path', {
          d: M(24, 26) + Q(32, 22, 40, 26) + L(37, 31) + Q(32, 28, 27, 31) + 'Z',
          fill: '#7a3a26',
        }) +
        h('path', {
          d:
            M(32, 26) +
            C(24, 24, 24, 14, 30, 8) +
            C(30, 13, 33, 14, 34, 11) +
            C(40, 16, 40, 24, 32, 26) +
            'Z',
          ...st('#ffd447', 2),
        }) +
        h('path', {
          d: M(16, 54) + Q(24, 44, 30, 54) + M(36, 54) + Q(44, 46, 50, 54),
          fill: 'none',
          stroke: lighten('#a8553a', 0.3),
          'stroke-width': 2.5,
        });
      break;
    case 'crystal-caves':
      pic =
        h('path', {
          d: polyD([
            { x: 32, y: 10 },
            { x: 40, y: 22 },
            { x: 38, y: 50 },
            { x: 26, y: 50 },
            { x: 24, y: 22 },
          ]),
          ...st('#d7c8ff'),
        }) +
        h('path', {
          d: polyD([
            { x: 18, y: 24 },
            { x: 24, y: 32 },
            { x: 24, y: 50 },
            { x: 14, y: 50 },
            { x: 12, y: 32 },
          ]),
          ...st('#b9a4ff'),
        }) +
        h('path', {
          d: polyD([
            { x: 47, y: 26 },
            { x: 53, y: 34 },
            { x: 51, y: 50 },
            { x: 41, y: 50 },
            { x: 40, y: 34 },
          ]),
          ...st('#9fe6ff'),
        }) +
        h('path', {
          d: M(32, 12) + L(32, 48) + M(18, 26) + L(18, 48),
          stroke: '#ffffff',
          'stroke-width': 2,
          opacity: 0.6,
        }) +
        h('path', { d: sparkleD(50, 16, 4), fill: cream });
      break;
    case 'sharing-lake':
      pic =
        h('path', {
          d: M(8, 34) + Q(16, 28, 24, 34) + Q(32, 40, 40, 34) + Q(48, 28, 56, 34),
          fill: 'none',
          stroke: cream,
          'stroke-width': 4,
          'stroke-linecap': 'round',
        }) +
        h('path', {
          d: M(10, 46) + Q(18, 40, 26, 46) + Q(34, 52, 42, 46) + Q(50, 40, 56, 46),
          fill: 'none',
          stroke: lighten(accent, 0.55),
          'stroke-width': 4,
          'stroke-linecap': 'round',
        }) +
        h('path', {
          d: M(22, 22) + L(42, 22) + Q(42, 30, 32, 30) + Q(22, 30, 22, 22) + 'Z',
          ...st(cream),
        }) +
        h('path', {
          d: M(42, 23) + Q(48, 23, 46, 27) + Q(44, 29, 41, 27),
          fill: 'none',
          stroke: line,
          'stroke-width': 2.2,
        }) +
        h('circle', { cx: 32, cy: 18, r: 4, ...st('#6a3f9e', 1.8) });
      break;
    case 'leftover-lagoon': {
      let shell = M(32, 50) + L(10, 36);
      const pts = [
        [10, 36],
        [13, 24],
        [22, 15],
        [32, 12],
        [42, 15],
        [51, 24],
        [54, 36],
      ];
      for (let i = 1; i < pts.length; i++)
        shell += Q(
          (pts[i - 1]![0]! + pts[i]![0]!) / 2 + (pts[i]![0]! - 32) * 0.08,
          (pts[i - 1]![1]! + pts[i]![1]!) / 2 - 3,
          pts[i]![0]!,
          pts[i]![1]!,
        );
      shell += 'Z';
      const ribs = pts
        .map(([x, y]) => M(32, 48) + L(x! * 0.85 + 32 * 0.15, y! * 0.85 + 48 * 0.15))
        .join('');
      pic =
        h('path', { d: shell, ...st('#ffd6e8') }) +
        h('path', { d: ribs, stroke: line, 'stroke-width': 1.6, opacity: 0.5 }) +
        h('circle', { cx: 32, cy: 46, r: 7, fill: '#fbf7f2', stroke: line, 'stroke-width': 2 }) +
        h('circle', { cx: 30, cy: 44, r: 2.2, fill: '#ffffff' });
      break;
    }
    case 'giants-peaks':
      pic =
        h('path', {
          d: M(4, 54) + L(22, 18) + L(34, 38) + L(42, 26) + L(60, 54) + 'Z',
          ...st('#7d6fa8'),
        }) +
        h('path', {
          d: M(22, 18) + L(28, 30) + L(24, 28) + L(20, 32) + L(17, 28) + 'Z',
          fill: cream,
        }) +
        h('path', {
          d: M(42, 26) + L(47, 34) + L(44, 33) + L(41, 36) + L(38, 32) + 'Z',
          fill: cream,
        }) +
        h('path', {
          d: M(4, 54) + Q(30, 44, 60, 54) + L(60, 64) + L(4, 64) + 'Z',
          fill: '#5f9e4a',
        });
      break;
    case 'riddle-ruins':
      pic =
        h('path', {
          d:
            M(14, 54) +
            L(14, 26) +
            Q(14, 12, 32, 12) +
            Q(50, 12, 50, 26) +
            L(50, 54) +
            L(42, 54) +
            L(42, 28) +
            Q(42, 20, 32, 20) +
            Q(22, 20, 22, 28) +
            L(22, 54) +
            'Z',
          ...st('#e9dcc0'),
        }) +
        h('path', {
          d:
            M(14, 34) +
            L(22, 34) +
            M(14, 44) +
            L(22, 44) +
            M(42, 34) +
            L(50, 34) +
            M(42, 44) +
            L(50, 44) +
            M(27, 15) +
            L(29, 21) +
            M(37, 15) +
            L(35, 21),
          stroke: line,
          'stroke-width': 1.8,
          opacity: 0.6,
        }) +
        h('path', {
          d: M(44, 14) + Q(48, 8, 54, 12),
          fill: 'none',
          stroke: '#5cbf5a',
          'stroke-width': 3,
          'stroke-linecap': 'round',
        }) +
        h('path', {
          d: M(27, 40) + C(27, 33, 37, 33, 37, 39) + C(37, 43, 32, 43, 32, 47),
          fill: 'none',
          stroke: cream,
          'stroke-width': 3.2,
          'stroke-linecap': 'round',
        }) +
        h('circle', { cx: 32, cy: 51.5, r: 1.8, fill: cream });
      break;
    case 'dragon-castle':
      pic =
        h('path', {
          d:
            M(10, 56) +
            L(10, 28) +
            L(8, 28) +
            L(8, 22) +
            L(12, 22) +
            L(12, 25) +
            L(15, 25) +
            L(15, 22) +
            L(19, 22) +
            L(19, 28) +
            L(17, 28) +
            L(17, 36) +
            L(25, 36) +
            L(25, 24) +
            L(32, 14) +
            L(39, 24) +
            L(39, 36) +
            L(47, 36) +
            L(47, 28) +
            L(45, 28) +
            L(45, 22) +
            L(49, 22) +
            L(49, 25) +
            L(52, 25) +
            L(52, 22) +
            L(56, 22) +
            L(56, 28) +
            L(54, 28) +
            L(54, 56) +
            'Z',
          ...st(cream),
        }) +
        h('path', {
          d: M(28, 56) + L(28, 46) + Q(32, 40, 36, 46) + L(36, 56) + 'Z',
          fill: darken(accent, 0.2),
        }) +
        h('path', {
          d: M(32, 14) + L(32, 5) + L(40, 8) + L(32, 11),
          fill: '#ffd23f',
          stroke: line,
          'stroke-width': 1.8,
          'stroke-linejoin': 'round',
        }) +
        h('rect', { x: 30, y: 26, width: 4, height: 6, rx: 2, fill: '#ffd23f' });
      break;
    default:
      pic = '';
  }
  return (
    h(
      'defs',
      null,
      h(
        'radialGradient',
        { id: g, cx: '0.35', cy: '0.3', r: '0.8' },
        h('stop', { offset: '0', 'stop-color': lighten(accent, 0.45) }),
        h('stop', { offset: '0.6', 'stop-color': accent }),
        h('stop', { offset: '1', 'stop-color': darken(accent, 0.2) }),
      ),
      h('clipPath', { id: clip }, h('circle', { cx: 32, cy: 32, r: 26 })),
    ) +
    h('circle', { cx: 32, cy: 32, r: 29, fill: `url(#${g})`, stroke: INK, 'stroke-width': 3 }) +
    h('g', { 'clip-path': `url(#${clip})` }, pic) +
    h('circle', {
      cx: 32,
      cy: 32,
      r: 26,
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': 2,
      opacity: 0.7,
    }) +
    h('path', { d: circleD(32, 32, 29), fill: 'none', stroke: INK, 'stroke-width': 3 })
  );
}
