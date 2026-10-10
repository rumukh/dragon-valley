import { polar } from '../svg/num';
import { M, L, Q, roundRectD, roundStarD, smoothClosedD } from '../svg/path';
import { h } from '../svg/xml';
import { outlineOf } from '../svg/color';
import { bittenCircleD, clover, plusD } from '../glyphs';
import { linearGradient, type Ctx } from './ctx';
import { belly, bellyPathD, bodyPathD } from './parts';
import { CX } from './skeleton';
import { gear } from './wings';
import type { MarkingStyle } from './types';

const RAINBOW = ['#ff5a5f', '#ff9f40', '#ffd93d', '#5ccc6b', '#4aa8ff', '#5b6cf0', '#a66cf0'];

function has(ctx: Ctx, m: MarkingStyle): boolean {
  return ctx.recipe.markings.includes(m);
}

function rainbowBelly(ctx: Ctx): string {
  const b = ctx.sk.belly;
  const d = bellyPathD(ctx);
  const clip = ctx.def('belly-clip', (id) => h('clipPath', { id }, h('path', { d })));
  const top = b.cy - b.ry;
  const step = (b.ry * 2) / 7;
  let stripes = '';
  let seams = '';
  RAINBOW.forEach((c, i) => {
    stripes += h('rect', {
      x: b.cx - b.rx - 2,
      y: top + i * step - 0.5,
      width: b.rx * 2 + 4,
      height: step + 1,
      fill: c,
    });
    if (i > 0) seams += M(b.cx - b.rx - 2, top + i * step) + L(b.cx + b.rx + 2, top + i * step);
  });
  return h(
    'g',
    { class: 'dv-belly dv-rainbow' },
    h(
      'g',
      { 'clip-path': `url(#${clip})` },
      stripes,
      h('path', { d: seams, stroke: '#ffffff', 'stroke-width': ctx.W * 0.45, opacity: 0.75 }),
      h('ellipse', {
        cx: b.cx - b.rx * 0.38,
        cy: b.cy - b.ry * 0.45,
        rx: b.rx * 0.18,
        ry: b.ry * 0.26,
        fill: '#ffffff',
        opacity: 0.28,
      }),
    ),
    h('path', { d, fill: 'none', stroke: ctx.paint.line, 'stroke-width': ctx.W * 0.75 }),
  );
}

function clockFace(ctx: Ctx): string {
  const b = ctx.sk.belly;
  const r = Math.min(b.rx, b.ry) * 0.9;
  const cy = b.cy + b.ry * 0.04;
  let ticks = '';
  let bold = '';
  for (let i = 0; i < 12; i++) {
    const a = -90 + i * 30;
    const long = i % 3 === 0;
    const p0 = polar(b.cx, cy, r * (long ? 0.62 : 0.74), a);
    const p1 = polar(b.cx, cy, r * 0.88, a);
    if (long) bold += M(p0.x, p0.y) + L(p1.x, p1.y);
    else ticks += M(p0.x, p0.y) + L(p1.x, p1.y);
  }
  return h(
    'g',
    { class: 'dv-clock' },
    h('circle', {
      cx: b.cx,
      cy,
      r,
      fill: '#fffbe8',
      stroke: ctx.paint.accentLine,
      'stroke-width': ctx.W * 0.8,
    }),
    h('path', {
      d: ticks,
      stroke: ctx.paint.accentShade,
      'stroke-width': ctx.W * 0.8,
      'stroke-linecap': 'round',
    }),
    h('path', {
      d: bold,
      stroke: ctx.paint.accentLine,
      'stroke-width': ctx.W * 1.25,
      'stroke-linecap': 'round',
    }),
    h('circle', { cx: b.cx, cy, r: r * 0.1, fill: ctx.paint.accentShade }),
  );
}

