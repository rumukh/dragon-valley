/**
 * The valley map (1600 x 1000 logical units): nine regions along a winding road from Sunny
 * Meadow (bottom left) to Dragon Castle on its hill (top centre). Hotspots and level-node
 * waypoints are computed from the same road geometry that is drawn, so they always line up.
 * Hotspots follow @aegis/browser/ui `Hotspot` ({ id, x, y, width, height, labelKey }).
 */
import { CANONICAL_REGION_IDS } from '../../../rules/contract/ids';
import { bez, dist, type Pt } from '../svg/num';
import { M, L, Q, C, polyD, roundRectD, smoothClosedD, smoothOpenD } from '../svg/path';
import { h } from '../svg/xml';
import { rng } from '../svg/prng';
import { flower, sparkleD } from '../glyphs';
import {
  SH,
  SW,
  castle,
  cloud,
  cottage,
  crystalCluster,
  linear,
  mountain,
  pine,
  radial,
  rock,
  roundTree,
  stoneBridge,
  type Defs,
} from './kit';

/** Planned level count per region (docs/plan.md section 2.3); each region also has a boss node. */
export const MAP_LEVELS: Record<string, number> = {
  'sunny-meadow': 6,
  'whispering-woods': 6,
  'fire-mountain': 6,
  'crystal-caves': 6,
  'sharing-lake': 6,
  'leftover-lagoon': 5,
  'giants-peaks': 6,
  'riddle-ruins': 6,
  'dragon-castle': 3,
};

/** Road waypoints per region, in travel order (the road is a smooth curve through all of them). */
const ROUTE: Record<string, Pt[]> = {
  'sunny-meadow': [
    { x: 96, y: 942 },
    { x: 200, y: 924 },
    { x: 300, y: 930 },
    { x: 392, y: 886 },
    { x: 404, y: 806 },
    { x: 336, y: 752 },
  ],
  'whispering-woods': [
    { x: 246, y: 700 },
    { x: 156, y: 652 },
    { x: 120, y: 570 },
    { x: 168, y: 494 },
    { x: 258, y: 466 },
    { x: 296, y: 400 },
  ],
  'fire-mountain': [
    { x: 236, y: 336 },
    { x: 150, y: 290 },
    { x: 150, y: 208 },
    { x: 226, y: 150 },
    { x: 318, y: 120 },
    { x: 404, y: 146 },
  ],
  'crystal-caves': [
    { x: 500, y: 196 },
    { x: 586, y: 238 },
    { x: 612, y: 318 },
    { x: 660, y: 392 },
    { x: 748, y: 410 },
    { x: 820, y: 452 },
  ],
  'sharing-lake': [
    { x: 846, y: 530 },
    { x: 812, y: 604 },
    { x: 712, y: 610 },
    { x: 616, y: 646 },
    { x: 610, y: 730 },
    { x: 690, y: 790 },
  ],
  'leftover-lagoon': [
    { x: 806, y: 842 },
    { x: 914, y: 900 },
    { x: 1030, y: 924 },
    { x: 1150, y: 906 },
    { x: 1256, y: 868 },
  ],
  'giants-peaks': [
    { x: 1340, y: 806 },
    { x: 1420, y: 760 },
    { x: 1504, y: 712 },
    { x: 1496, y: 628 },
    { x: 1420, y: 586 },
    { x: 1336, y: 548 },
  ],
  'riddle-ruins': [
    { x: 1306, y: 470 },
    { x: 1380, y: 420 },
    { x: 1460, y: 370 },
    { x: 1450, y: 288 },
    { x: 1370, y: 246 },
    { x: 1284, y: 220 },
  ],
  'dragon-castle': [
    { x: 1190, y: 206 },
    { x: 1100, y: 214 },
    { x: 1030, y: 206 },
  ],
};

/** Region areas (hotspot rectangles), non-overlapping, inside the 1600 x 1000 scene. */
const AREAS: Record<string, [number, number, number, number]> = {
  'sunny-meadow': [40, 730, 420, 260],
  'whispering-woods': [40, 380, 330, 340],
  'fire-mountain': [80, 40, 400, 330],
  'crystal-caves': [480, 140, 380, 320],
  'sharing-lake': [560, 460, 330, 360],
  'leftover-lagoon': [760, 830, 540, 160],
  'giants-peaks': [1300, 520, 280, 330],
  'riddle-ruins': [1240, 180, 330, 330],
  'dragon-castle': [860, 30, 360, 230],
};

function sampleRoad(points: readonly Pt[], perSeg = 16): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    for (let k = 0; k < perSeg; k++) out.push(bez(p1, c1, c2, p2, k / perSeg));
  }
  out.push(points[points.length - 1]!);
  return out;
}

