/** Region scenes, part 2, and the castle hall (1600 x 1000). */
import { polar } from '../svg/num';
import { M, L, Q, C, polyD, roundRectD, roundStarD } from '../svg/path';
import { h } from '../svg/xml';
import { rng } from '../svg/prng';
import { darken, lighten } from '../svg/color';
import { flower, pearl, sparkleD } from '../glyphs';
import {
  SH,
  SW,
  birds,
  bush,
  castle,
  cloud,
  cottage,
  hills,
  lightRays,
  linear,
  meadowDetails,
  mountain,
  pine,
  radial,
  reeds,
  ridgeD,
  rock,
  roundTree,
  sky,
  starsField,
  sun,
  vignette,
  water,
  type Defs,
} from './kit';

export function leftoverLagoon(defs: Defs): string {
  const r = rng('leftover-lagoon');
  let out = sky(defs, '#5b5fc4', '#ffc2cf', 0.6);
  out += starsField(r, 60, 0, 1600, 0, 330, '#fff6d6');
  out +=
    h('circle', {
      cx: 1330,
      cy: 150,
      r: 150,
      fill: radial(defs, 'moonglow', [
        [0, '#fff6d6', 0.55],
        [1, '#fff6d6', 0],
      ]),
    }) +
    h('circle', { cx: 1330, cy: 150, r: 52, fill: '#fff6d6' }) +
    h('circle', { cx: 1352, cy: 138, r: 46, fill: '#e9b8d4', opacity: 0.35 });
  out += hills(defs, 'far', r, 600, 70, 8, '#8a7ab8', '#a88ac4');
  for (let x = 0; x < SW; x += 70)
    out += roundTree(x + r() * 30, 618, 90 + r() * 40, '#6a5aa0', false);
  const lagoon =
    M(0, 630) +
    C(500, 600, 1100, 600, 1600, 630) +
    L(1600, 850) +
    C(1100, 810, 500, 830, 0, 870) +
    'Z';
  out += water(defs, 'lagoon', lagoon, '#c9a8e8', '#5fb8c8', r, [0, 630, 1600, 860], 26);
  out += h('ellipse', { cx: 1330, cy: 700, rx: 50, ry: 120, fill: '#fff6d6', opacity: 0.25 });
  // mist ribbons where the nymphs dance
  out += h('path', {
    d: M(-40, 720) + C(300, 690, 600, 740, 900, 708) + C(1200, 680, 1400, 720, 1640, 700),
    fill: 'none',
    stroke: '#ffffff',
    'stroke-width': 26,
    'stroke-linecap': 'round',
    opacity: 0.25,
  });
  // sandy beach with shells and pearls
  out += h('path', {
    d: M(0, 860) + C(400, 820, 1100, 800, 1600, 840) + L(1600, 1000) + L(0, 1000) + 'Z',
    fill: linear(defs, 'sand', [
      [0, '#f6dfb2'],
      [1, '#e4c08a'],
    ]),
  });
  const shell = (x: number, y: number, s: number, c: string): string => {
    let d = M(x, y + s * 0.2);
    const pts = [];
    for (let i = 0; i <= 6; i++) pts.push(polar(x, y + s * 0.2, s, -170 + i * 26.6));
    d += L(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++)
      d += Q(
        (pts[i - 1]!.x + pts[i]!.x) / 2 + (pts[i]!.x - x) * 0.1,
        (pts[i - 1]!.y + pts[i]!.y) / 2 - s * 0.12,
        pts[i]!.x,
        pts[i]!.y,
      );
    return h('path', { d: d + 'Z', fill: c, stroke: darken(c, 0.35), 'stroke-width': 2.5 });
  };
  out +=
    shell(260, 920, 34, '#ffc2cf') +
    shell(1240, 900, 28, '#ffe0b0') +
    shell(820, 960, 22, '#ffd6e8') +
    shell(1460, 950, 36, '#ffc2cf');
  out +=
    pearl(300, 948, 12, '#9a8ab8', 2) +
    pearl(330, 952, 10, '#9a8ab8', 2) +
    pearl(316, 930, 10, '#9a8ab8', 2) +
    pearl(390, 958, 9, '#9a8ab8', 2);
  out +=
    rock(90, 900, 80, '#9a8ab8') + rock(1540, 880, 90, '#9a8ab8') + rock(170, 930, 40, '#a89ac4');
  out += reeds(60, 850, 120) + reeds(1500, 830, 110) + reeds(1380, 845, 80);
  for (let i = 0; i < 22; i++)
    out += h('path', {
      class: `dv-twinkle dv-twinkle-${(i % 3) + 1}`,
      d: sparkleD(r() * 1600, 560 + r() * 330, 3 + r() * 4),
      fill: '#fff3a6',
    });
  return out + vignette(defs, '#1f1a3d', 0.3);
}

