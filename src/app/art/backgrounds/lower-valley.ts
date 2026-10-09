/**
 * The Lower Valley map sheet (1600 x 1000 logical units), the grades 1-2 part of the valley,
 * travelled before the valley map. Its road snakes through five regions: along the bottom from
 * Pebble Brook (bottom left) through Mushroom Hollow to Rainbow Ford (bottom right), then back
 * along the top through the Hundred Hills to Market Square. It leaves the sheet at the top left,
 * where the valley map's road arrives at its bottom left. Hotspots and level nodes come from the
 * same road geometry that is drawn (see `buildMapSheet`).
 */
import { type Pt } from '../svg/num';
import { M, C, L, Q, roundRectD, smoothClosedD } from '../svg/path';
import { h } from '../svg/xml';
import { rng } from '../svg/prng';
import { flower, sparkleD } from '../glyphs';
import { LOWER_VALLEY_REGION_IDS } from '../regions';
import {
  SH,
  SW,
  cloud,
  cottage,
  linear,
  pine,
  radial,
  reeds,
  rock,
  roundTree,
  type Defs,
} from './kit';
import { buildMapSheet, mapRoad, sheetNodePositions, type MapHotspots } from './map';
import { pebble, steppingStone } from './scenes-c';

/** Planned level count per Lower Valley region (docs/grades-plan.md); plus one boss node each. */
export const LOWER_VALLEY_LEVELS: Record<string, number> = {
  'pebble-brook': 6,
  'mushroom-hollow': 6,
  'rainbow-ford': 6,
  'hundred-hills': 5,
  'market-square': 5,
};

const ROUTE: Record<string, Pt[]> = {
  'pebble-brook': [
    { x: 92, y: 930 },
    { x: 196, y: 890 },
    { x: 296, y: 912 },
    { x: 384, y: 862 },
    { x: 424, y: 784 },
    { x: 486, y: 726 },
  ],
  'mushroom-hollow': [
    { x: 604, y: 704 },
    { x: 686, y: 764 },
    { x: 766, y: 832 },
    { x: 864, y: 862 },
    { x: 944, y: 804 },
    { x: 982, y: 722 },
  ],
  'rainbow-ford': [
    { x: 1092, y: 690 },
    { x: 1180, y: 760 },
    { x: 1290, y: 832 },
    { x: 1400, y: 802 },
    { x: 1462, y: 712 },
    { x: 1424, y: 622 },
  ],
  'hundred-hills': [
    { x: 1384, y: 500 },
    { x: 1302, y: 432 },
    { x: 1358, y: 350 },
    { x: 1450, y: 272 },
    { x: 1404, y: 172 },
    { x: 1302, y: 132 },
  ],
  'market-square': [
    { x: 1180, y: 152 },
    { x: 1062, y: 222 },
    { x: 940, y: 262 },
    { x: 820, y: 222 },
    { x: 700, y: 182 },
    { x: 584, y: 150 },
  ],
};

const AREAS: Record<string, [number, number, number, number]> = {
  'pebble-brook': [40, 640, 500, 350],
  'mushroom-hollow': [560, 640, 460, 350],
  'rainbow-ford': [1040, 560, 530, 420],
  'hundred-hills': [1240, 60, 340, 480],
  'market-square': [520, 60, 700, 330],
};

/** Where the road leaves the Lower Valley for the valley map (top-left edge). */
const LOWER_VALLEY_EXIT: Pt = { x: 268, y: 14 };

export const LOWER_VALLEY_HOTSPOTS: MapHotspots = /* @__PURE__ */ buildMapSheet({
  background: 'lower-valley-map',
  regionIds: LOWER_VALLEY_REGION_IDS,
  levels: LOWER_VALLEY_LEVELS,
  route: ROUTE,
  areas: AREAS,
  lead: {
    before: [{ x: 30, y: 1004 }],
    after: [{ x: 452, y: 112 }, { x: 330, y: 64 }, LOWER_VALLEY_EXIT],
  },
  links: { next: 'valley-map', exit: LOWER_VALLEY_EXIT },
});

/** Evenly spaced positions for `count` nodes along a Lower Valley region's trail. */
export function lowerValleyNodePositions(regionId: string, count: number): Pt[] {
  return sheetNodePositions(LOWER_VALLEY_HOTSPOTS, regionId, count);
}

