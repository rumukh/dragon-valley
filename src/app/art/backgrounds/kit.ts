/**
 * Storybook landscape kit for the background scenes (1600 x 1000 logical units).
 * Layers get lighter and bluer with distance; foreground objects carry thin hue-tinted outlines
 * like the characters, far layers carry none.
 */
import { polar, type Pt } from '../svg/num';
import { M, L, Q, C, polyD, smoothClosedD, smoothOpenD, roundRectD } from '../svg/path';
import { h } from '../svg/xml';
import { rng, type Rng } from '../svg/prng';
import { darken, lighten, outlineOf } from '../svg/color';
import { flower, sparkleD } from '../glyphs';

export const SW = 1600;
export const SH = 1000;

export interface Defs {
  list: string[];
  prefix: string;
  id(name: string): string;
}

export function makeDefs(prefix: string): Defs {
  const list: string[] = [];
  return { list, prefix, id: (name) => `${prefix}-${name}` };
}

export function linear(
  defs: Defs,
  name: string,
  stops: Array<[number, string, number?]>,
  vertical = true,
): string {
  const id = defs.id(name);
  defs.list.push(
    h(
      'linearGradient',
      { id, x1: 0, y1: 0, x2: vertical ? 0 : 1, y2: vertical ? 1 : 0 },
      ...stops.map(([o, c, a]) =>
        h('stop', { offset: String(o), 'stop-color': c, 'stop-opacity': a }),
      ),
    ),
  );
  return `url(#${id})`;
}

export function radial(defs: Defs, name: string, stops: Array<[number, string, number?]>): string {
  const id = defs.id(name);
  defs.list.push(
    h(
      'radialGradient',
      { id },
      ...stops.map(([o, c, a]) =>
        h('stop', { offset: String(o), 'stop-color': c, 'stop-opacity': a }),
      ),
    ),
  );
  return `url(#${id})`;
}

export function sky(defs: Defs, top: string, bottom: string, horizon = 0.75): string {
  return h('rect', {
    x: 0,
    y: 0,
    width: SW,
    height: SH,
    fill: linear(defs, 'sky', [
      [0, top],
      [horizon, bottom],
      [1, bottom],
    ]),
  });
}

export function sun(defs: Defs, x: number, y: number, r: number, color = '#fff3b0'): string {
  return (
    h('circle', {
      cx: x,
      cy: y,
      r: r * 3.2,
      fill: radial(defs, `sunglow-${x}`, [
        [0, color, 0.85],
        [0.35, color, 0.35],
        [1, color, 0],
      ]),
    }) + h('circle', { cx: x, cy: y, r, fill: color })
  );
}

/** Soft cloud: union of circles with a gently shaded bottom (no outline). */
export function cloud(
  x: number,
  y: number,
  s: number,
  color = '#ffffff',
  shade = '#dfe9fb',
): string {
  const parts = [
    [-0.9, 0.15, 0.42],
    [-0.4, -0.18, 0.55],
    [0.2, -0.28, 0.62],
    [0.75, -0.02, 0.48],
    [1.15, 0.2, 0.32],
  ];
  const circles = parts
    .map(([dx, dy, r]) => h('circle', { cx: x + dx! * s, cy: y + dy! * s, r: r! * s }))
    .join('');
  return h(
    'g',
    null,
    h('g', { fill: shade, transform: `translate(0 ${(s * 0.12).toFixed(1)})` }, circles),
    h('g', { fill: color }, circles),
    h('rect', {
      x: x - s * 1.25,
      y: y + s * 0.18,
      width: s * 2.65,
      height: s * 0.3,
      rx: s * 0.15,
      fill: shade,
    }),
  );
}

/** Rolling ridge from left to right, closed to the bottom of the scene. */
export function ridgeD(
  r: Rng,
  yBase: number,
  amp: number,
  bumps: number,
  x0 = -40,
  x1 = SW + 40,
  bottom = SH + 10,
): string {
  const pts: Pt[] = [];
  for (let i = 0; i <= bumps; i++) {
    const x = x0 + ((x1 - x0) * i) / bumps;
    const y = yBase - amp * (0.35 + 0.65 * r()) * (i % 2 === 0 ? 0.6 : 1);
    pts.push({ x, y });
  }
  return smoothOpenD(pts, 1) + L(x1, bottom) + L(x0, bottom) + 'Z';
}