/** Starry's ten-frame: two rows of five places, nine stars and one empty place (10 - 1). */
function tenFrame(ctx: Ctx): string {
  const b = ctx.sk.belly;
  const cols = 5;
  const slot = Math.min((b.rx * 2.16) / cols, (b.ry * 1.5) / 2);
  const w = slot * cols;
  const hgt = slot * 2;
  const x0 = b.cx - w / 2;
  const y0 = b.cy - hgt / 2 + b.ry * 0.08;
  let cells = '';
  let stars = '';
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const cx = x0 + slot * (c + 0.5);
      const cy = y0 + slot * (r + 0.5);
      cells += h('circle', { cx, cy, r: slot * 0.45, fill: '#14123f', opacity: 0.55 });
      if (i < 9) {
        stars += h('path', {
          d: roundStarD(cx, cy + slot * 0.02, 5, slot * 0.47, slot * 0.23, -90, 0.18),
          fill: '#ffd84d',
          stroke: '#7a4a00',
          'stroke-width': ctx.W * 0.42,
          'stroke-linejoin': 'round',
        });
        stars += h('circle', {
          cx: cx - slot * 0.1,
          cy: cy - slot * 0.1,
          r: slot * 0.06,
          fill: '#ffffff',
          opacity: 0.8,
        });
      } else {
        stars += h('path', {
          d: roundStarD(cx, cy + slot * 0.02, 5, slot * 0.4, slot * 0.2, -90, 0.18),
          fill: 'none',
          stroke: '#ffe58a',
          'stroke-width': ctx.W * 0.45,
          'stroke-dasharray': `${(slot * 0.1).toFixed(2)} ${(slot * 0.09).toFixed(2)}`,
          'stroke-linejoin': 'round',
        });
      }
    }
  }
  const pad = slot * 0.14;
  return h(
    'g',
    { class: 'dv-ten-frame' },
    h('path', {
      d: roundRectD(x0 - pad, y0 - pad, w + pad * 2, hgt + pad * 2, slot * 0.4),
      fill: '#22206a',
      stroke: '#ffd84d',
      'stroke-width': ctx.W * 0.5,
    }),
    h('path', {
      d:
        M(x0, y0 + slot) +
        L(x0 + w, y0 + slot) +
        [1, 2, 3, 4].map((k) => M(x0 + slot * k, y0) + L(x0 + slot * k, y0 + hgt)).join(''),
      stroke: '#ffd84d',
      'stroke-width': ctx.W * 0.25,
      opacity: 0.45,
    }),
    cells,
    stars,
  );
}

