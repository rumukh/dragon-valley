/**
 * Character kit for bosses: faces, hands, boots and small props in the storybook style shared with
 * the dragons (soft gradients, hue-tinted outlines, blush, glossy eyes).
 */
import { polar, type Pt } from '../svg/num';
import { M, L, Q, C, roundRectD } from '../svg/path';
import { h } from '../svg/xml';
import { darken, lighten, outlineOf } from '../svg/color';
import { sparkleD } from '../glyphs';
import { limb } from '../dragon/shapes';

export const INK = '#2a2140';

export type EyeStyle = 'open' | 'happy' | 'closed' | 'squint' | 'wide' | 'sleepy' | 'side';
export type BrowStyle = 'grumpy' | 'raised' | 'soft' | 'worried' | 'none';
export type MouthStyle =
  'frown' | 'pout' | 'smile' | 'grin' | 'laugh' | 'o' | 'snore' | 'wobbly' | 'flat';

export interface FaceSpec {
  cx: number;
  cy: number;
  /** Eye spacing (half distance). */
  dx: number;
  /** Eye radius. */
  r: number;
  eyes: EyeStyle;
  brows: BrowStyle;
  mouth: MouthStyle;
  /** Mouth centre y and width. */
  my: number;
  mw: number;
  skin: string;
  blush?: number;
  browColor?: string;
  /** Tilt the whole face expression to one side (looks). */
  look?: number;
}

