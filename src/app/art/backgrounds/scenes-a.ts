/**
 * Region scenes, part 1 (1600 x 1000). Composition rule shared by every region scene:
 * calm sky / far scenery in the centre-top UI area, the ground line around y = 760, the dragon's
 * spot left of centre and the boss's spot right of centre, detail framing the edges.
 */
import { M, L, Q, C, polyD, roundRectD, heartD } from '../svg/path';
import { h } from '../svg/xml';
import { rng } from '../svg/prng';
import { darken } from '../svg/color';
import { polar } from '../svg/num';
import { sparkleD } from '../glyphs';
import {
  SH,
  SW,
  birds,
  bush,
  church,
  cloud,
  cottage,
  crystalCluster,
  fence,
  hills,
  lightRays,
  lilyPad,
  linear,
  meadowDetails,
  mountain,
  mushroom,
  pine,
  radial,
  reeds,
  ridgeD,
  rock,
  roundTree,
  sky,
  starsField,
  stoneBridge,
  sun,
  vignette,
  water,
  type Defs,
} from './kit';

const FLOWERS = ['#ffffff', '#ffd23f', '#ff9fbf', '#b98cff', '#ff7a59'];

export function sunnyMeadow(defs: Defs): string {
  const r = rng('sunny-meadow');
  let out = sky(defs, '#86cdfb', '#fff4d8', 0.66);
  out += sun(defs, 210, 150, 62);
  out += cloud(980, 150, 64) + cloud(1380, 240, 48) + cloud(600, 250, 34) + cloud(250, 330, 30);
  out += birds([
    [1120, 300, 12],
    [1160, 318, 9],
    [1090, 330, 8],
  ]);
  out += hills(defs, 'far', r, 640, 110, 8, '#b8e3b4', '#a6d69a');
  out +=
    church(1260, 600, 64) +
    cottage(1180, 604, 48) +
    cottage(1370, 610, 44, '#e0663f') +
    cottage(1440, 616, 36);
  out += roundTree(1110, 612, 70, '#7cc25a', false) + roundTree(1500, 618, 64, '#6fb84f', false);
  out += hills(defs, 'mid', r, 720, 70, 6, '#97d86a', '#7cc25a');
  // orchard rows on the mid hill
  for (let i = 0; i < 5; i++)
    out += roundTree(
      120 + i * 70,
      716 - (i % 2) * 8,
      76,
      '#6fbf4f',
      true,
      i % 2 ? '#e8423f' : '#ffcf33',
    );
  // stream winding under the troll's bridge (drawn over a full-width front meadow: no seams)
  out += h('path', {
    d: ridgeD(r, 800, 30, 5),
    fill: linear(defs, 'front', [
      [0, '#7cc25a'],
      [1, '#55a548'],
    ]),
  });
  const stream =
    M(1600, 690) +
    C(1460, 700, 1380, 720, 1290, 742) +
    C(1180, 770, 1240, 860, 1110, 1000) +
    L(1240, 1000) +
    C(1340, 870, 1300, 790, 1380, 760) +
    C(1450, 735, 1530, 728, 1600, 726) +
    'Z';
  out += water(defs, 'stream', stream, '#8fd8ff', '#4fb3ec', r, [1100, 700, 1600, 1000], 14);
  out += stoneBridge(1300, 760, 210);
  out += h('path', {
    d: M(1250, 1000) + C(1300, 900, 1390, 830, 1600, 800) + L(1600, 1000) + 'Z',
    fill: linear(defs, 'front2', [
      [0, '#7cc25a'],
      [1, '#55a548'],
    ]),
  });
  out += meadowDetails(r, 20, 1080, 800, 990, 150, FLOWERS, '#4f9a3f');
  out += meadowDetails(r, 1330, 1590, 830, 990, 40, FLOWERS, '#4f9a3f');
  out += bush(70, 880, 60, '#5aa54a', '#ff9fbf') + bush(1530, 900, 54, '#5aa54a', '#ffffff');
  out += roundTree(1520, 820, 210, '#6fbf4f', true, '#e8423f');
  out += roundTree(70, 830, 240, '#5fae48', true, '#ffcf33');
  out += fence(160, 470, 852, 40);
  out += h('path', {
    d: sparkleD(760, 760, 8) + sparkleD(520, 680, 6),
    fill: '#ffffff',
    opacity: 0.8,
  });
  // butterflies
  for (const [x, y, c] of [
    [690, 700, '#ff9fbf'],
    [930, 760, '#ffd23f'],
  ] as const) {
    out += h('path', {
      d:
        M(x, y) +
        C(x - 14, y - 16, x - 22, y + 2, x, y + 4) +
        C(x + 22, y + 2, x + 14, y - 16, x, y),
      fill: c,
      stroke: darken(c, 0.4),
      'stroke-width': 1.5,
    });
  }
  return out + vignette(defs, '#2a1b45', 0.16);
}

