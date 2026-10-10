import { atan2Deg, lerp, polar, type Pt } from '../svg/num';
import { M, L, Q, C, Mp, Lp, Qp, Cp, polyD, ellipsePoint } from '../svg/path';
import { h } from '../svg/xml';
import { flame, flower } from '../glyphs';
import { linearGradient, type Ctx } from './ctx';
import { cloudUnion, mirrorX, taperD } from './shapes';
import { CX } from './skeleton';

function hornFill(ctx: Ctx): string {
  const hd = ctx.sk.head;
  return linearGradient(
    ctx,
    'horn-grad',
    [
      [0, ctx.paint.hornShade],
      [1, ctx.paint.horn],
    ],
    { x: 0, y: hd.cy - hd.ry * 0.6 },
    { x: 0, y: hd.cy - hd.ry - ctx.sk.horn.len },
  );
}

/** Single horn on the right side (mirror for the left). `tilt` = outward lean in degrees. */
function hornRight(ctx: Ctx, base: Pt, len: number, tilt: number): string {
  const style = ctx.recipe.horns.style;
  const W = ctx.W * 0.85;
  const bw = ctx.sk.horn.base;
  const up = polar(0, 0, 1, -90 + tilt);
  const out = polar(0, 0, 1, tilt);
  const at = (a: number, b: number): Pt => ({
    x: base.x + up.x * a + out.x * b,
    y: base.y + up.y * a + out.y * b,
  });
  const line = ctx.paint.hornLine;
  const fill = hornFill(ctx);
  switch (style) {
    case 'nub':
      return h('path', {
        d: taperD(
          at(-4, 0),
          at(len * 0.3, 0),
          at(len * 0.6, 0),
          at(len * 0.75, 0),
          bw * 0.9,
          bw * 0.55,
        ),
        fill,
        stroke: line,
        'stroke-width': W,
      });
    case 'straight': {
      const d = taperD(
        at(-6, 0),
        at(len * 0.35, len * 0.04),
        at(len * 0.7, len * 0.08),
        at(len, len * 0.12),
        bw,
        4,
      );
      return h('path', { d, fill, stroke: line, 'stroke-width': W, 'stroke-linejoin': 'round' });
    }
    case 'cloud': {
      const s = len * 0.9 + 8;
      return cloudUnion(
        [
          { ...at(s * 0.2, 0), r: s * 0.42 },
          { ...at(s * 0.62, s * 0.18), r: s * 0.32 },
          { ...at(s * 0.3, s * 0.45), r: s * 0.28 },
        ],
        ctx.paint.horn,
        line,
        W,
      );
    }
    case 'crystal': {
      const d = polyD([
        at(-4, -bw * 0.5),
        at(len * 0.72, -bw * 0.42),
        at(len * 1.1, len * 0.06),
        at(len * 0.72, bw * 0.5),
        at(-4, bw * 0.5),
      ]);
      const facet = Mp(at(-2, 0)) + Lp(at(len * 1.05, len * 0.06));
      return (
        h('path', {
          d,
          fill: ctx.paint.horn,
          stroke: line,
          'stroke-width': W,
          'stroke-linejoin': 'round',
        }) +
        h('path', { d: facet, stroke: line, 'stroke-width': W * 0.5, opacity: 0.45 }) +
        h('path', {
          d: Mp(at(len * 0.2, -bw * 0.2)) + Lp(at(len * 0.6, -bw * 0.18)),
          stroke: '#ffffff',
          'stroke-width': W,
          'stroke-linecap': 'round',
          opacity: 0.85,
        })
      );
    }
    case 'crescent': {
      // A moon crescent resting on its back (tips up), leaning outward.
      const r = len * 0.5 + 9;
      const c = at(r * 0.95, r * 0.25);
      const local = (dx: number, dy: number): Pt => ({
        x: c.x + out.x * dx - up.x * dy,
        y: c.y + out.y * dx - up.y * dy,
      });
      const tip1 = local(-r * 0.866, -r * 0.5);
      const tip2 = local(r * 0.866, -r * 0.5);
      const r2 = r * 0.9;
      const d = `${Mp(tip1)}A${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${tip2.x.toFixed(2)} ${tip2.y.toFixed(2)}A${r2.toFixed(2)} ${r2.toFixed(2)} 0 1 1 ${tip1.x.toFixed(2)} ${tip1.y.toFixed(2)}Z`;
      const shine =
        Mp(local(-r * 0.62, r * 0.25)) + Qp(local(-r * 0.3, r * 0.75), local(r * 0.1, r * 0.82));
      return (
        h('path', {
          d,
          fill: ctx.paint.horn,
          stroke: line,
          'stroke-width': W,
          'stroke-linejoin': 'round',
        }) +
        h('path', {
          d: shine,
          fill: 'none',
          stroke: '#ffffff',
          'stroke-width': W * 0.8,
          'stroke-linecap': 'round',
          opacity: 0.8,
        })
      );
    }
    case 'ram': {
      const c = at(len * 0.15, len * 0.45);
      const r = len * 0.48 + 8;
      const d = taperD(
        at(-4, 0),
        { x: c.x + r * 0.2, y: c.y - r * 1.25 },
        { x: c.x + r * 1.5, y: c.y - r * 0.2 },
        { x: c.x + r * 0.3, y: c.y + r * 0.5 },
        bw * 1.1,
        bw * 0.45,
        12,
      );
      const ridges = [0.3, 0.5, 0.7]
        .map((k) => {
          const p = { x: lerp(base.x, c.x + r * 1.1, k), y: lerp(base.y - 4, c.y - r * 0.6, k) };
          return Mp({ x: p.x - 5, y: p.y - 5 }) + Lp({ x: p.x + 5, y: p.y + 5 });
        })
        .join('');
      return (
        h('path', { d, fill, stroke: line, 'stroke-width': W, 'stroke-linejoin': 'round' }) +
        h('path', { d: ridges, stroke: line, 'stroke-width': W * 0.5, opacity: 0.4 })
      );
    }
    case 'branch': {
      // A chunky little sapling horn with a leaf sprout: bold enough to count at gameplay size.
      const d = taperD(
        at(-6, 0),
        at(len * 0.4, len * 0.04),
        at(len * 0.72, len * 0.02),
        at(len, len * 0.1),
        bw * 1.1,
        9,
      );
      const twigBase = at(len * 0.5, len * 0.04);
      const twig = taperD(
        twigBase,
        at(len * 0.6, len * 0.2),
        at(len * 0.64, len * 0.28),
        at(len * 0.68, len * 0.36),
        10,
        5,
      );
      const s = len * 0.5 + 8;
      const leafAt = at(len * 0.98, len * 0.12);
      const leafDir = polar(0, 0, 1, -90 + tilt + 30);
      const leafN = polar(0, 0, 1, tilt + 30);
      const lp = (a: number, b: number): Pt => ({
        x: leafAt.x + leafDir.x * a * s + leafN.x * b * s,
        y: leafAt.y + leafDir.y * a * s + leafN.y * b * s,
      });
      const leaf =
        Mp(lp(0, 0)) +
        Cp(lp(0.25, -0.42), lp(0.75, -0.38), lp(1, 0)) +
        Cp(lp(0.75, 0.38), lp(0.25, 0.42), lp(0, 0)) +
        'Z';
      const vein = Mp(lp(0.05, 0)) + Lp(lp(0.85, 0));
      return (
        h('path', { d: twig, fill, stroke: line, 'stroke-width': W }) +
        h('path', { d, fill, stroke: line, 'stroke-width': W, 'stroke-linejoin': 'round' }) +
        h('path', {
          d: leaf,
          fill: ctx.paint.accent,
          stroke: ctx.paint.accentLine,
          'stroke-width': W * 0.8,
          'stroke-linejoin': 'round',
        }) +
        h('path', { d: vein, stroke: ctx.paint.accentLine, 'stroke-width': W * 0.5, opacity: 0.5 })
      );
    }
    case 'none':
      return '';
    default: {
      // curved: sweeps out and back like a friendly ram-less dragon horn
      const d = taperD(
        at(-6, 0),
        at(len * 0.42, -len * 0.02),
        at(len * 0.78, len * 0.12),
        at(len * 0.98, len * 0.4),
        bw,
        4.5,
      );
      const grooves =
        ctx.sk.t > 0.3
          ? [0.18, 0.34]
              .map((k) => {
                const a = at(len * k, -bw * 0.42);
                const b = at(len * k + 3, bw * 0.42);
                return Mp(a) + Qp(at(len * k + 6, 0), b);
              })
              .join('')
          : '';
      return (
        h('path', { d, fill, stroke: line, 'stroke-width': W, 'stroke-linejoin': 'round' }) +
        (grooves
          ? h('path', {
              d: grooves,
              fill: 'none',
              stroke: line,
              'stroke-width': W * 0.5,
              opacity: 0.45,
            })
          : '')
      );
    }
  }
}

