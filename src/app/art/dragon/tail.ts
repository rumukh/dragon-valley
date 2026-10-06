import { atan2Deg, bez, bezTangent, polar, type Pt } from '../svg/num';
import { M, L, Q, C, polyD, circleD, heartD, roundStarD, tf } from '../svg/path';
import { h } from '../svg/xml';
import { clover, flame, flameD, flower, gearD, pearl } from '../glyphs';
import { softGradient, type Ctx } from './ctx';
import { cloudUnion, mirrorX, pivot, taperD } from './shapes';
import { CX } from './skeleton';
import type { SpikeStyle, TailTip } from './types';

/** Tip shape in local coordinates pointing up (-y) from (0,0). */
export function tailTipArt(ctx: Ctx, tip: TailTip, s: number): string {
  const p = ctx.paint;
  const W = ctx.W * 0.85;
  const stroke = { stroke: p.line, 'stroke-width': W, 'stroke-linejoin': 'round' as const };
  switch (tip) {
    case 'spade': {
      const d =
        M(0, -s * 1.15) +
        C(s * 0.3, -s * 0.82, s * 0.74, -s * 0.42, s * 0.56, -s * 0.06) +
        Q(s * 0.26, -s * 0.22, 0, s * 0.02) +
        Q(-s * 0.26, -s * 0.22, -s * 0.56, -s * 0.06) +
        C(-s * 0.74, -s * 0.42, -s * 0.3, -s * 0.82, 0, -s * 1.15) +
        'Z';
      return (
        h('path', { d, fill: p.accent, ...stroke }) +
        h('path', {
          d: M(0, -s * 0.95) + L(0, -s * 0.2),
          stroke: p.accentLight,
          'stroke-width': W * 0.8,
          'stroke-linecap': 'round',
          opacity: 0.7,
        })
      );
    }
    case 'heart':
      return h('path', { d: heartD(0, -s * 0.5, s * 1.1), fill: p.accent, ...stroke });
    case 'flame':
      return h(
        'g',
        null,
        h('path', { d: flameD(s * 1.5), fill: '#ff8a2a', ...stroke }),
        h('path', { d: flameD(s * 1.05), fill: '#ffd447', transform: 'translate(0 -2)' }),
        h('path', { d: flameD(s * 0.55), fill: '#fff4b8', transform: 'translate(0 -3)' }),
      );
    case 'cloud':
      return cloudUnion(
        [
          { x: 0, y: -s * 0.5, r: s * 0.42 },
          { x: -s * 0.4, y: -s * 0.3, r: s * 0.3 },
          { x: s * 0.42, y: -s * 0.32, r: s * 0.32 },
          { x: s * 0.06, y: -s * 0.9, r: s * 0.3 },
        ],
        p.wing,
        p.wingLine,
        W,
      );
    case 'fin': {
      const d =
        M(0, s * 0.05) +
        C(-s * 0.2, -s * 0.3, -s * 0.8, -s * 0.5, -s * 0.78, -s * 1.0) +
        Q(-s * 0.3, -s * 0.72, 0, -s * 0.5) +
        Q(s * 0.3, -s * 0.72, s * 0.78, -s * 1.0) +
        C(s * 0.8, -s * 0.5, s * 0.2, -s * 0.3, 0, s * 0.05) +
        'Z';
      const rays =
        M(0, -s * 0.1) +
        L(-s * 0.6, -s * 0.84) +
        M(0, -s * 0.1) +
        L(s * 0.6, -s * 0.84) +
        M(0, -s * 0.1) +
        L(-s * 0.3, -s * 0.66) +
        M(0, -s * 0.1) +
        L(s * 0.3, -s * 0.66);
      return (
        h('path', {
          d,
          fill: p.wing,
          stroke: p.wingLine,
          'stroke-width': W,
          'stroke-linejoin': 'round',
        }) +
        h('path', {
          d: rays,
          stroke: p.wingLine,
          'stroke-width': W * 0.5,
          opacity: 0.5,
          fill: 'none',
        })
      );
    }
    case 'clover':
      return h(
        'g',
        { transform: `translate(0 ${(-s * 0.55).toFixed(2)})` },
        clover(0, 0, s * 0.62, p.accent, p.accentLine, W),
      );
    case 'flower':
      return flower(0, -s * 0.55, s * 0.58, 4, p.wing, '#ffd84a', p.wingLine, W * 0.8, -45);
    case 'clock-hand': {
      const ring = circleD(0, -s * 0.62, s * 0.24) + circleD(0, -s * 0.62, s * 0.12);
      const lance = M(-s * 0.1, -s * 0.84) + L(0, -s * 1.5) + L(s * 0.1, -s * 0.84) + 'Z';
      const shaft =
        M(-s * 0.09, 0) + L(-s * 0.06, -s * 0.42) + L(s * 0.06, -s * 0.42) + L(s * 0.09, 0) + 'Z';
      return (
        h('path', { d: shaft + lance, fill: p.accentShade, ...stroke, stroke: p.accentLine }) +
        h('path', {
          d: ring,
          fill: p.accentShade,
          'fill-rule': 'evenodd',
          ...stroke,
          stroke: p.accentLine,
        }) +
        h('circle', { cx: 0, cy: -s * 0.62, r: s * 0.05, fill: p.accentLight })
      );
    }
    case 'crystal': {
      const d = polyD([
        { x: 0, y: -s * 1.35 },
        { x: s * 0.34, y: -s * 0.8 },
        { x: s * 0.24, y: 0 },
        { x: -s * 0.24, y: 0 },
        { x: -s * 0.34, y: -s * 0.8 },
      ]);
      return (
        h('path', {
          d,
          fill: p.wingLight,
          stroke: p.wingLine,
          'stroke-width': W,
          'stroke-linejoin': 'round',
        }) +
        h('path', {
          d: M(0, -s * 1.3) + L(0, -s * 0.05) + M(-s * 0.34, -s * 0.8) + L(s * 0.34, -s * 0.8),
          stroke: p.wingLine,
          'stroke-width': W * 0.5,
          opacity: 0.5,
        }) +
        h('path', {
          d: M(-s * 0.14, -s * 0.9) + L(-s * 0.08, -s * 0.3),
          stroke: '#ffffff',
          'stroke-width': W,
          'stroke-linecap': 'round',
          opacity: 0.8,
        })
      );
    }
    case 'star':
      return (
        h('path', {
          d: roundStarD(0, -s * 0.62, 5, s * 0.68, s * 0.34, -90, 0.22),
          fill: '#ffd84d',
          stroke: p.line,
          'stroke-width': W,
          'stroke-linejoin': 'round',
        }) +
        h('circle', { cx: -s * 0.12, cy: -s * 0.78, r: s * 0.1, fill: '#ffffff', opacity: 0.8 })
      );
    case 'pearl': {
      const fan: Pt[] = [];
      for (let i = 0; i <= 6; i++) fan.push(polar(0, -s * 0.1, s * 0.82, -170 + i * 26.6));
      const d =
        M(0, -s * 0.1) +
        fan
          .map((q, i) =>
            i === 0
              ? L(q.x, q.y)
              : Q(
                  ((q.x + fan[i - 1]!.x) / 2) * 1.12,
                  -s * 0.1 + ((q.y + fan[i - 1]!.y) / 2 + s * 0.1) * 1.12,
                  q.x,
                  q.y,
                ),
          )
          .join('') +
        'Z';
      return (
        h('path', {
          d,
          fill: p.wing,
          stroke: p.wingLine,
          'stroke-width': W,
          'stroke-linejoin': 'round',
        }) + pearl(0, -s * 0.5, s * 0.34, p.wingLine, W * 0.7)
      );
    }
    case 'rock': {
      const d = polyD([
        { x: -s * 0.3, y: 0 },
        { x: -s * 0.62, y: -s * 0.36 },
        { x: -s * 0.5, y: -s * 0.86 },
        { x: -s * 0.06, y: -s * 1.08 },
        { x: s * 0.46, y: -s * 0.9 },
        { x: s * 0.64, y: -s * 0.42 },
        { x: s * 0.3, y: 0 },
      ]);
      return (
        h('path', {
          d,
          fill: p.accent,
          stroke: p.line,
          'stroke-width': W,
          'stroke-linejoin': 'round',
        }) +
        h('path', {
          d: M(-s * 0.3, -s * 0.6) + L(s * 0.05, -s * 0.5) + L(s * 0.2, -s * 0.7),
          stroke: p.line,
          'stroke-width': W * 0.5,
          opacity: 0.5,
          fill: 'none',
        })
      );
    }
    case 'gear':
      return h('path', {
        d: gearD(0, -s * 0.58, s * 0.6, 8, 0.3),
        fill: p.accent,
        'fill-rule': 'evenodd',
        stroke: p.accentLine,
        'stroke-width': W,
        'stroke-linejoin': 'round',
      });
    case 'tuft': {
      const d =
        M(-s * 0.3, 0) +
        Q(-s * 0.6, -s * 0.6, -s * 0.2, -s * 1.1) +
        Q(-s * 0.1, -s * 0.6, 0, -s * 0.5) +
        Q(s * 0.1, -s * 0.9, s * 0.35, -s * 1.05) +
        Q(s * 0.55, -s * 0.5, s * 0.3, 0) +
        'Z';
      return h('path', {
        d,
        fill: '#fbf7ee',
        stroke: p.line,
        'stroke-width': W,
        'stroke-linejoin': 'round',
      });
    }
  }
  return '';
}