export function whisperingWoods(defs: Defs): string {
  const r = rng('whispering-woods');
  let out = sky(defs, '#bfe6c4', '#fff4d6', 0.7);
  out += lightRays(defs, 380, -40, 1100, 9, '#fff6cc', 5, 62);
  // far forest silhouettes, standing in the ground (no gaps), lighter with distance
  for (let layer = 0; layer < 3; layer++) {
    const tones = [
      ['#b4d9b0', '#a6d2a4'],
      ['#93c894', '#86bf8a'],
      ['#74b47a', '#68aa70'],
    ][layer]!;
    const y = 690 + layer * 22;
    for (let x = -30, i = 0; x < SW + 40; x += 42 - layer * 6 + r() * 10, i++) {
      out += pine(
        x + r() * 16,
        y + r() * 14,
        150 + layer * 40 + r() * 70,
        tones[i % 2]!,
        false,
        false,
      );
    }
  }
  out += hills(defs, 'ground', r, 716, 18, 6, '#7cbf5a', '#4f9a3f');
  // path into the woods
  out += h('path', {
    d:
      M(700, 1000) +
      C(760, 880, 760, 800, 790, 720) +
      L(830, 720) +
      C(860, 800, 880, 880, 960, 1000) +
      'Z',
    fill: linear(defs, 'path', [
      [0, '#e8c99a'],
      [1, '#c99a62'],
    ]),
  });
  out += pine(50, 820, 520, '#2f8a4c');
  // gingerbread cottage of the kind forest witch
  const gx = 300;
  const gy = 780;
  out += h('path', {
    d: roundRectD(gx - 110, gy - 140, 220, 140, 10),
    fill: '#b8662e',
    stroke: '#6b3a18',
    'stroke-width': 4,
  });
  out += h('path', {
    d: polyD([
      { x: gx - 140, y: gy - 130 },
      { x: gx, y: gy - 250 },
      { x: gx + 140, y: gy - 130 },
    ]),
    fill: '#8a4a22',
    stroke: '#5a2f12',
    'stroke-width': 4,
    'stroke-linejoin': 'round',
  });
  out += h('path', {
    d:
      M(gx - 130, gy - 132) +
      Q(gx - 110, gy - 118, gx - 90, gy - 132) +
      Q(gx - 70, gy - 118, gx - 50, gy - 132) +
      Q(gx - 30, gy - 118, gx - 10, gy - 132) +
      Q(gx + 10, gy - 118, gx + 30, gy - 132) +
      Q(gx + 50, gy - 118, gx + 70, gy - 132) +
      Q(gx + 90, gy - 118, gx + 110, gy - 132) +
      Q(gx + 120, gy - 124, gx + 130, gy - 132),
    fill: 'none',
    stroke: '#fffaf0',
    'stroke-width': 8,
    'stroke-linecap': 'round',
  });
  out += h('path', {
    d: heartD(gx, gy - 190, 52),
    fill: '#e0335a',
    stroke: '#fffaf0',
    'stroke-width': 4,
  });
  out += h('path', {
    d: roundRectD(gx - 30, gy - 80, 60, 80, 28),
    fill: '#6b3a18',
    stroke: '#fffaf0',
    'stroke-width': 4,
  });
  for (const [x, c] of [
    [gx - 80, '#ff5a8a'],
    [gx + 80, '#4aa8ff'],
  ] as const) {
    out +=
      h('circle', {
        cx: x,
        cy: gy - 90,
        r: 22,
        fill: '#ffe08a',
        stroke: '#fffaf0',
        'stroke-width': 5,
      }) + h('circle', { cx: x, cy: gy - 40, r: 9, fill: c, stroke: '#fffaf0', 'stroke-width': 3 });
  }
  // framing pines (the left giant was drawn behind the cottage)
  out +=
    pine(150, 900, 300, '#3a9a52') +
    pine(1430, 840, 560, '#2f8a4c') +
    pine(1560, 900, 420, '#3a9a52') +
    pine(1300, 880, 300, '#3fa458');
  // ferns and mushrooms
  out +=
    mushroom(470, 870, 54, '#a8642e') +
    mushroom(520, 880, 36, '#c27a3c') +
    mushroom(1180, 900, 50, '#a8642e') +
    mushroom(1120, 890, 30, '#e0533a');
  out += meadowDetails(r, 0, 1600, 820, 990, 110, ['#ffffff', '#ffd23f', '#b98cff'], '#3f8a3a');
  for (let i = 0; i < 14; i++)
    out += h('path', {
      class: `dv-twinkle dv-twinkle-${(i % 3) + 1}`,
      d: sparkleD(300 + r() * 1000, 560 + r() * 300, 4 + r() * 4),
      fill: '#fff3a6',
    });
  return out + vignette(defs, '#1f3a2a', 0.26);
}

