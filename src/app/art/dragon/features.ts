import { lerp, polar } from '../svg/num';
import { M, L, Q, roundRectD } from '../svg/path';
import { h } from '../svg/xml';
import { berry, pearl, sparkleD } from '../glyphs';
import { lighten, outlineOf } from '../svg/color';
import { glowGradient, type Ctx } from './ctx';
import { cloudUnion } from './shapes';
import { CX, GROUND } from './skeleton';
import type { FeatureStyle } from './types';

export function hasFeature(ctx: Ctx, f: FeatureStyle): boolean {
  return ctx.recipe.features.includes(f);
}

/** Puff's smoke ring: a floating cloud "0" (anything times zero goes poof). */
export function smokeRing(ctx: Ctx): string {
  const hd = ctx.sk.head;
  const r = lerp(30, 40, ctx.sk.t);
  const cx = hd.cx - hd.rx - r * 0.7;
  const cy = hd.cy - hd.ry * 0.25;
  const circles = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const p = polar(cx, cy, r, (i * 360) / n);
    circles.push({ x: p.x * 1 + (p.x - cx) * -0.18, y: p.y, r: r * 0.3 });
  }
  return h(
    'g',
    { class: 'dv-smoke-ring' },
    cloudUnion(circles, '#ffffff', ctx.paint.wingLine, ctx.W * 0.7),
    h('ellipse', {
      cx,
      cy,
      rx: r * 0.52,
      ry: r * 0.68,
      fill: 'none',
      stroke: ctx.paint.wing,
      'stroke-width': 1,
    }),
    cloudUnion(
      [
        { x: cx + r * 0.7, y: cy + r * 1.35, r: r * 0.22 },
        { x: cx + r * 1.15, y: cy + r * 1.55, r: r * 0.15 },
      ],
      '#ffffff',
      ctx.paint.wingLine,
      ctx.W * 0.6,
      'dv-puff',
    ),
  );
}

/** Bubbles: two pairs of bubbles (doubles). */
export function bubbles(ctx: Ctx): string {
  const hd = ctx.sk.head;
  const s = lerp(12, 16, ctx.sk.t);
  const pair = (x: number, y: number, k: number, cls: string): string =>
    h(
      'g',
      { class: cls },
      [
        [0, 0, 1],
        [s * 1.7, -s * 0.9, 0.72],
      ]
        .map(([dx, dy, rr]) => {
          const r = s * rr! * k;
          return (
            h('circle', {
              cx: x + dx!,
              cy: y + dy!,
              r,
              fill: '#e6f9ff',
              'fill-opacity': 0.55,
              stroke: ctx.paint.wingLine,
              'stroke-width': ctx.W * 0.5,
            }) +
            h('path', {
              d:
                M(x + dx! - r * 0.55, y + dy! - r * 0.15) +
                Q(x + dx! - r * 0.5, y + dy! - r * 0.55, x + dx! - r * 0.12, y + dy! - r * 0.62),
              fill: 'none',
              stroke: '#ffffff',
              'stroke-width': ctx.W * 0.6,
              'stroke-linecap': 'round',
            })
          );
        })
        .join(''),
    );
  return (
    pair(hd.cx - hd.rx - s * 2.6, hd.cy - hd.ry * 0.5, 1, 'dv-bubble dv-bubble-1') +
    pair(hd.cx + hd.rx + s * 0.6, hd.cy - hd.ry * 0.95, 0.9, 'dv-bubble dv-bubble-2')
  );
}

/** Pearl: a neat pile of pearls and one leftover rolling away. */
export function pearlPile(ctx: Ctx): string {
  const r = lerp(11, 14, ctx.sk.t);
  const x0 = CX - ctx.sk.body.w * 0.62 - r * 2.4;
  const y = GROUND - r;
  const line = ctx.paint.wingLine;
  const W = ctx.W * 0.5;
  const pile = [
    [x0, y],
    [x0 + r * 2.05, y],
    [x0 + r * 1.02, y - r * 1.75],
  ]
    .map(([x, yy]) => pearl(x!, yy!, r, line, W))
    .join('');
  const leftover = pearl(x0 - r * 3, y + 1, r * 0.95, line, W);
  return h(
    'g',
    { class: 'dv-pearls' },
    h('ellipse', {
      cx: x0 + r,
      cy: GROUND + 2,
      rx: r * 2.6,
      ry: r * 0.5,
      fill: '#2a2140',
      opacity: 0.12,
    }),
    pile,
    h('g', { class: 'dv-leftover' }, leftover),
  );
}