function spikeArt(ctx: Ctx, style: SpikeStyle, s: number): string {
  const p = ctx.paint;
  const W = ctx.W * 0.75;
  switch (style) {
    case 'flame':
      return flame(s * 1.25, '#ff9a2e', '#ffe066', p.line, W);
    case 'crystal':
      return h('path', {
        d: polyD([
          { x: -s * 0.3, y: 0 },
          { x: -s * 0.22, y: -s * 0.7 },
          { x: 0, y: -s * 1.1 },
          { x: s * 0.22, y: -s * 0.7 },
          { x: s * 0.3, y: 0 },
        ]),
        fill: p.wingLight,
        stroke: p.wingLine,
        'stroke-width': W,
        'stroke-linejoin': 'round',
      });
    case 'leaf':
      return (
        h('path', {
          d:
            M(0, 0) +
            C(-s * 0.55, -s * 0.3, -s * 0.3, -s * 0.9, 0, -s * 1.1) +
            C(s * 0.3, -s * 0.9, s * 0.55, -s * 0.3, 0, 0) +
            'Z',
          fill: p.accent,
          stroke: p.accentLine,
          'stroke-width': W,
          'stroke-linejoin': 'round',
        }) +
        h('path', {
          d: M(0, -s * 0.1) + L(0, -s * 0.85),
          stroke: p.accentLine,
          'stroke-width': W * 0.5,
          opacity: 0.6,
        })
      );
    case 'stone':
      return h('path', {
        d:
          M(-s * 0.45, 0) +
          Q(-s * 0.5, -s * 0.7, 0, -s * 0.78) +
          Q(s * 0.5, -s * 0.7, s * 0.45, 0) +
          'Z',
        fill: p.accent,
        stroke: p.line,
        'stroke-width': W,
        'stroke-linejoin': 'round',
      });
    case 'round':
      return h('path', {
        d:
          M(-s * 0.42, 0) +
          Q(-s * 0.3, -s * 0.6, 0, -s * 0.92) +
          Q(s * 0.3, -s * 0.6, s * 0.42, 0) +
          'Z',
        fill: p.horn,
        stroke: p.hornLine,
        'stroke-width': W,
        'stroke-linejoin': 'round',
      });
    default:
      return '';
  }
}