export function horns(ctx: Ctx): string {
  const r = ctx.recipe.horns;
  if (r.style === 'none' || r.count === 0) return '';
  const hn = ctx.sk.horn;
  const out: string[] = [];
  const pair = hornRight(ctx, { x: CX + hn.dx, y: hn.y }, hn.len, hn.spread);
  out.push(mirrorX(CX, pair), pair);
  if (r.count >= 3) {
    out.unshift(hornRight(ctx, { x: CX, y: hn.y - 4 }, hn.len * 1.12, 0));
  }
  return h('g', { class: 'dv-horns' }, ...out);
}

function earRight(ctx: Ctx): string {
  const e = ctx.sk.ear;
  const style = ctx.recipe.ears.style;
  const x = CX + e.dx;
  const y = e.y;
  const s = e.size;
  const W = ctx.W * 0.85;
  const fill = ctx.paint.wing;
  const line = ctx.paint.wingLine;
  const rot = (deg: number, inner: string): string =>
    h('g', { transform: `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${deg})` }, inner);
  switch (style) {
    case 'frill': {
      const d =
        M(-s * 0.2, -s * 0.34) +
        Q(s * 0.5, -s * 0.62, s * 1.0, -s * 0.5) +
        Q(s * 0.7, -s * 0.18, s * 0.86, s * 0.06) +
        Q(s * 0.4, s * 0.18, -s * 0.2, s * 0.3) +
        'Z';
      const ribs =
        M(-s * 0.1, -s * 0.04) +
        Q(s * 0.4, -s * 0.24, s * 0.92, -s * 0.46) +
        M(-s * 0.1, 0.06 * s) +
        Q(s * 0.4, 0, s * 0.8, s * 0.04);
      return rot(
        -18,
        h('path', { d, fill, stroke: line, 'stroke-width': W, 'stroke-linejoin': 'round' }) +
          h('path', { d: ribs, fill: 'none', stroke: line, 'stroke-width': W * 0.5, opacity: 0.5 }),
      );
    }
    case 'fin': {
      const tips = [
        { x: s * 0.62, y: -s * 0.78 },
        { x: s * 1.02, y: -s * 0.42 },
        { x: s * 1.08, y: s * 0.04 },
      ];
      let d = M(-s * 0.2, -s * 0.4) + Lp(tips[0]!);
      d +=
        Qp({ x: s * 0.66, y: -s * 0.44 }, tips[1]!) +
        Qp({ x: s * 0.76, y: -s * 0.12 }, tips[2]!) +
        Q(s * 0.5, s * 0.3, -s * 0.2, s * 0.32) +
        'Z';
      const rays = tips.map((p) => M(-s * 0.1, -s * 0.02) + L(p.x * 0.92, p.y * 0.92)).join('');
      return rot(
        -10,
        h('path', { d, fill, stroke: line, 'stroke-width': W, 'stroke-linejoin': 'round' }) +
          h('path', { d: rays, fill: 'none', stroke: line, 'stroke-width': W * 0.5, opacity: 0.5 }),
      );
    }
    case 'leaf': {
      const d =
        M(-s * 0.15, 0) +
        C(s * 0.2, -s * 0.7, s * 0.8, -s * 0.7, s * 1.15, -s * 0.36) +
        C(s * 0.8, s * 0.1, s * 0.3, s * 0.3, -s * 0.15, 0) +
        'Z';
      const vein = M(-s * 0.05, -s * 0.02) + Q(s * 0.5, -s * 0.26, s * 1.05, -s * 0.34);
      return rot(
        -22,
        h('path', {
          d,
          fill: ctx.paint.accent,
          stroke: ctx.paint.accentLine,
          'stroke-width': W,
          'stroke-linejoin': 'round',
        }) +
          h('path', {
            d: vein,
            fill: 'none',
            stroke: ctx.paint.accentLine,
            'stroke-width': W * 0.5,
            opacity: 0.55,
          }),
      );
    }
    case 'petal': {
      const d =
        M(-s * 0.15, 0) +
        C(s * 0.1, -s * 0.9, s * 1.0, -s * 0.9, s * 1.0, -s * 0.24) +
        C(s * 0.9, s * 0.24, s * 0.3, s * 0.3, -s * 0.15, 0) +
        'Z';
      return rot(
        -26,
        h('path', { d, fill, stroke: line, 'stroke-width': W, 'stroke-linejoin': 'round' }) +
          h('ellipse', {
            cx: s * 0.42,
            cy: -s * 0.3,
            rx: s * 0.2,
            ry: s * 0.12,
            fill: '#ffffff',
            opacity: 0.35,
          }),
      );
    }
    case 'cloud':
      return cloudUnion(
        [
          { x: x + s * 0.2, y: y - s * 0.1, r: s * 0.4 },
          { x: x + s * 0.62, y: y - s * 0.36, r: s * 0.3 },
        ],
        ctx.paint.wing,
        line,
        W,
      );
    case 'shell': {
      let d = M(0, 0);
      const pts: Pt[] = [];
      for (let i = 0; i <= 5; i++) pts.push(polar(0, 0, s * 0.9, -80 + i * 22));
      d += Lp(pts[0]!);
      for (let i = 1; i < pts.length; i++) {
        const m = {
          x: ((pts[i - 1]!.x + pts[i]!.x) / 2) * 1.16,
          y: ((pts[i - 1]!.y + pts[i]!.y) / 2) * 1.16,
        };
        d += Qp(m, pts[i]!);
      }
      d += 'Z';
      const ribs = pts.map((p) => M(0, 0) + L(p.x * 0.92, p.y * 0.92)).join('');
      return rot(
        -8,
        h('path', { d, fill, stroke: line, 'stroke-width': W, 'stroke-linejoin': 'round' }) +
          h('path', {
            d: ribs,
            stroke: line,
            'stroke-width': W * 0.45,
            opacity: 0.45,
            fill: 'none',
          }),
      );
    }
    case 'round': {
      // Mouse ear (Nibble): a big round body-coloured ear with a soft pink inside.
      const r = s * 0.6;
      return rot(
        -12,
        h('circle', {
          cx: s * 0.42,
          cy: -s * 0.5,
          r,
          fill: ctx.paint.body,
          stroke: ctx.paint.line,
          'stroke-width': W,
        }) +
          h('circle', {
            cx: s * 0.46,
            cy: -s * 0.52,
            r: r * 0.64,
            fill: ctx.paint.cheek,
            stroke: ctx.paint.line,
            'stroke-width': W * 0.45,
            opacity: 0.85,
          }),
      );
    }
    default:
      return '';
  }
}