export function face(f: FaceSpec): string {
  const out: string[] = [];
  const blush = f.blush ?? 0.45;
  if (blush > 0) {
    for (const s of [-1, 1])
      out.push(
        h('ellipse', {
          cx: f.cx + s * (f.dx + f.r * 0.5),
          cy: f.cy + f.r * 1.6,
          rx: f.r * 0.95,
          ry: f.r * 0.55,
          fill: '#ff7a8a',
          opacity: blush,
        }),
      );
  }
  for (const s of [-1, 1]) {
    const x = f.cx + s * f.dx;
    const y = f.cy;
    const r = f.r;
    const lx = (f.look ?? 0) * r * 0.35;
    switch (f.eyes) {
      case 'happy':
        out.push(
          h('path', {
            d: M(x - r, y + r * 0.25) + Q(x, y - r * 1.05, x + r, y + r * 0.25),
            fill: 'none',
            stroke: INK,
            'stroke-width': r * 0.42,
            'stroke-linecap': 'round',
          }),
        );
        break;
      case 'closed':
        out.push(
          h('path', {
            d: M(x - r, y) + Q(x, y + r * 0.8, x + r, y),
            fill: 'none',
            stroke: INK,
            'stroke-width': r * 0.38,
            'stroke-linecap': 'round',
          }),
        );
        break;
      case 'sleepy':
        out.push(
          h('path', {
            d: M(x - r, y + r * 0.1) + L(x + r, y + r * 0.1),
            stroke: INK,
            'stroke-width': r * 0.38,
            'stroke-linecap': 'round',
          }),
        );
        out.push(
          h('path', {
            d: M(x - r * 0.8, y + r * 0.1) + Q(x, y + r * 0.85, x + r * 0.8, y + r * 0.1),
            fill: INK,
            opacity: 0.85,
          }),
        );
        break;
      case 'squint':
        out.push(
          h('path', {
            d:
              M(x - r, y - r * 0.15) +
              Q(x, y + r * 0.35, x + r, y - r * 0.15) +
              Q(x, y + r * 0.05, x - r, y - r * 0.15) +
              'Z',
            fill: INK,
            stroke: INK,
            'stroke-width': r * 0.2,
            'stroke-linejoin': 'round',
          }),
        );
        break;
      default: {
        const big = f.eyes === 'wide' ? 1.18 : 1;
        out.push(
          h('ellipse', { cx: x + lx, cy: y, rx: r * 0.86 * big, ry: r * 1.05 * big, fill: INK }),
        );
        out.push(
          h('circle', {
            cx: x + lx + r * 0.3,
            cy: y - r * 0.38,
            r: r * 0.34 * big,
            fill: '#ffffff',
          }),
        );
        out.push(
          h('circle', {
            cx: x + lx - r * 0.28,
            cy: y + r * 0.42,
            r: r * 0.14,
            fill: '#ffffff',
            opacity: 0.9,
          }),
        );
      }
    }
  }
  const bc = f.browColor ?? darken(f.skin, 0.55);
  const bw = f.r * 0.42;
  const browY = f.cy - f.r * 1.75;
  if (f.brows !== 'none') {
    let d = '';
    for (const s of [-1, 1]) {
      const x = f.cx + s * f.dx;
      switch (f.brows) {
        case 'grumpy':
          d +=
            M(x + s * f.r * 1.05, browY - f.r * 0.45) + L(x - s * f.r * 0.85, browY + f.r * 0.15);
          break;
        case 'worried':
          d += M(x - s * f.r * 0.9, browY - f.r * 0.45) + L(x + s * f.r * 0.95, browY + f.r * 0.05);
          break;
        case 'raised':
          d +=
            M(x - f.r, browY - f.r * 0.15) + Q(x, browY - f.r * 0.95, x + f.r, browY - f.r * 0.15);
          break;
        default:
          d += M(x - f.r * 0.9, browY) + Q(x, browY - f.r * 0.45, x + f.r * 0.9, browY);
      }
    }
    out.push(
      h('path', { d, fill: 'none', stroke: bc, 'stroke-width': bw, 'stroke-linecap': 'round' }),
    );
  }
  const mx = f.cx;
  const my = f.my;
  const w = f.mw;
  switch (f.mouth) {
    case 'frown':
      out.push(
        h('path', {
          d: M(mx - w * 0.45, my + w * 0.12) + Q(mx, my - w * 0.2, mx + w * 0.45, my + w * 0.12),
          fill: 'none',
          stroke: INK,
          'stroke-width': w * 0.12,
          'stroke-linecap': 'round',
        }),
      );
      break;
    case 'pout':
      out.push(
        h('path', {
          d: M(mx - w * 0.3, my + w * 0.08) + Q(mx, my - w * 0.14, mx + w * 0.3, my + w * 0.08),
          fill: 'none',
          stroke: INK,
          'stroke-width': w * 0.12,
          'stroke-linecap': 'round',
        }),
      );
      out.push(
        h('ellipse', {
          cx: mx,
          cy: my + w * 0.18,
          rx: w * 0.14,
          ry: w * 0.07,
          fill: lighten('#ff8fa8', 0.2),
          opacity: 0.8,
        }),
      );
      break;
    case 'flat':
      out.push(
        h('path', {
          d: M(mx - w * 0.35, my) + L(mx + w * 0.35, my),
          stroke: INK,
          'stroke-width': w * 0.12,
          'stroke-linecap': 'round',
        }),
      );
      break;
    case 'wobbly':
      out.push(
        h('path', {
          d:
            M(mx - w * 0.42, my) +
            Q(mx - w * 0.21, my - w * 0.12, mx, my) +
            Q(mx + w * 0.21, my + w * 0.12, mx + w * 0.42, my),
          fill: 'none',
          stroke: INK,
          'stroke-width': w * 0.11,
          'stroke-linecap': 'round',
        }),
      );
      break;
    case 'smile':
      out.push(
        h('path', {
          d: M(mx - w * 0.45, my - w * 0.06) + Q(mx, my + w * 0.36, mx + w * 0.45, my - w * 0.06),
          fill: 'none',
          stroke: INK,
          'stroke-width': w * 0.12,
          'stroke-linecap': 'round',
        }),
      );
      break;
    case 'o':
      out.push(
        h('ellipse', {
          cx: mx,
          cy: my + w * 0.05,
          rx: w * 0.16,
          ry: w * 0.2,
          fill: '#6b2440',
          stroke: INK,
          'stroke-width': w * 0.07,
        }),
      );
      break;
    case 'snore':
      out.push(
        h('ellipse', {
          cx: mx,
          cy: my + w * 0.05,
          rx: w * 0.12,
          ry: w * 0.14,
          fill: '#6b2440',
          stroke: INK,
          'stroke-width': w * 0.06,
        }),
      );
      break;
    default: {
      const big = f.mouth === 'laugh' ? 1.3 : 1;
      const d =
        M(mx - w * 0.5 * big, my - w * 0.08) +
        Q(mx, my + w * 0.02, mx + w * 0.5 * big, my - w * 0.08) +
        C(
          mx + w * 0.46 * big,
          my + w * 0.62 * big,
          mx - w * 0.46 * big,
          my + w * 0.62 * big,
          mx - w * 0.5 * big,
          my - w * 0.08,
        ) +
        'Z';
      out.push(
        h('path', {
          d,
          fill: '#6b2440',
          stroke: INK,
          'stroke-width': w * 0.08,
          'stroke-linejoin': 'round',
        }),
      );
      out.push(
        h('ellipse', {
          cx: mx,
          cy: my + w * 0.36 * big,
          rx: w * 0.24 * big,
          ry: w * 0.12 * big,
          fill: '#ff8fa8',
        }),
      );
      out.push(
        h('path', {
          d: M(mx - w * 0.38 * big, my - w * 0.02) + L(mx + w * 0.38 * big, my - w * 0.02),
          stroke: '#ffffff',
          'stroke-width': w * 0.1,
          'stroke-linecap': 'round',
        }),
      );
    }
  }
  return out.join('');
}

