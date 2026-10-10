/**
 * Region scenes, part 4: the second-grade Lower Valley regions (docs/grades-plan.md section 3),
 * Hundred Hills and Market Square. Same composition rule as parts 1-3: calm sky and far scenery
 * in the centre-top UI area, the near ground around y = 780, the dragon's spot left of centre and
 * the boss's spot right of centre, detail framing the edges.
 */
import { M, L, Q, C, roundRectD } from '../svg/path';
import { h } from '../svg/xml';
import { rng } from '../svg/prng';
import { darken, lighten, outlineOf } from '../svg/color';
import {
  bush,
  castle,
  cloud,
  fence,
  hills,
  linear,
  meadowDetails,
  ridgeD,
  roundTree,
  sky,
  sun,
  tuft,
  vignette,
  type Defs,
} from './kit';

const FLOWERS = ['#ffffff', '#ffd23f', '#ff9fbf', '#8fd3f4', '#ff7a59'];
const FLAGS = ['#e8423f', '#ffb31f', '#3f8fd9', '#8a5ad9', '#3aa65b'];

/** A round dome hill standing on y (centre x, width w, height hgt) with a soft sunny crown. */
export function domeHill(x: number, y: number, w: number, hgt: number, color: string): string {
  return (
    h('path', {
      d:
        M(x - w / 2, y) +
        C(x - w * 0.4, y - hgt * 1.32, x + w * 0.4, y - hgt * 1.32, x + w / 2, y) +
        'Z',
      fill: color,
      stroke: darken(color, 0.22),
      'stroke-width': 3,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d:
        M(x - w * 0.3, y - hgt * 0.62) +
        Q(x - w * 0.12, y - hgt * 0.98, x + w * 0.1, y - hgt * 0.96),
      fill: 'none',
      stroke: lighten(color, 0.35),
      'stroke-width': Math.max(4, w * 0.05),
      'stroke-linecap': 'round',
      opacity: 0.8,
    })
  );
}

/** A little pennant on a pole (pole foot at x, y). */
export function pennant(x: number, y: number, s: number, color: string): string {
  return (
    h('path', {
      d: M(x, y) + L(x, y - s),
      stroke: '#6b4a2e',
      'stroke-width': Math.max(2, s * 0.08),
      'stroke-linecap': 'round',
    }) +
    h('path', {
      d:
        M(x, y - s) +
        Q(x + s * 0.3, y - s * 0.92, x + s * 0.55, y - s * 0.82) +
        L(x, y - s * 0.6) +
        'Z',
      fill: color,
      stroke: outlineOf(color, 0.5),
      'stroke-width': Math.max(1.5, s * 0.05),
      'stroke-linejoin': 'round',
    })
  );
}

/** Ten sticks standing tied in one bundle with a ribbon (foot at x, y; height s). */
export function stickSheaf(x: number, y: number, s: number, ribbon = '#e0533a'): string {
  const w = s * 0.07;
  let sticks = '';
  for (let i = 0; i < 10; i++) {
    const off = (i - 4.5) * w * 0.95;
    const a = (i - 4.5) * 2.4;
    sticks += h('path', {
      d: roundRectD(x + off - w / 2, y - s, w, s, w / 2),
      fill: i % 2 ? '#d9a45a' : '#e8b86e',
      stroke: '#8a5a2e',
      'stroke-width': 2,
      transform: `rotate(${a.toFixed(1)} ${(x + off).toFixed(1)} ${(y - s * 0.5).toFixed(1)})`,
    });
  }
  return (
    h('ellipse', { cx: x, cy: y + 2, rx: s * 0.5, ry: s * 0.07, fill: '#2a2140', opacity: 0.14 }) +
    sticks +
    h('path', {
      d: roundRectD(x - w * 5.4, y - s * 0.56, w * 10.8, s * 0.1, s * 0.04),
      fill: ribbon,
      stroke: outlineOf(ribbon, 0.5),
      'stroke-width': 2.5,
    }) +
    h('path', {
      d:
        M(x, y - s * 0.51) +
        Q(x - s * 0.18, y - s * 0.7, x - s * 0.2, y - s * 0.56) +
        Q(x - s * 0.14, y - s * 0.46, x, y - s * 0.51) +
        Q(x + s * 0.18, y - s * 0.7, x + s * 0.2, y - s * 0.56) +
        Q(x + s * 0.14, y - s * 0.46, x, y - s * 0.51) +
        'Z',
      fill: ribbon,
      stroke: outlineOf(ribbon, 0.5),
      'stroke-width': 2,
    })
  );
}