export function fireMountain(defs: Defs): string {
  const r = rng('fire-mountain');
  let out = sky(defs, '#ffb06b', '#ffe8c0', 0.62);
  out += sun(defs, 1240, 300, 70, '#fff0b0');
  out += cloud(420, 200, 60, '#fff3e0', '#ffd3b0') + cloud(860, 120, 46, '#fff3e0', '#ffd3b0');
  out +=
    mountain(240, 700, 620, 330, '#c9826a', false, 0.55) +
    mountain(620, 690, 520, 240, '#d99a7a', false, 0.6);
  for (let x = 20; x < 860; x += 34 + r() * 20)
    out += pine(
      x,
      712 + r() * 10,
      70 + r() * 50,
      ['#7a8a5a', '#6b7d4f'][Math.floor(r() * 2)]!,
      false,
      false,
    );
  // the friendly fire mountain: a warm glow and puffy smoke clouds, no danger
  out += h('circle', {
    cx: 1270,
    cy: 300,
    r: 220,
    fill: radial(defs, 'glow', [
      [0, '#ffcf6b', 0.65],
      [1, '#ffcf6b', 0],
    ]),
  });
  out += mountain(1270, 760, 760, 470, '#b8653e', false, 0.15);
  out += h('path', {
    d: M(1170, 300) + Q(1270, 270, 1370, 300) + L(1350, 330) + Q(1270, 310, 1190, 330) + 'Z',
    fill: '#ffb31f',
  });
  out += h('path', {
    d: M(1215, 302) + Q(1250, 380, 1236, 470) + M(1330, 304) + Q(1300, 400, 1322, 500),
    fill: 'none',
    stroke: '#ffb31f',
    'stroke-width': 14,
    'stroke-linecap': 'round',
    opacity: 0.85,
  });
  out +=
    cloud(1230, 230, 46, '#f6e6dc', '#e2c8bc') +
    cloud(1320, 170, 38, '#f6e6dc', '#e2c8bc') +
    cloud(1260, 110, 30, '#f6e6dc', '#e2c8bc');
  out += hills(defs, 'ground', r, 760, 40, 6, '#d98a5a', '#a8553a');
  // hot springs with steam (warm and cosy)
  out += h('ellipse', {
    cx: 300,
    cy: 880,
    rx: 170,
    ry: 44,
    fill: '#7fd0e8',
    stroke: '#5a8a9a',
    'stroke-width': 5,
  });
  out += h('path', {
    d:
      M(220, 830) +
      Q(240, 790, 220, 750) +
      M(300, 826) +
      Q(320, 780, 300, 730) +
      M(380, 832) +
      Q(400, 790, 380, 752),
    fill: 'none',
    stroke: '#ffffff',
    'stroke-width': 8,
    'stroke-linecap': 'round',
    opacity: 0.7,
  });
  out +=
    rock(120, 900, 70, '#9a6a5a') +
    rock(480, 900, 50, '#8a5a4a') +
    rock(1500, 920, 80, '#9a6a5a') +
    rock(1100, 930, 46, '#a8786a');
  // glowing ember stones
  for (let i = 0; i < 10; i++) {
    const x = 560 + r() * 900;
    const y = 840 + r() * 140;
    out += h('circle', {
      cx: x,
      cy: y,
      r: 7 + r() * 6,
      fill: '#ffb31f',
      stroke: '#c94a1f',
      'stroke-width': 2,
    });
  }
  out += meadowDetails(r, 0, 1600, 820, 990, 60, ['#ffd23f', '#ff7a59'], '#8a5a2a');
  return out + vignette(defs, '#4a1f1f', 0.22);
}

