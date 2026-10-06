import { mid, polar, type Pt } from '../svg/num';
import { M, Mp, Q, Qp, Cp, L, Lp, polyD, smoothClosedD, circleD } from '../svg/path';
import { h } from '../svg/xml';
import { linearGradient, type Ctx } from './ctx';
import { cloudUnion, limb, type Circle } from './shapes';
import { CX } from './skeleton';
import type { WingStyle } from './types';

/** One wing drawn in local coordinates: origin = shoulder, extends to +x and up (-y). */
export interface WingArt {
  /** Membrane outline(s) used to clip wing paints. */
  membrane: string;
  /** Layer drawn under the paint overlay (membrane fills). */
  base: string;
  /** Layer drawn over the paint overlay (bones, outlines, claws). */
  top: string;
}

function wingFill(ctx: Ctx, S: number, H: number): string {
  return linearGradient(
    ctx,
    'wing-grad',
    [
      [0, ctx.paint.wingShade],
      [0.5, ctx.paint.wing],
      [1, ctx.paint.wingLight],
    ],
    { x: 0, y: 0 },
    { x: S, y: -H },
  );
}

function scallop(a: Pt, b: Pt, toward: Pt, k = 0.3): string {
  const m = mid(a, b);
  return Qp({ x: m.x + (toward.x - m.x) * k, y: m.y + (toward.y - m.y) * k }, b);
}

function bat(ctx: Ctx, S: number, H: number, angular = false): WingArt {
  const root0 = { x: 0, y: -0.16 * H };
  const elbow = { x: 0.36 * S, y: -0.84 * H };
  const tip = { x: 0.95 * S, y: -1.0 * H };
  const f1 = { x: 1.0 * S, y: -0.42 * H };
  const f2 = { x: 0.74 * S, y: -0.1 * H };
  const f3 = { x: 0.42 * S, y: 0.06 * H };
  const root1 = { x: 0.04 * S, y: 0.14 * H };
  const inner = { x: 0.5 * S, y: -0.58 * H };
  let d: string;
  if (angular) {
    d = polyD([
      root0,
      elbow,
      tip,
      f1,
      { x: 0.8 * S, y: -0.3 * H },
      f2,
      { x: 0.5 * S, y: -0.12 * H },
      f3,
      root1,
    ]);
  } else {
    d =
      Mp(root0) +
      Cp({ x: 0.06 * S, y: -0.52 * H }, { x: 0.2 * S, y: -0.78 * H }, elbow) +
      Cp({ x: 0.56 * S, y: -0.9 * H }, { x: 0.78 * S, y: -1.02 * H }, tip) +
      scallop(tip, f1, inner, 0.26) +
      scallop(f1, f2, inner, 0.3) +
      scallop(f2, f3, inner, 0.3) +
      scallop(f3, root1, inner, 0.2) +
      'Z';
  }
  const W = ctx.W;
  const wrist = { x: 0.9 * S, y: -0.95 * H };
  const bones =
    Mp(wrist) +
    Qp({ x: 0.96 * S, y: -0.7 * H }, f1) +
    Mp(wrist) +
    Qp({ x: 0.8 * S, y: -0.5 * H }, f2) +
    Mp(elbow) +
    Qp({ x: 0.44 * S, y: -0.36 * H }, f3);
  const armBone = [
    root0,
    { x: 0.18 * S, y: -0.66 * H },
    elbow,
    { x: 0.66 * S, y: -0.97 * H },
    wrist,
  ];
  const claw = polyD([
    { x: wrist.x - 0.02 * S, y: wrist.y - 0.02 * H },
    { x: wrist.x + 0.1 * S + 6, y: wrist.y - 0.08 * H - 7 },
    { x: wrist.x + 0.06 * S, y: wrist.y + 0.06 * H },
  ]);
  return {
    membrane: d,
    base: h('path', { d, fill: wingFill(ctx, S, H) }),
    top:
      h('path', {
        d: bones,
        fill: 'none',
        stroke: ctx.paint.wingLine,
        'stroke-width': W * 0.7,
        'stroke-linecap': 'round',
        opacity: 0.75,
      }) +
      h('path', {
        d,
        fill: 'none',
        stroke: ctx.paint.wingLine,
        'stroke-width': W * 0.9,
        'stroke-linejoin': 'round',
      }) +
      h('path', {
        d: claw,
        fill: ctx.paint.horn,
        stroke: ctx.paint.hornLine,
        'stroke-width': W * 0.6,
        'stroke-linejoin': 'round',
      }) +
      limb(armBone, Math.max(7, S * 0.07), ctx.paint.body, ctx.paint.line, W * 0.8),
  };
}