function pointAt(poly: readonly Pt[], cum: readonly number[], s: number): Pt {
  let i = 1;
  while (i < poly.length - 1 && cum[i]! < s) i++;
  const a = poly[i - 1]!;
  const b = poly[i]!;
  const seg = cum[i]! - cum[i - 1]! || 1;
  const t = Math.min(1, Math.max(0, (s - cum[i - 1]!) / seg));
  return {
    x: Math.round((a.x + (b.x - a.x) * t) * 10) / 10,
    y: Math.round((a.y + (b.y - a.y) * t) * 10) / 10,
  };
}

export interface MapRegion {
  center: Pt;
  nodes: Pt[];
  boss: Pt;
  path: Array<[number, number]>;
}

export interface MapHotspots {
  schemaVersion: 1;
  background: 'valley-map';
  logical: { width: number; height: number };
  hotspots: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    labelKey: string;
  }>;
  path: Array<[number, number]>;
  regions: Record<string, MapRegion>;
}

function buildHotspots(): MapHotspots {
  const all: Pt[] = [];
  const spans: Record<string, [number, number]> = {};
  for (const id of CANONICAL_REGION_IDS) {
    const start = all.length;
    all.push(...ROUTE[id]!);
    spans[id] = [start, all.length - 1];
  }
  const regions: Record<string, MapRegion> = {};
  for (const id of CANONICAL_REGION_IDS) {
    const [a, b] = spans[id]!;
    const pts = all.slice(a, b + 1);
    const poly = sampleRoad(pts, 12);
    const cum = [0];
    for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1]! + dist(poly[i - 1]!, poly[i]!));
    const len = cum[cum.length - 1]!;
    const n = MAP_LEVELS[id]! + 1;
    const nodes: Pt[] = [];
    for (let i = 0; i < n; i++) nodes.push(pointAt(poly, cum, (len * i) / (n - 1)));
    const area = AREAS[id]!;
    regions[id] = {
      center: { x: area[0] + area[2] / 2, y: area[1] + area[3] / 2 },
      nodes: nodes.slice(0, n - 1),
      boss: nodes[n - 1]!,
      path: poly
        .filter((_, i) => i % 3 === 0 || i === poly.length - 1)
        .map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10] as [number, number]),
    };
  }
  const road = sampleRoad(all, 10).map(
    (p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10] as [number, number],
  );
  return {
    schemaVersion: 1,
    background: 'valley-map',
    logical: { width: SW, height: SH },
    hotspots: CANONICAL_REGION_IDS.map((id) => {
      const [x, y, width, height] = AREAS[id]!;
      return { id, x, y, width, height, labelKey: `region.${id}.name` };
    }),
    path: road,
    regions,
  };
}

export const MAP_HOTSPOTS: MapHotspots = /* @__PURE__ */ buildHotspots();

/** Evenly spaced positions for `count` nodes along a region's trail (if content grows). */
export function mapNodePositions(regionId: string, count: number): Pt[] {
  const region = MAP_HOTSPOTS.regions[regionId];
  if (!region) throw new Error(`Unknown region id: ${regionId}`);
  const poly = region.path.map(([x, y]) => ({ x, y }));
  const cum = [0];
  for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1]! + dist(poly[i - 1]!, poly[i]!));
  const len = cum[cum.length - 1]!;
  if (count <= 1) return [pointAt(poly, cum, 0)];
  return Array.from({ length: count }, (_, i) => pointAt(poly, cum, (len * i) / (count - 1)));
}

// ------------------------------------------------------------------------------------- drawing