export function hills(
  defs: Defs,
  name: string,
  r: Rng,
  yBase: number,
  amp: number,
  bumps: number,
  top: string,
  bottom: string,
  x0 = -40,
  x1 = SW + 40,
): string {
  return h('path', {
    d: ridgeD(r, yBase, amp, bumps, x0, x1),
    fill: linear(defs, name, [
      [0, top],
      [1, bottom],
    ]),
  });
}

/** Storybook pine: three stacked, slightly rounded tiers on a trunk. */
export function pine(
  x: number,
  y: number,
  hgt: number,
  color: string,
  outline = true,
  trunk = true,
): string {
  const w = hgt * 0.5;
  const line = outlineOf(color, 0.5);
  const tier = (top: number, base: number, half: number): string =>
    M(x, top) +
    Q(x + half * 0.3, top + (base - top) * 0.4, x + half, base) +
    Q(x, base + half * 0.12, x - half, base) +
    Q(x - half * 0.3, top + (base - top) * 0.4, x, top) +
    'Z';
  const d =
    tier(y - hgt, y - hgt * 0.55, w * 0.55) +
    tier(y - hgt * 0.78, y - hgt * 0.3, w * 0.78) +
    tier(y - hgt * 0.55, y - hgt * 0.08, w);
  return (
    (trunk
      ? h('rect', {
          x: x - hgt * 0.04,
          y: y - hgt * 0.12,
          width: hgt * 0.08,
          height: hgt * 0.14,
          fill: '#7a5230',
        })
      : '') +
    h('path', {
      d,
      fill: color,
      stroke: outline ? line : 'none',
      'stroke-width': outline ? Math.max(1.5, hgt * 0.02) : 0,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d:
        M(x - w * 0.15, y - hgt * 0.9) +
        Q(x - w * 0.35, y - hgt * 0.7, x - w * 0.5, y - hgt * 0.62),
      fill: 'none',
      stroke: lighten(color, 0.35),
      'stroke-width': Math.max(2, hgt * 0.025),
      'stroke-linecap': 'round',
      opacity: 0.7,
    })
  );
}

/** Round deciduous tree: trunk and a cloud-like canopy. */
export function roundTree(
  x: number,
  y: number,
  hgt: number,
  color: string,
  outline = true,
  fruit?: string,
): string {
  const r = hgt * 0.32;
  const cy = y - hgt * 0.62;
  const line = outlineOf(color, 0.5);
  const canopy = [
    [0, -0.2, 1],
    [-0.62, 0.15, 0.72],
    [0.62, 0.12, 0.75],
    [-0.25, 0.42, 0.7],
    [0.3, 0.4, 0.72],
  ];
  const circles = canopy.map(([dx, dy, k]) => ({ x: x + dx! * r, y: cy + dy! * r, r: k! * r }));
  let out = h('path', {
    d:
      M(x - hgt * 0.05, y) +
      L(x - hgt * 0.035, cy) +
      L(x + hgt * 0.035, cy) +
      L(x + hgt * 0.05, y) +
      'Z',
    fill: '#8a5a32',
    stroke: outline ? '#5a3a1e' : 'none',
    'stroke-width': outline ? 2 : 0,
  });
  if (outline)
    out += h(
      'g',
      { fill: line },
      ...circles.map((c) => h('circle', { cx: c.x, cy: c.y, r: c.r + 2 })),
    );
  out += h('g', { fill: color }, ...circles.map((c) => h('circle', { cx: c.x, cy: c.y, r: c.r })));
  out += h('circle', {
    cx: x - r * 0.3,
    cy: cy - r * 0.45,
    r: r * 0.38,
    fill: lighten(color, 0.3),
    opacity: 0.6,
  });
  if (fruit) {
    const fr = rng(`${x}-${y}`);
    for (let i = 0; i < 5; i++)
      out += h('circle', {
        cx: x + (fr() - 0.5) * r * 1.6,
        cy: cy + (fr() - 0.3) * r * 1.0,
        r: Math.max(3, r * 0.1),
        fill: fruit,
        stroke: darken(fruit, 0.3),
        'stroke-width': 1.2,
      });
  }
  return out;
}

