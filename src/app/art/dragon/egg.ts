import { lerp, polar } from '../svg/num';
import { M, L, Q, eggD, polyD, roundStarD } from '../svg/path';
import { h } from '../svg/xml';
import { clover, flame, flower, gearD, pearl, snowflake, sparkleD } from '../glyphs';
import { glowGradient, type Ctx } from './ctx';
import { cloudUnion, pivot } from './shapes';
import { CX, GROUND } from './skeleton';
import { lighten, darken, outlineOf, mix } from '../svg/color';

export const EGG = { cx: CX, cy: GROUND - 128, w: 196, h: 252 };

const RAINBOW = ['#ff5a5f', '#ff9f40', '#ffd93d', '#5ccc6b', '#4aa8ff', '#5b6cf0', '#a66cf0'];

/** Pattern drawn inside the egg (clipped by the caller). */
function eggPattern(ctx: Ctx): string {
  const { base, accent, pattern } = ctx.recipe.egg;
  const { cx, cy, w, h: eh } = EGG;
  const top = cy - eh / 2;
  const line = outlineOf(accent, 0.45);
  const W = 3;
  switch (pattern) {
    case 'clouds': {
      const puff = (x: number, y: number, s: number): string =>
        cloudUnion(
          [
            { x, y, r: s },
            { x: x - s * 0.9, y: y + s * 0.3, r: s * 0.7 },
            { x: x + s * 0.95, y: y + s * 0.25, r: s * 0.75 },
          ],
          '#ffffff',
          lighten(line, 0.3),
          W,
        );
      return (
        puff(cx - 40, cy + 30, 26) +
        puff(cx + 52, cy - 40, 20) +
        h('ellipse', {
          cx: cx + 30,
          cy: cy + 62,
          rx: 22,
          ry: 26,
          fill: 'none',
          stroke: accent,
          'stroke-width': 11,
        }) +
        h('ellipse', {
          cx: cx - 30,
          cy: cy - 70,
          rx: 13,
          ry: 16,
          fill: 'none',
          stroke: accent,
          'stroke-width': 7,
        })
      );
    }
    case 'shine':
      return (
        h('path', {
          d: M(cx - 120, cy + 40) + L(cx + 40, cy - 140),
          stroke: '#ffffff',
          'stroke-width': 26,
          opacity: 0.55,
        }) +
        h('path', {
          d: M(cx - 80, cy + 120) + L(cx + 110, cy - 90),
          stroke: '#ffffff',
          'stroke-width': 12,
          opacity: 0.45,
        }) +
        h('path', { d: sparkleD(cx + 40, cy + 30, 18), fill: '#ffffff' })
      );
    case 'waves': {
      let d = '';
      for (const y of [cy - 10, cy + 60]) {
        d += M(cx - w, y);
        for (let i = 0; i < 6; i++)
          d +=
            Q(cx - w + i * 40 + 20, y - 18, cx - w + i * 40 + 40, y) +
            Q(cx - w + i * 40 + 60, y + 18, cx - w + i * 40 + 80, y);
      }
      const bub = (x: number, y: number, r: number): string =>
        h('circle', {
          cx: x,
          cy: y,
          r,
          fill: '#ffffff',
          'fill-opacity': 0.6,
          stroke: line,
          'stroke-width': 2.5,
        });
      return (
        h('path', {
          d,
          fill: 'none',
          stroke: accent,
          'stroke-width': 14,
          'stroke-linecap': 'round',
        }) +
        bub(cx - 30, cy - 70, 14) +
        bub(cx - 6, cy - 88, 9) +
        bub(cx + 44, cy + 100, 12) +
        bub(cx + 66, cy + 86, 8)
      );
    }
    case 'clovers':
      return (
        clover(cx - 40, cy - 40, 26, accent, line, W) +
        clover(cx + 46, cy + 22, 22, accent, line, W) +
        clover(cx - 20, cy + 82, 20, accent, line, W)
      );
    case 'flowers':
      return (
        flower(cx - 38, cy - 44, 28, 4, accent, '#ffd84a', line, W, -45) +
        flower(cx + 48, cy + 26, 24, 4, accent, '#ffd84a', line, W, -45) +
        flower(cx - 22, cy + 90, 20, 4, accent, '#ffd84a', line, W, -45)
      );
    case 'sun': {
      let rays = '';
      for (let i = 0; i < 5; i++) {
        const a = -90 + i * 72;
        const p0 = polar(cx, cy + 4, 46, a - 12);
        const p1 = polar(cx, cy + 4, 80, a);
        const p2 = polar(cx, cy + 4, 46, a + 12);
        rays += M(p0.x, p0.y) + L(p1.x, p1.y) + L(p2.x, p2.y) + 'Z';
      }
      return (
        h('path', {
          d: rays,
          fill: accent,
          stroke: line,
          'stroke-width': W,
          'stroke-linejoin': 'round',
        }) +
        h('circle', { cx, cy: cy + 4, r: 44, fill: '#fff3a6', stroke: line, 'stroke-width': W })
      );
    }
    case 'flames': {
      let out = '';
      for (let i = 0; i < 5; i++)
        out += h(
          'g',
          { transform: `translate(${(cx - 76 + i * 38).toFixed(2)} ${(cy + 70).toFixed(2)})` },
          flame(42, accent, '#ffe066', line, W),
        );
      out += h(
        'g',
        { transform: `translate(${cx} ${(cy - 16).toFixed(2)})` },
        flame(84, accent, '#ffe066', line, W),
      );
      return out;
    }
    case 'rainbow': {
      let out = '';
      const step = 15;
      RAINBOW.forEach((c, i) => {
        out += h('rect', {
          x: cx - w,
          y: cy - 40 + i * step,
          width: w * 2,
          height: step + 0.5,
          fill: c,
        });
      });
      return out;
    }
    case 'snowflake':
      return (
        snowflake(cx, cy + 6, 62, 8, line, 11) +
        snowflake(cx, cy + 6, 62, 8, '#ffffff', 5) +
        h('path', {
          d: sparkleD(cx - 52, cy - 76, 10) + sparkleD(cx + 58, cy + 78, 8),
          fill: '#ffffff',
        })
      );
    case 'stars': {
      let out = '';
      const pts = [
        [-44, -70],
        [10, -96],
        [50, -54],
        [-60, -14],
        [-6, -28],
        [52, 6],
        [-40, 46],
        [16, 40],
        [56, 70],
        [-12, 98],
      ];
      pts.forEach(([x, y], i) => {
        const d = roundStarD(cx + x!, cy + y!, 5, 13, 6, -90, 0.2);
        out +=
          i < 9
            ? h('path', {
                d,
                fill: accent,
                stroke: line,
                'stroke-width': 2.2,
                'stroke-linejoin': 'round',
              })
            : h('path', {
                d,
                fill: 'none',
                stroke: accent,
                'stroke-width': 2.5,
                'stroke-dasharray': '3 3',
              });
      });
      return out;
    }
    case 'crown': {
      const n = 10;
      const bandTop = cy - 6;
      const step = (w + 20) / n;
      let d = M(cx - w / 2 - 10, cy + 30) + L(cx - w / 2 - 10, bandTop);
      for (let i = 0; i < n; i++) {
        d +=
          L(cx - w / 2 - 10 + step * (i + 0.5), bandTop - 30) +
          L(cx - w / 2 - 10 + step * (i + 1), bandTop);
      }
      d += L(cx + w / 2 + 10, cy + 30) + 'Z';
      return (
        h('path', {
          d,
          fill: accent,
          stroke: line,
          'stroke-width': W,
          'stroke-linejoin': 'round',
        }) +
        h('circle', { cx, cy: cy + 12, r: 9, fill: '#e0335a', stroke: line, 'stroke-width': 2 }) +
        h('circle', {
          cx: cx - 44,
          cy: cy + 12,
          r: 7,
          fill: '#3d7be0',
          stroke: line,
          'stroke-width': 2,
        }) +
        h('circle', {
          cx: cx + 44,
          cy: cy + 12,
          r: 7,
          fill: '#3d7be0',
          stroke: line,
          'stroke-width': 2,
        })
      );
    }
    case 'scallops': {
      let d = '';
      for (let row = 0; row < 9; row++) {
        const y = top + 40 + row * 26;
        const off = row % 2 ? 0 : 16;
        for (let x = cx - w / 2 - 40 + off; x < cx + w / 2 + 40; x += 32)
          d += M(x - 16, y) + Q(x, y + 18, x + 16, y);
      }
      return (
        h('path', {
          d,
          fill: 'none',
          stroke: accent,
          'stroke-width': 4,
          'stroke-linecap': 'round',
          opacity: 0.8,
        }) +
        pearl(cx + 30, cy + 40, 14, line, 2) +
        pearl(cx - 40, cy - 30, 11, line, 2)
      );
    }
    case 'speckles': {
      let out = '';
      const spots = [
        [-50, -60, 9],
        [30, -80, 6],
        [60, -20, 10],
        [-20, 0, 7],
        [-66, 40, 8],
        [20, 50, 12],
        [56, 90, 6],
        [-30, 100, 7],
        [0, -110, 5],
      ];
      for (const [x, y, r] of spots)
        out += h('circle', { cx: cx + x!, cy: cy + y!, r: r!, fill: accent, opacity: 0.75 });
      out += h('path', {
        d: M(cx - w / 2, cy - 20) + Q(cx - 40, cy - 60, cx - 10, cy - 90),
        fill: 'none',
        stroke: darken(base, 0.35),
        'stroke-width': 3,
        opacity: 0.5,
      });
      out += cloudUnion(
        [
          { x: cx + 40, y: top + 30, r: 22 },
          { x: cx + 10, y: top + 24, r: 18 },
          { x: cx + 66, y: top + 44, r: 16 },
        ],
        '#7fae4f',
        '#3f6b2a',
        3,
      );
      return out;
    }
    case 'gears':
      return (
        h('path', {
          d: gearD(cx - 30, cy - 30, 40, 10),
          fill: accent,
          'fill-rule': 'evenodd',
          stroke: line,
          'stroke-width': W,
        }) +
        h('path', {
          d: gearD(cx + 36, cy + 30, 30, 8),
          fill: lighten(accent, 0.35),
          'fill-rule': 'evenodd',
          stroke: line,
          'stroke-width': W,
        }) +
        h('path', {
          d: gearD(cx - 18, cy + 84, 20, 7),
          fill: accent,
          'fill-rule': 'evenodd',
          stroke: line,
          'stroke-width': W,
        })
      );
    default: {
      let out = '';
      for (const [x, y, r] of [
        [-40, -50, 18],
        [40, -10, 14],
        [-20, 60, 16],
        [50, 80, 10],
      ])
        out += h('circle', { cx: cx + x!, cy: cy + y!, r: r!, fill: accent });
      return out;
    }
  }
}