export function ears(ctx: Ctx): string {
  if (ctx.recipe.ears.style === 'none') return '';
  const right = earRight(ctx);
  return h('g', { class: 'dv-ears' }, mirrorX(CX, right), right);
}

/** Sun crest: disc rim + rays behind the head (Sunny: 5 rays). */
export function sunCrest(ctx: Ctx): string {
  const hd = ctx.sk.head;
  const n = Math.max(1, ctx.recipe.crest.count);
  const rayLen = lerp(46, 72, ctx.sk.t);
  const span = 168;
  const rays: string[] = [];
  const cx = hd.cx;
  const rx = hd.rx * 1.16;
  const ry = hd.ry * 1.2;
  // Keep the disc's bottom at the chin so neckwear stays visible; the extra height shows above.
  const cy = hd.cy + hd.ry * 0.98 - ry;
  for (let i = 0; i < n; i++) {
    const a = -90 - span / 2 + (n === 1 ? span / 2 : (i * span) / (n - 1));
    const dir = polar(0, 0, 1, a);
    const side = polar(0, 0, 1, a + 90);
    const b0 = { x: cx + dir.x * rx * 0.9, y: cy + dir.y * ry * 0.9 };
    const reach = Math.sqrt(dir.x * rx * dir.x * rx + dir.y * ry * dir.y * ry);
    const tip = {
      x: b0.x + dir.x * (reach * 0.1 + rayLen),
      y: b0.y + dir.y * (reach * 0.1 + rayLen),
    };
    const half = rayLen * 0.46;
    const l = { x: b0.x + side.x * half, y: b0.y + side.y * half };
    const r = { x: b0.x - side.x * half, y: b0.y - side.y * half };
    rays.push(
      Mp(l) +
        Qp(
          {
            x: (l.x + tip.x) / 2 + side.x * half * 0.18,
            y: (l.y + tip.y) / 2 + side.y * half * 0.18,
          },
          { x: tip.x + side.x * 3, y: tip.y + side.y * 3 },
        ) +
        Qp(
          { x: tip.x + dir.x * 7, y: tip.y + dir.y * 7 },
          { x: tip.x - side.x * 3, y: tip.y - side.y * 3 },
        ) +
        Qp(
          {
            x: (r.x + tip.x) / 2 - side.x * half * 0.18,
            y: (r.y + tip.y) / 2 - side.y * half * 0.18,
          },
          r,
        ) +
        'Z',
    );
  }
  const W = ctx.W * 0.85;
  return h(
    'g',
    { class: 'dv-crest dv-crest-sun' },
    h('path', {
      d: rays.join(''),
      fill: ctx.paint.accent,
      stroke: ctx.paint.accentLine,
      'stroke-width': W,
      'stroke-linejoin': 'round',
    }),
    h('ellipse', {
      cx,
      cy,
      rx,
      ry,
      fill: ctx.paint.accent2,
      stroke: ctx.paint.accentLine,
      'stroke-width': W,
    }),
    h('ellipse', {
      cx,
      cy,
      rx: rx * 0.93,
      ry: ry * 0.93,
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': W * 0.8,
      opacity: 0.5,
    }),
  );
}