export function bush(x: number, y: number, s: number, color: string, flowers?: string): string {
  const circles = [
    [-0.6, -0.25, 0.55],
    [0, -0.45, 0.7],
    [0.62, -0.25, 0.55],
  ].map(([dx, dy, k]) => ({ x: x + dx! * s, y: y + dy! * s, r: k! * s }));
  let out = h(
    'g',
    { fill: outlineOf(color, 0.5) },
    ...circles.map((c) => h('circle', { cx: c.x, cy: c.y, r: c.r + 2 })),
  );
  out += h('g', { fill: color }, ...circles.map((c) => h('circle', { cx: c.x, cy: c.y, r: c.r })));
  out += h('rect', {
    x: x - s * 1.2,
    y: y - s * 0.05,
    width: s * 2.4,
    height: s * 0.2,
    fill: color,
  });
  if (flowers) {
    for (const [dx, dy] of [
      [-0.5, -0.4],
      [0.1, -0.7],
      [0.55, -0.35],
    ])
      out += h('circle', { cx: x + dx! * s, cy: y + dy! * s, r: s * 0.09, fill: flowers });
  }
  return out;
}

export function tuft(x: number, y: number, s: number, color: string): string {
  return h('path', {
    d:
      M(x - s, y) +
      Q(x - s * 0.6, y - s * 0.9, x - s * 0.9, y - s * 1.6) +
      Q(x - s * 0.2, y - s * 0.8, x, y - s * 1.9) +
      Q(x + s * 0.2, y - s * 0.8, x + s * 0.9, y - s * 1.5) +
      Q(x + s * 0.6, y - s * 0.8, x + s, y) +
      'Z',
    fill: color,
  });
}

/** Scatter meadow flowers and grass tufts inside a band. */
export function meadowDetails(
  r: Rng,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  n: number,
  colors: readonly string[],
  grass: string,
): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0);
    const y = y0 + r() * (y1 - y0);
    const depth = (y - y0) / Math.max(1, y1 - y0);
    if (r() < 0.45) out += tuft(x, y, 6 + depth * 10, grass);
    else {
      const c = colors[Math.floor(r() * colors.length)]!;
      const s = 3 + depth * 6;
      out +=
        h('circle', { cx: x, cy: y, r: s, fill: c }) +
        h('circle', { cx: x, cy: y, r: s * 0.38, fill: '#ffd23f' });
    }
  }
  return out;
}

export function rock(x: number, y: number, s: number, color = '#a8a2b8'): string {
  const d = smoothClosedD(
    [
      { x: x - s, y },
      { x: x - s * 0.85, y: y - s * 0.55 },
      { x: x - s * 0.2, y: y - s * 0.85 },
      { x: x + s * 0.55, y: y - s * 0.7 },
      { x: x + s, y: y - s * 0.15 },
      { x: x + s * 0.9, y },
    ],
    0.8,
  );
  return (
    h('path', {
      d,
      fill: color,
      stroke: outlineOf(color, 0.5),
      'stroke-width': Math.max(1.5, s * 0.05),
    }) +
    h('path', {
      d: M(x - s * 0.55, y - s * 0.55) + Q(x - s * 0.2, y - s * 0.75, x + s * 0.2, y - s * 0.68),
      fill: 'none',
      stroke: lighten(color, 0.45),
      'stroke-width': Math.max(2, s * 0.08),
      'stroke-linecap': 'round',
    })
  );
}

