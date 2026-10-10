/**
 * Region scenes, part 5: the rest of first grade in the Lower Valley (docs/grades-plan.md
 * section 3), Mushroom Hollow and Rainbow Ford. Same composition rule as parts 1-4: calm sky and
 * far scenery in the centre-top UI area, the near ground around y = 780, the dragon's spot left of
 * centre and the boss's spot right of centre, detail framing the edges.
 */
import { M, L, Q, C, roundRectD } from '../svg/path';
import { h } from '../svg/xml';
import { rng, type Rng } from '../svg/prng';
import { darken, lighten, outlineOf } from '../svg/color';
import { sparkleD } from '../glyphs';
import {
  bush,
  cloud,
  hills,
  lightRays,
  lilyPad,
  linear,
  meadowDetails,
  radial,
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
import { pebble, steppingStone } from './scenes-c';
import { pennant } from './scenes-d';

const FLOWERS = ['#ffffff', '#ffd23f', '#ff9fbf', '#8fd3f4', '#ff7a59'];
const RAINBOW = ['#e8423f', '#ff9a2e', '#ffd23f', '#5cc46a', '#3f9fe0', '#5a5ad9', '#a35ad9'];

/** A toadstool (foot centre x, y; cap radius s). Red ones get white spots, brown ones a sheen. */
export function toadstool(x: number, y: number, s: number, cap: string, spots = true): string {
  const stem =
    M(x - s * 0.28, y - s * 0.7) +
    Q(x - s * 0.36, y - s * 0.25, x - s * 0.4, y) +
    Q(x, y + s * 0.1, x + s * 0.4, y) +
    Q(x + s * 0.34, y - s * 0.25, x + s * 0.28, y - s * 0.7) +
    'Z';
  const capD =
    M(x - s, y - s * 0.62) +
    C(x - s * 1.02, y - s * 1.75, x + s * 1.02, y - s * 1.75, x + s, y - s * 0.62) +
    Q(x, y - s * 0.86, x - s, y - s * 0.62) +
    'Z';
  let marks = '';
  if (spots)
    for (const [dx, dy, rr] of [
      [-0.55, -0.9, 0.15],
      [-0.08, -1.22, 0.17],
      [0.45, -0.98, 0.13],
      [0.78, -0.7, 0.09],
      [-0.82, -0.66, 0.08],
      [0.12, -0.82, 0.09],
    ] as const)
      marks += h('ellipse', {
        cx: x + dx * s,
        cy: y + dy * s,
        rx: rr * s,
        ry: rr * s * 0.8,
        fill: '#fffaf0',
      });
  else
    marks = h('path', {
      d: M(x - s * 0.62, y - s * 0.95) + Q(x - s * 0.3, y - s * 1.32, x + s * 0.1, y - s * 1.3),
      fill: 'none',
      stroke: lighten(cap, 0.4),
      'stroke-width': Math.max(2, s * 0.1),
      'stroke-linecap': 'round',
    });
  return (
    h('path', {
      d: stem,
      fill: '#fff4e0',
      stroke: '#a88a68',
      'stroke-width': Math.max(1.5, s * 0.05),
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d: M(x - s * 0.62, y - s * 0.66) + Q(x, y - s * 0.5, x + s * 0.62, y - s * 0.66),
      fill: 'none',
      stroke: '#e8d4b4',
      'stroke-width': Math.max(1.5, s * 0.08),
      'stroke-linecap': 'round',
    }) +
    h('path', {
      d: capD,
      fill: cap,
      stroke: outlineOf(cap, 0.5),
      'stroke-width': Math.max(2, s * 0.06),
      'stroke-linejoin': 'round',
    }) +
    marks
  );
}

/** An acorn lying on the ground (bottom centre x, y; size s), tilted by a degrees. */
export function acornProp(x: number, y: number, s: number, a = 0): string {
  return h(
    'g',
    { transform: `rotate(${a} ${x} ${y})` },
    h('path', {
      d:
        M(x - s * 0.36, y - s * 0.62) +
        C(x - s * 0.4, y - s * 0.1, x - s * 0.1, y, x, y) +
        C(x + s * 0.1, y, x + s * 0.4, y - s * 0.1, x + s * 0.36, y - s * 0.62) +
        'Z',
      fill: '#c98a3e',
      stroke: '#7a4e22',
      'stroke-width': Math.max(1.5, s * 0.07),
      'stroke-linejoin': 'round',
    }),
    h('path', {
      d:
        M(x - s * 0.44, y - s * 0.6) +
        Q(x - s * 0.44, y - s * 0.98, x, y - s * 0.98) +
        Q(x + s * 0.44, y - s * 0.98, x + s * 0.44, y - s * 0.6) +
        Q(x, y - s * 0.5, x - s * 0.44, y - s * 0.6) +
        'Z',
      fill: '#8a5a2e',
      stroke: '#5a3a1a',
      'stroke-width': Math.max(1.5, s * 0.07),
      'stroke-linejoin': 'round',
    }),
    h('path', {
      d: M(x, y - s * 0.98) + Q(x + s * 0.04, y - s * 1.14, x + s * 0.14, y - s * 1.18),
      fill: 'none',
      stroke: '#5a3a1a',
      'stroke-width': Math.max(2, s * 0.09),
      'stroke-linecap': 'round',
    }),
    h('ellipse', {
      cx: x - s * 0.16,
      cy: y - s * 0.34,
      rx: s * 0.07,
      ry: s * 0.14,
      fill: '#ffffff',
      opacity: 0.4,
    }),
  );
}

/** A feathery fern frond fan growing from x, y (height s, leaning by dir). */
function fern(x: number, y: number, s: number, color: string, dir = 1): string {
  let out = '';
  for (const a of [-50, -25, 0, 22, 46]) {
    const rad = ((a * dir - 90) * Math.PI) / 180;
    const tx = x + Math.cos(rad) * s;
    const ty = y + Math.sin(rad) * s;
    const mx = x + Math.cos(rad) * s * 0.5 + dir * s * 0.12;
    const my = y + Math.sin(rad) * s * 0.5;
    out += h('path', {
      d: M(x, y) + Q(mx, my, tx, ty),
      fill: 'none',
      stroke: darken(color, 0.15),
      'stroke-width': 3,
      'stroke-linecap': 'round',
    });
    let leaves = '';
    for (let i = 1; i < 7; i++) {
      const t = i / 7;
      const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * mx + t * t * tx;
      const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * my + t * t * ty;
      const l = s * 0.2 * (1 - t * 0.7);
      leaves +=
        M(px, py) +
        Q(px - l * 0.6, py - l * 0.2, px - l, py + l * 0.3) +
        M(px, py) +
        Q(px + l * 0.6, py - l * 0.2, px + l, py + l * 0.3);
    }
    out += h('path', {
      d: leaves,
      fill: 'none',
      stroke: color,
      'stroke-width': 5,
      'stroke-linecap': 'round',
    });
  }
  return out;
}

/** A big old tree trunk with roots, framing an edge (foot centre x, y). */
function oldTrunk(x: number, y: number, w: number, color: string, top = -40): string {
  const bark = darken(color, 0.25);
  let grain = '';
  for (let i = 0; i < 4; i++) {
    const gx = x - w * 0.3 + i * w * 0.2;
    grain += M(gx, y - 40) + Q(gx + 8, (y + top) / 2, gx - 4, top);
  }
  return (
    h('path', {
      d:
        M(x - w / 2, top) +
        L(x - w / 2, y - w * 0.3) +
        Q(x - w * 0.6, y - 10, x - w * 1.05, y + 6) +
        L(x + w * 1.05, y + 6) +
        Q(x + w * 0.6, y - 10, x + w / 2, y - w * 0.3) +
        L(x + w / 2, top) +
        'Z',
      fill: color,
      stroke: bark,
      'stroke-width': 4,
      'stroke-linejoin': 'round',
    }) + h('path', { d: grain, fill: 'none', stroke: bark, 'stroke-width': 3, opacity: 0.55 })
  );
}

/** A little round door in a tree stump: the House Goblin's nook (foot centre x, y). */
export function goblinNook(x: number, y: number, s: number): string {
  const stump = '#a7774a';
  const top = y - s * 1.6;
  let rings = '';
  for (let i = 1; i < 4; i++)
    rings += h('ellipse', {
      cx: x,
      cy: top,
      rx: s * 0.95 * (i / 4),
      ry: s * 0.24 * (i / 4),
      fill: 'none',
      stroke: '#b58956',
      'stroke-width': 2,
    });
  const door = roundRectD(x - s * 0.34, y - s * 0.9, s * 0.68, s * 0.9, s * 0.34);
  return (
    h('path', {
      d:
        M(x - s, top) +
        L(x - s * 1.02, y - s * 0.2) +
        Q(x - s * 1.25, y, x - s * 1.5, y + 4) +
        L(x + s * 1.5, y + 4) +
        Q(x + s * 1.25, y, x + s * 1.02, y - s * 0.2) +
        L(x + s, top) +
        'Z',
      fill: stump,
      stroke: '#6a4422',
      'stroke-width': 4,
      'stroke-linejoin': 'round',
    }) +
    h('ellipse', {
      cx: x,
      cy: top,
      rx: s,
      ry: s * 0.25,
      fill: '#e2bf8a',
      stroke: '#6a4422',
      'stroke-width': 4,
    }) +
    rings +
    // moss cushion on the stump, and a tiny chimney with a curl of smoke
    h('path', {
      d:
        M(x - s, top + 4) +
        Q(x - s * 0.6, top - s * 0.18, x - s * 0.1, top + s * 0.06) +
        Q(x - s * 0.4, top + s * 0.3, x - s, top + s * 0.34) +
        'Z',
      fill: '#7fb44a',
      stroke: '#4f7f32',
      'stroke-width': 2.5,
    }) +
    h('path', {
      d: roundRectD(x + s * 0.4, top - s * 0.5, s * 0.22, s * 0.48, 3),
      fill: '#b8643a',
      stroke: '#6a3a1a',
      'stroke-width': 3,
    }) +
    h('path', {
      d:
        M(x + s * 0.51, top - s * 0.56) +
        C(x + s * 0.3, top - s * 0.8, x + s * 0.75, top - s * 0.95, x + s * 0.55, top - s * 1.2),
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': 6,
      'stroke-linecap': 'round',
      opacity: 0.6,
    }) +
    h('path', {
      d: door,
      fill: '#c0392b',
      stroke: '#6a2018',
      'stroke-width': 3.5,
    }) +
    h('path', {
      d: M(x, y - s * 0.86) + L(x, y),
      stroke: '#6a2018',
      'stroke-width': 2,
      opacity: 0.6,
    }) +
    h('circle', { cx: x + s * 0.18, cy: y - s * 0.42, r: s * 0.05, fill: '#ffd23f' }) +
    h('circle', {
      cx: x - s * 0.62,
      cy: y - s * 1.1,
      r: s * 0.17,
      fill: '#ffe9a0',
      stroke: '#6a4422',
      'stroke-width': 3,
    }) +
    h('path', {
      d:
        M(x - s * 0.62, y - s * 1.27) +
        L(x - s * 0.62, y - s * 0.93) +
        M(x - s * 0.79, y - s * 1.1) +
        L(x - s * 0.45, y - s * 1.1),
      stroke: '#6a4422',
      'stroke-width': 2,
    }) +
    // two stepping stones to the door and a lantern
    h('ellipse', {
      cx: x - s * 0.1,
      cy: y + s * 0.18,
      rx: s * 0.28,
      ry: s * 0.08,
      fill: '#cfc6b8',
      stroke: '#8a8070',
      'stroke-width': 2,
    }) +
    h('ellipse', {
      cx: x - s * 0.5,
      cy: y + s * 0.4,
      rx: s * 0.24,
      ry: s * 0.07,
      fill: '#d8d0c2',
      stroke: '#8a8070',
      'stroke-width': 2,
    }) +
    h('path', {
      d: M(x + s * 0.7, y) + L(x + s * 0.7, y - s * 0.7),
      stroke: '#5a3a1a',
      'stroke-width': 3,
    }) +
    h('path', {
      d: roundRectD(x + s * 0.6, y - s * 0.9, s * 0.2, s * 0.24, 4),
      fill: '#ffd86a',
      stroke: '#5a3a1a',
      'stroke-width': 2.5,
    })
  );
}

/** A rounded bunch of leaves hanging from the canopy (centre x, y; size s). */
function leafCluster(r: Rng, x: number, y: number, s: number, color: string): string {
  const blobs: Array<[number, number, number]> = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.5;
    const d = s * (0.35 + r() * 0.25);
    blobs.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, s * (0.32 + r() * 0.14)]);
  }
  blobs.push([x, y, s * 0.55]);
  const circles = (dy: number): string =>
    blobs
      .map(
        ([bx, by, br]) =>
          M(bx - br, by + dy) + `a${br} ${br} 0 1 0 ${br * 2} 0a${br} ${br} 0 1 0 ${-br * 2} 0`,
      )
      .join('');
  let shine = '';
  for (const [bx, by, br] of blobs.slice(0, 4))
    shine +=
      M(bx - br * 0.5, by - br * 0.35) +
      Q(bx - br * 0.1, by - br * 0.75, bx + br * 0.35, by - br * 0.55);
  return (
    h('path', { d: circles(s * 0.1), fill: darken(color, 0.22) }) +
    h('path', { d: circles(0), fill: color }) +
    h('path', {
      d: shine,
      fill: 'none',
      stroke: lighten(color, 0.3),
      'stroke-width': Math.max(3, s * 0.05),
      'stroke-linecap': 'round',
      opacity: 0.8,
    })
  );
}