/** Goldie's crown: exactly `count` points (10). */
export function crownTen(ctx: Ctx, grand = false): string {
  const hd = ctx.sk.head;
  const n = Math.max(3, ctx.recipe.crest.count);
  const w = hd.rx * (grand ? 1.62 : 1.5);
  const bandH = lerp(16, 22, ctx.sk.t) * (grand ? 1.15 : 1);
  const pointH = lerp(22, 32, ctx.sk.t) * (grand ? 1.15 : 1);
  const baseY = hd.cy - hd.ry * 0.82;
  const x0 = CX - w / 2;
  const top = baseY - bandH;
  const curve = w * 0.06;
  let d = M(x0, baseY) + Q(CX, baseY + curve, x0 + w, baseY) + L(x0 + w, top);
  const step = w / n;
  for (let i = n - 1; i >= 0; i--) {
    const px = x0 + step * (i + 0.5);
    d += L(px, top - pointH) + L(x0 + step * i, top);
  }
  d += 'Z';
  const W = ctx.W * 0.85;
  const gold = linearGradient(
    ctx,
    'crown10-grad',
    [
      [0, '#fff3b0'],
      [0.5, '#ffd23f'],
      [1, '#e09a12'],
    ],
    { x: 0, y: top - pointH },
    { x: 0, y: baseY },
  );
  let balls = '';
  for (let i = 0; i < n; i++) {
    balls += h('circle', {
      cx: x0 + step * (i + 0.5),
      cy: top - pointH,
      r: Math.max(2.6, step * 0.2),
      fill: '#fff6cf',
      stroke: '#9a5a00',
      'stroke-width': W * 0.5,
    });
  }
  const gems = [-0.3, 0, 0.3]
    .map((k, i) =>
      h('ellipse', {
        cx: CX + k * w,
        cy: top + bandH * 0.55 + (k === 0 ? 0 : 1),
        rx: bandH * (i === 1 ? 0.36 : 0.26),
        ry: bandH * (i === 1 ? 0.3 : 0.24),
        fill: i === 1 ? '#e0335a' : '#3d7be0',
        stroke: '#7a2a00',
        'stroke-width': W * 0.4,
      }),
    )
    .join('');
  return h(
    'g',
    { class: 'dv-crest dv-crest-crown' },
    h('path', { d, fill: gold, stroke: '#9a5a00', 'stroke-width': W, 'stroke-linejoin': 'round' }),
    balls,
    gems,
  );
}