export function shineSparkles(ctx: Ctx): string {
  const hd = ctx.sk.head;
  const { top, w } = ctx.sk.body;
  const pts = [
    { x: hd.cx + hd.rx * 0.95, y: hd.cy - hd.ry * 0.7, r: 12 },
    { x: CX - w * 0.62, y: top + 30, r: 9 },
    { x: CX + w * 0.6, y: top + 70, r: 7 },
  ];
  return h(
    'g',
    { class: 'dv-shine' },
    ...pts.map((p, i) =>
      h('path', {
        class: `dv-twinkle dv-twinkle-${i + 1}`,
        d: sparkleD(p.x, p.y, p.r * (0.8 + ctx.sk.t * 0.4)),
        fill: '#ffffff',
        stroke: ctx.paint.accentLine,
        'stroke-width': 1.5,
      }),
    ),
  );
}

/** Clockwork's wind-up key on its back (drawn behind the body). */
export function windKey(ctx: Ctx): string {
  const { top, w, h: bh } = ctx.sk.body;
  const x = CX + w * 0.4;
  const y = top + bh * 0.36;
  const s = lerp(22, 32, ctx.sk.t);
  const W = ctx.W * 0.75;
  const bx = x + s * 1.35;
  return h(
    'g',
    null,
    h('rect', {
      x,
      y: y - s * 0.13,
      width: s * 1.05,
      height: s * 0.26,
      rx: s * 0.1,
      fill: ctx.paint.accent2,
      stroke: ctx.paint.accentLine,
      'stroke-width': W,
    }),
    h(
      'g',
      { transform: `translate(${bx.toFixed(2)} ${y.toFixed(2)})` },
      h(
        'g',
        { class: 'dv-key' },
        h('ellipse', {
          cx: 0,
          cy: -s * 0.48,
          rx: s * 0.4,
          ry: s * 0.46,
          fill: ctx.paint.accent,
          stroke: ctx.paint.accentLine,
          'stroke-width': W,
        }),
        h('ellipse', {
          cx: 0,
          cy: s * 0.48,
          rx: s * 0.4,
          ry: s * 0.46,
          fill: ctx.paint.accent,
          stroke: ctx.paint.accentLine,
          'stroke-width': W,
        }),
        h('circle', { cx: 0, cy: -s * 0.5, r: s * 0.14, fill: ctx.paint.accentShade }),
        h('circle', { cx: 0, cy: s * 0.5, r: s * 0.14, fill: ctx.paint.accentShade }),
        h('rect', {
          x: -s * 0.22,
          y: -s * 0.16,
          width: s * 0.44,
          height: s * 0.32,
          rx: s * 0.08,
          fill: ctx.paint.accent2,
          stroke: ctx.paint.accentLine,
          'stroke-width': W,
        }),
      ),
    ),
  );
}

