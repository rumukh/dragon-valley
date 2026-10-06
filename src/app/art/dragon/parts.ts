import { f, type Pt } from '../svg/num';
import { smoothClosedD, M, Q, C, L } from '../svg/path';
import { h } from '../svg/xml';
import { linearGradient, softGradient, type Ctx } from './ctx';
import { limb } from './shapes';
import { CX, GROUND } from './skeleton';

export function bodyPathD(ctx: Ctx): string {
  const { top, bottom, w, h: bh } = ctx.sk.body;
  const r: Pt[] = [
    { x: CX + 0.29 * w, y: top + 0.07 * bh },
    { x: CX + 0.45 * w, y: top + 0.4 * bh },
    { x: CX + 0.5 * w, y: top + 0.74 * bh },
    { x: CX + 0.38 * w, y: bottom - 0.01 * bh },
  ];
  const l = r.map((p) => ({ x: 2 * CX - p.x, y: p.y })).reverse();
  return smoothClosedD([{ x: CX, y: top }, ...r, { x: CX, y: bottom + 2 }, ...l], 1);
}

export function headPathD(ctx: Ctx, head = ctx.sk.head): string {
  const { cx, cy, rx, ry } = head;
  const r: Pt[] = [
    { x: cx + 0.72 * rx, y: cy - 0.84 * ry },
    { x: cx + rx, y: cy - 0.08 * ry },
    { x: cx + 0.86 * rx, y: cy + 0.6 * ry },
    { x: cx + 0.44 * rx, y: cy + 0.96 * ry },
  ];
  const l = r.map((p) => ({ x: 2 * cx - p.x, y: p.y })).reverse();
  return smoothClosedD([{ x: cx, y: cy - ry }, ...r, { x: cx, y: cy + ry }, ...l], 1);
}

export function bellyPathD(ctx: Ctx): string {
  const { cx, cy, rx, ry } = ctx.sk.belly;
  const k = 0.8;
  return smoothClosedD(
    [
      { x: cx, y: cy - ry },
      { x: cx + k * rx, y: cy - k * ry },
      { x: cx + rx, y: cy },
      { x: cx + k * rx, y: cy + k * ry },
      { x: cx, y: cy + ry },
      { x: cx - k * rx, y: cy + k * ry },
      { x: cx - rx, y: cy },
      { x: cx - k * rx, y: cy - k * ry },
    ],
    1,
  );
}

export function bodyFill(ctx: Ctx): string {
  const { top, w, h: bh } = ctx.sk.body;
  return softGradient(ctx, 'body-grad', ctx.paint.body, ctx.paint.bodyLight, ctx.paint.bodyShade, {
    cx: CX,
    cy: top + bh * 0.5,
    r: Math.max(w, bh) * 0.62,
  });
}

export function headFill(ctx: Ctx): string {
  const { cy, rx } = ctx.sk.head;
  return softGradient(ctx, 'head-grad', ctx.paint.body, ctx.paint.bodyLight, ctx.paint.bodyShade, {
    cx: CX,
    cy,
    r: rx * 1.05,
  });
}

export function shadow(ctx: Ctx): string {
  const w = ctx.sk.body.w;
  return h('ellipse', {
    class: 'dv-shadow',
    cx: CX + 8,
    cy: GROUND + 2,
    rx: w * 0.62,
    ry: 14 + ctx.sk.t * 4,
    fill: '#2a2140',
    opacity: 0.16,
  });
}

export function neck(ctx: Ctx): string {
  const n = ctx.sk.neck;
  if (!n) return '';
  const x0 = CX - n.w / 2;
  const d =
    M(x0, n.bottom) +
    L(x0, n.top + 20) +
    Q(x0, n.top, CX, n.top) +
    Q(CX + n.w / 2, n.top, CX + n.w / 2, n.top + 20) +
    L(CX + n.w / 2, n.bottom) +
    'Z';
  return h('path', {
    d,
    fill: ctx.paint.body,
    stroke: ctx.paint.line,
    'stroke-width': ctx.W,
    'stroke-linejoin': 'round',
  });
}

export function body(ctx: Ctx, d = bodyPathD(ctx)): string {
  return h('path', {
    class: 'dv-body',
    d,
    fill: bodyFill(ctx),
    stroke: ctx.paint.line,
    'stroke-width': ctx.W,
    'stroke-linejoin': 'round',
  });
}