/** Ember's flame crest: `count` (5) golden flames standing on the head, the middle one tallest. */
export function flameCrest(ctx: Ctx): string {
  const hd = ctx.sk.head;
  const n = Math.max(1, ctx.recipe.crest.count);
  const s = lerp(40, 50, ctx.sk.t);
  const span = 104;
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = -90 - span / 2 + (n === 1 ? span / 2 : (i * span) / (n - 1));
    const base = ellipsePoint(hd.cx, hd.cy, hd.rx * 0.8, hd.ry * 0.93, a);
    const out1 = polar(0, 0, 1, a);
    const lean = { x: out1.x * 0.55, y: -1 + out1.y * 0.2 };
    const deg = atan2Deg(lean.y, lean.x) + 90;
    const k = 1 - Math.abs(i - (n - 1) / 2) * 0.08;
    out += h(
      'g',
      {
        transform: `translate(${base.x.toFixed(2)} ${base.y.toFixed(2)}) rotate(${deg.toFixed(2)}) scale(0.78 1)`,
      },
      flame(s * k * 1.3, '#ffbe1f', '#fff3a6', '#b8520a', ctx.W * 0.85),
    );
  }
  return h('g', { class: 'dv-crest dv-crest-flames' }, out);
}

export function flowerCrest(ctx: Ctx): string {
  const hd = ctx.sk.head;
  const s = lerp(34, 46, ctx.sk.t);
  const cy = hd.cy - hd.ry * 1.0;
  const leaf = (dir: number): string => {
    const d =
      M(CX, cy + s * 0.2) +
      C(
        CX + dir * s * 0.4,
        cy - s * 0.1,
        CX + dir * s * 1.2,
        cy - s * 0.05,
        CX + dir * s * 1.45,
        cy + s * 0.25,
      ) +
      C(CX + dir * s * 1.1, cy + s * 0.55, CX + dir * s * 0.45, cy + s * 0.55, CX, cy + s * 0.2) +
      'Z';
    return h('path', {
      d,
      fill: '#6fcf6a',
      stroke: '#2f6b2a',
      'stroke-width': ctx.W * 0.6,
      'stroke-linejoin': 'round',
    });
  };
  return h(
    'g',
    { class: 'dv-crest' },
    leaf(-1),
    leaf(1),
    flower(
      CX,
      cy,
      s,
      Math.max(4, ctx.recipe.crest.count),
      ctx.paint.wing,
      '#ffd84a',
      ctx.paint.wingLine,
      ctx.W * 0.7,
      -45,
    ),
  );
}