/** Glimmer: a fluffy white beard under the chin. */
export function beard(ctx: Ctx): string {
  const m = ctx.sk.muzzle;
  const hd = ctx.sk.head;
  const top = m.cy + m.ry * 0.55;
  const w = m.rx * 1.25;
  const len = hd.ry * 0.95;
  const d =
    M(CX - w, top - 6) +
    Q(CX - w * 1.05, top + len * 0.45, CX - w * 0.55, top + len * 0.7) +
    Q(CX - w * 0.4, top + len * 0.92, CX - w * 0.1, top + len * 0.85) +
    Q(CX, top + len * 1.12, CX + w * 0.12, top + len * 0.86) +
    Q(CX + w * 0.42, top + len * 0.94, CX + w * 0.56, top + len * 0.7) +
    Q(CX + w * 1.05, top + len * 0.45, CX + w, top - 6) +
    Q(CX, top + len * 0.2, CX - w, top - 6) +
    'Z';
  const strands =
    M(CX - w * 0.5, top + len * 0.25) +
    Q(CX - w * 0.45, top + len * 0.5, CX - w * 0.32, top + len * 0.66) +
    M(CX + w * 0.5, top + len * 0.25) +
    Q(CX + w * 0.45, top + len * 0.5, CX + w * 0.32, top + len * 0.66) +
    M(CX, top + len * 0.35) +
    L(CX, top + len * 0.8);
  return h(
    'g',
    { class: 'dv-beard' },
    h('path', {
      d,
      fill: '#fbf8f1',
      stroke: '#8d86a6',
      'stroke-width': ctx.W * 0.8,
      'stroke-linejoin': 'round',
    }),
    h('path', {
      d: strands,
      fill: 'none',
      stroke: '#c9c3d9',
      'stroke-width': ctx.W * 0.6,
      'stroke-linecap': 'round',
    }),
  );
}

/** Glimmer: big friendly eyebrows. */
export function bushyBrows(ctx: Ctx): string {
  const e = ctx.sk.eye;
  const lift =
    ctx.expression === 'curious'
      ? 0.35
      : ctx.expression === 'happy' || ctx.expression === 'proud'
        ? 0.25
        : 0.1;
  let out = '';
  for (const s of [-1, 1]) {
    const x = CX + s * e.dx;
    const y = e.y - e.r * (1.45 + lift);
    const d =
      M(x - s * e.r * 0.2, y + e.r * 0.25) +
      Q(x, y - e.r * 0.3, x + s * e.r * 1.0, y + e.r * 0.05) +
      Q(x + s * e.r * 0.8, y + e.r * 0.25, x + s * e.r * 1.05, y + e.r * 0.45) +
      Q(x + s * e.r * 0.4, y + e.r * 0.15, x - s * e.r * 0.2, y + e.r * 0.25) +
      'Z';
    out += h('path', {
      d,
      fill: '#fbf8f1',
      stroke: '#8d86a6',
      'stroke-width': ctx.W * 0.6,
      'stroke-linejoin': 'round',
    });
  }
  return h('g', { class: 'dv-bushy-brows' }, out);
}

/** Glimmer: round reading spectacles perched on the snout. */
export function spectacles(ctx: Ctx): string {
  const e = ctx.sk.eye;
  const r = e.r * 1.08;
  const y = e.y + e.r * 0.2;
  const W = ctx.W * 0.8;
  const frame = '#b8862b';
  return h(
    'g',
    { class: 'dv-spectacles' },
    ...[-1, 1].map((s) =>
      h('circle', {
        cx: CX + s * e.dx,
        cy: y,
        r,
        fill: '#e8f6ff',
        'fill-opacity': 0.28,
        stroke: frame,
        'stroke-width': W * 1.3,
      }),
    ),
    h('path', {
      d: M(CX - e.dx + r, y - r * 0.15) + Q(CX, y - r * 0.55, CX + e.dx - r, y - r * 0.15),
      fill: 'none',
      stroke: frame,
      'stroke-width': W * 1.2,
      'stroke-linecap': 'round',
    }),
    ...[-1, 1].map((s) =>
      h('path', {
        d:
          M(CX + s * (e.dx - r * 0.45), y - r * 0.55) + L(CX + s * (e.dx - r * 0.15), y - r * 0.75),
        stroke: '#ffffff',
        'stroke-width': W,
        'stroke-linecap': 'round',
        opacity: 0.8,
      }),
    ),
  );
}