export function giantsPeaks(defs: Defs): string {
  const r = rng('giants-peaks');
  let out = sky(defs, '#79bdfc', '#eef8ff', 0.6);
  out += cloud(500, 170, 54) + cloud(1120, 120, 44) + cloud(1450, 260, 36);
  // Krkonose-like rounded peaks with snow fields
  out +=
    mountain(260, 640, 760, 400, '#9fb0d6', true, 0.6) +
    mountain(1320, 630, 820, 470, '#8fa3cf', true, 0.55);
  out += mountain(820, 660, 600, 260, '#b3c2e2', true, 0.7);
  out += birds([
    [760, 280, 10],
    [800, 300, 8],
  ]);
  out += hills(defs, 'farmeadow', r, 680, 30, 9, '#c4e6b4', '#b0dba0');
  out += hills(defs, 'alp', r, 720, 70, 6, '#9fd47a', '#7cbf5a');
  // dwarf pines (klec) as low dark clumps on the slopes
  for (let i = 0; i < 26; i++) {
    const x = r() * 1600;
    const y = 700 + r() * 70;
    out += h('ellipse', {
      cx: x,
      cy: y,
      rx: 26 + r() * 30,
      ry: 12 + r() * 8,
      fill: '#3f7a4a',
      opacity: 0.85,
    });
  }
  // a mountain hut (bouda) with a big wooden roof
  const bx = 220;
  const by = 760;
  out += h('path', {
    d: roundRectD(bx - 110, by - 110, 220, 110, 6),
    fill: '#e9dcc0',
    stroke: '#8a7a6a',
    'stroke-width': 4,
  });
  out += h('path', {
    d: M(bx - 110, by - 70) + L(bx + 110, by - 70),
    stroke: '#a8743a',
    'stroke-width': 30,
  });
  out += h('path', {
    d: polyD([
      { x: bx - 150, y: by - 104 },
      { x: bx, y: by - 210 },
      { x: bx + 150, y: by - 104 },
    ]),
    fill: '#7a4a2a',
    stroke: '#4a2a12',
    'stroke-width': 4,
    'stroke-linejoin': 'round',
  });
  for (const x of [bx - 60, bx + 30])
    out += h('rect', {
      x,
      y: by - 100,
      width: 30,
      height: 26,
      fill: '#ffe08a',
      stroke: '#6b4a2e',
      'stroke-width': 3,
    });
  out += h('rect', { x: bx + 70, y: by - 60, width: 28, height: 60, fill: '#8a5a32' });
  out += h('path', {
    d: ridgeD(r, 850, 30, 6),
    fill: linear(defs, 'meadow', [
      [0, '#8fcf6a'],
      [1, '#5aa54a'],
    ]),
  });
  // giant-sized boulders: the friendly giant's stepping stones
  out +=
    rock(1420, 880, 170, '#b8b0c8') + rock(1240, 900, 90, '#a8a0bc') + rock(80, 920, 70, '#b8b0c8');
  out += meadowDetails(
    r,
    0,
    1600,
    860,
    995,
    140,
    ['#b98cff', '#ffffff', '#ff9fd6', '#ffd23f'],
    '#4f9a3f',
  );
  out += pine(560, 860, 200, '#2f7a4a') + pine(620, 880, 150, '#3a8a52');
  return out + vignette(defs, '#1f2a4a', 0.18);
}