/** Sprout's toadstool cap: a red, white-spotted mushroom cap worn at a jaunty tilt, with a sprig. */
export function toadstoolCrest(ctx: Ctx): string {
  const hd = ctx.sk.head;
  const s = lerp(40, 52, ctx.sk.t);
  const cx = CX + s * 0.12;
  const cy = hd.cy - hd.ry * 0.86;
  const fill = ctx.paint.accent;
  const line = ctx.paint.accentLine;
  const cap =
    M(cx - s * 1.2, cy + s * 0.1) +
    C(cx - s * 1.25, cy - s * 0.95, cx + s * 1.25, cy - s * 0.95, cx + s * 1.2, cy + s * 0.1) +
    Q(cx, cy - s * 0.18, cx - s * 1.2, cy + s * 0.1) +
    'Z';
  const spots: Array<[number, number, number]> = [
    [-0.62, -0.28, 0.17],
    [-0.08, -0.56, 0.2],
    [0.5, -0.36, 0.15],
    [0.12, -0.12, 0.1],
    [0.86, -0.06, 0.09],
  ].slice(0, Math.max(3, Math.min(5, ctx.recipe.crest.count))) as Array<[number, number, number]>;
  return h(
    'g',
    { class: 'dv-crest', transform: `rotate(-8 ${cx} ${cy})` },
    h('path', {
      d: M(cx - s * 1.0, cy + s * 0.08) + Q(cx, cy + s * 0.32, cx + s * 1.0, cy + s * 0.08),
      fill: 'none',
      stroke: '#fff8ea',
      'stroke-width': ctx.W * 1.6,
      'stroke-linecap': 'round',
    }),
    h('path', {
      d: cap,
      fill,
      stroke: line,
      'stroke-width': ctx.W * 0.8,
      'stroke-linejoin': 'round',
    }),
    ...spots.map(([x, y, r]) =>
      h('circle', { cx: cx + x * s, cy: cy + y * s, r: r * s, fill: '#ffffff' }),
    ),
    h('ellipse', {
      cx: cx - s * 0.5,
      cy: cy - s * 0.55,
      rx: s * 0.22,
      ry: s * 0.1,
      fill: '#ffffff',
      opacity: 0.45,
      transform: `rotate(-25 ${cx - s * 0.5} ${cy - s * 0.55})`,
    }),
    h('path', {
      d:
        M(cx + s * 0.2, cy - s * 0.66) +
        Q(cx + s * 0.3, cy - s * 1.0, cx + s * 0.55, cy - s * 1.08),
      fill: 'none',
      stroke: '#4f7f32',
      'stroke-width': ctx.W * 0.6,
      'stroke-linecap': 'round',
    }),
    h('ellipse', {
      cx: cx + s * 0.62,
      cy: cy - s * 1.1,
      rx: s * 0.2,
      ry: s * 0.1,
      fill: '#8fcf5a',
      stroke: '#4f7f32',
      'stroke-width': ctx.W * 0.4,
      transform: `rotate(-20 ${cx + s * 0.62} ${cy - s * 1.1})`,
    }),
  );
}