function fin(ctx: Ctx, S: number, H: number): WingArt {
  const rays = [-104, -78, -52, -26, -4];
  const tips = rays.map((a, i) => {
    const k = [0.9, 1.04, 1.06, 0.98, 0.82][i]!;
    const p = polar(0, 0, 1, a);
    return { x: p.x * S * k, y: p.y * H * k };
  });
  const root1 = { x: 0.1 * S, y: 0.1 * H };
  const root0 = { x: -0.06 * S, y: -0.1 * H };
  let d = Mp(root0) + Lp(tips[0]!);
  for (let i = 1; i < tips.length; i++) d += scallop(tips[i - 1]!, tips[i]!, { x: 0, y: 0 }, 0.16);
  d += Qp({ x: 0.5 * S, y: 0.06 * H }, root1) + 'Z';
  const raysD = tips
    .map((p) => M(0.02 * S, -0.02 * H) + Q(p.x * 0.5 + 4, p.y * 0.55, p.x * 0.96, p.y * 0.96))
    .join('');
  return {
    membrane: d,
    base: h('path', { d, fill: wingFill(ctx, S, H) }),
    top:
      h('path', {
        d: raysD,
        fill: 'none',
        stroke: ctx.paint.wingLine,
        'stroke-width': ctx.W * 0.6,
        'stroke-linecap': 'round',
        opacity: 0.6,
      }) +
      h('path', {
        d,
        fill: 'none',
        stroke: ctx.paint.wingLine,
        'stroke-width': ctx.W * 0.9,
        'stroke-linejoin': 'round',
      }),
  };
}

function leafShape(
  base: Pt,
  angle: number,
  len: number,
  width: number,
): { d: string; mid: string; tip: Pt } {
  const tip = polar(base.x, base.y, len, angle);
  const n = polar(0, 0, width / 2, angle - 90);
  const a = polar(base.x, base.y, len * 0.3, angle);
  const b = polar(base.x, base.y, len * 0.72, angle);
  const d =
    Mp(base) +
    Cp(
      { x: a.x + n.x * 1.5, y: a.y + n.y * 1.5 },
      { x: b.x + n.x * 1.3, y: b.y + n.y * 1.3 },
      tip,
    ) +
    Cp(
      { x: b.x - n.x * 1.3, y: b.y - n.y * 1.3 },
      { x: a.x - n.x * 1.5, y: a.y - n.y * 1.5 },
      base,
    ) +
    'Z';
  let veins = Mp(base) + Lp(polar(base.x, base.y, len * 0.9, angle));
  for (const k of [0.32, 0.52, 0.72]) {
    const p = polar(base.x, base.y, len * k, angle);
    for (const s of [-1, 1]) {
      const q = polar(p.x, p.y, width * 0.36 * (1.05 - k * 0.5), angle + s * 52);
      veins += Mp(p) + Lp(q);
    }
  }
  return { d, mid: veins, tip };
}