export function riddleRuins(defs: Defs): string {
  const r = rng('riddle-ruins');
  let out = sky(defs, '#ffd08a', '#fff4dc', 0.6);
  out += sun(defs, 1300, 260, 64, '#fff3c4');
  out += cloud(480, 160, 50, '#fffaf0', '#f6e0c0') + cloud(900, 230, 34, '#fffaf0', '#f6e0c0');
  out += hills(defs, 'far', r, 620, 70, 7, '#d8d6a8', '#c8c896');
  const stone = '#e9dcc0';
  const line = '#9a8a6a';
  const column = (x: number, y: number, hgt: number, broken: boolean): string =>
    h('path', {
      d: roundRectD(x - 30, y - hgt, 60, hgt, 4),
      fill: stone,
      stroke: line,
      'stroke-width': 3,
    }) +
    h('path', {
      d: M(x - 12, y - hgt + 10) + L(x - 12, y - 10) + M(x + 12, y - hgt + 10) + L(x + 12, y - 10),
      stroke: darken(stone, 0.15),
      'stroke-width': 3,
    }) +
    (broken
      ? h('path', {
          d:
            M(x - 30, y - hgt) +
            L(x - 10, y - hgt - 20) +
            L(x + 8, y - hgt - 6) +
            L(x + 30, y - hgt - 24) +
            L(x + 30, y - hgt) +
            'Z',
          fill: stone,
          stroke: line,
          'stroke-width': 3,
        })
      : h('path', {
          d: roundRectD(x - 44, y - hgt - 24, 88, 24, 4),
          fill: stone,
          stroke: line,
          'stroke-width': 3,
        }));
  // a ruined arch on the left with ivy
  out += column(150, 780, 360, false) + column(390, 780, 300, true);
  out += h('path', {
    d: M(106, 396) + Q(260, 300, 434, 410) + L(434, 440) + Q(260, 340, 106, 430) + 'Z',
    fill: stone,
    stroke: line,
    'stroke-width': 3,
  });
  for (let i = 0; i < 9; i++) {
    const y = 420 + i * 40;
    out += h('circle', { cx: 150 + (i % 2) * 14 - 7, cy: y, r: 16, fill: '#93a83a', opacity: 0.9 });
  }
  // the riddle door with gears (the golem's workshop) on the right
  const dx = 1300;
  const dy = 780;
  out += h('path', {
    d:
      M(dx - 170, dy) +
      L(dx - 170, dy - 260) +
      Q(dx, dy - 400, dx + 170, dy - 260) +
      L(dx + 170, dy) +
      'Z',
    fill: stone,
    stroke: line,
    'stroke-width': 4,
  });
  out += h('path', {
    d:
      M(dx - 110, dy) +
      L(dx - 110, dy - 220) +
      Q(dx, dy - 310, dx + 110, dy - 220) +
      L(dx + 110, dy) +
      'Z',
    fill: '#8a6a4a',
    stroke: '#5a4a2a',
    'stroke-width': 4,
  });
  const gearAt = (x: number, y: number, rad: number): string => {
    const pts = [];
    for (let i = 0; i < 40; i++) pts.push(polar(x, y, i % 4 < 2 ? rad : rad * 0.8, i * 9));
    return (
      h('path', { d: polyD(pts), fill: '#c9a06a', stroke: '#6b4a2e', 'stroke-width': 3 }) +
      h('circle', {
        cx: x,
        cy: y,
        r: rad * 0.3,
        fill: '#8a6a4a',
        stroke: '#6b4a2e',
        'stroke-width': 3,
      })
    );
  };
  out +=
    gearAt(dx - 40, dy - 170, 46) + gearAt(dx + 36, dy - 120, 34) + gearAt(dx - 10, dy - 70, 26);
  out += h('path', {
    d: roundStarD(dx, dy - 300, 5, 22, 10, -90, 0.2),
    fill: '#ffd23f',
    stroke: '#8a5a00',
    'stroke-width': 3,
  });
  out += h('path', {
    d: ridgeD(r, 800, 26, 6),
    fill: linear(defs, 'ground', [
      [0, '#b8c86a'],
      [1, '#8a9a3a'],
    ]),
  });
  // stone tiles path and fallen pieces
  for (let i = 0; i < 9; i++) {
    const x = 520 + i * 70;
    const y = 900 + (i % 2) * 14;
    out += h('path', {
      d: roundRectD(x, y, 58, 30, 6),
      fill: lighten(stone, 0.1),
      stroke: line,
      'stroke-width': 2.5,
    });
  }
  out += h(
    'g',
    { transform: 'rotate(-12 600 870)' },
    h('path', {
      d: roundRectD(520, 850, 160, 50, 10),
      fill: stone,
      stroke: line,
      'stroke-width': 3,
    }),
  );
  out +=
    roundTree(1530, 830, 260, '#7cae4a') +
    bush(80, 900, 60, '#7cae4a', '#ffffff') +
    bush(980, 930, 46, '#8fbf5a', '#ffd23f');
  out += meadowDetails(r, 0, 1600, 830, 995, 90, ['#ffffff', '#ffd23f', '#b98cff'], '#6b7a2a');
  return out + vignette(defs, '#3a2a1a', 0.2);
}