export function shellCrest(ctx: Ctx): string {
  const hd = ctx.sk.head;
  const s = lerp(32, 48, ctx.sk.t);
  const cx = CX;
  const cy = hd.cy - hd.ry * 0.82;
  const pts: Pt[] = [];
  for (let i = 0; i <= 6; i++) pts.push(polar(cx, cy, s, -165 + i * 25));
  let d = M(cx, cy + 4) + Lp(pts[0]!);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const m = { x: cx + ((a.x + b.x) / 2 - cx) * 1.14, y: cy + ((a.y + b.y) / 2 - cy) * 1.14 };
    d += Qp(m, b);
  }
  d += 'Z';
  const ribs = pts
    .map((p) => M(cx, cy + 2) + L(cx + (p.x - cx) * 0.9, cy + (p.y - cy) * 0.9))
    .join('');
  return h(
    'g',
    { class: 'dv-crest' },
    h('path', {
      d,
      fill: ctx.paint.wing,
      stroke: ctx.paint.wingLine,
      'stroke-width': ctx.W * 0.8,
      'stroke-linejoin': 'round',
    }),
    h('path', {
      d: ribs,
      stroke: ctx.paint.wingLine,
      'stroke-width': ctx.W * 0.45,
      opacity: 0.45,
      fill: 'none',
    }),
    h('ellipse', {
      cx: cx - s * 0.3,
      cy: cy - s * 0.5,
      rx: s * 0.18,
      ry: s * 0.1,
      fill: '#ffffff',
      opacity: 0.6,
    }),
  );
}