/** Crystal's bold 8-arm snowflake (double, double, double: 2, 4, 8). */
function boldSnowflake(ctx: Ctx): string {
  const b = ctx.sk.belly;
  const r = Math.min(b.rx, b.ry) * 0.9;
  const cx = b.cx;
  const cy = b.cy + b.ry * 0.03;
  let arms = '';
  let tips = '';
  for (let i = 0; i < 8; i++) {
    const a = -90 + i * 45;
    const tip = polar(cx, cy, r * 0.8, a);
    arms += M(cx, cy) + L(tip.x, tip.y);
    const br = polar(cx, cy, r * 0.5, a);
    const l = polar(br.x, br.y, r * 0.24, a - 45);
    const rr = polar(br.x, br.y, r * 0.24, a + 45);
    arms += M(l.x, l.y) + L(br.x, br.y) + L(rr.x, rr.y);
    const d0 = polar(cx, cy, r, a);
    const s0 = polar(tip.x, tip.y, r * 0.09, a - 90);
    const s1 = polar(tip.x, tip.y, r * 0.09, a + 90);
    tips +=
      M(d0.x, d0.y) +
      L(s0.x, s0.y) +
      L(polar(cx, cy, r * 0.72, a).x, polar(cx, cy, r * 0.72, a).y) +
      L(s1.x, s1.y) +
      'Z';
  }
  const outline = ctx.paint.accentShade;
  return h(
    'g',
    { class: 'dv-snowflake' },
    h('path', {
      d: arms,
      fill: 'none',
      stroke: outline,
      'stroke-width': ctx.W * 2.6,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
    h('path', {
      d: tips,
      fill: outline,
      stroke: outline,
      'stroke-width': ctx.W * 1.1,
      'stroke-linejoin': 'round',
    }),
    h('path', {
      d: arms,
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': ctx.W * 1.3,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
    h('path', { d: tips, fill: '#ffffff' }),
    h('circle', {
      cx,
      cy,
      r: r * 0.17,
      fill: '#ffffff',
      stroke: outline,
      'stroke-width': ctx.W * 0.6,
    }),
  );
}

function mirrorBelly(ctx: Ctx): string {
  const b = ctx.sk.belly;
  const d = bellyPathD(ctx);
  const clip = ctx.def('belly-clip', (id) => h('clipPath', { id }, h('path', { d })));
  const glass = linearGradient(
    ctx,
    'mirror-grad',
    [
      [0, '#f4fbff'],
      [0.5, '#cfe8fb'],
      [1, '#9ec6ea'],
    ],
    { x: b.cx - b.rx, y: b.cy - b.ry },
    { x: b.cx + b.rx, y: b.cy + b.ry },
  );
  return h(
    'g',
    { class: 'dv-belly dv-mirror' },
    h('path', { d, fill: glass }),
    h(
      'g',
      { 'clip-path': `url(#${clip})` },
      h('path', {
        d:
          M(b.cx - b.rx * 0.9, b.cy + b.ry * 0.1) +
          L(b.cx - b.rx * 0.1, b.cy - b.ry * 0.9) +
          M(b.cx - b.rx * 0.55, b.cy + b.ry * 0.55) +
          L(b.cx + b.rx * 0.45, b.cy - b.ry * 0.6),
        stroke: '#ffffff',
        'stroke-width': b.rx * 0.18,
        'stroke-linecap': 'round',
        opacity: 0.75,
      }),
    ),
    h('path', { d, fill: 'none', stroke: ctx.paint.horn, 'stroke-width': ctx.W * 1.6 }),
    h('path', { d, fill: 'none', stroke: ctx.paint.line, 'stroke-width': ctx.W * 0.5 }),
  );
}

function zeroMedallion(ctx: Ctx): string {
  const b = ctx.sk.belly;
  const cx = b.cx;
  const cy = b.cy - b.ry * 0.38;
  const r = b.rx * 0.36;
  const ribbon =
    M(cx - r * 0.8, cy - r * 1.9) + L(cx, cy - r * 0.95) + L(cx + r * 0.8, cy - r * 1.9);
  const W = ctx.W * 0.75;
  return h(
    'g',
    { class: 'dv-medal' },
    h('path', {
      d: ribbon,
      fill: 'none',
      stroke: '#e0335a',
      'stroke-width': r * 0.32,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
    h('ellipse', {
      cx,
      cy,
      rx: r * 0.82,
      ry: r,
      fill: 'none',
      stroke: '#9a5a00',
      'stroke-width': r * 0.48 + W * 2,
    }),
    h('ellipse', {
      cx,
      cy,
      rx: r * 0.82,
      ry: r,
      fill: 'none',
      stroke: '#ffd23f',
      'stroke-width': r * 0.48,
    }),
    h('path', {
      d:
        M(cx - r * 0.8, cy - r * 0.35) +
        Q(cx - r * 0.75, cy - r * 0.95, cx - r * 0.2, cy - r * 1.05),
      fill: 'none',
      stroke: '#fff6cf',
      'stroke-width': r * 0.14,
      'stroke-linecap': 'round',
    }),
  );
}

function placeValue(ctx: Ctx): string {
  const b = ctx.sk.belly;
  const u = b.rx * 0.11;
  const line = ctx.paint.bellyLine;
  const W = ctx.W * 0.55;
  const x0 = b.cx - b.rx * 0.62;
  const y0 = b.cy - b.ry * 0.45;
  let grid = '';
  const side = u * 5;
  for (let i = 1; i < 5; i++) {
    grid +=
      M(x0 + (side * i) / 5, y0) +
      L(x0 + (side * i) / 5, y0 + side) +
      M(x0, y0 + (side * i) / 5) +
      L(x0 + side, y0 + (side * i) / 5);
  }
  const rodX = x0 + side + u * 0.9;
  let rod = '';
  for (let i = 1; i < 5; i++)
    rod += M(rodX, y0 + (side * i) / 5) + L(rodX + u, y0 + (side * i) / 5);
  const cubeX = rodX + u * 1.9;
  const cubeY = y0 + side - u;
  return h(
    'g',
    { class: 'dv-place-value', opacity: 0.8 },
    h('rect', {
      x: x0,
      y: y0,
      width: side,
      height: side,
      rx: 2,
      fill: ctx.paint.bellyShade,
      stroke: line,
      'stroke-width': W,
    }),
    h('path', { d: grid, stroke: line, 'stroke-width': W * 0.6, opacity: 0.7 }),
    h('rect', {
      x: rodX,
      y: y0,
      width: u,
      height: side,
      rx: 2,
      fill: ctx.paint.bellyShade,
      stroke: line,
      'stroke-width': W,
    }),
    h('path', { d: rod, stroke: line, 'stroke-width': W * 0.6, opacity: 0.7 }),
    h('rect', {
      x: cubeX,
      y: cubeY,
      width: u,
      height: u,
      rx: 2,
      fill: ctx.paint.bellyShade,
      stroke: line,
      'stroke-width': W,
    }),
  );
}

function gears(ctx: Ctx): string {
  const b = ctx.sk.belly;
  const r1 = b.rx * 0.44;
  const r2 = b.rx * 0.32;
  const r3 = b.rx * 0.24;
  const c1 = { x: b.cx - b.rx * 0.22, y: b.cy + b.ry * 0.18 };
  const c2 = { x: c1.x + (r1 + r2) * 0.86, y: c1.y - (r1 + r2) * 0.42 };
  const c3 = { x: c2.x - (r2 + r3) * 0.3, y: c2.y - (r2 + r3) * 0.94 };
  return h(
    'g',
    { class: 'dv-gears' },
    gear(ctx, c3.x, c3.y, r3, 7, 'dv-gear dv-gear-3', ctx.paint.accent2),
    gear(ctx, c2.x, c2.y, r2, 9, 'dv-gear dv-gear-2', ctx.paint.accent),
    gear(ctx, c1.x, c1.y, r1, 12, 'dv-gear dv-gear-1', ctx.paint.accent2),
  );
}

function bubbleSpots(ctx: Ctx): string {
  const { top, w, h: bh } = ctx.sk.body;
  const d = bodyPathD(ctx);
  const clip = ctx.def('body-clip', (id) => h('clipPath', { id }, h('path', { d })));
  let spots = '';
  for (const s of [-1, 1]) {
    for (const [dx, dy] of [
      [0.4, 0.42],
      [0.43, 0.56],
    ] as const) {
      spots += h('circle', {
        cx: CX + s * w * dx,
        cy: top + bh * dy,
        r: w * 0.045,
        fill: ctx.paint.bodyShade,
        opacity: 0.55,
      });
      spots += h('circle', {
        cx: CX + s * w * dx - w * 0.012,
        cy: top + bh * dy - w * 0.014,
        r: w * 0.014,
        fill: '#ffffff',
        opacity: 0.7,
      });
    }
  }
  return h('g', { 'clip-path': `url(#${clip})` }, spots);
}

function freckles(ctx: Ctx): string {
  const c = ctx.sk.cheek;
  let out = '';
  for (const s of [-1, 1]) {
    for (const [dx, dy] of [
      [-0.35, -0.1],
      [0.05, 0.25],
      [0.4, -0.05],
    ] as const) {
      out += h('circle', {
        cx: CX + s * (c.dx + dx * c.rx),
        cy: c.y + dy * c.ry,
        r: c.ry * 0.16,
        fill: ctx.paint.accentShade,
        opacity: 0.6,
      });
    }
  }
  return out;
}

function moss(ctx: Ctx): string {
  const hd = ctx.sk.head;
  const { top, w } = ctx.sk.body;
  const blob = (cx: number, cy: number, r: number): string =>
    h('path', {
      d: smoothClosedD(
        [0, 60, 120, 180, 240, 300].map((a, i) => polar(cx, cy, r * (i % 2 ? 0.75 : 1), a)),
        1,
      ),
      fill: '#7fae4f',
      stroke: '#3f6b2a',
      'stroke-width': ctx.W * 0.5,
    });
  return h(
    'g',
    { class: 'dv-moss' },
    blob(hd.cx - hd.rx * 0.32, hd.cy - hd.ry * 0.78, hd.rx * 0.2),
    blob(CX - w * 0.36, top + 14, w * 0.09),
    blob(CX + w * 0.38, top + 22, w * 0.07),
  );
}

function scales(ctx: Ctx): string {
  const { top, w, h: bh } = ctx.sk.body;
  let d = '';
  for (const s of [-1, 1]) {
    for (const [dx, dy] of [
      [0.36, 0.5],
      [0.42, 0.62],
      [0.33, 0.66],
    ] as const) {
      const x = CX + s * w * dx;
      const y = top + bh * dy;
      d += M(x - 7, y) + Q(x, y + 7, x + 7, y);
    }
  }
  return h('path', {
    d,
    fill: 'none',
    stroke: ctx.paint.line,
    'stroke-width': ctx.W * 0.45,
    opacity: 0.35,
    'stroke-linecap': 'round',
  });
}

/**
 * Dot's counting belly: a ten-frame of ten round dots, five warm on top and five sunny below
 * (5 and 5 make 10), on a light frame so it reads apart from Starry's night-sky stars.
 */
function countingDots(ctx: Ctx): string {
  const b = ctx.sk.belly;
  const cols = 5;
  const slot = Math.min((b.rx * 2.1) / cols, (b.ry * 1.5) / 2);
  const w = slot * cols;
  const hgt = slot * 2;
  const x0 = b.cx - w / 2;
  const y0 = b.cy - hgt / 2 + b.ry * 0.08;
  const pad = slot * 0.16;
  const line = ctx.paint.bellyLine;
  let dots = '';
  for (let r = 0; r < 2; r++) {
    const fill = r === 0 ? ctx.paint.accent : ctx.paint.accent2;
    const edge = r === 0 ? ctx.paint.accentLine : outlineOf(ctx.paint.accent2, 0.55);
    for (let c = 0; c < cols; c++) {
      const cx = x0 + slot * (c + 0.5);
      const cy = y0 + slot * (r + 0.5);
      dots +=
        h('circle', {
          cx,
          cy,
          r: slot * 0.36,
          fill,
          stroke: edge,
          'stroke-width': ctx.W * 0.42,
        }) +
        h('circle', {
          cx: cx - slot * 0.11,
          cy: cy - slot * 0.12,
          r: slot * 0.09,
          fill: '#ffffff',
          opacity: 0.75,
        });
    }
  }
  return h(
    'g',
    { class: 'dv-counting-dots' },
    h('path', {
      d: roundRectD(x0 - pad, y0 - pad, w + pad * 2, hgt + pad * 2, slot * 0.35),
      fill: ctx.paint.bellyLight,
      stroke: line,
      'stroke-width': ctx.W * 0.55,
    }),
    h('path', {
      d:
        M(x0, y0 + slot) +
        L(x0 + w, y0 + slot) +
        [1, 2, 3, 4].map((k) => M(x0 + slot * k, y0) + L(x0 + slot * k, y0 + hgt)).join(''),
      stroke: line,
      'stroke-width': ctx.W * 0.3,
      opacity: 0.45,
    }),
    dots,
  );
}

/** Dot's polka dots on the body and head sides. */
function polkaDots(ctx: Ctx): string {
  const { top, w, h: bh } = ctx.sk.body;
  const d = bodyPathD(ctx);
  const clip = ctx.def('body-clip', (id) => h('clipPath', { id }, h('path', { d })));
  let spots = '';
  const colors = [ctx.paint.accent2, ctx.paint.accent, ctx.paint.accent2];
  for (const s of [-1, 1]) {
    for (const [i, [dx, dy, rr]] of (
      [
        [0.42, 0.3, 0.05],
        [0.47, 0.52, 0.04],
        [0.38, 0.74, 0.055],
      ] as const
    ).entries()) {
      spots += h('circle', {
        cx: CX + s * w * dx,
        cy: top + bh * dy,
        r: w * rr,
        fill: colors[i]!,
        stroke: ctx.paint.line,
        'stroke-width': ctx.W * 0.3,
        opacity: 0.9,
      });
    }
  }
  return h('g', { class: 'dv-polka', 'clip-path': `url(#${clip})` }, spots);
}

/** Round medallion on the upper belly holding a sign (Hop's plus, Nibble's minus). */
function signMedallion(ctx: Ctx, sign: 'plus' | 'minus'): string {
  const b = ctx.sk.belly;
  const cx = b.cx;
  const cy = b.cy - b.ry * 0.12;
  const r = Math.min(b.rx, b.ry) * 0.62;
  const W = ctx.W * 0.7;
  const disc =
    sign === 'minus'
      ? h('path', {
          d: bittenCircleD(cx, cy, r, -40, 0.34),
          fill: ctx.paint.accent2,
          stroke: ctx.paint.accentLine,
          'stroke-width': W,
          'stroke-linejoin': 'round',
        })
      : h('circle', {
          cx,
          cy,
          r,
          fill: ctx.paint.accent2,
          stroke: ctx.paint.accentLine,
          'stroke-width': W,
        });
  const s = r * 0.58;
  const mark =
    sign === 'plus'
      ? plusD(cx, cy, s, 0.3)
      : roundRectD(cx - s, cy - s * 0.3, s * 2, s * 0.6, s * 0.3);
  return h(
    'g',
    { class: `dv-medal dv-${sign}` },
    disc,
    h('path', {
      d: mark,
      fill: ctx.paint.accent,
      stroke: ctx.paint.accentLine,
      'stroke-width': W,
      'stroke-linejoin': 'round',
    }),
    h('path', {
      d:
        M(cx - r * 0.68, cy - r * 0.3) +
        Q(cx - r * 0.6, cy - r * 0.66, cx - r * 0.25, cy - r * 0.76),
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': r * 0.11,
      'stroke-linecap': 'round',
      opacity: 0.7,
    }),
  );
}

/** Belly layer (replaces the plain belly when a marking defines its own belly). */
export function bellyLayer(ctx: Ctx): string {
  if (has(ctx, 'rainbow-belly')) return rainbowBelly(ctx);
  if (has(ctx, 'mirror-belly')) return mirrorBelly(ctx);
  const plain =
    has(ctx, 'clock-belly') ||
    has(ctx, 'snowflake-belly') ||
    has(ctx, 'ten-frame-stars') ||
    has(ctx, 'clover-spots') ||
    has(ctx, 'gears') ||
    has(ctx, 'place-value') ||
    has(ctx, 'zero-medallion') ||
    has(ctx, 'counting-dots') ||
    has(ctx, 'plus-belly') ||
    has(ctx, 'minus-belly');
  let out = belly(ctx, undefined, !plain);
  if (has(ctx, 'clock-belly')) out += clockFace(ctx);
  if (has(ctx, 'snowflake-belly')) out += boldSnowflake(ctx);
  if (has(ctx, 'ten-frame-stars')) out += tenFrame(ctx);
  if (has(ctx, 'clover-spots')) {
    const b = ctx.sk.belly;
    out += h(
      'g',
      { class: 'dv-clover' },
      clover(
        b.cx,
        b.cy + b.ry * 0.08,
        Math.min(b.rx, b.ry) * 0.62,
        ctx.paint.accent,
        ctx.paint.accentLine,
        ctx.W * 0.7,
      ),
    );
  }
  if (has(ctx, 'gears')) out += gears(ctx);
  if (has(ctx, 'place-value')) out += placeValue(ctx);
  if (has(ctx, 'zero-medallion')) out += zeroMedallion(ctx);
  if (has(ctx, 'counting-dots')) out += countingDots(ctx);
  if (has(ctx, 'plus-belly')) out += signMedallion(ctx, 'plus');
  if (has(ctx, 'minus-belly')) out += signMedallion(ctx, 'minus');
  return out;
}

/** Marks painted over the body (spots, scales). */
export function bodyMarks(ctx: Ctx): string {
  let out = '';
  if (has(ctx, 'bubble-spots')) out += bubbleSpots(ctx);
  if (has(ctx, 'scales')) out += scales(ctx);
  if (has(ctx, 'polka-dots')) out += polkaDots(ctx);
  return out;
}

/** Marks painted on the head (freckles, moss). */
export function headMarks(ctx: Ctx): string {
  let out = '';
  if (has(ctx, 'freckles')) out += freckles(ctx);
  if (has(ctx, 'moss')) out += moss(ctx);
  return out;
}