export function crystalCaves(defs: Defs): string {
  const r = rng('crystal-caves');
  let out = h('rect', {
    x: 0,
    y: 0,
    width: SW,
    height: SH,
    fill: linear(defs, 'cave', [
      [0, '#231d4a'],
      [0.6, '#3a2f6e'],
      [1, '#2a2252'],
    ]),
  });
  // a far opening with a starry sky
  out += h('ellipse', {
    cx: 800,
    cy: 230,
    rx: 420,
    ry: 230,
    fill: linear(defs, 'opening', [
      [0, '#3f4fa8'],
      [1, '#6a5ac8'],
    ]),
  });
  out += starsField(r, 70, 420, 1180, 40, 400);
  // cave walls
  out += h('path', {
    d:
      M(0, 0) +
      L(1600, 0) +
      L(1600, 700) +
      C(1500, 560, 1440, 420, 1240, 380) +
      C(1180, 220, 1000, 20, 800, 20) +
      C(600, 20, 420, 220, 360, 380) +
      C(160, 420, 100, 560, 0, 700) +
      'Z',
    fill: '#2a2252',
  });
  for (let i = 0; i < 14; i++) {
    const x = 60 + i * 110 + r() * 40;
    const len = 40 + r() * 90;
    out += h('path', {
      d: M(x - 24, 0) + Q(x - 10, len * 0.7, x, len) + Q(x + 10, len * 0.7, x + 24, 0) + 'Z',
      fill: '#3f3578',
      stroke: '#1d1840',
      'stroke-width': 2,
    });
  }
  out += hills(defs, 'floor', r, 790, 36, 7, '#4a3f86', '#2a2252');
  // glowing crystal clusters framing the scene
  out +=
    crystalCluster(150, 820, 210, ['#b9a4ff', '#8b5cf6', '#d7c8ff'], defs) +
    crystalCluster(1450, 830, 230, ['#7fe0ff', '#4aa8ff', '#c8f4ff'], defs);
  out +=
    crystalCluster(420, 800, 110, ['#ff9fd6', '#e35d9b', '#ffd0ea'], defs) +
    crystalCluster(1180, 800, 120, ['#b9a4ff', '#8b5cf6', '#d7c8ff'], defs);
  out += crystalCluster(820, 790, 60, ['#7fe0ff', '#4aa8ff'], defs);
  // the miners' rails and a little cart
  out += h('path', {
    d: M(0, 930) + L(560, 880) + M(0, 960) + L(580, 906),
    stroke: '#8a7a9a',
    'stroke-width': 6,
  });
  for (let i = 0; i < 7; i++)
    out += h('path', {
      d: M(30 + i * 80, 960 - i * 8) + L(30 + i * 80, 920 - i * 8),
      stroke: '#6b5a4a',
      'stroke-width': 10,
    });
  out += h('path', {
    d: M(280, 900) + L(300, 830) + L(450, 820) + L(440, 890) + 'Z',
    fill: '#8a6a4a',
    stroke: '#4a3a2a',
    'stroke-width': 4,
  });
  out += crystalCluster(370, 838, 46, ['#ffd23f', '#ffe680']);
  out +=
    h('circle', { cx: 320, cy: 902, r: 16, fill: '#4a3a2a' }) +
    h('circle', { cx: 420, cy: 892, r: 16, fill: '#4a3a2a' });
  // hanging lanterns
  for (const x of [560, 1040]) {
    out +=
      h('path', { d: M(x, 0) + L(x, 140), stroke: '#8a7a9a', 'stroke-width': 3 }) +
      h('circle', {
        cx: x,
        cy: 170,
        r: 60,
        fill: radial(defs, `lamp-${x}`, [
          [0, '#ffd36b', 0.5],
          [1, '#ffd36b', 0],
        ]),
      }) +
      h('path', {
        d: roundRectD(x - 18, 140, 36, 46, 8),
        fill: '#ffe08a',
        stroke: '#8a6a2a',
        'stroke-width': 4,
      });
  }
  for (let i = 0; i < 26; i++)
    out += h('path', {
      d: sparkleD(r() * 1600, 420 + r() * 560, 3 + r() * 5),
      fill: ['#d7c8ff', '#c8f4ff', '#ffd0ea'][i % 3]!,
      opacity: 0.85,
    });
  return out + vignette(defs, '#120e2a', 0.4);
}