// ------------------------------------------------------------------------------------- drawing

function toadstool(x: number, y: number, s: number, cap: string): string {
  let out = h('path', {
    d:
      M(x - s * 0.2, y) +
      Q(x - s * 0.24, y - s * 0.5, x - s * 0.14, y - s * 0.62) +
      L(x + s * 0.14, y - s * 0.62) +
      Q(x + s * 0.24, y - s * 0.5, x + s * 0.2, y) +
      'Z',
    fill: '#fff3dc',
    stroke: '#8a6a4a',
    'stroke-width': 2.5,
  });
  out += h('path', {
    d:
      M(x - s * 0.62, y - s * 0.56) +
      C(x - s * 0.6, y - s * 1.18, x + s * 0.6, y - s * 1.18, x + s * 0.62, y - s * 0.56) +
      Q(x, y - s * 0.44, x - s * 0.62, y - s * 0.56) +
      'Z',
    fill: cap,
    stroke: '#7a2a2a',
    'stroke-width': 3,
  });
  for (const [dx, dy, rr] of [
    [-0.3, -0.72, 0.09],
    [0.06, -0.9, 0.11],
    [0.34, -0.7, 0.08],
  ] as const)
    out += h('circle', { cx: x + dx * s, cy: y + dy * s, r: rr * s, fill: '#fffaf0' });
  return out;
}

function stall(x: number, y: number, s: number, awning: string): string {
  let stripes = '';
  for (let i = 0; i < 4; i++)
    stripes += h('path', {
      d: roundRectD(x - s / 2 + (i * s) / 4, y - s * 0.95, s / 4, s * 0.26, 0),
      fill: i % 2 ? '#fffaf0' : awning,
    });
  return (
    h('path', {
      d: roundRectD(x - s * 0.42, y - s * 0.7, s * 0.84, s * 0.7, 3),
      fill: '#e8c48e',
      stroke: '#7a5530',
      'stroke-width': 2.5,
    }) +
    stripes +
    h('path', {
      d: roundRectD(x - s / 2, y - s * 0.95, s, s * 0.26, 4),
      fill: 'none',
      stroke: '#7a5530',
      'stroke-width': 2.5,
    }) +
    h('circle', { cx: x - s * 0.18, cy: y - s * 0.52, r: s * 0.1, fill: '#e8423f' }) +
    h('circle', { cx: x + s * 0.04, cy: y - s * 0.52, r: s * 0.1, fill: '#ffb31f' }) +
    h('circle', { cx: x + s * 0.24, cy: y - s * 0.52, r: s * 0.1, fill: '#7fc65a' })
  );
}

function littleHill(x: number, y: number, w: number, color: string, flag?: string): string {
  let out = h('path', {
    d:
      M(x - w / 2, y) +
      C(x - w * 0.36, y - w * 0.62, x + w * 0.36, y - w * 0.62, x + w / 2, y) +
      'Z',
    fill: color,
    stroke: '#5f9a46',
    'stroke-width': 3,
  });
  if (flag) {
    const top = y - w * 0.46;
    out +=
      h('path', {
        d: M(x, top) + L(x, top - w * 0.34),
        stroke: '#6b4a2e',
        'stroke-width': 3,
        'stroke-linecap': 'round',
      }) +
      h('path', {
        d: M(x, top - w * 0.34) + L(x + w * 0.2, top - w * 0.28) + L(x, top - w * 0.2) + 'Z',
        fill: flag,
        stroke: '#6b4a2e',
        'stroke-width': 1.5,
      });
  }
  return out;
}