/** Rounded mitten hand. */
export function hand(x: number, y: number, r: number, skin: string, angle = 0): string {
  const line = outlineOf(skin, 0.6);
  const thumb = polar(x, y, r * 0.85, angle - 120);
  return (
    h('circle', {
      cx: thumb.x,
      cy: thumb.y,
      r: r * 0.42,
      fill: skin,
      stroke: line,
      'stroke-width': 4,
    }) +
    h('circle', { cx: x, cy: y, r, fill: skin, stroke: line, 'stroke-width': 4.5 }) +
    h('circle', { cx: x - r * 0.3, cy: y - r * 0.32, r: r * 0.25, fill: '#ffffff', opacity: 0.35 })
  );
}

/** Thick arm from shoulder through elbow to hand. */
export function arm(points: readonly Pt[], thick: number, fill: string): string {
  return limb(points, thick, fill, outlineOf(fill, 0.6), 4.5);
}

/** Rounded boot or foot. */
export function boot(x: number, y: number, w: number, color: string, toe = 1): string {
  const line = outlineOf(color, 0.6);
  const d =
    M(x - w * 0.5, y) +
    L(x - w * 0.5, y - w * 0.45) +
    Q(x - w * 0.5, y - w * 0.7, x - w * 0.2, y - w * 0.7) +
    L(x + w * 0.05, y - w * 0.7) +
    Q(x + w * 0.2, y - w * 0.36, x + w * 0.5 * toe + w * 0.2, y - w * 0.32) +
    Q(x + w * 0.62 * toe + w * 0.2, y - w * 0.1, x + w * 0.5 * toe + w * 0.18, y) +
    'Z';
  return (
    h('path', { d, fill: color, stroke: line, 'stroke-width': 4.5, 'stroke-linejoin': 'round' }) +
    h('path', {
      d: M(x - w * 0.44, y - w * 0.08) + L(x + w * 0.5 * toe + w * 0.12, y - w * 0.08),
      stroke: darken(color, 0.3),
      'stroke-width': 4,
      opacity: 0.6,
    })
  );
}