/** A diamond kite with a ribbon tail of bows. */
function kite(x: number, y: number, s: number): string {
  const tail =
    M(x, y + s) + C(x - s * 0.5, y + s * 1.6, x + s * 0.6, y + s * 2.1, x - s * 0.2, y + s * 2.8);
  return (
    h('path', { d: tail, fill: 'none', stroke: '#6b4a2e', 'stroke-width': 2.5 }) +
    [
      [x - s * 0.12, y + s * 1.55, '#ffd23f'],
      [x + s * 0.12, y + s * 2.05, '#3f8fd9'],
      [x - s * 0.1, y + s * 2.55, '#e8423f'],
    ]
      .map(([bx, by, c]) =>
        h('path', {
          d:
            M(bx as number, by as number) +
            L((bx as number) - s * 0.16, (by as number) - s * 0.1) +
            L((bx as number) - s * 0.16, (by as number) + s * 0.1) +
            'Z' +
            M(bx as number, by as number) +
            L((bx as number) + s * 0.16, (by as number) - s * 0.1) +
            L((bx as number) + s * 0.16, (by as number) + s * 0.1) +
            'Z',
          fill: c as string,
          stroke: outlineOf(c as string, 0.5),
          'stroke-width': 1.5,
        }),
      )
      .join('') +
    h('path', {
      d: M(x, y - s) + L(x + s * 0.62, y) + L(x, y + s) + L(x - s * 0.62, y) + 'Z',
      fill: '#ff8a5c',
      stroke: '#b8452a',
      'stroke-width': 3,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d:
        M(x, y - s) +
        L(x + s * 0.62, y) +
        L(x, y) +
        'Z' +
        M(x, y + s) +
        L(x - s * 0.62, y) +
        L(x, y) +
        'Z',
      fill: '#ffd23f',
      opacity: 0.85,
    }) +
    h('path', {
      d: M(x, y - s) + L(x, y + s) + M(x - s * 0.62, y) + L(x + s * 0.62, y),
      stroke: '#b8452a',
      'stroke-width': 2,
      opacity: 0.6,
    })
  );
}

/**
 * Hundred Hills: rows and rows of round green hills to count, little flags on the far ten, a
 * path winding up to a small castle, and bundles of ten sticks waiting on the near meadow.
 */