/** Mountain with rounded shoulders (Krkonose-like when `round` is high) and an optional snow cap. */
export function mountain(
  x: number,
  y: number,
  w: number,
  hgt: number,
  color: string,
  snow = true,
  round = 0.3,
): string {
  const k = Math.max(0, Math.min(1, round));
  const top = { x, y: y - hgt };
  const tw = w * (0.03 + 0.07 * k);
  const d =
    M(x - w / 2, y) +
    C(
      x - w * (0.4 - 0.08 * k),
      y - hgt * (0.3 + 0.3 * k),
      x - w * (0.16 + 0.08 * k),
      y - hgt * (0.88 + 0.04 * k),
      top.x - tw,
      top.y + hgt * 0.02,
    ) +
    Q(top.x, top.y - hgt * 0.03 * (1 + k), top.x + tw, top.y + hgt * 0.02) +
    C(
      x + w * (0.16 + 0.08 * k),
      y - hgt * (0.86 + 0.04 * k),
      x + w * (0.4 - 0.08 * k),
      y - hgt * (0.28 + 0.3 * k),
      x + w / 2,
      y,
    ) +
    'Z';
  let out = h('path', { d, fill: color });
  // shaded right flank and a soft ridge line
  out += h('path', {
    d:
      M(top.x + tw * 0.4, top.y + hgt * 0.03) +
      C(x + w * 0.04, y - hgt * 0.6, x + w * 0.12, y - hgt * 0.25, x + w * 0.08, y) +
      L(x + w / 2, y) +
      C(
        x + w * (0.4 - 0.08 * k),
        y - hgt * (0.28 + 0.3 * k),
        x + w * (0.16 + 0.08 * k),
        y - hgt * (0.86 + 0.04 * k),
        top.x + tw * 0.4,
        top.y + hgt * 0.03,
      ) +
      'Z',
    fill: darken(color, 0.14),
    opacity: 0.55,
  });
  out += h('path', {
    d:
      M(x - w * 0.12, y - hgt * 0.55) + Q(x - w * 0.2, y - hgt * 0.3, x - w * 0.26, y - hgt * 0.08),
    fill: 'none',
    stroke: lighten(color, 0.25),
    'stroke-width': Math.max(3, w * 0.012),
    'stroke-linecap': 'round',
    opacity: 0.6,
  });
  if (snow) {
    const sy = top.y + hgt * 0.24;
    out += h('path', {
      d:
        M(top.x - tw, top.y + hgt * 0.025) +
        Q(top.x, top.y - hgt * 0.03 * (1 + k), top.x + tw, top.y + hgt * 0.025) +
        Q(top.x + w * 0.11, top.y + hgt * 0.12, top.x + w * 0.14, sy) +
        L(top.x + w * 0.07, sy - hgt * 0.05) +
        L(top.x + w * 0.02, sy + hgt * 0.02) +
        L(top.x - w * 0.05, sy - hgt * 0.06) +
        L(top.x - w * 0.1, sy + hgt * 0.01) +
        Q(top.x - w * 0.11, top.y + hgt * 0.12, top.x - tw, top.y + hgt * 0.025) +
        'Z',
      fill: '#ffffff',
      opacity: 0.95,
    });
  }
  return out;
}

/** Czech village cottage: white walls, red roof, a little window. */
export function cottage(
  x: number,
  y: number,
  s: number,
  roof = '#d9533a',
  wall = '#fff6e6',
): string {
  const w = s;
  const hh = s * 0.6;
  return (
    h('path', {
      d: roundRectD(x - w / 2, y - hh, w, hh, 3),
      fill: wall,
      stroke: outlineOf(wall, 0.4),
      'stroke-width': 2,
    }) +
    h('path', {
      d: polyD([
        { x: x - w * 0.62, y: y - hh + 2 },
        { x, y: y - hh - s * 0.5 },
        { x: x + w * 0.62, y: y - hh + 2 },
      ]),
      fill: roof,
      stroke: outlineOf(roof, 0.5),
      'stroke-width': 2,
      'stroke-linejoin': 'round',
    }) +
    h('rect', {
      x: x - w * 0.22,
      y: y - hh * 0.65,
      width: w * 0.18,
      height: w * 0.16,
      fill: '#ffe08a',
      stroke: '#8a6a4a',
      'stroke-width': 1.5,
    }) +
    h('rect', {
      x: x + w * 0.1,
      y: y - hh * 0.55,
      width: w * 0.16,
      height: hh * 0.55,
      fill: '#9a6a3a',
    }) +
    h('rect', {
      x: x + w * 0.18,
      y: y - hh - s * 0.42,
      width: w * 0.1,
      height: s * 0.24,
      fill: '#b8a8a0',
    })
  );
}