/** Glimmer: a cozy knitted shawl over the shoulders. */
export function shawl(ctx: Ctx): string {
  const { top, w, h: bh } = ctx.sk.body;
  const y = top + bh * 0.08;
  const d =
    M(CX - w * 0.5, y + bh * 0.1) +
    Q(CX - w * 0.42, y - bh * 0.08, CX, y - bh * 0.06) +
    Q(CX + w * 0.42, y - bh * 0.08, CX + w * 0.5, y + bh * 0.1) +
    L(CX + w * 0.4, y + bh * 0.36) +
    Q(CX + w * 0.2, y + bh * 0.2, CX, y + bh * 0.42) +
    Q(CX - w * 0.2, y + bh * 0.2, CX - w * 0.4, y + bh * 0.36) +
    'Z';
  let knit = '';
  for (let i = -3; i <= 3; i++)
    knit += M(CX + i * w * 0.11, y - bh * 0.02) + L(CX + i * w * 0.1, y + bh * 0.18);
  return h(
    'g',
    { class: 'dv-shawl' },
    h('path', {
      d,
      fill: '#c8577a',
      stroke: '#6b2440',
      'stroke-width': ctx.W * 0.85,
      'stroke-linejoin': 'round',
    }),
    h('path', {
      d: knit,
      stroke: '#e58aa6',
      'stroke-width': ctx.W * 0.6,
      'stroke-linecap': 'round',
      opacity: 0.8,
    }),
    h('circle', {
      cx: CX,
      cy: y + bh * 0.3,
      r: w * 0.045,
      fill: '#ffd23f',
      stroke: '#8a5a00',
      'stroke-width': ctx.W * 0.5,
    }),
  );
}