export function hundredHills(defs: Defs): string {
  const r = rng('hundred-hills');
  let out = sky(defs, '#9fd8ff', '#f4fbff', 0.62);
  out += sun(defs, 1310, 140, 56);
  out += cloud(300, 150, 50) + cloud(1000, 104, 40) + cloud(640, 230, 26);
  out += kite(1480, 250, 44);
  // the far ten: a row of ten round blue-green hills, each with a pennant
  out += hills(defs, 'far', r, 600, 40, 8, '#cfe9d4', '#b6dcc0');
  for (let i = 0; i < 10; i++) {
    const x = 60 + i * 164;
    const hgt = 70 + ((i * 37) % 3) * 14;
    out += domeHill(x, 612, 190, hgt, ['#a9d8b4', '#9ccfa9', '#b4dfbd'][i % 3]!);
    out += pennant(x, 612 - hgt * 0.98, 34, FLAGS[i % FLAGS.length]!);
  }
  // a small castle on the far hill where the road ends
  out += castle(820, 560, 54, '#ffb31f');
  // mid rows of rounder, greener hills
  for (let i = 0; i < 9; i++) {
    const x = -20 + i * 205;
    out += domeHill(x, 700, 250, 84 + (i % 2) * 18, ['#8fd06c', '#9fd87a', '#86c864'][i % 3]!);
  }
  for (const [x, y, s, c] of [
    [180, 660, 90, '#5aa54a'],
    [1430, 664, 96, '#6fbf4f'],
    [1060, 690, 70, '#5aa54a'],
  ] as const)
    out += roundTree(x, y, s, c, true, x > 1000 ? '#e8423f' : undefined);
  // the path climbing over the hills towards the castle
  const path =
    M(700, 1010) +
    C(740, 900, 900, 860, 860, 780) +
    C(830, 720, 760, 700, 800, 640) +
    C(820, 610, 820, 590, 820, 566);
  out +=
    h('path', {
      d: path,
      fill: 'none',
      stroke: '#d9b77a',
      'stroke-width': 54,
      'stroke-linecap': 'round',
      opacity: 0.9,
    }) +
    h('path', {
      d: path,
      fill: 'none',
      stroke: '#ead2a0',
      'stroke-width': 36,
      'stroke-linecap': 'round',
    });
  // near meadow
  out += h('path', {
    d: ridgeD(r, 800, 30, 7),
    fill: linear(defs, 'meadow', [
      [0, '#8fd46a'],
      [1, '#5fae4c'],
    ]),
  });
  out += h('path', {
    d: M(760, 1010) + C(800, 920, 880, 880, 870, 810),
    fill: 'none',
    stroke: '#ead2a0',
    'stroke-width': 40,
    'stroke-linecap': 'round',
  });
  // bundles of ten sticks on the near meadow (left and right edges), a few loose ones
  out += stickSheaf(120, 870, 120) + stickSheaf(230, 900, 96, '#3f8fd9');
  out += stickSheaf(1380, 880, 110, '#ffb31f') + stickSheaf(1500, 900, 128);
  for (const [x, y, a] of [
    [300, 930, -12],
    [330, 940, 6],
    [1290, 940, 14],
  ] as const)
    out += h('path', {
      d: roundRectD(x, y - 8, 72, 8, 4),
      fill: '#e8b86e',
      stroke: '#8a5a2e',
      'stroke-width': 2,
      transform: `rotate(${a} ${x} ${y})`,
    });
  out += fence(-20, 70, 820, 40) + fence(1530, 1620, 820, 40);
  out += bush(40, 960, 50, '#6fbf4f', '#ffffff') + bush(1570, 970, 54, '#5aa54a', '#ffd23f');
  out +=
    tuft(560, 880, 18, '#4f9a3f') + tuft(1080, 890, 16, '#4f9a3f') + tuft(980, 960, 14, '#4f9a3f');
  out += meadowDetails(r, 0, 1600, 860, 995, 60, FLOWERS, '#4f9a3f');
  return out + vignette(defs, '#1f3a2a', 0.15);
}

/** A tall Czech town house with a curved gable (foot centre x, y). */
function townHouse(
  x: number,
  y: number,
  w: number,
  hgt: number,
  wall: string,
  roof: string,
): string {
  const top = y - hgt;
  const gable =
    M(x - w / 2, top + w * 0.22) +
    Q(x - w / 2, top, x - w * 0.26, top - w * 0.02) +
    Q(x - w * 0.2, top - w * 0.34, x, top - w * 0.44) +
    Q(x + w * 0.2, top - w * 0.34, x + w * 0.26, top - w * 0.02) +
    Q(x + w / 2, top, x + w / 2, top + w * 0.22) +
    'Z';
  let windows = '';
  const cols = w > 120 ? 3 : 2;
  const rows = Math.max(1, Math.floor((hgt - w * 0.5) / (w * 0.36)));
  for (let rI = 0; rI < rows; rI++)
    for (let c = 0; c < cols; c++) {
      const wx = x - w / 2 + (w * (c + 0.5)) / cols;
      const wy = top + w * 0.26 + rI * w * 0.36;
      windows +=
        h('path', {
          d: roundRectD(wx - w * 0.07, wy, w * 0.14, w * 0.2, w * 0.05),
          fill: '#9fd0ff',
          stroke: outlineOf(wall, 0.45),
          'stroke-width': 2.5,
        }) +
        h('path', {
          d: roundRectD(wx - w * 0.1, wy + w * 0.2, w * 0.2, w * 0.04, 2),
          fill: '#ff8fa8',
          stroke: outlineOf(wall, 0.45),
          'stroke-width': 1.5,
        });
    }
  return (
    h('path', {
      d: roundRectD(x - w / 2, top + w * 0.1, w, hgt - w * 0.1, 4),
      fill: wall,
      stroke: outlineOf(wall, 0.45),
      'stroke-width': 3,
    }) +
    h('path', {
      d: gable,
      fill: wall,
      stroke: outlineOf(wall, 0.45),
      'stroke-width': 3,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d: M(x - w * 0.3, top + w * 0.02) + Q(x, top - w * 0.5, x + w * 0.3, top + w * 0.02),
      fill: 'none',
      stroke: roof,
      'stroke-width': w * 0.06,
      'stroke-linecap': 'round',
    }) +
    h('circle', {
      cx: x,
      cy: top - w * 0.12,
      r: w * 0.07,
      fill: '#fff6e6',
      stroke: outlineOf(wall, 0.45),
      'stroke-width': 2,
    }) +
    windows +
    h('path', {
      d:
        M(x - w * 0.12, y) +
        L(x - w * 0.12, y - w * 0.26) +
        Q(x, y - w * 0.38, x + w * 0.12, y - w * 0.26) +
        L(x + w * 0.12, y) +
        'Z',
      fill: '#a8743a',
      stroke: '#6b4a2e',
      'stroke-width': 2.5,
    })
  );
}