export interface EggParts {
  shape: string;
  fill: string;
  body: string;
}

/** The decorated egg (no shadow), as layered markup sharing one clip. */
export function eggArt(ctx: Ctx): EggParts {
  const { cx, cy, w, h: eh } = EGG;
  const d = eggD(cx, cy, w, eh);
  const { base, accent } = ctx.recipe.egg;
  const line = outlineOf(mix(base, accent, 0.4), 0.5);
  const gid = ctx.def('egg-grad', (id) =>
    h(
      'radialGradient',
      { id, gradientUnits: 'userSpaceOnUse', cx: cx - w * 0.18, cy: cy - eh * 0.22, r: eh * 0.7 },
      h('stop', { offset: '0', 'stop-color': lighten(base, 0.55) }),
      h('stop', { offset: '0.5', 'stop-color': base }),
      h('stop', { offset: '1', 'stop-color': darken(base, 0.18) }),
    ),
  );
  const clip = ctx.def('egg-clip', (id) => h('clipPath', { id }, h('path', { d })));
  const body =
    h('path', { d, fill: `url(#${gid})` }) +
    h(
      'g',
      { 'clip-path': `url(#${clip})` },
      eggPattern(ctx),
      h('ellipse', {
        cx: cx + w * 0.2,
        cy: cy + eh * 0.32,
        rx: w * 0.5,
        ry: eh * 0.24,
        fill: darken(base, 0.4),
        opacity: 0.12,
      }),
    ) +
    h('ellipse', {
      cx: cx - w * 0.2,
      cy: cy - eh * 0.26,
      rx: w * 0.13,
      ry: eh * 0.12,
      fill: '#ffffff',
      opacity: 0.6,
      transform: `rotate(-20 ${(cx - w * 0.2).toFixed(2)} ${(cy - eh * 0.26).toFixed(2)})`,
    }) +
    h('path', { d, fill: 'none', stroke: line, 'stroke-width': 5 });
  return { shape: d, fill: `url(#${gid})`, body };
}

