/**
 * Region scenes, part 3: the Lower Valley (grades 1-2, docs/grades-plan.md section 3). Same
 * composition rule as parts 1 and 2: calm sky and far scenery in the centre-top UI area, the
 * near bank around y = 780, the dragon's spot left of centre and the boss's spot right of
 * centre, detail framing the edges.
 */
import { M, L, Q, C } from '../svg/path';
import { h } from '../svg/xml';
import { rng } from '../svg/prng';
import { sparkleD } from '../glyphs';
import {
  bush,
  cloud,
  hills,
  linear,
  meadowDetails,
  reeds,
  ridgeD,
  roundTree,
  sky,
  sun,
  tuft,
  vignette,
  water,
  type Defs,
} from './kit';

const FLOWERS = ['#ffffff', '#ffd23f', '#ff9fbf', '#8fd3f4', '#ff7a59'];
const PEBBLE_COLORS = ['#d9d2c6', '#c9d6de', '#e3d4bb', '#d6cde2', '#cfdcc8', '#e8d9cf'];

/** A smooth river pebble lying on the ground (bottom centre x, y; width w). */
export function pebble(x: number, y: number, w: number, color: string): string {
  const hh = w * 0.56;
  return (
    h('path', {
      d:
        M(x - w / 2, y) +
        C(x - w / 2, y - hh * 1.1, x + w / 2, y - hh * 1.1, x + w / 2, y) +
        Q(x, y + hh * 0.18, x - w / 2, y) +
        'Z',
      fill: color,
      stroke: '#6f6a7f',
      'stroke-width': Math.max(2, w * 0.06),
      'stroke-linejoin': 'round',
    }) +
    h('ellipse', {
      cx: x - w * 0.16,
      cy: y - hh * 0.55,
      rx: w * 0.14,
      ry: hh * 0.14,
      fill: '#ffffff',
      opacity: 0.55,
    })
  );
}

/** A flat stepping stone in the water, seen from above at a slant. */
export function steppingStone(x: number, y: number, w: number, color: string): string {
  return (
    h('ellipse', {
      cx: x,
      cy: y + w * 0.12,
      rx: w * 0.55,
      ry: w * 0.2,
      fill: '#2f7fb0',
      opacity: 0.35,
    }) +
    h('ellipse', {
      cx: x,
      cy: y,
      rx: w / 2,
      ry: w * 0.26,
      fill: color,
      stroke: '#6f6a7f',
      'stroke-width': 3,
    }) +
    h('ellipse', {
      cx: x - w * 0.12,
      cy: y - w * 0.07,
      rx: w * 0.18,
      ry: w * 0.06,
      fill: '#ffffff',
      opacity: 0.5,
    })
  );
}

/**
 * Pebble Brook: a clear, shallow brook winding across a sunny meadow, ten stepping stones to
 * count across it, smooth pebbles on the banks, willows and reeds where the will-o'-wisps hide.
 */