/** A market stall seen from the front with a striped scalloped awning and goods on the counter. */
export function marketStall(
  x: number,
  y: number,
  s: number,
  awning: string,
  goods: 'fruit' | 'bread' | 'veg',
): string {
  const w = s;
  const ah = s * 0.24;
  const top = y - s * 0.95;
  let stripes = '';
  const n = 6;
  for (let i = 0; i < n; i++)
    stripes += h('path', {
      d: roundRectD(x - w / 2 + (i * w) / n, top, w / n, ah, 0),
      fill: i % 2 ? '#fffaf0' : awning,
    });
  let scallops = M(x - w / 2, top + ah);
  for (let i = 0; i < n; i++) {
    const x0 = x - w / 2 + (i * w) / n;
    scallops += Q(x0 + w / n / 2, top + ah + s * 0.1, x0 + w / n, top + ah);
  }
  let items = '';
  const cy = y - s * 0.44;
  for (let i = 0; i < 7; i++) {
    const ix = x - w * 0.36 + i * w * 0.12;
    if (goods === 'fruit')
      items += h('circle', {
        cx: ix,
        cy: cy - (i % 2) * s * 0.03,
        r: s * 0.05,
        fill: ['#e8423f', '#ffb31f', '#7fc65a', '#b98cff'][i % 4]!,
        stroke: '#7a3a2a',
        'stroke-width': 1.5,
      });
    else if (goods === 'bread')
      items += h('ellipse', {
        cx: ix,
        cy,
        rx: s * 0.055,
        ry: s * 0.035,
        fill: '#e0a050',
        stroke: '#8a5a2e',
        'stroke-width': 1.5,
      });
    else
      items += h('path', {
        d:
          M(ix, cy + s * 0.04) +
          Q(ix - s * 0.05, cy - s * 0.02, ix, cy - s * 0.05) +
          Q(ix + s * 0.05, cy - s * 0.02, ix, cy + s * 0.04) +
          'Z',
        fill: i % 2 ? '#ff8a3d' : '#c9573f',
        stroke: '#7a3a2a',
        'stroke-width': 1.5,
      });
  }
  return (
    h('ellipse', { cx: x, cy: y + 4, rx: w * 0.56, ry: s * 0.06, fill: '#2a2140', opacity: 0.14 }) +
    h('path', {
      d: roundRectD(x - w * 0.46, top + ah, w * 0.05, y - top - ah, 3),
      fill: '#c98a4a',
      stroke: '#7a5530',
      'stroke-width': 2.5,
    }) +
    h('path', {
      d: roundRectD(x + w * 0.41, top + ah, w * 0.05, y - top - ah, 3),
      fill: '#c98a4a',
      stroke: '#7a5530',
      'stroke-width': 2.5,
    }) +
    h('path', {
      d: roundRectD(x - w * 0.48, y - s * 0.42, w * 0.96, s * 0.42, 5),
      fill: '#e8c48e',
      stroke: '#7a5530',
      'stroke-width': 3,
    }) +
    h('path', {
      d: M(x - w * 0.44, y - s * 0.22) + L(x + w * 0.44, y - s * 0.22),
      stroke: '#c9a06a',
      'stroke-width': 3,
    }) +
    items +
    stripes +
    h('path', {
      d: scallops + L(x + w / 2, top) + L(x - w / 2, top) + 'Z',
      fill: 'none',
      stroke: outlineOf(awning, 0.5),
      'stroke-width': 3,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d: scallops + L(x + w / 2, top + ah) + 'Z',
      fill: awning,
      stroke: outlineOf(awning, 0.5),
      'stroke-width': 2.5,
    })
  );
}