export function sharingLake(defs: Defs): string {
  const r = rng('sharing-lake');
  let out = sky(defs, '#9fd8ff', '#f4fbff', 0.62);
  out += cloud(380, 170, 58) + cloud(1200, 120, 52) + cloud(820, 260, 30);
  out += hills(defs, 'far', r, 600, 80, 7, '#b8dcc8', '#a2cdb4');
  for (let x = -20; x < SW; x += 40)
    out += pine(x + r() * 16, 612 + r() * 8, 70 + r() * 40, '#7fb894', false);
  const lake =
    M(0, 640) +
    C(400, 610, 1200, 610, 1600, 640) +
    L(1600, 860) +
    C(1200, 900, 400, 900, 0, 860) +
    'Z';
  out += water(defs, 'lake', lake, '#9fe0ff', '#4fa6e6', r, [0, 640, 1600, 880], 30);
  // reflections of the far trees
  out += h('path', {
    d:
      M(0, 640) +
      C(400, 610, 1200, 610, 1600, 640) +
      L(1600, 670) +
      C(1200, 650, 400, 650, 0, 670) +
      'Z',
    fill: '#6fae8a',
    opacity: 0.35,
  });
  // the water mill on the right shore (the water goblin's home)
  const mx = 1330;
  const my = 700;
  out += h('path', {
    d: roundRectD(mx - 90, my - 150, 180, 150, 8),
    fill: '#c9a06a',
    stroke: '#6b4a2e',
    'stroke-width': 4,
  });
  out += h('path', {
    d: polyD([
      { x: mx - 112, y: my - 142 },
      { x: mx, y: my - 240 },
      { x: mx + 112, y: my - 142 },
    ]),
    fill: '#8a4a32',
    stroke: '#5a2f1a',
    'stroke-width': 4,
    'stroke-linejoin': 'round',
  });
  out += h('rect', {
    x: mx - 20,
    y: my - 120,
    width: 40,
    height: 40,
    fill: '#ffe08a',
    stroke: '#6b4a2e',
    'stroke-width': 3,
  });
  out += h('circle', {
    cx: mx - 120,
    cy: my - 40,
    r: 76,
    fill: 'none',
    stroke: '#8a5a32',
    'stroke-width': 12,
  });
  for (let i = 0; i < 8; i++) {
    const p = polar(mx - 120, my - 40, 76, (i * 360) / 8);
    out += h('path', {
      d: M(mx - 120, my - 40) + L(p.x, p.y),
      stroke: '#8a5a32',
      'stroke-width': 7,
    });
  }
  // willow on the left shore
  out += h('path', {
    d: M(170, 760) + C(160, 640, 200, 560, 240, 520),
    fill: 'none',
    stroke: '#7a5230',
    'stroke-width': 26,
    'stroke-linecap': 'round',
  });
  for (let i = 0; i < 14; i++) {
    const x = 90 + i * 22;
    out += h('path', {
      d: M(x + 60, 470 + (i % 3) * 10) + Q(x + 30, 560, x + 10, 700 - (i % 4) * 20),
      fill: 'none',
      stroke: ['#6fbf4f', '#5aa54a', '#8fd46a'][i % 3]!,
      'stroke-width': 14,
      'stroke-linecap': 'round',
    });
  }
  out +=
    lilyPad(520, 780, 46, '#ffffff') +
    lilyPad(640, 820, 34) +
    lilyPad(980, 800, 40, '#ff9fbf') +
    lilyPad(1080, 770, 30);
  out += reeds(380, 830, 90) + reeds(1170, 840, 80) + reeds(60, 860, 100);
  // dock with the goblin's teacups
  out += h('path', {
    d: roundRectD(1180, 800, 300, 26, 6),
    fill: '#b8864a',
    stroke: '#6b4a2e',
    'stroke-width': 4,
  });
  for (const x of [1210, 1300, 1390, 1460])
    out += h('rect', { x, y: 826, width: 14, height: 70, fill: '#8a5a32' });
  for (const [x, c] of [
    [1250, '#4f7bd0'],
    [1330, '#e0335a'],
    [1410, '#5cbf5a'],
  ] as const) {
    out += h('path', {
      d: M(x - 22, 800) + L(x + 22, 800) + C(x + 22, 776, x - 22, 776, x - 22, 800) + 'Z',
      transform: `rotate(180 ${x} 790)`,
      fill: '#ffffff',
      stroke: c,
      'stroke-width': 3,
    });
  }
  out += h('path', {
    d: ridgeD(r, 900, 24, 6),
    fill: linear(defs, 'bank', [
      [0, '#7cc25a'],
      [1, '#55a548'],
    ]),
  });
  out += meadowDetails(r, 0, 1600, 900, 995, 70, FLOWERS, '#4f9a3f');
  return out + vignette(defs, '#1f2a4a', 0.18);
}