export function valleyMap(defs: Defs): string {
  const r = rng('valley-map');
  let out = h('rect', {
    x: 0,
    y: 0,
    width: SW,
    height: SH,
    fill: linear(defs, 'land', [
      [0, '#bfe8a8'],
      [0.5, '#a8dc8c'],
      [1, '#93d07a'],
    ]),
  });
  // soft terrain patches
  for (let i = 0; i < 40; i++) {
    const x = r() * SW;
    const y = r() * SH;
    out += h('ellipse', {
      cx: x,
      cy: y,
      rx: 60 + r() * 120,
      ry: 30 + r() * 60,
      fill: r() < 0.5 ? '#b7e39a' : '#9fd684',
      opacity: 0.6,
    });
  }
  // river from the castle hill to the lake and on to the lagoon
  const river =
    M(1000, 250) +
    C(940, 330, 1000, 420, 900, 480) +
    C(840, 520, 860, 560, 800, 600) +
    M(760, 760) +
    C(800, 800, 820, 860, 900, 880);
  out +=
    h('path', {
      d: river,
      fill: 'none',
      stroke: '#6ec3f0',
      'stroke-width': 22,
      'stroke-linecap': 'round',
    }) +
    h('path', {
      d: river,
      fill: 'none',
      stroke: '#a8e0ff',
      'stroke-width': 8,
      'stroke-linecap': 'round',
      opacity: 0.8,
    });

  // 9. Dragon Castle on its hill (top centre)
  out += h('ellipse', {
    cx: 1010,
    cy: 200,
    rx: 220,
    ry: 90,
    fill: '#8fcf6a',
    stroke: '#6fae4f',
    'stroke-width': 4,
  });
  out += castle(1010, 170, 150);

  // 3. Fire Mountain: a friendly volcano with smoke puffs (top left)
  out += h('circle', {
    cx: 330,
    cy: 160,
    r: 150,
    fill: radial(defs, 'fireglow', [
      [0, '#ffcf6b', 0.5],
      [1, '#ffcf6b', 0],
    ]),
  });
  out += mountain(330, 250, 300, 190, '#c9784e', false, 0.2);
  out += h('path', {
    d: M(290, 66) + Q(330, 56, 370, 66) + L(362, 80) + Q(330, 70, 298, 80) + 'Z',
    fill: '#ffb31f',
  });
  out += h('path', {
    d: M(304, 72) + Q(316, 120, 300, 170) + M(356, 72) + Q(344, 130, 360, 180),
    fill: 'none',
    stroke: '#ffb31f',
    'stroke-width': 9,
    'stroke-linecap': 'round',
  });
  out += cloud(318, 40, 22, '#f6e6dc', '#e2c8bc') + cloud(356, 22, 16, '#f6e6dc', '#e2c8bc');

  // 2. Whispering Woods (left middle)
  for (let i = 0; i < 26; i++) {
    const x = 70 + r() * 280;
    const y = 420 + r() * 300;
    out += pine(x, y, 56 + r() * 30, i % 3 ? '#2f8a4c' : '#3fa458', i % 4 === 0);
  }
  out +=
    h('path', {
      d: roundRectD(214, 560, 40, 30, 4),
      fill: '#b8662e',
      stroke: '#6b3a18',
      'stroke-width': 2.5,
    }) +
    h('path', {
      d: polyD([
        { x: 206, y: 562 },
        { x: 234, y: 538 },
        { x: 262, y: 562 },
      ]),
      fill: '#8a4a22',
      stroke: '#5a2f12',
      'stroke-width': 2.5,
    });

  // 4. Crystal Caves: a rocky hill with a glowing cave mouth (top middle)
  out += h('path', {
    d: smoothClosedD(
      [
        { x: 560, y: 330 },
        { x: 600, y: 210 },
        { x: 700, y: 170 },
        { x: 800, y: 210 },
        { x: 830, y: 320 },
        { x: 760, y: 360 },
        { x: 640, y: 360 },
      ],
      1,
    ),
    fill: '#a89ac4',
    stroke: '#6b5f8f',
    'stroke-width': 4,
  });
  out += h('path', {
    d: M(660, 340) + Q(700, 250, 740, 340) + 'Z',
    fill: '#3a2f6e',
    stroke: '#2a2252',
    'stroke-width': 3,
  });
  out +=
    crystalCluster(700, 336, 50, ['#b9a4ff', '#7fe0ff', '#ffd0ea'], defs) +
    crystalCluster(800, 300, 30, ['#7fe0ff', '#b9a4ff']) +
    crystalCluster(600, 300, 26, ['#b9a4ff', '#ff9fd6']);

  // 5. Sharing Lake with the water mill (centre)
  out += h('path', {
    d: smoothClosedD(
      [
        { x: 660, y: 560 },
        { x: 760, y: 520 },
        { x: 850, y: 560 },
        { x: 860, y: 660 },
        { x: 790, y: 740 },
        { x: 690, y: 720 },
        { x: 640, y: 640 },
      ],
      1,
    ),
    fill: linear(defs, 'lake', [
      [0, '#9fe0ff'],
      [1, '#5fb3ec'],
    ]),
    stroke: '#4f9ad0',
    'stroke-width': 4,
  });
  out += h('path', {
    d:
      M(700, 610) +
      Q(730, 600, 760, 610) +
      M(740, 660) +
      Q(770, 650, 800, 660) +
      M(690, 690) +
      Q(715, 682, 740, 690),
    fill: 'none',
    stroke: '#ffffff',
    'stroke-width': 3,
    'stroke-linecap': 'round',
    opacity: 0.7,
  });
  out +=
    h('path', {
      d: roundRectD(840, 600, 40, 34, 4),
      fill: '#c9a06a',
      stroke: '#6b4a2e',
      'stroke-width': 2.5,
    }) +
    h('circle', { cx: 838, cy: 626, r: 16, fill: 'none', stroke: '#8a5a32', 'stroke-width': 4 });

  // 6. Leftover Lagoon: sandy cove with shells (bottom right of centre)
  out += h('path', {
    d: smoothClosedD(
      [
        { x: 880, y: 880 },
        { x: 1000, y: 850 },
        { x: 1140, y: 860 },
        { x: 1230, y: 900 },
        { x: 1200, y: 970 },
        { x: 1040, y: 990 },
        { x: 900, y: 960 },
      ],
      1,
    ),
    fill: '#f6dfb2',
    stroke: '#d9b27a',
    'stroke-width': 4,
  });
  out += h('path', {
    d: smoothClosedD(
      [
        { x: 940, y: 900 },
        { x: 1040, y: 880 },
        { x: 1140, y: 890 },
        { x: 1170, y: 930 },
        { x: 1060, y: 960 },
        { x: 960, y: 940 },
      ],
      1,
    ),
    fill: linear(defs, 'lagoon', [
      [0, '#c9a8e8'],
      [1, '#5fb8c8'],
    ]),
  });
  out +=
    h('circle', {
      cx: 1180,
      cy: 950,
      r: 8,
      fill: '#fbf7f2',
      stroke: '#9a8ab8',
      'stroke-width': 2,
    }) +
    h('circle', { cx: 1196, cy: 956, r: 7, fill: '#fbf7f2', stroke: '#9a8ab8', 'stroke-width': 2 });

  // 7. Giant's Peaks (right middle): rounded snowy peaks
  out +=
    mountain(1430, 700, 300, 220, '#9fb0d6', true, 0.55) +
    mountain(1520, 720, 220, 160, '#8fa3cf', true, 0.6) +
    mountain(1350, 720, 200, 140, '#b3c2e2', true, 0.6);

  // 8. Riddle Ruins (top right): arches and columns
  const stone = '#e9dcc0';
  for (const [x, y, hh] of [
    [1330, 380, 90],
    [1380, 380, 70],
    [1440, 350, 100],
  ] as const) {
    out += h('path', {
      d: roundRectD(x - 12, y - hh, 24, hh, 3),
      fill: stone,
      stroke: '#9a8a6a',
      'stroke-width': 3,
    });
  }
  out += h('path', {
    d:
      M(1420, 250) +
      Q(1460, 210, 1500, 250) +
      L(1500, 330) +
      L(1484, 330) +
      L(1484, 258) +
      Q(1460, 236, 1436, 258) +
      L(1436, 330) +
      L(1420, 330) +
      'Z',
    fill: stone,
    stroke: '#9a8a6a',
    'stroke-width': 3,
  });

  // 1. Sunny Meadow (bottom left): flowers, cottages, a stream with the troll's bridge
  out += cottage(150, 830, 44) + cottage(210, 840, 38, '#e0663f');
  out += h('path', {
    d: M(470, 1000) + C(480, 930, 440, 880, 480, 820),
    fill: 'none',
    stroke: '#6ec3f0',
    'stroke-width': 18,
    'stroke-linecap': 'round',
  });
  out += stoneBridge(462, 900, 70);
  for (let i = 0; i < 40; i++)
    out += flower(
      60 + r() * 380,
      760 + r() * 220,
      5 + r() * 3,
      5,
      ['#ffffff', '#ffd23f', '#ff9fbf', '#b98cff'][i % 4]!,
      '#ffd23f',
      '#6b6b6b',
      1,
    );

  // scattered orchard trees, rocks and clouds in the margins
  for (const [x, y] of [
    [520, 520],
    [560, 760],
    [940, 760],
    [1140, 640],
    [1220, 420],
    [520, 940],
    [1300, 980],
  ] as const) {
    out += roundTree(x, y, 60, '#6fbf4f', true, '#e8423f');
  }
  out += rock(1120, 520, 26) + rock(560, 620, 20) + rock(1560, 980, 30);
  out += cloud(70, 60, 40) + cloud(1540, 70, 44) + cloud(720, 60, 26) + cloud(1560, 420, 30);

  // the road
  const road = smoothOpenD(
    MAP_HOTSPOTS.path.map(([x, y]) => ({ x, y })),
    1,
  );
  out += h('path', {
    d: road,
    fill: 'none',
    stroke: '#b88a52',
    'stroke-width': 30,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  out += h('path', {
    d: road,
    fill: 'none',
    stroke: '#f2d9a8',
    'stroke-width': 22,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  out += h('path', {
    d: road,
    fill: 'none',
    stroke: '#ffffff',
    'stroke-width': 3,
    'stroke-dasharray': '2 18',
    'stroke-linecap': 'round',
    opacity: 0.8,
  });
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