/** Sleepy zZ (animated by .dv-zzz). */
export function zzz(ctx: Ctx): string {
  const hd = ctx.sk.head;
  const s = lerp(18, 24, ctx.sk.t);
  const z = (x: number, y: number, k: number, cls: string): string =>
    h('path', {
      class: cls,
      d:
        M(x - s * k * 0.5, y - s * k * 0.5) +
        L(x + s * k * 0.5, y - s * k * 0.5) +
        L(x - s * k * 0.5, y + s * k * 0.5) +
        L(x + s * k * 0.5, y + s * k * 0.5),
      fill: 'none',
      stroke: '#6a4ce0',
      'stroke-width': s * k * 0.22,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
  const x = hd.cx + hd.rx * 0.95;
  const y = hd.cy - hd.ry * 0.85;
  return h(
    'g',
    { class: 'dv-zzz' },
    z(x, y + s * 1.2, 0.7, 'dv-z dv-z-1'),
    z(x + s * 1.1, y, 1, 'dv-z dv-z-2'),
    z(x + s * 2.4, y - s * 1.3, 1.3, 'dv-z dv-z-3'),
  );
}

/** Happy sparkles around the head. */
export function joySparkles(ctx: Ctx): string {
  const hd = ctx.sk.head;
  const pts = [
    { x: hd.cx - hd.rx * 1.12, y: hd.cy - hd.ry * 0.7, r: 13 },
    { x: hd.cx + hd.rx * 1.15, y: hd.cy - hd.ry * 0.55, r: 11 },
    { x: hd.cx + hd.rx * 0.9, y: hd.cy - hd.ry * 1.25, r: 8 },
  ];
  return h(
    'g',
    { class: 'dv-joy' },
    ...pts.map((p, i) =>
      h('path', {
        class: `dv-twinkle dv-twinkle-${i + 1}`,
        d: sparkleD(p.x, p.y, p.r),
        fill: '#ffd23f',
        stroke: '#c47f0a',
        'stroke-width': 1.5,
      }),
    ),
  );
}

/** Proud glow behind the dragon. */
export function proudGlow(ctx: Ctx): string {
  const { top, h: bh } = ctx.sk.body;
  const fill = glowGradient(ctx, 'proud-glow', '#ffe680', 0.85);
  const cy = top + bh * 0.1;
  const r = Math.max(ctx.sk.wing.span * 1.4, 170) + ctx.sk.body.w * 0.2;
  return h(
    'g',
    { transform: `translate(${CX} ${cy.toFixed(2)})` },
    h('g', { class: 'dv-glow' }, h('circle', { cx: 0, cy: 0, r, fill })),
  );
}

/** Crowned aura: golden glow ring + twinkling sparkles. */
export function crownAura(ctx: Ctx): { back: string; front: string } {
  const { top, h: bh } = ctx.sk.body;
  const fill = glowGradient(ctx, 'aura-glow', '#ffd23f', 0.55);
  const cy = top + bh * 0.05;
  const R = 240;
  const back = h(
    'g',
    { transform: `translate(${CX} ${cy.toFixed(2)})` },
    h('g', { class: 'dv-aura' }, h('circle', { cx: 0, cy: 0, r: R, fill })),
  );
  const spots = [
    { a: -150, d: 0.86, r: 15 },
    { a: -112, d: 0.98, r: 10 },
    { a: -64, d: 0.94, r: 13 },
    { a: -28, d: 0.9, r: 9 },
    { a: 196, d: 0.8, r: 9 },
    { a: 18, d: 0.84, r: 12 },
  ];
  const front = h(
    'g',
    { class: 'dv-sparkles' },
    ...spots.map((s, i) => {
      const p = polar(CX, cy, R * s.d * 0.86, s.a);
      return h('path', {
        class: `dv-sparkle dv-sparkle-${i + 1}`,
        d: sparkleD(p.x, p.y, s.r),
        fill: '#fff3b0',
        stroke: '#e0a020',
        'stroke-width': 1.6,
      });
    }),
  );
  return { back, front };
}

/** Left edge of a ground prop standing beside the dragon (pearl pile, number line, berries). */
export function groundPropLeft(ctx: Ctx): number {
  return CX - ctx.sk.body.w * 0.62 - 150;
}

/** Hop's number line on the ground: ticks 0-4 with two dotted hop arcs and a hop arrow. */
export function numberLine(ctx: Ctx): string {
  const x0 = groundPropLeft(ctx) + 6;
  const step = 30;
  const y = GROUND - 4;
  const line = ctx.paint.line;
  const W = ctx.W * 0.55;
  let ticks = '';
  let dots = '';
  for (let i = 0; i <= 4; i++) {
    const x = x0 + 10 + i * step;
    ticks += M(x, y - 7) + L(x, y + 7);
    dots += h('circle', { cx: x, cy: y, r: 3.2, fill: line });
  }
  const arc = (a: number, b: number): string =>
    M(x0 + 10 + a * step + 3, y - 10) +
    Q(x0 + 10 + ((a + b) / 2) * step, y - 46, x0 + 10 + b * step - 3, y - 10);
  const end = { x: x0 + 10 + 3 * step - 3, y: y - 10 };
  return h(
    'g',
    { class: 'dv-number-line' },
    h('path', {
      d: M(x0, y) + L(x0 + step * 4 + 20, y) + ticks,
      fill: 'none',
      stroke: line,
      'stroke-width': W,
      'stroke-linecap': 'round',
    }),
    dots,
    h('path', {
      d: arc(1, 2) + arc(2, 3),
      fill: 'none',
      stroke: ctx.paint.accent,
      'stroke-width': W * 1.1,
      'stroke-linecap': 'round',
      'stroke-dasharray': '1 7',
    }),
    h('path', {
      d: M(end.x - 8, end.y - 9) + L(end.x, end.y) + L(end.x + 3, end.y - 12),
      fill: 'none',
      stroke: ctx.paint.accent,
      'stroke-width': W * 1.1,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
    h('path', {
      d: roundRectD(x0 + 10 + 3 * step - 8, y - 28, 16, 10, 5),
      fill: ctx.paint.accent2,
      stroke: line,
      'stroke-width': W * 0.6,
      opacity: 0.9,
    }),
  );
}

/** Nibble's row of five berries on the ground; the last two are nibbled (take away two). */
export function berryRow(ctx: Ctx): string {
  const r = lerp(10, 12, ctx.sk.t);
  const x0 = groundPropLeft(ctx) + r + 4;
  const y = GROUND - r;
  const line = ctx.paint.accentLine;
  let out = h('ellipse', {
    cx: x0 + r * 5,
    cy: GROUND + 2,
    rx: r * 6.2,
    ry: r * 0.5,
    fill: '#2a2140',
    opacity: 0.12,
  });
  for (let i = 0; i < 5; i++)
    out += berry(x0 + i * r * 2.3, y, r, ctx.paint.accent, line, ctx.W * 0.45, i >= 3);
  return h('g', { class: 'dv-berry-row' }, out);
}

const propShadow = (x: number, rx: number): string =>
  h('ellipse', { cx: x, cy: GROUND + 2, rx, ry: rx * 0.1, fill: '#2a2140', opacity: 0.12 });

/** Bead's counting rods on the ground: three ten-bead rods and four loose beads (34). */
export function beadRods(ctx: Ctx): string {
  const r = lerp(5.5, 6.5, ctx.sk.t);
  const x0 = groundPropLeft(ctx) + 4;
  const W = ctx.W * 0.4;
  const rod = (x: number): string => {
    let beads = '';
    for (let i = 0; i < 10; i++) {
      const y = GROUND - r - i * r * 1.9;
      const fill = i < 5 ? ctx.paint.accent : lighten(ctx.paint.accent, 0.3);
      beads += h('circle', {
        cx: x,
        cy: y,
        r,
        fill,
        stroke: outlineOf(fill, 0.55),
        'stroke-width': W,
      });
    }
    return (
      h('path', {
        d: M(x, GROUND) + L(x, GROUND - r * 19.6),
        stroke: '#a8743a',
        'stroke-width': W * 1.4,
        'stroke-linecap': 'round',
      }) + beads
    );
  };
  let out = propShadow(x0 + r * 9, r * 11);
  for (let k = 0; k < 3; k++) out += rod(x0 + r + k * r * 2.6);
  for (let i = 0; i < 4; i++) {
    const x = x0 + r * 10 + i * r * 2.3;
    out += h('circle', {
      cx: x,
      cy: GROUND - r,
      r,
      fill: ctx.paint.accent2,
      stroke: outlineOf(ctx.paint.accent2, 0.55),
      'stroke-width': W,
    });
  }
  return h('g', { class: 'dv-bead-rods' }, out);
}

/** Tumble's bundle of ten sticks tied with a ribbon, with three loose sticks beside it (13). */
export function stickBundle(ctx: Ctx): string {
  const s = lerp(0.9, 1.05, ctx.sk.t);
  const x0 = groundPropLeft(ctx) + 10;
  const len = 70 * s;
  const stickW = 6 * s;
  const wood = '#d9a45a';
  const line = outlineOf(wood, 0.55);
  let out = propShadow(x0 + 60 * s, 70 * s);
  const bx = x0 + 34 * s;
  let bundle = '';
  for (let i = 0; i < 10; i++) {
    const off = (i - 4.5) * stickW * 0.92;
    const tilt = (i - 4.5) * 1.6 * s;
    bundle += h('path', {
      d: roundRectD(bx + off - stickW / 2 + tilt * 0.3, GROUND - len, stickW, len, stickW / 2),
      fill: i % 2 ? wood : lighten(wood, 0.12),
      stroke: line,
      'stroke-width': ctx.W * 0.35,
      transform: `rotate(${tilt.toFixed(2)} ${(bx + off).toFixed(2)} ${GROUND})`,
    });
  }
  out += bundle;
  out += h('path', {
    d: roundRectD(bx - stickW * 5.1, GROUND - len * 0.56, stickW * 10.2, 9 * s, 4 * s),
    fill: ctx.paint.accent,
    stroke: ctx.paint.accentLine,
    'stroke-width': ctx.W * 0.4,
  });
  const kx = bx + stickW * 5.2;
  const ky = GROUND - len * 0.52;
  out += h('path', {
    d:
      M(kx, ky) +
      Q(kx + 12 * s, ky - 14 * s, kx + 4 * s, ky - 16 * s) +
      Q(kx - 2 * s, ky - 10 * s, kx, ky) +
      M(kx, ky) +
      Q(kx + 16 * s, ky + 2 * s, kx + 14 * s, ky + 12 * s),
    fill: 'none',
    stroke: ctx.paint.accent,
    'stroke-width': ctx.W * 0.6,
    'stroke-linecap': 'round',
  });
  for (let i = 0; i < 3; i++) {
    const x = x0 + 86 * s + i * 13 * s;
    out += h('path', {
      d: roundRectD(x, GROUND - stickW - 1, len * 0.62, stickW, stickW / 2),
      fill: lighten(wood, 0.08),
      stroke: line,
      'stroke-width': ctx.W * 0.35,
      transform: `rotate(${(-8 + i * 6).toFixed(0)} ${x.toFixed(2)} ${GROUND})`,
    });
  }
  return h('g', { class: 'dv-stick-bundle' }, out);
}

/** Penny's little drawstring purse with a short stack of coins beside it. */
export function coinPurse(ctx: Ctx): string {
  const s = lerp(0.9, 1.05, ctx.sk.t);
  const x0 = groundPropLeft(ctx) + 10;
  const cloth = '#d8604a';
  const line = outlineOf(cloth, 0.55);
  const cx = x0 + 42 * s;
  const purse =
    M(cx - 18 * s, GROUND - 56 * s) +
    Q(cx - 46 * s, GROUND - 30 * s, cx - 34 * s, GROUND - 4 * s) +
    Q(cx, GROUND + 4 * s, cx + 34 * s, GROUND - 4 * s) +
    Q(cx + 46 * s, GROUND - 30 * s, cx + 18 * s, GROUND - 56 * s) +
    'Z';
  const gold = ctx.paint.accent;
  const goldLine = ctx.paint.accentLine;
  const coin = (x: number, y: number, rx: number): string =>
    h('ellipse', {
      cx: x,
      cy: y,
      rx,
      ry: rx * 0.36,
      fill: gold,
      stroke: goldLine,
      'stroke-width': ctx.W * 0.4,
    });
  let stack = '';
  for (let i = 0; i < 4; i++) stack += coin(x0 + 108 * s, GROUND - 4 * s - i * 7 * s, 15 * s);
  const top = { x: x0 + 108 * s, y: GROUND - 4 * s - 3 * 7 * s };
  return h(
    'g',
    { class: 'dv-coin-purse' },
    propShadow(x0 + 70 * s, 72 * s),
    h('path', { d: purse, fill: cloth, stroke: line, 'stroke-width': ctx.W * 0.55 }),
    h('path', {
      d: M(cx - 20 * s, GROUND - 50 * s) + Q(cx, GROUND - 42 * s, cx + 20 * s, GROUND - 50 * s),
      fill: 'none',
      stroke: '#ffe27a',
      'stroke-width': ctx.W * 0.6,
      'stroke-linecap': 'round',
    }),
    h('path', {
      d:
        M(cx - 14 * s, GROUND - 56 * s) +
        L(cx - 22 * s, GROUND - 68 * s) +
        M(cx + 14 * s, GROUND - 56 * s) +
        L(cx + 22 * s, GROUND - 68 * s),
      stroke: line,
      'stroke-width': ctx.W * 0.6,
      'stroke-linecap': 'round',
    }),
    h('circle', {
      cx: cx + 8 * s,
      cy: GROUND - 54 * s,
      r: 10 * s,
      fill: gold,
      stroke: goldLine,
      'stroke-width': ctx.W * 0.4,
    }),
    h('path', { d: sparkleD(cx - 14 * s, GROUND - 26 * s, 6 * s), fill: '#fff3b0', opacity: 0.9 }),
    coin(x0 + 140 * s, GROUND - 3 * s, 14 * s),
    stack,
    h('path', {
      d: sparkleD(top.x + 6 * s, top.y - 12 * s, 7 * s),
      fill: '#fff3b0',
      stroke: '#e0a020',
      'stroke-width': 1.4,
    }),
  );
}

/** Nibble's two little front teeth just under the smile. */
export function buckTeeth(ctx: Ctx): string {
  const m = ctx.sk.mouth;
  const tw = Math.max(5, m.w * 0.24);
  const th = tw * 1.15;
  const y = m.y + 1;
  return h('path', {
    class: 'dv-teeth',
    d:
      roundRectD(CX - tw, y - 2, tw - 0.6, th, tw * 0.3) +
      roundRectD(CX + 0.6, y - 2, tw - 0.6, th, tw * 0.3),
    fill: '#ffffff',
    stroke: ctx.paint.line,
    'stroke-width': ctx.W * 0.35,
  });
}