function leaf(ctx: Ctx, S: number, H: number): WingArt {
  const big = leafShape({ x: 0, y: 0 }, -56, Math.max(S, H) * 1.08, Math.max(S, H) * 0.5);
  const small = leafShape(
    { x: 0.04 * S, y: 0.02 * H },
    -12,
    Math.max(S, H) * 0.74,
    Math.max(S, H) * 0.36,
  );
  const fill = wingFill(ctx, S, H);
  const stroke = {
    fill: 'none',
    stroke: ctx.paint.wingLine,
    'stroke-width': ctx.W * 0.9,
    'stroke-linejoin': 'round',
  };
  const vein = {
    fill: 'none',
    stroke: ctx.paint.wingLine,
    'stroke-width': ctx.W * 0.5,
    'stroke-linecap': 'round',
    opacity: 0.55,
  };
  return {
    membrane: small.d + big.d,
    base:
      h('path', { d: small.d, fill }) +
      h('path', { d: small.d, ...stroke }) +
      h('path', { d: big.d, fill }),
    top:
      h('path', { d: small.mid, ...vein }) +
      h('path', { d: big.mid, ...vein }) +
      h('path', { d: big.d, ...stroke }),
  };
}

/** Petal wing: a blossom petal with a notched tip, pale at the heart and pink at the rim. */
function petal(ctx: Ctx, S: number, H: number, angle: number): WingArt {
  const len = Math.max(S, H) * 1.06;
  const wd = len * 0.74;
  const u = polar(0, 0, 1, angle);
  const v = polar(0, 0, 1, angle - 90);
  const P = (a: number, b: number): Pt => ({
    x: u.x * a * len + v.x * b * wd,
    y: u.y * a * len + v.y * b * wd,
  });
  const d =
    Mp(P(0, 0)) +
    Cp(P(0.1, 0.44), P(0.34, 0.6), P(0.58, 0.52)) +
    Cp(P(0.8, 0.45), P(0.98, 0.32), P(1, 0.14)) +
    Qp(P(0.95, 0.03), P(0.87, 0)) +
    Qp(P(0.95, -0.03), P(1, -0.14)) +
    Cp(P(0.98, -0.32), P(0.8, -0.45), P(0.58, -0.52)) +
    Cp(P(0.34, -0.6), P(0.1, -0.44), P(0, 0)) +
    'Z';
  const veins = [-0.22, 0, 0.22]
    .map((o) => Mp(P(0.04, 0)) + Qp(P(0.4, o * 0.5), P(0.74, o)))
    .join('');
  const gid = ctx.def(`petal-grad-${angle}`, (id) =>
    h(
      'radialGradient',
      { id, gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: len * 1.02 },
      h('stop', { offset: '0', 'stop-color': '#fff7fb' }),
      h('stop', { offset: '0.45', 'stop-color': ctx.paint.wingLight }),
      h('stop', { offset: '0.85', 'stop-color': ctx.paint.wing }),
      h('stop', { offset: '1', 'stop-color': ctx.paint.wingShade }),
    ),
  );
  return {
    membrane: d,
    base: h('path', { d, fill: `url(#${gid})` }),
    top:
      h('path', {
        d: veins,
        fill: 'none',
        stroke: ctx.paint.wingLine,
        'stroke-width': ctx.W * 0.5,
        'stroke-linecap': 'round',
        opacity: 0.4,
      }) +
      h('path', {
        d,
        fill: 'none',
        stroke: ctx.paint.wingLine,
        'stroke-width': ctx.W * 0.9,
        'stroke-linejoin': 'round',
      }),
  };
}

function cloudWing(ctx: Ctx, S: number, H: number): WingArt {
  const circles: Circle[] = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    circles.push({
      x: 0.06 * S + t * 0.76 * S,
      y: -0.12 * H - t * 0.72 * H + t * t * 0.1 * H,
      r: H * (0.25 - t * 0.08),
    });
  }
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    circles.push({
      x: 0.3 * S + t * 0.6 * S,
      y: -0.12 * H - t * 0.32 * H,
      r: H * (0.2 - t * 0.05),
    });
  }
  const d = circles.map((c) => circleD(c.x, c.y, c.r)).join('');
  return {
    membrane: d,
    base: cloudUnion(circles, wingFill(ctx, S, H), ctx.paint.wingLine, ctx.W * 0.9),
    top: circles
      .slice(0, 5)
      .map((c) =>
        h('ellipse', {
          cx: c.x - c.r * 0.3,
          cy: c.y - c.r * 0.35,
          rx: c.r * 0.35,
          ry: c.r * 0.2,
          fill: '#ffffff',
          opacity: 0.6,
        }),
      )
      .join(''),
  };
}