/** Places local art at position p, rotated so local "up" follows `dir`. */
function orient(p: Pt, dir: Pt, art: string): string {
  const deg = atan2Deg(dir.y, dir.x) + 90;
  return h('g', { transform: tf(p.x, p.y, deg) }, art);
}

/** One tail (right side). */
function tailOne(ctx: Ctx, cls: string): string {
  const sk = ctx.sk;
  const { p0, p1, p2, p3, w0, w1 } = sk.tail;
  const d = taperD(p0, p1, p2, p3, w0, w1);
  const fill = softGradient(
    ctx,
    'tail-grad',
    ctx.paint.body,
    ctx.paint.bodyLight,
    ctx.paint.bodyShade,
    {
      cx: (p0.x + p3.x) / 2,
      cy: (p0.y + p3.y) / 2,
      r: Math.abs(p3.x - p0.x) * 0.7 + 20,
    },
  );
  const sp = ctx.recipe.spikes;
  let spikes = '';
  if (sp.where === 'tail' && sp.style !== 'none' && sp.count > 0) {
    const n = sp.count;
    const s = (sp.style === 'flame' ? 0.8 : 0.62) * (20 + sk.t * 12);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : 0.18 + (i * 0.56) / (n - 1);
      const at = bez(p0, p1, p2, p3, t);
      const tg = bezTangent(p0, p1, p2, p3, t);
      const w = (w0 + (w1 - w0) * t) / 2;
      const nrm = { x: tg.y, y: -tg.x };
      const base = { x: at.x + nrm.x * w * 0.6, y: at.y + nrm.y * w * 0.6 };
      spikes += orient(base, nrm, spikeArt(ctx, sp.style, s * (1 - t * 0.25)));
    }
  }
  const tg = bezTangent(p0, p1, p2, p3, 1);
  const tipSize = (ctx.recipe.tail.tip === 'flame' ? 26 : 30) + sk.t * 16;
  const tip = orient(p3, tg, tailTipArt(ctx, ctx.recipe.tail.tip, tipSize));
  const inner =
    spikes +
    h('path', {
      d,
      fill,
      stroke: ctx.paint.line,
      'stroke-width': ctx.W,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d:
        M(p1.x - 6, p1.y - w0 * 0.22) +
        Q(p2.x - 10, p2.y - w0 * 0.28, (p2.x + p3.x) / 2, (p2.y + p3.y) / 2 + 4),
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': ctx.W * 0.9,
      'stroke-linecap': 'round',
      opacity: 0.28,
    }) +
    tip;
  return pivot(p0.x, p0.y, cls, inner);
}

export function tails(ctx: Ctx): string {
  const right = tailOne(ctx, 'dv-tail');
  if (ctx.recipe.tail.count === 2) {
    return mirrorX(CX, tailOne(ctx, 'dv-tail-l')) + right;
  }
  return right;
}

/** Bounding extent of the tail tip (for fit framing). */
export function tailExtent(ctx: Ctx): { x: number; y: number; r: number } {
  const { p3 } = ctx.sk.tail;
  return { x: p3.x, y: p3.y, r: 40 + ctx.sk.t * 26 };
}