export function bodySheen(ctx: Ctx): string {
  const { top, w, h: bh } = ctx.sk.body;
  return h('ellipse', {
    cx: CX - w * 0.27,
    cy: top + bh * 0.3,
    rx: w * 0.07,
    ry: bh * 0.12,
    fill: '#ffffff',
    opacity: 0.32,
    transform: `rotate(18 ${f(CX - w * 0.27)} ${f(top + bh * 0.3)})`,
  });
}

/** Belly plate: base shape + optional segment lines (markings may replace the fill). */
export function belly(ctx: Ctx, fillOverride?: string, segments = true): string {
  const b = ctx.sk.belly;
  const d = bellyPathD(ctx);
  const fill =
    fillOverride ??
    linearGradient(
      ctx,
      'belly-grad',
      [
        [0, ctx.paint.bellyLight],
        [0.55, ctx.paint.belly],
        [1, ctx.paint.bellyShade],
      ],
      { x: b.cx, y: b.cy - b.ry },
      { x: b.cx, y: b.cy + b.ry },
    );
  let lines = '';
  if (segments) {
    const clip = ctx.def('belly-clip', (id) => h('clipPath', { id }, h('path', { d })));
    const segs: string[] = [];
    for (const k of [-0.46, -0.12, 0.22, 0.56]) {
      const y = b.cy + k * b.ry;
      segs.push(
        M(b.cx - b.rx * 1.1, y - b.ry * 0.06) +
          Q(b.cx, y + b.ry * 0.12, b.cx + b.rx * 1.1, y - b.ry * 0.06),
      );
    }
    lines = h(
      'g',
      { 'clip-path': `url(#${clip})` },
      h('path', {
        d: segs.join(''),
        fill: 'none',
        stroke: ctx.paint.bellyLine,
        'stroke-width': ctx.W * 0.55,
        'stroke-linecap': 'round',
        opacity: 0.45,
      }),
    );
  }
  return (
    h('path', {
      class: 'dv-belly',
      d,
      fill,
      stroke: ctx.paint.bellyLine,
      'stroke-width': ctx.W * 0.6,
      'stroke-opacity': 0.55,
    }) + lines
  );
}

export function feet(ctx: Ctx): string {
  const ft = ctx.sk.foot;
  const out: string[] = [];
  for (const side of [-1, 1]) {
    const x = CX + side * ft.dx;
    out.push(
      h('ellipse', {
        cx: x,
        cy: ft.y,
        rx: ft.rx,
        ry: ft.ry,
        fill: ctx.paint.body,
        stroke: ctx.paint.line,
        'stroke-width': ctx.W,
      }),
    );
    // highlight + three toe beans
    out.push(
      h('ellipse', {
        cx: x - ft.rx * 0.3,
        cy: ft.y - ft.ry * 0.35,
        rx: ft.rx * 0.32,
        ry: ft.ry * 0.22,
        fill: '#ffffff',
        opacity: 0.3,
      }),
    );
    for (const k of [-0.5, 0, 0.5]) {
      out.push(
        h('ellipse', {
          cx: x + k * ft.rx * 0.95,
          cy: ft.y + ft.ry * 0.5 - Math.abs(k) * ft.ry * 0.2,
          rx: ft.rx * 0.17,
          ry: ft.ry * 0.25,
          fill: ctx.paint.bellyLight,
          stroke: ctx.paint.line,
          'stroke-width': ctx.W * 0.45,
        }),
      );
    }
  }
  return h('g', { class: 'dv-feet' }, ...out);
}

export type ArmPose = 'rest' | 'cheer' | 'chin' | 'hold' | 'relax' | 'hips';

export function armPoseFor(ctx: Ctx): { left: ArmPose; right: ArmPose; front: boolean } {
  switch (ctx.expression) {
    case 'happy':
      return { left: 'cheer', right: 'cheer', front: false };
    case 'curious':
      return { left: 'chin', right: 'rest', front: true };
    case 'eating':
      return { left: 'hold', right: 'hold', front: true };
    case 'sleepy':
      return { left: 'relax', right: 'relax', front: false };
    case 'proud':
      return { left: 'hips', right: 'hips', front: false };
    default:
      return { left: 'rest', right: 'rest', front: false };
  }
}