/** Church with an onion-dome tower (a common Czech village silhouette). */
export function church(x: number, y: number, s: number): string {
  const wall = '#fff6e6';
  return (
    cottage(x - s * 0.35, y, s * 0.9, '#b84a32', wall) +
    h('rect', {
      x: x + s * 0.05,
      y: y - s * 1.3,
      width: s * 0.36,
      height: s * 1.3,
      fill: wall,
      stroke: outlineOf(wall, 0.4),
      'stroke-width': 2,
    }) +
    h('path', {
      d:
        M(x + s * 0.05, y - s * 1.3) +
        C(x + s * 0.0, y - s * 1.5, x + s * 0.2, y - s * 1.55, x + s * 0.23, y - s * 1.75) +
        C(x + s * 0.26, y - s * 1.55, x + s * 0.46, y - s * 1.5, x + s * 0.41, y - s * 1.3) +
        'Z',
      fill: '#4f8f6a',
      stroke: '#2f5a44',
      'stroke-width': 2,
    }) +
    h('path', {
      d:
        M(x + s * 0.23, y - s * 1.75) +
        L(x + s * 0.23, y - s * 1.92) +
        M(x + s * 0.17, y - s * 1.85) +
        L(x + s * 0.29, y - s * 1.85),
      stroke: '#c9973e',
      'stroke-width': 2.5,
    }) +
    h('circle', {
      cx: x + s * 0.23,
      cy: y - s * 1.0,
      r: s * 0.08,
      fill: '#ffe08a',
      stroke: '#8a6a4a',
      'stroke-width': 1.5,
    })
  );
}

/** Storybook castle: walls, round towers with red conical roofs, flags. */
export function castle(x: number, y: number, s: number, flag = '#d93a57'): string {
  const wall = '#f4ead6';
  const line = '#8a7a6a';
  const tower = (tx: number, w: number, hgt: number): string =>
    h('path', {
      d: roundRectD(tx - w / 2, y - hgt, w, hgt, 4),
      fill: wall,
      stroke: line,
      'stroke-width': 2.5,
    }) +
    h('path', {
      d: polyD([
        { x: tx - w * 0.62, y: y - hgt + 3 },
        { x: tx, y: y - hgt - w * 1.2 },
        { x: tx + w * 0.62, y: y - hgt + 3 },
      ]),
      fill: '#d9533a',
      stroke: outlineOf('#d9533a', 0.5),
      'stroke-width': 2.5,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d:
        M(tx, y - hgt - w * 1.2) +
        L(tx, y - hgt - w * 1.55) +
        L(tx + w * 0.4, y - hgt - w * 1.45) +
        L(tx, y - hgt - w * 1.35),
      fill: flag,
      stroke: outlineOf(flag, 0.5),
      'stroke-width': 1.5,
    }) +
    h('path', {
      d: roundRectD(tx - w * 0.12, y - hgt * 0.7, w * 0.24, w * 0.34, w * 0.12),
      fill: '#ffe08a',
      stroke: line,
      'stroke-width': 1.5,
    });
  let crenel = '';
  for (let i = -3; i <= 3; i++)
    crenel += h('rect', {
      x: x + i * s * 0.12 - s * 0.04,
      y: y - s * 0.62,
      width: s * 0.08,
      height: s * 0.07,
      fill: wall,
      stroke: line,
      'stroke-width': 2,
    });
  return (
    tower(x - s * 0.55, s * 0.22, s * 0.85) +
    tower(x + s * 0.55, s * 0.22, s * 0.85) +
    h('path', {
      d: roundRectD(x - s * 0.5, y - s * 0.56, s, s * 0.56, 3),
      fill: wall,
      stroke: line,
      'stroke-width': 2.5,
    }) +
    crenel +
    tower(x, s * 0.3, s * 1.2) +
    h('path', {
      d:
        M(x - s * 0.1, y) +
        L(x - s * 0.1, y - s * 0.2) +
        Q(x, y - s * 0.32, x + s * 0.1, y - s * 0.2) +
        L(x + s * 0.1, y) +
        'Z',
      fill: '#8a5a32',
      stroke: line,
      'stroke-width': 2,
    })
  );
}

/** Stone arch bridge across a stream. */
export function stoneBridge(x: number, y: number, w: number): string {
  const hgt = w * 0.28;
  const d =
    M(x - w / 2, y) +
    L(x - w / 2, y - hgt) +
    Q(x, y - hgt * 1.35, x + w / 2, y - hgt) +
    L(x + w / 2, y) +
    L(x + w * 0.32, y) +
    Q(x, y - hgt * 1.6, x - w * 0.32, y) +
    'Z';
  let stones = '';
  for (let i = -3; i <= 3; i++)
    stones +=
      M(x + i * w * 0.13, y - hgt * 1.12 + Math.abs(i) * hgt * 0.06) +
      L(x + i * w * 0.13, y - hgt * 0.95 + Math.abs(i) * hgt * 0.05);
  return (
    h('path', {
      d,
      fill: '#c9c0b4',
      stroke: '#7d756c',
      'stroke-width': 3,
      'stroke-linejoin': 'round',
    }) +
    h('path', { d: stones, stroke: '#9a9288', 'stroke-width': 2.5 }) +
    h('path', {
      d: M(x - w / 2, y - hgt) + Q(x, y - hgt * 1.35, x + w / 2, y - hgt),
      fill: 'none',
      stroke: '#ece6dc',
      'stroke-width': 4,
      'stroke-linecap': 'round',
    })
  );
}