function crystalWing(ctx: Ctx, S: number, H: number): WingArt {
  const root = { x: 0, y: 0 };
  const v = [
    { x: -0.04 * S, y: -0.2 * H },
    { x: 0.14 * S, y: -0.78 * H },
    { x: 0.5 * S, y: -1.02 * H },
    { x: 0.98 * S, y: -0.8 * H },
    { x: 0.88 * S, y: -0.36 * H },
    { x: 0.56 * S, y: -0.06 * H },
    { x: 0.14 * S, y: 0.12 * H },
  ];
  const d = polyD(v);
  let facets = '';
  for (let i = 0; i < v.length - 1; i++) {
    facets += h('path', {
      d: polyD([root, v[i]!, v[i + 1]!]),
      fill: i % 2 === 0 ? ctx.paint.wingLight : ctx.paint.wing,
      opacity: 0.9,
    });
  }
  const lines = v.map((p) => Mp(root) + Lp(p)).join('');
  return {
    membrane: d,
    base: h('path', { d, fill: wingFill(ctx, S, H) }) + facets,
    top:
      h('path', {
        d: lines,
        fill: 'none',
        stroke: ctx.paint.wingLine,
        'stroke-width': ctx.W * 0.45,
        opacity: 0.5,
      }) +
      h('path', {
        d,
        fill: 'none',
        stroke: ctx.paint.wingLine,
        'stroke-width': ctx.W * 0.9,
        'stroke-linejoin': 'round',
      }) +
      h('path', {
        d: M(0.5 * S, -0.9 * H) + L(0.62 * S, -0.82 * H),
        stroke: '#ffffff',
        'stroke-width': ctx.W * 0.8,
        'stroke-linecap': 'round',
        opacity: 0.8,
      }),
  };
}

function shellWing(ctx: Ctx, S: number, H: number): WingArt {
  const angles = [-112, -94, -76, -58, -40, -22, -4];
  const edge = angles.map((a) => {
    const p = polar(0, 0, 1, a);
    return { x: p.x * S * 1.02, y: p.y * H * 1.02 };
  });
  let d = M(0, 0.06 * H) + Lp(edge[0]!);
  for (let i = 1; i < edge.length; i++) d += scallop(edge[i - 1]!, edge[i]!, { x: 0, y: 0 }, -0.2);
  d += 'Z';
  const ribs = edge.map((p) => M(0, 0.02 * H) + L(p.x * 0.94, p.y * 0.94)).join('');
  const fill = ctx.def('shell-grad', (id) =>
    h(
      'radialGradient',
      { id, gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: Math.max(S, H) },
      h('stop', { offset: '0', 'stop-color': ctx.paint.wingShade }),
      h('stop', { offset: '0.45', 'stop-color': ctx.paint.wing }),
      h('stop', { offset: '0.8', 'stop-color': ctx.paint.wingLight }),
      h('stop', { offset: '1', 'stop-color': ctx.paint.accent2 }),
    ),
  );
  return {
    membrane: d,
    base: h('path', { d, fill: `url(#${fill})` }),
    top:
      h('path', {
        d: ribs,
        fill: 'none',
        stroke: ctx.paint.wingLine,
        'stroke-width': ctx.W * 0.5,
        opacity: 0.5,
      }) +
      h('path', {
        d,
        fill: 'none',
        stroke: ctx.paint.wingLine,
        'stroke-width': ctx.W * 0.9,
        'stroke-linejoin': 'round',
      }),
  };
}