export function cloudTuft(ctx: Ctx): string {
  const hd = ctx.sk.head;
  const s = lerp(36, 48, ctx.sk.t);
  const y = hd.cy - hd.ry * 0.96;
  return h(
    'g',
    { class: 'dv-crest' },
    cloudUnion(
      [
        { x: CX - s * 0.95, y: y + s * 0.3, r: s * 0.34 },
        { x: CX - s * 0.5, y: y - s * 0.05, r: s * 0.45 },
        { x: CX + s * 0.05, y: y - s * 0.32, r: s * 0.56 },
        { x: CX + s * 0.6, y: y - s * 0.02, r: s * 0.44 },
        { x: CX + s * 1.0, y: y + s * 0.32, r: s * 0.32 },
      ],
      ctx.paint.wing,
      ctx.paint.wingLine,
      ctx.W * 0.8,
    ),
    h('ellipse', {
      cx: CX - s * 0.15,
      cy: y - s * 0.55,
      rx: s * 0.26,
      ry: s * 0.14,
      fill: '#ffffff',
      opacity: 0.7,
    }),
  );
}

/** Small royal crown for the `crowned` stage (5 points, three gems); `lift` raises it above a crest. */
export function royalCrown(ctx: Ctx, lift = 0): string {
  const hd = ctx.sk.head;
  const w = hd.rx * 0.95;
  const H = hd.ry * 0.52;
  const baseY = hd.cy - hd.ry * 0.8 - lift;
  const x0 = CX - w / 2;
  const pts: Pt[] = [
    { x: x0, y: baseY },
    { x: x0 - w * 0.04, y: baseY - H * 0.92 },
    { x: x0 + w * 0.2, y: baseY - H * 0.45 },
    { x: x0 + w * 0.32, y: baseY - H * 1.05 },
    { x: CX, y: baseY - H * 0.5 },
    { x: x0 + w * 0.68, y: baseY - H * 1.05 },
    { x: x0 + w * 0.8, y: baseY - H * 0.45 },
    { x: x0 + w * 1.04, y: baseY - H * 0.92 },
    { x: x0 + w, y: baseY },
  ];
  const d = polyD(pts);
  const W = ctx.W * 0.85;
  const gold = linearGradient(
    ctx,
    'royal-grad',
    [
      [0, '#fff3b0'],
      [0.5, '#ffd23f'],
      [1, '#e39b12'],
    ],
    { x: 0, y: baseY - H },
    { x: 0, y: baseY },
  );
  const tips = [pts[1]!, pts[3]!, pts[5]!, pts[7]!]
    .map((p) =>
      h('circle', {
        cx: p.x,
        cy: p.y,
        r: H * 0.1,
        fill: '#fff6cf',
        stroke: '#9a5a00',
        'stroke-width': W * 0.5,
      }),
    )
    .join('');
  return h(
    'g',
    { class: 'dv-crown' },
    h('path', { d, fill: gold, stroke: '#9a5a00', 'stroke-width': W, 'stroke-linejoin': 'round' }),
    h('path', {
      d: M(x0 + 4, baseY - H * 0.18) + L(x0 + w - 4, baseY - H * 0.18),
      stroke: '#c47f0a',
      'stroke-width': W * 0.6,
      opacity: 0.6,
    }),
    tips,
    h('ellipse', {
      cx: CX,
      cy: baseY - H * 0.32,
      rx: H * 0.16,
      ry: H * 0.14,
      fill: '#e0335a',
      stroke: '#7a2a00',
      'stroke-width': W * 0.4,
    }),
    h('circle', {
      cx: x0 + w * 0.22,
      cy: baseY - H * 0.28,
      r: H * 0.09,
      fill: '#3d7be0',
      stroke: '#7a2a00',
      'stroke-width': W * 0.35,
    }),
    h('circle', {
      cx: x0 + w * 0.78,
      cy: baseY - H * 0.28,
      r: H * 0.09,
      fill: '#2fbf71',
      stroke: '#7a2a00',
      'stroke-width': W * 0.35,
    }),
    h('path', {
      d: M(x0 + w * 0.3, baseY - H * 0.8) + L(x0 + w * 0.34, baseY - H * 0.55),
      stroke: '#ffffff',
      'stroke-width': W * 0.8,
      'stroke-linecap': 'round',
      opacity: 0.8,
    }),
  );
}