export function dragonCastle(defs: Defs): string {
  const r = rng('dragon-castle');
  let out = sky(defs, '#8db3ff', '#ffe2c8', 0.62);
  out += sun(defs, 300, 220, 58, '#fff0c4');
  out += cloud(760, 160, 50) + cloud(1420, 300, 36) + cloud(540, 300, 28);
  // little dragons gliding around the towers
  const tiny = (x: number, y: number, c: string): string =>
    h('path', {
      d:
        M(x - 18, y) +
        Q(x - 10, y - 14, x, y - 2) +
        Q(x + 10, y - 14, x + 18, y) +
        Q(x, y + 6, x - 18, y) +
        'Z',
      fill: c,
      stroke: darken(c, 0.4),
      'stroke-width': 2,
    });
  out += tiny(1000, 250, '#ff6a3d') + tiny(1460, 180, '#45aef5') + tiny(880, 320, '#ffd84a');
  out += hills(defs, 'far', r, 640, 90, 7, '#b6c8e8', '#a8bde0');
  // the castle hill
  out += h('path', {
    d:
      M(860, 760) +
      C(980, 560, 1100, 500, 1210, 500) +
      C(1320, 500, 1440, 560, 1600, 680) +
      L(1600, 800) +
      L(860, 800) +
      'Z',
    fill: linear(defs, 'hill', [
      [0, '#9fd46a'],
      [1, '#6fb84f'],
    ]),
  });
  out += castle(1220, 520, 260);
  out += h('path', {
    d: M(940, 800) + C(1040, 740, 1080, 640, 1180, 560),
    fill: 'none',
    stroke: '#e8c99a',
    'stroke-width': 22,
    'stroke-linecap': 'round',
  });
  for (let i = 0; i < 6; i++)
    out += pine(900 + i * 40 + r() * 10, 760 - i * 22, 80, '#3f8a4c', false);
  out += hills(defs, 'mid', r, 800, 50, 6, '#8fcf6a', '#62ad4c');
  out += cottage(300, 800, 60) + cottage(380, 806, 50, '#e0663f') + cottage(220, 812, 46);
  out += h('path', {
    d: ridgeD(r, 880, 22, 6),
    fill: linear(defs, 'garden', [
      [0, '#7cc25a'],
      [1, '#4f9a3f'],
    ]),
  });
  // castle garden hedges and royal flowers in the foreground
  out +=
    bush(80, 930, 70, '#3f8a4c', '#d93a57') +
    bush(1520, 930, 76, '#3f8a4c', '#ffffff') +
    bush(200, 960, 44, '#4f9a5a', '#ffd23f');
  for (let i = 0; i < 12; i++)
    out += flower(
      140 + i * 120 + r() * 30,
      940 + r() * 30,
      10,
      5,
      ['#d93a57', '#ffd23f', '#ffffff'][i % 3]!,
      '#ffd23f',
      '#6b2440',
      1.5,
    );
  out += meadowDetails(r, 0, 1600, 890, 995, 60, ['#ffffff', '#ffd23f', '#ff9fbf'], '#4f9a3f');
  return out + vignette(defs, '#2a1b45', 0.18);
}

/** Where the Magic Window renderer sits in the castle hall (600 x 872 window art). */
export const HALL_WINDOW = { x: 532, y: 84, width: 536, height: 779 };