/** Water band with gentle ripple lines. */
export function water(
  defs: Defs,
  name: string,
  d: string,
  top: string,
  bottom: string,
  r: Rng,
  bounds: [number, number, number, number],
  ripples = 18,
): string {
  let lines = '';
  const [x0, y0, x1, y1] = bounds;
  for (let i = 0; i < ripples; i++) {
    const x = x0 + r() * (x1 - x0);
    const y = y0 + r() * (y1 - y0);
    const w = 14 + r() * 40;
    lines += M(x - w, y) + Q(x, y - 4, x + w, y);
  }
  const clip = defs.id(`${name}-clip`);
  defs.list.push(h('clipPath', { id: clip }, h('path', { d })));
  return (
    h('path', {
      d,
      fill: linear(defs, name, [
        [0, top],
        [1, bottom],
      ]),
    }) +
    h('path', {
      d: lines,
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': 3,
      'stroke-linecap': 'round',
      opacity: 0.55,
      'clip-path': `url(#${clip})`,
    })
  );
}

export function birds(points: Array<[number, number, number]>, color = '#4f4669'): string {
  return h('path', {
    d: points
      .map(
        ([x, y, s]) =>
          M(x - s, y) + Q(x - s * 0.5, y - s * 0.6, x, y) + Q(x + s * 0.5, y - s * 0.6, x + s, y),
      )
      .join(''),
    fill: 'none',
    stroke: color,
    'stroke-width': 3,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
}

export function starsField(
  r: Rng,
  n: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  color = '#fff3b0',
): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0);
    const y = y0 + r() * (y1 - y0);
    const s = 1.2 + r() * 2.4;
    out +=
      r() < 0.15
        ? h('path', { d: sparkleD(x, y, s * 3), fill: color })
        : h('circle', { cx: x, cy: y, r: s, fill: color, opacity: 0.6 + r() * 0.4 });
  }
  return out;
}

export function crystalCluster(
  x: number,
  y: number,
  s: number,
  colors: readonly string[],
  glowDefs?: Defs,
): string {
  const shards: Array<[number, number, number, number]> = [
    [-0.45, 0.55, -18, 0],
    [0, 1, 0, 1],
    [0.42, 0.7, 16, 2],
    [-0.2, 0.42, -32, 3],
    [0.25, 0.4, 30, 4],
  ];
  let out = '';
  if (glowDefs)
    out += h('circle', {
      cx: x,
      cy: y - s * 0.5,
      r: s * 1.3,
      fill: radial(glowDefs, `cg-${Math.round(x)}-${Math.round(y)}`, [
        [0, colors[0]!, 0.55],
        [1, colors[0]!, 0],
      ]),
    });
  for (const [dx, k, rot, ci] of shards) {
    const c = colors[ci % colors.length]!;
    const hgt = s * k;
    const w = s * 0.26;
    const bx = x + dx * s;
    const d = polyD([
      { x: bx - w / 2, y },
      { x: bx - w / 2, y: y - hgt * 0.75 },
      { x: bx, y: y - hgt },
      { x: bx + w / 2, y: y - hgt * 0.75 },
      { x: bx + w / 2, y },
    ]);
    out += h(
      'g',
      { transform: `rotate(${rot} ${bx.toFixed(1)} ${y.toFixed(1)})` },
      h('path', {
        d,
        fill: c,
        stroke: outlineOf(c, 0.5),
        'stroke-width': 2.5,
        'stroke-linejoin': 'round',
      }),
      h('path', {
        d: M(bx - w * 0.15, y - hgt * 0.1) + L(bx - w * 0.15, y - hgt * 0.7),
        stroke: '#ffffff',
        'stroke-width': 3,
        'stroke-linecap': 'round',
        opacity: 0.7,
      }),
    );
  }
  return out;
}