/** A fallen log furred with moss, with two little toadstools on it (centre x, ground y, length w). */
function mossyLog(x: number, y: number, w: number): string {
  const hgt = w * 0.17;
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  return (
    h('ellipse', {
      cx: x,
      cy: y + 4,
      rx: w * 0.55,
      ry: hgt * 0.25,
      fill: '#2a2140',
      opacity: 0.1,
    }) +
    h('path', {
      d: M(x0, y - hgt) + L(x1, y - hgt) + L(x1, y) + L(x0, y) + 'Z',
      fill: '#9a6a40',
      stroke: '#5a3a1a',
      'stroke-width': 3.5,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d:
        M(x0 + 30, y - hgt * 0.55) +
        L(x1 - 40, y - hgt * 0.55) +
        M(x0 + 60, y - hgt * 0.25) +
        L(x1 - 70, y - hgt * 0.25),
      stroke: '#7a4e2a',
      'stroke-width': 2.5,
      'stroke-linecap': 'round',
    }) +
    h('ellipse', {
      cx: x1,
      cy: y - hgt / 2,
      rx: hgt * 0.32,
      ry: hgt / 2,
      fill: '#e2bf8a',
      stroke: '#5a3a1a',
      'stroke-width': 3.5,
    }) +
    h('ellipse', {
      cx: x1,
      cy: y - hgt / 2,
      rx: hgt * 0.16,
      ry: hgt * 0.25,
      fill: 'none',
      stroke: '#b58956',
      'stroke-width': 2,
    }) +
    h('path', {
      d:
        M(x0 - 4, y - hgt * 0.7) +
        Q(x0 + w * 0.1, y - hgt * 1.4, x0 + w * 0.3, y - hgt * 1.05) +
        Q(x0 + w * 0.5, y - hgt * 1.4, x0 + w * 0.7, y - hgt * 1.0) +
        Q(x0 + w * 0.85, y - hgt * 1.3, x1 - hgt * 0.3, y - hgt * 0.85) +
        L(x1 - hgt * 0.3, y - hgt * 0.7) +
        Q(x, y - hgt * 0.62, x0 - 4, y - hgt * 0.7) +
        'Z',
      fill: '#8fca5f',
      stroke: '#4f7f32',
      'stroke-width': 2.5,
      'stroke-linejoin': 'round',
    }) +
    toadstool(x0 + w * 0.22, y - hgt * 1.05, 16, '#e0473a') +
    toadstool(x0 + w * 0.32, y - hgt * 1.0, 11, '#c98a5b', false)
  );
}