function basket(x: number, y: number, s: number, fruit: string): string {
  let apples = '';
  for (const [dx, dy] of [
    [-0.28, -0.34],
    [0, -0.42],
    [0.28, -0.34],
    [-0.14, -0.5],
    [0.14, -0.52],
  ] as const)
    apples += h('circle', {
      cx: x + dx * s,
      cy: y + dy * s,
      r: s * 0.17,
      fill: fruit,
      stroke: darken(fruit, 0.4),
      'stroke-width': 2,
    });
  return (
    h('ellipse', { cx: x, cy: y + 2, rx: s * 0.55, ry: s * 0.1, fill: '#2a2140', opacity: 0.14 }) +
    apples +
    h('path', {
      d:
        M(x - s * 0.5, y - s * 0.32) +
        L(x + s * 0.5, y - s * 0.32) +
        L(x + s * 0.38, y) +
        L(x - s * 0.38, y) +
        'Z',
      fill: '#d9a45a',
      stroke: '#8a5a2e',
      'stroke-width': 2.5,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d:
        M(x - s * 0.44, y - s * 0.2) +
        L(x + s * 0.44, y - s * 0.2) +
        M(x - s * 0.41, y - s * 0.1) +
        L(x + s * 0.41, y - s * 0.1),
      stroke: '#a8743a',
      'stroke-width': 2,
    })
  );
}

/**
 * Market Square: a cobbled town square in front of a row of colourful gabled houses, striped
 * market stalls with fruit, bread and vegetables, a stone well in the middle and baskets of
 * apples to count on the cobbles.
 */