export function lilyPad(x: number, y: number, s: number, bloom?: string): string {
  const d =
    M(x, y) +
    L(x + s * 0.9, y - s * 0.12) +
    C(x + s * 0.9, y - s * 0.6, x - s, y - s * 0.6, x - s, y) +
    C(x - s, y + s * 0.45, x + s, y + s * 0.45, x + s * 0.92, y + s * 0.1) +
    'Z';
  return (
    h('path', { d, fill: '#5cbf5a', stroke: '#2f6b2a', 'stroke-width': 2 }) +
    (bloom ? flower(x - s * 0.1, y - s * 0.2, s * 0.35, 6, bloom, '#ffd23f', '#9a6a8a', 1.5) : '')
  );
}

export function reeds(x: number, y: number, s: number): string {
  let d = '';
  let tops = '';
  for (let i = 0; i < 5; i++) {
    const dx = (i - 2) * s * 0.18;
    const hgt = s * (0.9 + (i % 2) * 0.35);
    d += M(x + dx, y) + Q(x + dx + s * 0.05, y - hgt * 0.5, x + dx + (i - 2) * s * 0.06, y - hgt);
    if (i % 2 === 0)
      tops += h('path', {
        d: roundRectD(x + dx + (i - 2) * s * 0.06 - 4, y - hgt - s * 0.05, 8, s * 0.22, 4),
        fill: '#8a5a32',
      });
  }
  return (
    h('path', {
      d,
      fill: 'none',
      stroke: '#4f8f3a',
      'stroke-width': 3.5,
      'stroke-linecap': 'round',
    }) + tops
  );
}

export function fence(x0: number, x1: number, y: number, s: number, color = '#c9a06a'): string {
  let posts = '';
  const n = Math.max(2, Math.round((x1 - x0) / (s * 1.4)));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    posts += h('path', {
      d:
        M(x - s * 0.12, y) +
        L(x - s * 0.12, y - s * 0.95) +
        L(x, y - s * 1.1) +
        L(x + s * 0.12, y - s * 0.95) +
        L(x + s * 0.12, y) +
        'Z',
      fill: color,
      stroke: outlineOf(color, 0.5),
      'stroke-width': 2,
    });
  }
  return (
    h('path', {
      d: M(x0, y - s * 0.4) + L(x1, y - s * 0.4) + M(x0, y - s * 0.75) + L(x1, y - s * 0.75),
      stroke: darken(color, 0.1),
      'stroke-width': s * 0.12,
    }) + posts
  );
}

export function mushroom(x: number, y: number, s: number, cap = '#a8642e'): string {
  return (
    h('path', {
      d:
        M(x - s * 0.22, y) +
        Q(x - s * 0.26, y - s * 0.45, x - s * 0.15, y - s * 0.55) +
        L(x + s * 0.15, y - s * 0.55) +
        Q(x + s * 0.26, y - s * 0.45, x + s * 0.22, y) +
        'Z',
      fill: '#fff3dc',
      stroke: '#8a6a4a',
      'stroke-width': 2,
    }) +
    h('path', {
      d:
        M(x - s * 0.55, y - s * 0.5) +
        C(x - s * 0.55, y - s * 1.15, x + s * 0.55, y - s * 1.15, x + s * 0.55, y - s * 0.5) +
        Q(x, y - s * 0.4, x - s * 0.55, y - s * 0.5) +
        'Z',
      fill: cap,
      stroke: outlineOf(cap, 0.5),
      'stroke-width': 2,
    })
  );
}

export function vignette(defs: Defs, color = '#2a1b45', strength = 0.28): string {
  return h('rect', {
    x: 0,
    y: 0,
    width: SW,
    height: SH,
    fill: radial(defs, 'vignette', [
      [0.55, color, 0],
      [1, color, strength],
    ]),
  });
}

/** A gentle light shaft (god rays) for forest and hall scenes. */
export function lightRays(
  defs: Defs,
  x: number,
  y: number,
  len: number,
  spread: number,
  color = '#fff6cc',
  n = 4,
  angle = 70,
): string {
  let out = '';
  const g = linear(defs, `rays-${x}`, [
    [0, color, 0.45],
    [1, color, 0],
  ]);
  for (let i = 0; i < n; i++) {
    const a = angle + (i - (n - 1) / 2) * spread;
    const p = polar(x, y, len, a);
    const q = polar(x, y, len, a + spread * 0.45);
    out += h('path', { d: M(x, y) + L(p.x, p.y) + L(q.x, q.y) + 'Z', fill: g });
  }
  return out;
}