function willow(x: number, y: number, s: number): string {
  let out = h('path', {
    d:
      M(x - s * 0.06, y) +
      Q(x - s * 0.02, y - s * 0.5, x - s * 0.1, y - s * 0.8) +
      L(x + s * 0.08, y - s * 0.8) +
      Q(x + s * 0.04, y - s * 0.5, x + s * 0.08, y) +
      'Z',
    fill: '#8a5a32',
    stroke: '#5a3a1e',
    'stroke-width': 2,
  });
  out += h('ellipse', {
    cx: x,
    cy: y - s * 0.86,
    rx: s * 0.5,
    ry: s * 0.36,
    fill: '#7cc25a',
    stroke: '#3f7a32',
    'stroke-width': 3,
  });
  let fronds = '';
  for (let i = -3; i <= 3; i++) {
    const fx = x + i * s * 0.13;
    fronds += M(fx, y - s * 0.8) + Q(fx + s * 0.05, y - s * 0.5, fx - s * 0.02, y - s * 0.3);
  }
  return (
    out +
    h('path', {
      d: fronds,
      fill: 'none',
      stroke: '#5aa848',
      'stroke-width': 6,
      'stroke-linecap': 'round',
    })
  );
}

export function lowerValleyMap(defs: Defs): string {
  const r = rng('lower-valley-map');
  let out = h('rect', {
    x: 0,
    y: 0,
    width: SW,
    height: SH,
    fill: linear(defs, 'land', [
      [0, '#c6eba8'],
      [0.5, '#b2e092'],
      [1, '#9fd57f'],
    ]),
  });
  for (let i = 0; i < 40; i++) {
    out += h('ellipse', {
      cx: r() * SW,
      cy: r() * SH,
      rx: 60 + r() * 120,
      ry: 30 + r() * 60,
      fill: r() < 0.5 ? '#bfe6a0' : '#a8da88',
      opacity: 0.6,
    });
  }

  // top left: the road climbs towards the upper valley (pines and a far castle hill)
  out += h('ellipse', {
    cx: 200,
    cy: 40,
    rx: 260,
    ry: 110,
    fill: '#93cf74',
    stroke: '#6fae4f',
    'stroke-width': 4,
  });
  for (let i = 0; i < 16; i++) {
    const x = 50 + r() * 380;
    const y = 220 + r() * 300;
    out += pine(x, y, 50 + r() * 26, i % 3 ? '#2f8a4c' : '#3fa458', i % 4 === 0);
  }

  // 5. Market Square (top middle, roughed in): cottages around a cobbled square with stalls
  out += h('path', {
    d: smoothClosedD(
      [
        { x: 700, y: 250 },
        { x: 820, y: 290 },
        { x: 960, y: 300 },
        { x: 1080, y: 270 },
        { x: 1060, y: 330 },
        { x: 880, y: 360 },
        { x: 720, y: 320 },
      ],
      1,
    ),
    fill: '#e9dcc0',
    stroke: '#b8a27a',
    'stroke-width': 3,
  });
  out +=
    cottage(640, 120, 46) +
    cottage(760, 112, 40, '#3f8fd9') +
    cottage(1000, 130, 44, '#e0663f') +
    cottage(1120, 110, 38, '#8a5ad9');
  out +=
    stall(800, 330, 50, '#e8423f') +
    stall(900, 344, 50, '#3f8fd9') +
    stall(1000, 334, 50, '#ffb31f');

  // 4. Hundred Hills (right, roughed in): rows of little round hills, some with flags
  const hillColors = ['#a8dc8c', '#9fd684', '#b7e39a'];
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 4; col++) {
      const x = 1270 + col * 80 + (row % 2) * 40;
      const y = 140 + row * 90;
      if (x > 1580) continue;
      out += littleHill(
        x,
        y,
        66,
        hillColors[(row + col) % 3]!,
        (row + col) % 3 === 0 ? ['#e8423f', '#ffb31f', '#3f8fd9'][col % 3] : undefined,
      );
    }

  // 3. Rainbow Ford (bottom right, roughed in): a river with a rainbow over the ford
  const river =
    M(1230, 1010) + C(1240, 900, 1340, 860, 1330, 760) + C(1320, 680, 1500, 640, 1610, 600);
  out +=
    h('path', {
      d: river,
      fill: 'none',
      stroke: '#6ec3f0',
      'stroke-width': 46,
      'stroke-linecap': 'round',
    }) + h('path', { d: river, fill: 'none', stroke: '#a8e0ff', 'stroke-width': 14, opacity: 0.8 });
  const bands = ['#ff6b6b', '#ffb31f', '#ffe14d', '#7fd36a', '#5fb3ec', '#9a7ce8'];
  bands.forEach((c, i) => {
    const rr = 150 - i * 12;
    out += h('path', {
      d:
        M(1310 - rr, 900) + C(1310 - rr, 900 - rr * 1.3, 1310 + rr, 900 - rr * 1.3, 1310 + rr, 900),
      fill: 'none',
      stroke: c,
      'stroke-width': 12,
      opacity: 0.75,
    });
  });
  out += cloud(1160, 900, 26) + cloud(1468, 900, 26);

  // 2. Mushroom Hollow (bottom middle, roughed in): a mossy dell full of toadstools
  out += h('ellipse', {
    cx: 800,
    cy: 800,
    rx: 210,
    ry: 130,
    fill: radial(defs, 'hollow', [
      [0, '#7fbf62'],
      [1, '#9fd57f'],
    ]),
  });
  for (const [x, y, s, cap] of [
    [650, 860, 60, '#e8423f'],
    [720, 940, 44, '#d9533a'],
    [880, 960, 54, '#e8423f'],
    [960, 900, 40, '#c9784e'],
    [820, 740, 36, '#d9533a'],
    [600, 780, 34, '#c9784e'],
  ] as const)
    out += toadstool(x, y, s, cap);

  // scattered orchard trees and rocks in the margins
  for (const [x, y] of [
    [560, 520],
    [700, 560],
    [1120, 460],
    [1000, 560],
    [500, 420],
  ] as const)
    out += roundTree(x, y, 60, '#6fbf4f', true, '#e8423f');
  out += rock(1200, 540, 24) + rock(620, 440, 20);
  out += cloud(640, 40, 30) + cloud(1500, 30, 36) + cloud(1060, 470, 24);

  // the road (drawn before Pebble Brook so the brook and its stepping stones cross it)
  out += mapRoad(LOWER_VALLEY_HOTSPOTS.path);

  // 1. Pebble Brook (bottom left, fully drawn): a clear brook crossed on stepping stones,
  // willows and reeds on its banks, pebbles everywhere
  const brook = M(20, 650) + C(150, 700, 120, 800, 210, 860) + C(290, 910, 250, 960, 300, 1010);
  out +=
    h('path', {
      d: brook,
      fill: 'none',
      stroke: '#4f9ad0',
      'stroke-width': 58,
      'stroke-linecap': 'round',
    }) +
    h('path', {
      d: brook,
      fill: 'none',
      stroke: '#7ccaf2',
      'stroke-width': 48,
      'stroke-linecap': 'round',
    }) +
    h('path', {
      d: brook,
      fill: 'none',
      stroke: '#c8ecff',
      'stroke-width': 4,
      'stroke-dasharray': '14 26',
      'stroke-linecap': 'round',
      opacity: 0.9,
    });
  const stoneColors = ['#d9d2c6', '#c9d6de', '#e3d4bb', '#d6cde2'];
  for (const [i, [x, y]] of (
    [
      [238, 893],
      [266, 899],
      [294, 905],
    ] as const
  ).entries())
    out += steppingStone(x, y, 30, stoneColors[i % stoneColors.length]!);
  out += willow(70, 800, 120) + willow(330, 720, 104) + willow(470, 980, 90);
  out += reeds(120, 720, 46) + reeds(270, 980, 40) + reeds(36, 900, 40);
  for (let i = 0; i < 22; i++) {
    const x = 60 + r() * 460;
    const y = 680 + r() * 300;
    out += pebble(x, y, 10 + r() * 10, stoneColors[i % stoneColors.length]!);
  }
  for (let i = 0; i < 18; i++)
    out += flower(
      80 + r() * 440,
      700 + r() * 280,
      5 + r() * 3,
      5,
      ['#ffffff', '#ffd23f', '#ff9fbf', '#b98cff'][i % 4]!,
      '#ffd23f',
      '#6b6b6b',
      1,
    );

  for (let i = 0; i < 18; i++)
    out += h('path', {
      d: sparkleD(r() * SW, r() * SH, 3 + r() * 3),
      fill: '#ffffff',
      opacity: 0.7,
    });
  return (
    out +
    h('rect', {
      x: 0,
      y: 0,
      width: SW,
      height: SH,
      fill: radial(defs, 'mapvignette', [
        [0.6, '#2a1b45', 0],
        [1, '#2a1b45', 0.25],
      ]),
    })
  );
}