/** Arms; side -1 = viewer's left. */
export function arms(ctx: Ctx): string {
  const sk = ctx.sk;
  const { top, w, h: bh } = sk.body;
  const poses = armPoseFor(ctx);
  const out: string[] = [];
  for (const side of [-1, 1] as const) {
    const pose = side < 0 ? poses.left : poses.right;
    const sh = { x: CX + side * sk.arm.shoulder.x, y: sk.arm.shoulder.y };
    let pts: Pt[];
    const headBottom = sk.head.cy + sk.head.ry;
    switch (pose) {
      case 'cheer':
        pts = [
          sh,
          { x: CX + side * w * 0.56, y: top + bh * 0.06 },
          { x: CX + side * w * 0.66, y: top - bh * 0.14 },
        ];
        break;
      case 'chin':
        pts = [
          sh,
          { x: CX + side * w * 0.3, y: headBottom + bh * 0.16 },
          { x: CX + side * w * 0.1, y: headBottom + bh * 0.02 },
        ];
        break;
      case 'hold':
        pts = [
          sh,
          { x: CX + side * w * 0.3, y: headBottom + bh * 0.2 },
          { x: CX + side * w * 0.12, y: headBottom + bh * 0.06 },
        ];
        break;
      case 'relax':
        pts = [
          sh,
          { x: CX + side * w * 0.3, y: top + bh * 0.58 },
          { x: CX + side * w * 0.24, y: top + bh * 0.68 },
        ];
        break;
      case 'hips':
        pts = [
          sh,
          { x: CX + side * w * 0.56, y: top + bh * 0.46 },
          { x: CX + side * w * 0.43, y: top + bh * 0.62 },
        ];
        break;
      default:
        pts = [
          sh,
          { x: CX + side * w * 0.3, y: top + bh * 0.47 },
          { x: CX + side * sk.arm.paw.x, y: sk.arm.paw.y },
        ];
    }
    const paw = pts[pts.length - 1]!;
    const prev = pts[pts.length - 2]!;
    const dx = paw.x - prev.x;
    const dy = paw.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const t = sk.arm.thick;
    // two little claws at the paw tip
    const claws = [-0.28, 0.28]
      .map((k) => {
        const bx = paw.x + ux * t * 0.36 - uy * t * k;
        const by = paw.y + uy * t * 0.36 + ux * t * k;
        return M(bx, by) + L(bx + ux * t * 0.18, by + uy * t * 0.18);
      })
      .join('');
    out.push(
      h(
        'g',
        { class: side < 0 ? 'dv-arm-l' : 'dv-arm-r' },
        limb(pts, t, ctx.paint.body, ctx.paint.line, ctx.W),
        h('path', {
          d: claws,
          stroke: ctx.paint.line,
          'stroke-width': ctx.W * 0.6,
          'stroke-linecap': 'round',
          fill: 'none',
        }),
      ),
    );
  }
  return out.join('');
}

export function muzzle(ctx: Ctx): string {
  const m = ctx.sk.muzzle;
  const n = ctx.sk.nostril;
  const nostrils = [-1, 1]
    .map((s) =>
      h('ellipse', {
        cx: m.cx + s * n.dx,
        cy: n.y,
        rx: n.r * 1.1,
        ry: n.r * 0.75,
        fill: ctx.paint.line,
        opacity: 0.55,
        transform: `rotate(${s * 18} ${f(m.cx + s * n.dx)} ${f(n.y)})`,
      }),
    )
    .join('');
  return (
    h('ellipse', {
      cx: m.cx,
      cy: m.cy,
      rx: m.rx,
      ry: m.ry,
      fill: ctx.paint.muzzle,
      stroke: ctx.paint.line,
      'stroke-width': ctx.W * 0.55,
      'stroke-opacity': 0.4,
    }) +
    h('ellipse', {
      cx: m.cx - m.rx * 0.35,
      cy: m.cy - m.ry * 0.45,
      rx: m.rx * 0.3,
      ry: m.ry * 0.16,
      fill: '#ffffff',
      opacity: 0.45,
    }) +
    nostrils
  );
}

export function cheeks(ctx: Ctx): string {
  const c = ctx.sk.cheek;
  const op: Record<string, number> = {
    idle: 0.5,
    happy: 0.75,
    curious: 0.42,
    eating: 0.8,
    sleepy: 0.45,
    proud: 0.62,
  };
  const puff = ctx.expression === 'eating' ? 1.25 : 1;
  return [-1, 1]
    .map((s) =>
      h('ellipse', {
        cx: CX + s * c.dx,
        cy: c.y,
        rx: c.rx * puff,
        ry: c.ry * puff,
        fill: ctx.paint.cheek,
        opacity: op[ctx.expression] ?? 0.5,
      }),
    )
    .join('');
}