/** Zig-zag crack across the egg, used for very warm eggs and the hatch sequence. */
export function crackD(level: number): string {
  const { cx, cy, w } = EGG;
  const y = cy - 22;
  const pts = [
    { x: cx - w * 0.5, y: y + 6 },
    { x: cx - w * 0.36, y: y - 12 },
    { x: cx - w * 0.22, y: y + 10 },
    { x: cx - w * 0.06, y: y - 14 },
    { x: cx + w * 0.08, y: y + 8 },
    { x: cx + w * 0.24, y: y - 12 },
    { x: cx + w * 0.38, y: y + 8 },
    { x: cx + w * 0.5, y: y - 6 },
  ];
  const n = Math.max(2, Math.round(pts.length * Math.min(1, level)));
  const start = Math.floor((pts.length - n) / 2);
  return polyD(pts.slice(start, start + n), false);
}

/** Zig-zag split line as a closed region (top part of the egg) for the hatch shells. */
export function topHalfClipD(): string {
  const { cx, cy, w, h: eh } = EGG;
  const y = cy - 22;
  return (
    M(cx - w, y + 6) +
    L(cx - w * 0.5, y + 6) +
    L(cx - w * 0.36, y - 12) +
    L(cx - w * 0.22, y + 10) +
    L(cx - w * 0.06, y - 14) +
    L(cx + w * 0.08, y + 8) +
    L(cx + w * 0.24, y - 12) +
    L(cx + w * 0.38, y + 8) +
    L(cx + w * 0.5, y - 6) +
    L(cx + w, y - 6) +
    L(cx + w, cy - eh) +
    L(cx - w, cy - eh) +
    'Z'
  );
}