/** Soft fireflies drifting in the shade. */
function fireflies(r: Rng, n: number, x0: number, x1: number, y0: number, y1: number): string {
  let glow = '';
  let dots = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0);
    const y = y0 + r() * (y1 - y0);
    glow += M(x - 9, y) + `a9 9 0 1 0 18 0a9 9 0 1 0 -18 0`;
    dots += M(x - 2.6, y) + `a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0`;
  }
  return (
    h('path', { d: glow, fill: '#fff6a8', opacity: 0.35 }) + h('path', { d: dots, fill: '#fffbe0' })
  );
}

/**
 * Mushroom Hollow: a mossy dell under old trees, giant toadstools to either side, a fairy ring of
 * ten little toadstools (seven red, three brown) on the moss, acorns everywhere, and the House
 * Goblin's nook with its round red door in a stump.
 */
export function mushroomHollow(defs: Defs): string {
  const r = rng('mushroom-hollow');
  let out = sky(defs, '#bfe3b0', '#fbf7dc', 0.62);
  out += h('rect', {
    x: 0,
    y: 0,
    width: 1600,
    height: 1000,
    fill: radial(defs, 'glade', [
      [0, '#fff6c8', 0.7],
      [1, '#fff6c8', 0],
    ]),
  });
  out += lightRays(defs, 800, -60, 760, 13, '#fff4c0', 5, 90);
  // far wood: pale trunks and rounded crowns in the haze
  out += hills(defs, 'far', r, 600, 50, 6, '#cfe6bd', '#b8dba6');
  for (let i = 0; i < 9; i++) {
    const x = 40 + i * 190 + r() * 40;
    if (x > 520 && x < 1080) continue;
    out += h('path', {
      d: roundRectD(x - 14, 340, 28, 290, 10),
      fill: '#b9cfa6',
    });
    out += h('circle', { cx: x, cy: 330, r: 90 + r() * 20, fill: '#c3dcae' });
  }
  out += hills(defs, 'mid', r, 668, 46, 5, '#a9d488', '#8fc46c');
  // mid toadstools half-hidden on the far bank
  for (const [x, s, c] of [
    [560, 26, '#d9584a'],
    [600, 18, '#c98a5b'],
    [1010, 22, '#d9584a'],
    [1050, 30, '#c98a5b'],
    [1090, 16, '#d9584a'],
  ] as const)
    out += toadstool(x, 662, s, c, c === '#d9584a');
  out += mossyLog(800, 708, 230);
  // old trees framing the edges, with canopy hanging from the top corners
  out += oldTrunk(70, 820, 120, '#8a6440', 60);
  out += oldTrunk(1560, 820, 110, '#7f5b3a', 80);
  for (const [x, y, s, c] of [
    [-20, 40, 200, '#4f8f3a'],
    [150, -10, 170, '#5fa14a'],
    [300, -60, 140, '#6fb04f'],
    [1640, 60, 210, '#4f8f3a'],
    [1460, -10, 170, '#5fa14a'],
    [1310, -60, 140, '#6fb04f'],
  ] as const)
    out += leafCluster(r, x, y, s, c);
  // the mossy floor of the dell
  out += h('path', {
    d: ridgeD(r, 800, 24, 6),
    fill: linear(defs, 'moss', [
      [0, '#8fca5f'],
      [1, '#5f9f42'],
    ]),
  });
  out += h('path', {
    d: M(-20, 880) + Q(400, 850, 800, 870) + Q(1200, 890, 1620, 860) + L(1620, 1020) + L(-20, 1020),
    fill: '#6aa84a',
    opacity: 0.5,
  });
  // giant toadstools: two at the left edge, three at the right, beside the goblin's stump
  out += toadstool(210, 840, 120, '#e0473a');
  out += toadstool(330, 880, 54, '#c98a5b', false);
  out += goblinNook(1400, 826, 92);
  out += toadstool(1310, 870, 46, '#e0473a');
  out += toadstool(1545, 900, 70, '#c98a5b', false);
  out += fern(20, 900, 120, '#5aa54a', 1) + fern(1590, 930, 110, '#4f9a3f', -1);
  // the fairy ring: ten little toadstools round a ring of brighter moss, seven red and three brown
  out += h('ellipse', {
    cx: 800,
    cy: 905,
    rx: 150,
    ry: 38,
    fill: '#a6d873',
    stroke: '#7fb44a',
    'stroke-width': 3,
    opacity: 0.85,
  });
  const ring = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    return { x: 800 + Math.cos(a) * 150, y: 905 + Math.sin(a) * 38 + 8, red: i < 7 };
  }).sort((a, b) => a.y - b.y);
  for (const t of ring)
    out += toadstool(t.x, t.y, t.red ? 22 : 18, t.red ? '#e0473a' : '#b8784a', t.red);
  // acorns scattered on the moss, and a little heap of them
  for (const [x, y, s, a] of [
    [520, 900, 26, -20],
    [600, 940, 22, 30],
    [980, 950, 24, -10],
    [1080, 900, 20, 40],
    [130, 960, 28, 15],
    [1240, 960, 26, -30],
  ] as const)
    out += acornProp(x, y, s, a);
  for (const [x, y] of [
    [1490, 960],
    [1520, 962],
    [1505, 940],
  ] as const)
    out += acornProp(x, y, 24, 0);
  out += bush(460, 990, 48, '#5aa54a', '#ffffff') + bush(1150, 1000, 44, '#4f9a3f', '#ff9fbf');
  out +=
    tuft(700, 880, 16, '#4f9a3f') + tuft(920, 880, 14, '#4f9a3f') + tuft(260, 960, 18, '#4f9a3f');
  out += meadowDetails(r, 0, 1600, 870, 995, 40, FLOWERS, '#4f9a3f');
  out += fireflies(r, 14, 40, 1560, 560, 860);
  return out + vignette(defs, '#1f3a1a', 0.22);
}