function featherWing(ctx: Ctx, S: number, H: number): WingArt {
  const feathers: string[] = [];
  const shapes: string[] = [];
  const rows: Array<{ n: number; len: number; from: number; to: number; r: number }> = [
    { n: 5, len: 0.62, from: -86, to: -18, r: 1 },
    { n: 4, len: 0.42, from: -80, to: -30, r: 0.7 },
  ];
  for (const row of rows) {
    for (let i = 0; i < row.n; i++) {
      const t = i / (row.n - 1);
      const a = row.from + (row.to - row.from) * t;
      const base = polar(0, 0, Math.max(S, H) * 0.36 * row.r, a - 8);
      const len = Math.max(S, H) * row.len * (1.05 - t * 0.25);
      const tip = polar(base.x, base.y, len, a + 4);
      const n1 = polar(0, 0, len * 0.18, a - 86);
      const d =
        Mp(base) +
        Qp({ x: mid(base, tip).x + n1.x, y: mid(base, tip).y + n1.y }, tip) +
        Qp({ x: mid(base, tip).x - n1.x, y: mid(base, tip).y - n1.y }, base) +
        'Z';
      shapes.push(d);
    }
  }
  const arm = smoothClosedD([
    { x: -0.05 * S, y: 0.08 * H },
    { x: 0.18 * S, y: -0.6 * H },
    { x: 0.62 * S, y: -0.82 * H },
    { x: 0.74 * S, y: -0.62 * H },
    { x: 0.36 * S, y: -0.24 * H },
  ]);
  const fill = wingFill(ctx, S, H);
  for (const d of shapes.slice(0, 5)) {
    feathers.push(
      h('path', {
        d,
        fill,
        stroke: ctx.paint.wingLine,
        'stroke-width': ctx.W * 0.7,
        'stroke-linejoin': 'round',
      }),
    );
  }
  const covert = shapes
    .slice(5)
    .map((d) =>
      h('path', {
        d,
        fill: ctx.paint.wingLight,
        stroke: ctx.paint.wingLine,
        'stroke-width': ctx.W * 0.6,
        'stroke-linejoin': 'round',
      }),
    )
    .join('');
  return {
    membrane: shapes.join('') + arm,
    base:
      feathers.join('') +
      h('path', {
        d: arm,
        fill: ctx.paint.wing,
        stroke: ctx.paint.wingLine,
        'stroke-width': ctx.W * 0.8,
      }) +
      covert,
    top: '',
  };
}

function gearShapeD(cx: number, cy: number, r: number, teeth: number): string {
  const pts: Pt[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i * 360) / (teeth * 4) - 90;
    const outer = i % 4 === 1 || i % 4 === 2;
    pts.push(polar(cx, cy, outer ? r : r * 0.8, a));
  }
  return polyD(pts) + circleD(cx, cy, r * 0.32);
}

export function gear(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  teeth: number,
  cls: string,
  fill: string,
): string {
  const d = gearShapeD(0, 0, r, teeth);
  return h(
    'g',
    { transform: `translate(${cx.toFixed(2)} ${cy.toFixed(2)})` },
    h(
      'g',
      { class: cls },
      h('path', {
        d,
        fill,
        'fill-rule': 'evenodd',
        stroke: ctx.paint.accentLine,
        'stroke-width': ctx.W * 0.6,
        'stroke-linejoin': 'round',
      }),
      h('circle', {
        cx: 0,
        cy: 0,
        r: r * 0.55,
        fill: 'none',
        stroke: ctx.paint.accentLine,
        'stroke-width': ctx.W * 0.4,
        opacity: 0.5,
      }),
    ),
  );
}