/** Soft radial body gradient (user space). */
export function bodyGrad(id: string, base: string, cx: number, cy: number, r: number): string {
  return h(
    'radialGradient',
    { id, gradientUnits: 'userSpaceOnUse', cx: cx - r * 0.3, cy: cy - r * 0.4, r: r * 1.4 },
    h('stop', { offset: '0', 'stop-color': lighten(base, 0.35) }),
    h('stop', { offset: '0.45', 'stop-color': base }),
    h('stop', { offset: '1', 'stop-color': darken(base, 0.28) }),
  );
}

export function ground(cx = 256, rx = 190): string {
  return h('ellipse', { cx, cy: 472, rx, ry: 16, fill: INK, opacity: 0.15 });
}

export function zzz(x: number, y: number, s: number): string {
  const z = (zx: number, zy: number, k: number, cls: string): string =>
    h('path', {
      class: cls,
      d:
        M(zx - s * k * 0.5, zy - s * k * 0.5) +
        L(zx + s * k * 0.5, zy - s * k * 0.5) +
        L(zx - s * k * 0.5, zy + s * k * 0.5) +
        L(zx + s * k * 0.5, zy + s * k * 0.5),
      fill: 'none',
      stroke: '#6a4ce0',
      'stroke-width': s * k * 0.22,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
  return h(
    'g',
    { class: 'dv-zzz' },
    z(x, y + s * 1.2, 0.7, 'dv-z dv-z-1'),
    z(x + s * 1.1, y, 1, 'dv-z dv-z-2'),
    z(x + s * 2.4, y - s * 1.3, 1.3, 'dv-z dv-z-3'),
  );
}

export function questionMarks(x: number, y: number, s: number, color = '#6a4ce0'): string {
  const q = (qx: number, qy: number, k: number): string =>
    h('path', {
      d:
        M(qx - s * k * 0.32, qy - s * k * 0.3) +
        C(
          qx - s * k * 0.32,
          qy - s * k * 0.75,
          qx + s * k * 0.38,
          qy - s * k * 0.75,
          qx + s * k * 0.36,
          qy - s * k * 0.28,
        ) +
        C(qx + s * k * 0.34, qy, qx, qy, qx, qy + s * k * 0.2),
      fill: 'none',
      stroke: color,
      'stroke-width': s * k * 0.18,
      'stroke-linecap': 'round',
    }) + h('circle', { cx: qx, cy: qy + s * k * 0.46, r: s * k * 0.1, fill: color });
  return h('g', { class: 'dv-question' }, q(x, y, 1), q(x + s * 1.05, y - s * 0.5, 0.7));
}

export function sparkles(points: Array<[number, number, number]>, fill = '#ffd23f'): string {
  return h(
    'g',
    { class: 'dv-joy' },
    ...points.map(([x, y, r], i) =>
      h('path', {
        class: `dv-twinkle dv-twinkle-${(i % 3) + 1}`,
        d: sparkleD(x, y, r),
        fill,
        stroke: '#c47f0a',
        'stroke-width': 1.5,
      }),
    ),
  );
}

export function tears(x: number, y: number, s: number, side: 1 | -1): string {
  return h('path', {
    d:
      M(x, y) +
      Q(x + side * s * 0.9, y + s * 0.5, x + side * s * 0.5, y + s * 1.3) +
      Q(x + side * s * 0.1, y + s * 0.9, x, y) +
      'Z',
    fill: '#9fdcff',
    stroke: '#3a7bc8',
    'stroke-width': 2.5,
  });
}

export function rr(
  x: number,
  y: number,
  w: number,
  hgt: number,
  r: number,
  fill: string,
  lineK = 0.6,
  sw = 4.5,
): string {
  return h('path', {
    d: roundRectD(x, y, w, hgt, r),
    fill,
    stroke: outlineOf(fill, lineK),
    'stroke-width': sw,
    'stroke-linejoin': 'round',
  });
}