/** A rainbow arc (centre x, foot y, outer radius rr, band width bw). */
function rainbowArc(x: number, y: number, rr: number, bw: number, opacity: number): string {
  let out = '';
  RAINBOW.forEach((c, i) => {
    const rad = rr - i * bw - bw / 2;
    out += h('path', {
      d: M(x - rad, y) + `A${rad} ${rad} 0 0 1 ${x + rad} ${y}`,
      fill: 'none',
      stroke: c,
      'stroke-width': bw + 0.5,
      opacity,
    });
  });
  return out;
}

/** Kašpárek's little puppet theatre booth (foot centre x, y; width w). */
export function puppetBooth(x: number, y: number, w: number): string {
  const hgt = w * 1.5;
  const top = y - hgt;
  const stripes: string[] = [];
  const n = 6;
  for (let i = 0; i < n; i++)
    stripes.push(
      h('path', {
        d: roundRectD(x - w / 2 + (w / n) * i, top + w * 0.62, w / n, hgt - w * 0.62, 0),
        fill: i % 2 ? '#ffd23f' : '#e8423f',
      }),
    );
  const scallop = Array.from({ length: n }, (_, i) => {
    const sx = x - w / 2 + (w / n) * i;
    return Q(sx + w / n / 2, top + w * 0.2, sx + w / n, top + w * 0.08);
  }).join('');
  return (
    h('path', {
      d: roundRectD(x - w / 2, top + w * 0.08, w, hgt - w * 0.08, 6),
      fill: '#8a5ad9',
      stroke: '#4a2a80',
      'stroke-width': 4,
    }) +
    stripes.join('') +
    // the stage window with a drawn curtain
    h('path', {
      d: roundRectD(x - w * 0.36, top + w * 0.22, w * 0.72, w * 0.42, 8),
      fill: '#2e2350',
      stroke: '#4a2a80',
      'stroke-width': 4,
    }) +
    h('path', {
      d:
        M(x - w * 0.36, top + w * 0.22) +
        Q(x - w * 0.2, top + w * 0.4, x - w * 0.3, top + w * 0.64) +
        L(x - w * 0.36, top + w * 0.64) +
        'Z' +
        M(x + w * 0.36, top + w * 0.22) +
        Q(x + w * 0.2, top + w * 0.4, x + w * 0.3, top + w * 0.64) +
        L(x + w * 0.36, top + w * 0.64) +
        'Z',
      fill: '#d93a57',
      stroke: '#7a1a2e',
      'stroke-width': 2.5,
    }) +
    h('path', {
      d:
        M(x - w / 2, top + w * 0.08) +
        scallop +
        L(x + w / 2, top - w * 0.06) +
        L(x - w / 2, top - w * 0.06) +
        'Z',
      fill: '#ffd23f',
      stroke: '#b8860b',
      'stroke-width': 3,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d: M(x - w / 2 - 6, y) + L(x + w / 2 + 6, y),
      stroke: '#4a2a80',
      'stroke-width': 5,
      'stroke-linecap': 'round',
    }) +
    // a star and two little bells on top
    h('path', {
      d: sparkleD(x, top - w * 0.2, w * 0.12),
      fill: '#ffd23f',
      stroke: '#b8860b',
      'stroke-width': 2,
    }) +
    h('circle', {
      cx: x - w * 0.42,
      cy: top - w * 0.1,
      r: w * 0.05,
      fill: '#ffd23f',
      stroke: '#b8860b',
      'stroke-width': 2,
    }) +
    h('circle', {
      cx: x + w * 0.42,
      cy: top - w * 0.1,
      r: w * 0.05,
      fill: '#ffd23f',
      stroke: '#b8860b',
      'stroke-width': 2,
    })
  );
}