function gearWing(ctx: Ctx, S: number, H: number): WingArt {
  const w = bat(ctx, S, H);
  const rivets = [
    { x: 0.16 * S, y: -0.5 * H },
    { x: 0.3 * S, y: -0.72 * H },
    { x: 0.52 * S, y: -0.86 * H },
    { x: 0.74 * S, y: -0.92 * H },
  ]
    .map((p) =>
      h('circle', {
        cx: p.x,
        cy: p.y + Math.max(6, H * 0.08),
        r: Math.max(2, S * 0.018),
        fill: ctx.paint.accent2,
        opacity: 0.9,
      }),
    )
    .join('');
  return {
    membrane: w.membrane,
    base: w.base + rivets,
    top:
      w.top + gear(ctx, 2, -4, Math.max(10, S * 0.13), 8, 'dv-gear dv-gear-wing', ctx.paint.accent),
  };
}

export function wingArt(ctx: Ctx, style: WingStyle, S: number, H: number, angle = -58): WingArt {
  switch (style) {
    case 'fin':
      return fin(ctx, S, H);
    case 'leaf':
      return leaf(ctx, S, H);
    case 'petal':
      return petal(ctx, S, H, angle);
    case 'cloud':
      return cloudWing(ctx, S, H);
    case 'crystal':
      return crystalWing(ctx, S, H);
    case 'shell':
      return shellWing(ctx, S, H);
    case 'stone':
      return bat(ctx, S, H, true);
    case 'gear':
      return gearWing(ctx, S, H);
    case 'feather':
      return featherWing(ctx, S, H);
    default:
      return bat(ctx, S, H);
  }
}

/** Static resting wing angle per expression (degrees, local space). Young wings sit lower. */
function wingPose(ctx: Ctx): number {
  const young = (1 - ctx.sk.t) * 30;
  switch (ctx.expression) {
    case 'happy':
      return young - 12;
    case 'proud':
      return young - 8;
    case 'sleepy':
      return young + 14;
    case 'curious':
      return young - 4;
    default:
      return young;
  }
}

export type WingPaintFn = (
  membrane: string,
  side: 'l' | 'r',
  index: number,
  S: number,
  H: number,
) => string;

/** Both wings (2 or 4) with pivots at the shoulders. */
export function wings(
  ctx: Ctx,
  paintFn?: WingPaintFn,
): { back: string; anchors: Array<{ side: 'l' | 'r'; x: number; y: number }> } {
  const sk = ctx.sk;
  const r = ctx.recipe.wings;
  const S = sk.wing.span;
  const H = sk.wing.height;
  const pose = wingPose(ctx);
  const layers: Array<{
    S: number;
    H: number;
    dx: number;
    dy: number;
    angle: number;
    cls: string;
    rot: number;
  }> = [];
  if (r.count === 4) {
    layers.push({
      S: S * 0.78,
      H: H * 0.7,
      dx: sk.shoulder.dx - 6,
      dy: sk.body.h * 0.18,
      angle: -14,
      cls: '2',
      rot: 0,
    });
    layers.push({ S, H, dx: sk.shoulder.dx, dy: 0, angle: -62, cls: '', rot: 0 });
  } else {
    layers.push({ S, H, dx: sk.shoulder.dx, dy: 0, angle: -58, cls: '', rot: 0 });
  }
  const out: string[] = [];
  const anchors: Array<{ side: 'l' | 'r'; x: number; y: number }> = [];
  layers.forEach((ly, index) => {
    for (const side of ['l', 'r'] as const) {
      const x = side === 'r' ? CX + ly.dx : CX - ly.dx;
      const y = sk.shoulder.y + ly.dy;
      const art = wingArt(ctx, r.style, ly.S, ly.H, ly.angle);
      const paint = paintFn ? paintFn(art.membrane, side, index, ly.S, ly.H) : '';
      const mirror = side === 'l' ? ' scale(-1 1)' : '';
      out.push(
        h(
          'g',
          {
            transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})${mirror}${pose ? ` rotate(${pose})` : ''}`,
          },
          h('g', { class: `dv-wing-${side}${ly.cls}` }, art.base, paint, art.top),
        ),
      );
      if (index === layers.length - 1) anchors.push({ side, x, y });
    }
  });
  return { back: out.join(''), anchors };
}