/** Gaze offset per expression, in eye radii. */
function gazeFor(ctx: Ctx): Pt {
  if (ctx.expression === 'curious') return { x: 0.14, y: -0.16 };
  return { x: 0, y: 0.04 };
}

type EyeStyle = 'open' | 'wide' | 'happy' | 'closed';

function eyeStyleFor(ctx: Ctx): EyeStyle {
  switch (ctx.expression) {
    case 'happy':
    case 'eating':
    case 'proud':
      return 'happy';
    case 'sleepy':
      return 'closed';
    case 'curious':
      return 'wide';
    default:
      return 'open';
  }
}

export function openEye(
  ctx: Ctx,
  ex: number,
  ey: number,
  r: number,
  side: 'l' | 'r',
  wide: boolean,
  gaze: Pt,
): string {
  const ry = r * 1.12;
  const clip = ctx.def(`eye-clip-${side}${ex.toFixed(0)}`, (id) =>
    h('clipPath', { id }, h('ellipse', { cx: ex, cy: ey, rx: r, ry })),
  );
  const irisGrad = ctx.def('iris-grad', (id) =>
    h(
      'radialGradient',
      { id, cx: '0.5', cy: '0.72', r: '0.62' },
      h('stop', { offset: '0', 'stop-color': ctx.paint.irisLight }),
      h('stop', { offset: '0.55', 'stop-color': ctx.paint.iris }),
      h('stop', { offset: '1', 'stop-color': ctx.paint.irisDark }),
    ),
  );
  const ix = ex + gaze.x * r;
  const iy = ey + gaze.y * r + r * 0.06;
  const pr = wide ? 0.5 : 0.44;
  const lid = h(
    'g',
    { transform: `translate(${f(ex)} ${f(ey - ry)})` },
    h(
      'g',
      { class: 'dv-lid', opacity: 0 },
      h(
        'g',
        { transform: `translate(${f(-ex)} ${f(-(ey - ry))})` },
        h('rect', {
          x: ex - r - 2,
          y: ey - ry - 2,
          width: 2 * r + 4,
          height: 2 * ry + 4,
          fill: ctx.paint.body,
          'clip-path': `url(#${clip})`,
        }),
        h('path', {
          d: M(ex - r * 0.98, ey + ry * 0.2) + Q(ex, ey + ry * 0.62, ex + r * 0.98, ey + ry * 0.2),
          fill: 'none',
          stroke: ctx.paint.pupil,
          'stroke-width': r * 0.14,
          'stroke-linecap': 'round',
        }),
      ),
    ),
  );
  return h(
    'g',
    { class: `dv-eye dv-eye-${side}` },
    h('ellipse', { cx: ex, cy: ey, rx: r, ry, fill: ctx.paint.sclera }),
    h(
      'g',
      { 'clip-path': `url(#${clip})` },
      h('ellipse', { cx: ix, cy: iy, rx: r * 0.78, ry: ry * 0.82, fill: `url(#${irisGrad})` }),
      h('ellipse', {
        cx: ix + gaze.x * r * 0.1,
        cy: iy + r * 0.02,
        rx: r * pr,
        ry: ry * (pr + 0.04),
        fill: ctx.paint.pupil,
      }),
    ),
    h('ellipse', {
      cx: ex,
      cy: ey,
      rx: r,
      ry,
      fill: 'none',
      stroke: ctx.paint.line,
      'stroke-width': ctx.W * 0.75,
    }),
    h('circle', {
      cx: ix + r * 0.26,
      cy: iy - r * 0.32,
      r: r * (wide ? 0.3 : 0.26),
      fill: '#ffffff',
    }),
    h('circle', {
      cx: ix - r * 0.24,
      cy: iy + r * 0.3,
      r: r * 0.11,
      fill: '#ffffff',
      opacity: 0.9,
    }),
    wide
      ? h('circle', {
          cx: ix + r * 0.02,
          cy: iy - r * 0.02,
          r: r * 0.06,
          fill: '#ffffff',
          opacity: 0.8,
        })
      : '',
    lid,
  );
}