export function castleHall(defs: Defs): string {
  const r = rng('castle-hall');
  const stone = '#e8dcc0';
  let out = h('rect', {
    x: 0,
    y: 0,
    width: SW,
    height: SH,
    fill: linear(defs, 'wall', [
      [0, '#d8c8a8'],
      [0.7, '#e8dcc0'],
      [1, '#c9b48f'],
    ]),
  });
  // stone blocks
  let blocks = '';
  for (let row = 0; row < 16; row++) {
    const y = row * 50;
    const off = row % 2 ? 0 : 60;
    for (let x = -off; x < SW; x += 120) blocks += M(x, y) + L(x, y + 50) + M(x, y) + L(x + 120, y);
  }
  out += h('path', { d: blocks, stroke: '#c9b48f', 'stroke-width': 3, opacity: 0.6 });
  // vaulted arches on both sides
  for (const x of [250, 1350]) {
    out += h('path', {
      d: M(x - 170, 820) + L(x - 170, 330) + Q(x, 120, x + 170, 330) + L(x + 170, 820) + 'Z',
      fill: '#cdbb95',
      stroke: '#9a8a6a',
      'stroke-width': 5,
    });
    out += h('path', {
      d: M(x - 120, 820) + L(x - 120, 360) + Q(x, 200, x + 120, 360) + L(x + 120, 820) + 'Z',
      fill: '#4a3f63',
      opacity: 0.25,
    });
  }
  // the window niche (the Magic Window art is placed over it)
  const w = HALL_WINDOW;
  out += h('path', {
    d:
      M(w.x - 40, w.y + w.height + 10) +
      L(w.x - 40, w.y + 260) +
      Q(w.x + w.width / 2, w.y - 120, w.x + w.width + 40, w.y + 260) +
      L(w.x + w.width + 40, w.y + w.height + 10) +
      'Z',
    fill: '#4a3f63',
    opacity: 0.35,
  });
  out += lightRays(defs, 800, 700, 420, 9, '#fff3b0', 5, 90);
  // pillars
  for (const x of [470, 1130]) {
    out += h('path', {
      d: roundRectD(x - 34, 120, 68, 760, 6),
      fill: linear(
        defs,
        `pillar${x}`,
        [
          [0, '#f6ecd8'],
          [1, '#c9b48f'],
        ],
        false,
      ),
      stroke: '#9a8a6a',
      'stroke-width': 4,
    });
    out += h('path', {
      d: roundRectD(x - 50, 96, 100, 34, 6) + roundRectD(x - 50, 866, 100, 34, 6),
      fill: stone,
      stroke: '#9a8a6a',
      'stroke-width': 4,
    });
  }
  // banners with dragon emblems (no text)
  const banner = (x: number, c: string, emblem: string): string =>
    h('path', {
      d: M(x - 70, 150) + L(x + 70, 150) + L(x + 70, 470) + L(x, 430) + L(x - 70, 470) + 'Z',
      fill: c,
      stroke: darken(c, 0.4),
      'stroke-width': 4,
    }) +
    h('path', {
      d: M(x - 80, 150) + L(x + 80, 150),
      stroke: '#c9973e',
      'stroke-width': 10,
      'stroke-linecap': 'round',
    }) +
    h('circle', {
      cx: x,
      cy: 280,
      r: 44,
      fill: lighten(c, 0.2),
      stroke: '#ffd23f',
      'stroke-width': 5,
    }) +
    emblem;
  out += banner(
    250,
    '#d93a57',
    h('path', {
      d: roundStarD(250, 282, 5, 30, 14, -90, 0.2),
      fill: '#ffd23f',
      stroke: '#8a5a00',
      'stroke-width': 3,
    }),
  );
  out += banner(
    1350,
    '#5b4fd6',
    h('path', {
      d:
        M(1350, 250) +
        C(1330, 270, 1326, 300, 1350, 316) +
        C(1374, 300, 1370, 270, 1350, 250) +
        'Z',
      fill: '#ffd23f',
      stroke: '#8a5a00',
      'stroke-width': 3,
    }) +
      h('path', {
        d: M(1320, 300) + Q(1350, 280, 1380, 300),
        fill: 'none',
        stroke: '#ffd23f',
        'stroke-width': 6,
        'stroke-linecap': 'round',
      }),
  );
  // candle sconces with a warm glow
  for (const x of [470, 1130]) {
    out += h('circle', {
      cx: x,
      cy: 520,
      r: 90,
      fill: radial(defs, `candle${x}`, [
        [0, '#ffd36b', 0.55],
        [1, '#ffd36b', 0],
      ]),
    });
    out +=
      h('path', {
        d: roundRectD(x - 10, 520, 20, 40, 4),
        fill: '#fff6e0',
        stroke: '#c9973e',
        'stroke-width': 3,
      }) +
      h('path', {
        d: M(x, 520) + Q(x - 9, 504, x, 488) + Q(x + 9, 504, x, 520) + 'Z',
        fill: '#ffb31f',
      });
  }
  // floor and the royal carpet to the window
  out += h('path', {
    d: M(0, 860) + L(1600, 860) + L(1600, 1000) + L(0, 1000) + 'Z',
    fill: linear(defs, 'floor', [
      [0, '#b8a07a'],
      [1, '#8a7452'],
    ]),
  });
  let tiles = '';
  for (let x = -40; x < SW; x += 80) tiles += M(x, 860) + L(x - (x - 800) * 0.35, 1000);
  out += h('path', {
    d: tiles + M(0, 910) + L(1600, 910) + M(0, 965) + L(1600, 965),
    stroke: '#7a6442',
    'stroke-width': 2.5,
    opacity: 0.6,
  });
  out += h('path', {
    d: M(700, 860) + L(900, 860) + L(1010, 1000) + L(590, 1000) + 'Z',
    fill: linear(defs, 'carpet', [
      [0, '#c9324f'],
      [1, '#a8203e'],
    ]),
  });
  out += h('path', {
    d: M(712, 862) + L(604, 1000) + M(888, 862) + L(996, 1000),
    stroke: '#ffd23f',
    'stroke-width': 6,
  });
  for (let i = 0; i < 12; i++)
    out += h('path', {
      d: sparkleD(560 + r() * 480, 120 + r() * 700, 3 + r() * 4),
      fill: '#fff6cc',
      opacity: 0.8,
    });
  return out + vignette(defs, '#2a1b45', 0.32);
}