export function pebbleBrook(defs: Defs): string {
  const r = rng('pebble-brook');
  let out = sky(defs, '#a6dcff', '#f2fbff', 0.6);
  out += sun(defs, 1290, 150, 58);
  out += cloud(330, 160, 54) + cloud(980, 110, 44) + cloud(700, 250, 26);
  out += hills(defs, 'far', r, 590, 70, 6, '#bfe3c4', '#a6d4ae');
  out += hills(defs, 'mid', r, 650, 60, 5, '#9fd27e', '#86c46a');
  // far trees along the brook
  for (const [x, s, c] of [
    [90, 150, '#6fbf4f'],
    [220, 120, '#5aa54a'],
    [1370, 130, '#6fbf4f'],
    [1500, 160, '#5aa54a'],
  ] as const)
    out += roundTree(x, 650, s, c);
  // the brook: in from the far left, winding to the near right
  const top = M(-20, 662) + C(300, 640, 520, 700, 820, 690) + C(1100, 680, 1300, 720, 1620, 712);
  const brook =
    top + L(1620, 800) + C(1300, 806, 1100, 770, 820, 778) + C(520, 786, 300, 740, -20, 750) + 'Z';
  out += water(defs, 'brook', brook, '#bdeaff', '#5cb6e6', r, [0, 660, 1600, 800], 26);
  out += h('path', {
    d: M(-20, 750) + C(300, 740, 520, 786, 820, 778) + C(1100, 770, 1300, 806, 1620, 800),
    fill: 'none',
    stroke: '#ffffff',
    'stroke-width': 5,
    'stroke-linecap': 'round',
    opacity: 0.55,
  });
  // ten stepping stones across the brook, in two fives
  const stones: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    stones.push([560 + t * 520 + (i >= 5 ? 26 : 0), 724 + Math.sin(t * Math.PI * 2) * 12]);
  }
  out += stones
    .map(([x, y], i) =>
      steppingStone(x, y, 46 + (i % 3) * 4, PEBBLE_COLORS[i % PEBBLE_COLORS.length]!),
    )
    .join('');
  // pebble shoals on the far bank
  for (let i = 0; i < 12; i++) {
    const x = 120 + i * 120 + r() * 40;
    out += pebble(x, 668 + r() * 14 + (x > 820 ? 20 : 0), 16 + r() * 10, PEBBLE_COLORS[i % 6]!);
  }
  // near bank
  out += h('path', {
    d: ridgeD(r, 820, 26, 7),
    fill: linear(defs, 'bank', [
      [0, '#86cd62'],
      [1, '#5fae4c'],
    ]),
  });
  // willows framing the edges
  for (const [x, flip] of [
    [70, 1],
    [1530, -1],
  ] as const) {
    out += h('path', {
      d: M(x, 830) + C(x - flip * 6, 720, x + flip * 30, 640, x + flip * 70, 600),
      fill: 'none',
      stroke: '#7a5230',
      'stroke-width': 26,
      'stroke-linecap': 'round',
    });
    for (let i = 0; i < 12; i++) {
      const bx = x + flip * (-40 + i * 18);
      out += h('path', {
        d:
          M(bx + flip * 60, 540 + (i % 3) * 12) +
          Q(bx + flip * 30, 640, bx + flip * 12, 760 - (i % 4) * 22),
        fill: 'none',
        stroke: ['#6fbf4f', '#5aa54a', '#8fd46a'][i % 3]!,
        'stroke-width': 14,
        'stroke-linecap': 'round',
      });
    }
  }
  out += reeds(250, 820, 96) + reeds(1340, 826, 90) + reeds(960, 812, 60);
  out += bush(1460, 900, 54, '#5aa54a', '#ffd23f') + bush(150, 930, 50, '#6fbf4f', '#ffffff');
  // counting pebbles on the near bank (left: the dragon's side; right: the wisps')
  for (const [x, y, w] of [
    [250, 900, 34],
    [290, 910, 26],
    [640, 940, 30],
    [980, 950, 28],
    [1010, 940, 22],
    [1330, 920, 36],
    [1380, 930, 24],
  ] as const)
    out += pebble(x, y, w, PEBBLE_COLORS[((x / 10) % 6) | 0]!);
  out += tuft(560, 880, 18, '#4f9a3f') + tuft(1100, 890, 16, '#4f9a3f');
  out += meadowDetails(r, 0, 1600, 870, 995, 60, FLOWERS, '#4f9a3f');
  // a few soft wisp-lights over the reeds
  out += h('path', {
    d:
      sparkleD(250, 680, 12) +
      sparkleD(1350, 690, 10) +
      sparkleD(1180, 640, 8) +
      sparkleD(420, 640, 7),
    fill: '#fff6b8',
    opacity: 0.85,
  });
  return out + vignette(defs, '#1f3a4a', 0.16);
}