/** A duck swimming (centre x, y; size s; facing dir). */
export function duck(x: number, y: number, s: number, dir = 1): string {
  return h(
    'g',
    { transform: `translate(${x} ${y}) scale(${dir} 1)` },
    h('path', {
      d: M(-s, 0) + Q(-s, -s * 0.6, 0, -s * 0.5) + Q(s * 0.6, -s * 0.5, s * 0.8, 0) + 'Z',
      fill: '#ffffff',
      stroke: '#8a8070',
      'stroke-width': 2,
    }) +
      h('circle', {
        cx: s * 0.5,
        cy: -s * 0.78,
        r: s * 0.3,
        fill: '#3f9f5a',
        stroke: '#2a6a3a',
        'stroke-width': 2,
      }) +
      h('path', {
        d: M(s * 0.76, -s * 0.8) + L(s * 1.08, -s * 0.72) + L(s * 0.76, -s * 0.64) + 'Z',
        fill: '#ffb31f',
      }) +
      h('circle', { cx: s * 0.56, cy: -s * 0.86, r: s * 0.05, fill: '#2a2140' }) +
      h('path', {
        d: M(-s * 1.1, s * 0.08) + Q(0, -s * 0.06, s * 1.0, s * 0.08),
        fill: 'none',
        stroke: '#ffffff',
        'stroke-width': 2.5,
        opacity: 0.7,
      }),
  );
}