export function marketSquare(defs: Defs): string {
  const r = rng('market-square');
  let out = sky(defs, '#a8dcff', '#fff6e4', 0.6);
  out += sun(defs, 1280, 150, 54);
  out += cloud(340, 140, 48) + cloud(960, 100, 38) + cloud(660, 220, 24);
  out += hills(defs, 'far', r, 600, 50, 6, '#bfe3c4', '#a6d4ae');
  for (const [x, s, c] of [
    [520, 110, '#6fbf4f'],
    [1080, 100, '#5aa54a'],
  ] as const)
    out += roundTree(x, 600, s, c);
  // the row of town houses: tall at the edges, lower in the middle (calm centre-top for the UI)
  const walls = ['#ffcf6b', '#ff9f80', '#9fd0ff', '#c8a8ff', '#a8e08c', '#ffd8e4', '#ffe9a8'];
  const roofs = ['#d9533a', '#b84a32', '#3f8fd9', '#8a5ad9', '#3aa65b', '#e0533a', '#c9784e'];
  const houses: Array<[number, number, number]> = [
    [40, 150, 360],
    [190, 140, 300],
    [330, 130, 230],
    [460, 120, 170],
    [1140, 120, 170],
    [1270, 130, 230],
    [1410, 140, 300],
    [1560, 150, 360],
  ];
  houses.forEach(([x, w, hgt], i) => {
    out += townHouse(x, 700, w, hgt, walls[i % walls.length]!, roofs[i % roofs.length]!);
  });
  // low town wall and a little church tower far in the middle
  out += h('path', {
    d: roundRectD(520, 640, 560, 60, 6),
    fill: '#efe2c6',
    stroke: '#b8a27a',
    'stroke-width': 3,
  });
  out += h('path', {
    d: roundRectD(760, 520, 80, 130, 6),
    fill: '#fff6e6',
    stroke: '#b8a27a',
    'stroke-width': 3,
  });
  out += h('path', {
    d: M(748, 524) + L(800, 450) + L(852, 524) + 'Z',
    fill: '#3aa65b',
    stroke: '#2f6b2a',
    'stroke-width': 3,
    'stroke-linejoin': 'round',
  });
  out += h('circle', {
    cx: 800,
    cy: 566,
    r: 18,
    fill: '#fffaf0',
    stroke: '#b8a27a',
    'stroke-width': 3,
  });
  out += h('path', {
    d: M(800, 566) + L(800, 554) + M(800, 566) + L(810, 570),
    stroke: '#6b4a2e',
    'stroke-width': 3,
    'stroke-linecap': 'round',
  });
  // bunting between the edge houses
  for (const [x0, x1, y0] of [
    [40, 330, 470],
    [1270, 1560, 470],
  ] as const) {
    const mid = (x0 + x1) / 2;
    out += h('path', {
      d: M(x0, y0) + Q(mid, y0 + 70, x1, y0),
      fill: 'none',
      stroke: '#8a6a4a',
      'stroke-width': 2.5,
    });
    for (let i = 1; i < 9; i++) {
      const t = i / 9;
      const fx = x0 + (x1 - x0) * t;
      const fy = y0 + 70 * 2 * t * (1 - t);
      out += h('path', {
        d: M(fx - 11, fy) + L(fx + 11, fy) + L(fx, fy + 22) + 'Z',
        fill: FLAGS[i % FLAGS.length]!,
        stroke: '#6b4a2e',
        'stroke-width': 1.5,
        'stroke-linejoin': 'round',
      });
    }
  }
  // the cobbled square
  out += h('path', {
    d: M(-20, 700) + L(1620, 700) + L(1620, 1010) + L(-20, 1010) + 'Z',
    fill: linear(defs, 'cobbles', [
      [0, '#e3d3b4'],
      [1, '#cdb994'],
    ]),
  });
  let cobbles = '';
  for (let row = 0; row < 14; row++) {
    const y = 712 + row * row * 1.1 + row * 12;
    const rh = 4 + row * 0.9;
    const step = 22 + row * 5;
    for (let x = -10 + (row % 2) * step * 0.5; x < 1620; x += step) {
      if (r() < 0.35) continue;
      cobbles += h('ellipse', {
        cx: x + r() * 6,
        cy: y,
        rx: step * 0.36,
        ry: rh,
        fill: r() < 0.5 ? '#d8c6a2' : '#ecdcbc',
        stroke: '#b8a27a',
        'stroke-width': 1.2,
      });
    }
  }
  out += cobbles;
  // stalls: two big ones framing the edges, two small ones further back
  out +=
    marketStall(600, 740, 150, '#3f8fd9', 'bread') + marketStall(1000, 740, 150, '#ffb31f', 'veg');
  out +=
    marketStall(130, 880, 250, '#e8423f', 'fruit') +
    marketStall(1480, 890, 250, '#3aa65b', 'bread');
  // the stone well in the middle of the square
  out +=
    h('ellipse', { cx: 800, cy: 774, rx: 74, ry: 14, fill: '#2a2140', opacity: 0.14 }) +
    h('path', {
      d: roundRectD(736, 714, 128, 58, 12),
      fill: '#cfc6d8',
      stroke: '#6f6a7f',
      'stroke-width': 3,
    }) +
    h('path', {
      d:
        M(744, 734) +
        L(856, 734) +
        M(760, 714) +
        L(760, 772) +
        M(800, 734) +
        L(800, 772) +
        M(840, 714) +
        L(840, 772),
      stroke: '#a8a2b8',
      'stroke-width': 2,
    }) +
    h('path', {
      d: M(748, 714) + L(748, 650) + M(852, 714) + L(852, 650),
      stroke: '#8a5a2e',
      'stroke-width': 7,
      'stroke-linecap': 'round',
    }) +
    h('path', {
      d: M(730, 660) + L(800, 620) + L(870, 660) + 'Z',
      fill: '#d9533a',
      stroke: '#8a2a1a',
      'stroke-width': 3,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d: roundRectD(788, 670, 24, 24, 5),
      fill: '#c98a4a',
      stroke: '#6b4a2e',
      'stroke-width': 2.5,
    });
  // baskets of apples and flower pots on the cobbles
  out +=
    basket(320, 930, 70, '#e8423f') +
    basket(1240, 940, 66, '#7fc65a') +
    basket(1310, 960, 54, '#ffb31f');
  for (const [x, y] of [
    [560, 900],
    [1080, 910],
  ] as const)
    out +=
      h('path', {
        d: M(x - 18, y - 30) + L(x + 18, y - 30) + L(x + 13, y) + L(x - 13, y) + 'Z',
        fill: '#c9784e',
        stroke: '#7a3a2a',
        'stroke-width': 2.5,
      }) + bush(x, y - 30, 24, '#5aa54a', '#ff9fbf');
  out += tuft(40, 990, 14, '#4f9a3f') + tuft(1580, 990, 14, '#4f9a3f');
  return out + vignette(defs, '#3a2a1a', 0.16);
}