export function bottomHalfClipD(): string {
  const { cx, cy, w, h: eh } = EGG;
  const y = cy - 22;
  return (
    M(cx - w, y + 6) +
    L(cx - w * 0.5, y + 6) +
    L(cx - w * 0.36, y - 12) +
    L(cx - w * 0.22, y + 10) +
    L(cx - w * 0.06, y - 14) +
    L(cx + w * 0.08, y + 8) +
    L(cx + w * 0.24, y - 12) +
    L(cx + w * 0.38, y + 8) +
    L(cx + w * 0.5, y - 6) +
    L(cx + w, y - 6) +
    L(cx + w, cy + eh) +
    L(cx - w, cy + eh) +
    'Z'
  );
}

export function eggShadow(): string {
  return h('ellipse', {
    class: 'dv-shadow',
    cx: CX + 6,
    cy: GROUND + 2,
    rx: EGG.w * 0.5,
    ry: 14,
    fill: '#2a2140',
    opacity: 0.16,
  });
}

/** Static egg with warmth cues. */
export function eggContent(
  ctx: Ctx,
  warmth: number | undefined,
): { back: string; body: string; front: string } {
  const art = eggArt(ctx);
  const { cx, cy, w, h: eh } = EGG;
  let back = '';
  let front = '';
  let over = '';
  if (warmth !== undefined) {
    const wv = Math.max(0, Math.min(1, warmth));
    if (wv < 0.3) {
      // cold: frosty veil, icicle rim, snowflakes
      const k = (0.3 - wv) / 0.3;
      over += h('path', { d: art.shape, fill: '#dff3ff', opacity: lerp(0.2, 0.5, k).toFixed(2) });
      over += h('path', {
        d: art.shape,
        fill: 'none',
        stroke: '#ffffff',
        'stroke-width': 9,
        opacity: 0.6,
        'stroke-dasharray': '2 14',
        'stroke-linecap': 'round',
      });
      front += h(
        'g',
        { class: 'dv-frost' },
        snowflake(cx - w * 0.62, cy - eh * 0.22, 16, 6, '#9fd6f5', 3.5),
        snowflake(cx + w * 0.62, cy + eh * 0.02, 12, 6, '#9fd6f5', 3),
        snowflake(cx + w * 0.5, cy - eh * 0.45, 9, 6, '#9fd6f5', 2.5),
      );
    } else if (wv >= 0.5) {
      const glow = glowGradient(ctx, 'egg-warm', '#ffb347', lerp(0.35, 0.8, (wv - 0.5) / 0.5));
      back += h(
        'g',
        { transform: `translate(${cx} ${cy.toFixed(2)})` },
        h(
          'g',
          { class: 'dv-egg-glow' },
          h('ellipse', { cx: 0, cy: 0, rx: w * 0.95, ry: eh * 0.78, fill: glow }),
        ),
      );
      if (wv >= 0.85) {
        over += h('path', {
          d: crackD(((wv - 0.85) / 0.15) * 0.6 + 0.4),
          fill: 'none',
          stroke: '#5b3a2a',
          'stroke-width': 4.5,
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
        });
      }
      front += h(
        'g',
        { class: 'dv-warm-sparkles' },
        h('path', {
          class: 'dv-twinkle dv-twinkle-1',
          d: sparkleD(cx - w * 0.6, cy - eh * 0.3, 11),
          fill: '#ffe08a',
        }),
        h('path', {
          class: 'dv-twinkle dv-twinkle-2',
          d: sparkleD(cx + w * 0.62, cy - eh * 0.1, 9),
          fill: '#ffe08a',
        }),
      );
    }
  }
  const body = pivot(CX, GROUND, 'dv-egg', art.body + over);
  return { back, body, front };
}