/**
 * Rainbow Ford: a wide river crossed by twenty stepping stones, ten up to a sandbar with a flag
 * (the ten) and ten beyond, under a rainbow; Kašpárek's puppet booth stands on the near bank.
 */
export function rainbowFord(defs: Defs): string {
  const r = rng('rainbow-ford');
  let out = sky(defs, '#8fd0ff', '#f6fcff', 0.6);
  out += sun(defs, 1360, 130, 50);
  out += rainbowArc(800, 640, 600, 22, 0.42);
  out += cloud(250, 170, 48) + cloud(1050, 110, 36) + cloud(560, 250, 24);
  out += hills(defs, 'far', r, 590, 60, 6, '#c4e6cf', '#acd8b8');
  out += hills(defs, 'mid', r, 640, 50, 5, '#a3d580', '#8cc56a');
  for (const [x, s, c] of [
    [100, 150, '#6fbf4f'],
    [230, 116, '#5aa54a'],
    [1380, 120, '#6fbf4f'],
    [1500, 150, '#5aa54a'],
  ] as const)
    out += roundTree(x, 640, s, c, false, x > 1000 ? '#ff7a59' : undefined);
  // the river, wide and shallow, running across the scene
  const top = M(-20, 650) + C(300, 636, 600, 668, 820, 664) + C(1100, 660, 1300, 680, 1620, 672);
  const river =
    top + L(1620, 806) + C(1300, 812, 1100, 784, 820, 790) + C(520, 796, 300, 770, -20, 780) + 'Z';
  out += water(defs, 'ford', river, '#c4ecff', '#4fa8e0', r, [0, 650, 1600, 806], 30);
  // the rainbow's soft reflection on the water
  for (let i = 0; i < RAINBOW.length; i++)
    out += h('path', {
      d: M(260 + i * 10, 700 + i * 8) + Q(800, 740 + i * 6, 1340 - i * 10, 700 + i * 8),
      fill: 'none',
      stroke: RAINBOW[i]!,
      'stroke-width': 6,
      'stroke-linecap': 'round',
      opacity: 0.18,
    });
  out += h('path', {
    d: M(-20, 780) + C(300, 770, 520, 796, 820, 790) + C(1100, 784, 1300, 812, 1620, 806),
    fill: 'none',
    stroke: '#ffffff',
    'stroke-width': 5,
    'stroke-linecap': 'round',
    opacity: 0.55,
  });
  // the sandbar in the middle with the ten flag
  out += h('path', {
    d: M(740, 726) + Q(800, 700, 862, 726) + Q(800, 742, 740, 726) + 'Z',
    fill: '#f0dca8',
    stroke: '#c8a868',
    'stroke-width': 3,
  });
  out += pennant(802, 722, 70, '#e8423f');
  // twenty stepping stones: ten (eight warm, two golden) to the sandbar, then ten beyond
  const stoneColors = ['#e3d4bb', '#d9d2c6', '#cfdcc8', '#d6cde2'];
  for (let i = 0; i < 20; i++) {
    const left = i < 10;
    const t = left ? i / 9 : (i - 10) / 9;
    const x = left ? 120 + t * 580 : 900 + t * 580;
    const y = 740 + Math.sin(t * Math.PI) * -14 + (left ? 18 - t * 18 : t * 18);
    const golden = left && i >= 8;
    out += steppingStone(x, y, 40 + (i % 3) * 4, golden ? '#ffe08a' : stoneColors[i % 4]!);
  }
  out += duck(470, 690, 20, 1) + duck(520, 700, 14, 1) + duck(1180, 694, 18, -1);
  out += lilyPad(340, 676, 26) + lilyPad(1270, 684, 24, '#ff9fbf') + lilyPad(1420, 692, 20);
  // near bank
  out += h('path', {
    d: ridgeD(r, 820, 24, 7),
    fill: linear(defs, 'bank', [
      [0, '#8ad064'],
      [1, '#5fae4c'],
    ]),
  });
  for (let i = 0; i < 9; i++) {
    const x = 60 + i * 180 + r() * 40;
    out += pebble(x, 834 + r() * 10, 18 + r() * 10, stoneColors[i % 4]!);
  }
  // Kašpárek's puppet booth on the right, reeds on the left
  out += puppetBooth(1460, 880, 150);
  out += reeds(40, 820, 120) + reeds(140, 830, 90) + reeds(1590, 830, 90);
  // bunting from the booth to a post
  out += h('path', {
    d: M(1236, 726) + L(1236, 880),
    stroke: '#8a5a2e',
    'stroke-width': 7,
    'stroke-linecap': 'round',
  });
  let bunting = h('path', {
    d: M(1236, 730) + Q(1310, 770, 1386, 666),
    fill: 'none',
    stroke: '#6b4a2e',
    'stroke-width': 2,
  });
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6;
    const bx = (1 - t) * (1 - t) * 1236 + 2 * (1 - t) * t * 1310 + t * t * 1386;
    const by = (1 - t) * (1 - t) * 730 + 2 * (1 - t) * t * 770 + t * t * 666;
    const c = RAINBOW[i % RAINBOW.length]!;
    bunting += h('path', {
      d: M(bx - 8, by - 2) + L(bx + 8, by - 2) + L(bx, by + 16) + 'Z',
      fill: c,
      stroke: outlineOf(c, 0.5),
      'stroke-width': 1.5,
    });
  }
  out += bunting;
  out += bush(300, 980, 50, '#6fbf4f', '#ffffff') + bush(1080, 990, 46, '#5aa54a', '#ffd23f');
  out +=
    tuft(620, 880, 16, '#4f9a3f') + tuft(980, 900, 16, '#4f9a3f') + tuft(220, 900, 18, '#4f9a3f');
  out += meadowDetails(r, 0, 1600, 860, 995, 54, FLOWERS, '#4f9a3f');
  return out + vignette(defs, '#1f2a4a', 0.14);
}