export function happyEye(ctx: Ctx, ex: number, ey: number, r: number, side: 'l' | 'r'): string {
  const d = M(ex - r * 0.72, ey + r * 0.22) + Q(ex, ey - r * 0.8, ex + r * 0.72, ey + r * 0.22);
  return h(
    'g',
    { class: `dv-eye dv-eye-${side}` },
    h('path', {
      d,
      fill: 'none',
      stroke: ctx.paint.pupil,
      'stroke-width': r * 0.24,
      'stroke-linecap': 'round',
    }),
  );
}

export function closedEye(ctx: Ctx, ex: number, ey: number, r: number, side: 'l' | 'r'): string {
  const s = side === 'l' ? -1 : 1;
  const d = M(ex - r * 0.7, ey) + Q(ex, ey + r * 0.55, ex + r * 0.7, ey);
  const lash =
    M(ex + s * r * 0.62, ey + r * 0.05) +
    L(ex + s * r * 0.9, ey + r * 0.22) +
    M(ex + s * r * 0.4, ey + r * 0.22) +
    L(ex + s * r * 0.58, ey + r * 0.46);
  return h(
    'g',
    { class: `dv-eye dv-eye-${side}` },
    h('path', {
      d: d + lash,
      fill: 'none',
      stroke: ctx.paint.pupil,
      'stroke-width': r * 0.2,
      'stroke-linecap': 'round',
    }),
  );
}

export function eyes(ctx: Ctx): string {
  const e = ctx.sk.eye;
  const style = eyeStyleFor(ctx);
  const gaze = gazeFor(ctx);
  const out: string[] = [];
  for (const [side, s] of [
    ['l', -1],
    ['r', 1],
  ] as const) {
    const ex = CX + s * e.dx;
    if (style === 'happy') out.push(happyEye(ctx, ex, e.y, e.r, side));
    else if (style === 'closed') out.push(closedEye(ctx, ex, e.y, e.r, side));
    else out.push(openEye(ctx, ex, e.y, e.r, side, style === 'wide', gaze));
  }
  return out.join('');
}

export function brows(ctx: Ctx): string {
  const e = ctx.sk.eye;
  const ry = e.r * 1.12;
  const lift: Record<string, [number, number] | null> = {
    idle: null,
    eating: null,
    happy: [0.34, 0.34],
    curious: [0.2, 0.55],
    sleepy: [0.05, 0.05],
    proud: [0.38, 0.38],
  };
  const l = lift[ctx.expression];
  if (!l) return '';
  const out: string[] = [];
  for (const [i, s] of [
    [0, -1],
    [1, 1],
  ] as const) {
    const ex = CX + s * e.dx;
    const by = e.y - ry - e.r * l[i]!;
    const tilt =
      ctx.expression === 'sleepy'
        ? s * e.r * 0.12
        : ctx.expression === 'curious' && i === 1
          ? -e.r * 0.08
          : 0;
    out.push(M(ex - e.r * 0.5, by + tilt) + Q(ex, by - e.r * 0.28, ex + e.r * 0.5, by - tilt));
  }
  return h('path', {
    class: 'dv-brows',
    d: out.join(''),
    fill: 'none',
    stroke: ctx.paint.line,
    'stroke-width': e.r * 0.16,
    'stroke-linecap': 'round',
  });
}

