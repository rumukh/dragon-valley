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
import { SH, SW, cloud, linear, pine, radial, reeds, rock, roundTree, type Defs } from './kit';
import { buildMapSheet, mapRoad, sheetNodePositions, type MapHotspots } from './map';
import { pebble, steppingStone } from './scenes-c';
import { basket, domeHill, kite, marketStall, pennant, stickSheaf, townHouse } from './scenes-d';
import { acornProp, duck, goblinNook, puppetBooth } from './scenes-e';

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

  // 5. Market Square (top middle, fully drawn): a row of gabled town houses with a clock tower
  // above the road, and below it a cobbled square with striped stalls, a well and apple baskets
  const walls = ['#ffcf6b', '#ff9f80', '#9fd0ff', '#c8a8ff', '#a8e08c', '#ffd8e4', '#ffe9a8'];
  const roofs = ['#d9533a', '#b84a32', '#3f8fd9', '#8a5ad9', '#3aa65b', '#e0533a', '#c9784e'];
  for (const [i, [x, w, hgt]] of (
    [
      [600, 54, 74],
      [662, 48, 62],
      [760, 52, 70],
      [1000, 52, 70],
      [1066, 48, 62],
      [1128, 54, 78],
    ] as const
  ).entries())
    out += townHouse(x, 128, w, hgt, walls[i % walls.length]!, roofs[i % roofs.length]!);
  out +=
    h('path', {
      d: roundRectD(860, 54, 40, 76, 4),
      fill: '#fff6e6',
      stroke: '#b8a27a',
      'stroke-width': 2.5,
    }) +
    h('path', {
      d: M(852, 58) + L(880, 18) + L(908, 58) + 'Z',
      fill: '#3aa65b',
      stroke: '#2f6b2a',
      'stroke-width': 2.5,
      'stroke-linejoin': 'round',
    }) +
    h('circle', { cx: 880, cy: 80, r: 10, fill: '#fffaf0', stroke: '#b8a27a', 'stroke-width': 2 }) +
    h('path', {
      d: M(880, 80) + L(880, 73) + M(880, 80) + L(886, 82),
      stroke: '#6b4a2e',
      'stroke-width': 2,
      'stroke-linecap': 'round',
    });
  for (const [x0, x1] of [
    [600, 760],
    [1000, 1128],
  ] as const) {
    out += h('path', {
      d: M(x0, 76) + Q((x0 + x1) / 2, 104, x1, 76),
      fill: 'none',
      stroke: '#8a6a4a',
      'stroke-width': 1.5,
    });
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const fx = x0 + (x1 - x0) * t;
      const fy = 76 + 28 * 2 * t * (1 - t);
      out += h('path', {
        d: M(fx - 5, fy) + L(fx + 5, fy) + L(fx, fy + 10) + 'Z',
        fill: ['#e8423f', '#ffb31f', '#3f8fd9', '#8a5ad9', '#3aa65b'][i % 5]!,
      });
    }
  }
  const square = smoothClosedD(
    [
      { x: 680, y: 262 },
      { x: 820, y: 296 },
      { x: 960, y: 306 },
      { x: 1100, y: 268 },
      { x: 1130, y: 330 },
      { x: 900, y: 378 },
      { x: 690, y: 340 },
    ],
    1,
  );
  out += h('path', { d: square, fill: '#e9dcc0', stroke: '#b8a27a', 'stroke-width': 3 });
  for (let i = 0; i < 46; i++) {
    const x = 712 + r() * 390;
    const y = 300 + r() * 60;
    if (Math.abs(x - 900) < 34 && y < 350) continue;
    out += h('ellipse', {
      cx: x,
      cy: y,
      rx: 7,
      ry: 3.5,
      fill: '#d8c6a2',
      stroke: '#b8a27a',
      'stroke-width': 1,
    });
  }
  out +=
    marketStall(770, 336, 62, '#e8423f', 'fruit') +
    marketStall(1030, 330, 62, '#3f8fd9', 'bread') +
    marketStall(1110, 368, 46, '#ffb31f', 'veg');
  out +=
    h('path', {
      d: roundRectD(880, 330, 40, 20, 5),
      fill: '#cfc6d8',
      stroke: '#6f6a7f',
      'stroke-width': 2,
    }) +
    h('path', {
      d: M(884, 330) + L(884, 310) + M(916, 330) + L(916, 310),
      stroke: '#8a5a2e',
      'stroke-width': 3,
    }) +
    h('path', {
      d: M(876, 312) + L(900, 298) + L(924, 312) + 'Z',
      fill: '#d9533a',
      stroke: '#8a2a1a',
      'stroke-width': 2,
    });
  out +=
    basket(700, 364, 26, '#e8423f') +
    basket(960, 374, 22, '#7fc65a') +
    basket(986, 378, 20, '#ffb31f');

  // 4. Hundred Hills (right, fully drawn): rows of round counting hills climbing to the top,
  // the far ten with pennants, bundles of ten sticks and a kite above
  const hillColors = ['#9fd684', '#8fcd74', '#b0e092'];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 5; col++) {
      const x = 1262 + col * 76 + (row % 2) * 36;
      const y = 120 + row * 80;
      if (x > 1600) continue;
      const w = 74 + ((row * 3 + col) % 3) * 8;
      out += domeHill(x, y, w, w * 0.42, hillColors[(row + col) % 3]!);
      if (row === 0 || (row === 3 && col % 2 === 0))
        out += pennant(
          x,
          y - w * 0.4,
          26,
          ['#e8423f', '#ffb31f', '#3f8fd9', '#8a5ad9', '#3aa65b'][col]!,
        );
    }
  out +=
    stickSheaf(1250, 400, 38) +
    stickSheaf(1556, 330, 40, '#3f8fd9') +
    stickSheaf(1520, 540, 36, '#ffb31f');
  out += h(
    'g',
    { transform: 'translate(1546 48) scale(0.5) translate(-1546 -48)' },
    kite(1546, 48, 40),
  );
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
  // the ford itself: two rows of five stepping stones (a ten) across the river
  const g1 = rng('lower-valley-map-g1');
  for (let i = 0; i < 5; i++) {
    out += steppingStone(1206 + i * 17, 930 + (g1() - 0.5) * 4, 15, '#d6e2f2');
    out += steppingStone(1212 + i * 17, 956 + (g1() - 0.5) * 4, 15, '#f6dc8c');
  }
  out += duck(1532, 634, 11, -1) + duck(1556, 626, 8, -1);
  out += puppetBooth(1090, 868, 58);

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
  // the House Goblin's stump with its round red door, and acorns everywhere
  out += goblinNook(900, 712, 30);
  for (const [x, y, a] of [
    [632, 920, -20],
    [792, 930, 15],
    [1000, 958, -10],
    [850, 780, 25],
    [580, 860, 0],
  ] as const)
    out += acornProp(x, y, 14, a);

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
  out += cloud(430, 570, 24) + cloud(1220, 610, 24) + cloud(1060, 470, 24);

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