/** Mouth (inside the jaw group so eating can chew). */
export function mouth(ctx: Ctx): string {
  const m = ctx.sk.mouth;
  const w = m.w;
  const y = m.y;
  const line = ctx.paint.line;
  const W = ctx.W;
  const fang = (x: number, yy: number, s: number): string =>
    h('path', {
      d: M(x - s * 0.5, yy) + L(x + s * 0.5, yy) + L(x, yy + s * 0.95) + 'Z',
      fill: '#ffffff',
      stroke: line,
      'stroke-width': W * 0.35,
      'stroke-linejoin': 'round',
    });
  switch (ctx.expression) {
    case 'happy': {
      const d =
        M(CX - w * 0.62, y - w * 0.06) +
        Q(CX, y + w * 0.02, CX + w * 0.62, y - w * 0.06) +
        C(CX + w * 0.58, y + w * 0.62, CX - w * 0.58, y + w * 0.62, CX - w * 0.62, y - w * 0.06) +
        'Z';
      const clip = ctx.def('mouth-clip', (id) => h('clipPath', { id }, h('path', { d })));
      return h(
        'g',
        { class: 'dv-mouth' },
        h('path', { d, fill: ctx.paint.mouth }),
        h('ellipse', {
          cx: CX,
          cy: y + w * 0.5,
          rx: w * 0.36,
          ry: w * 0.22,
          fill: ctx.paint.tongue,
          'clip-path': `url(#${clip})`,
        }),
        h('path', {
          d,
          fill: 'none',
          stroke: line,
          'stroke-width': W * 0.7,
          'stroke-linejoin': 'round',
        }),
        fang(CX - w * 0.36, y - w * 0.03, w * 0.16),
      );
    }
    case 'eating': {
      const d =
        M(CX - w * 0.5, y - w * 0.04) +
        C(CX - w * 0.48, y + w * 0.66, CX + w * 0.48, y + w * 0.66, CX + w * 0.5, y - w * 0.04) +
        Q(CX, y - w * 0.16, CX - w * 0.5, y - w * 0.04) +
        'Z';
      const clip = ctx.def('mouth-clip', (id) => h('clipPath', { id }, h('path', { d })));
      return h(
        'g',
        { transform: `translate(${f(CX)} ${f(y - w * 0.08)})` },
        h(
          'g',
          { class: 'dv-jaw' },
          h(
            'g',
            { transform: `translate(${f(-CX)} ${f(-(y - w * 0.08))})` },
            h('path', { d, fill: ctx.paint.mouth }),
            h('ellipse', {
              cx: CX,
              cy: y + w * 0.44,
              rx: w * 0.32,
              ry: w * 0.18,
              fill: ctx.paint.tongue,
              'clip-path': `url(#${clip})`,
            }),
            h('path', {
              d,
              fill: 'none',
              stroke: line,
              'stroke-width': W * 0.7,
              'stroke-linejoin': 'round',
            }),
            fang(CX - w * 0.3, y - w * 0.08, w * 0.15),
            fang(CX + w * 0.3, y - w * 0.08, w * 0.15),
          ),
        ),
      );
    }
    case 'curious':
      return h('ellipse', {
        class: 'dv-mouth',
        cx: CX + w * 0.04,
        cy: y + w * 0.12,
        rx: w * 0.16,
        ry: w * 0.2,
        fill: ctx.paint.mouth,
        stroke: line,
        'stroke-width': W * 0.6,
      });
    case 'sleepy':
      return h('ellipse', {
        class: 'dv-mouth',
        cx: CX,
        cy: y + w * 0.1,
        rx: w * 0.1,
        ry: w * 0.12,
        fill: ctx.paint.mouth,
        stroke: line,
        'stroke-width': W * 0.55,
      });
    case 'proud': {
      const d = M(CX - w * 0.6, y - w * 0.1) + Q(CX, y + w * 0.42, CX + w * 0.6, y - w * 0.1);
      return h(
        'g',
        { class: 'dv-mouth' },
        h('path', {
          d,
          fill: 'none',
          stroke: line,
          'stroke-width': W * 0.8,
          'stroke-linecap': 'round',
        }),
        fang(CX + w * 0.32, y + w * 0.1, w * 0.15),
      );
    }
    default: {
      const d =
        M(CX - w * 0.5, y - w * 0.04) +
        Q(CX - w * 0.25, y + w * 0.3, CX, y + w * 0.02) +
        Q(CX + w * 0.25, y + w * 0.3, CX + w * 0.5, y - w * 0.04);
      return h(
        'g',
        { class: 'dv-mouth' },
        h('path', {
          d,
          fill: 'none',
          stroke: line,
          'stroke-width': W * 0.75,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
        fang(CX + w * 0.26, y + w * 0.13, w * 0.14),
      );
    }
  }
}

export function headSheen(ctx: Ctx): string {
  const hd = ctx.sk.head;
  return h('ellipse', {
    cx: hd.cx - hd.rx * 0.38,
    cy: hd.cy - hd.ry * 0.58,
    rx: hd.rx * 0.22,
    ry: hd.ry * 0.11,
    fill: '#ffffff',
    opacity: 0.38,
    transform: `rotate(-24 ${f(hd.cx - hd.rx * 0.38)} ${f(hd.cy - hd.ry * 0.58)})`,
  });
}

export function headShape(ctx: Ctx, d = headPathD(ctx)): string {
  return h('path', {
    class: 'dv-head-shape',
    d,
    fill: headFill(ctx),
    stroke: ctx.paint.line,
    'stroke-width': ctx.W,
    'stroke-linejoin': 'round',
  });
}
