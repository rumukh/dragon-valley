/** Small reusable glyph shapes (flames, leaves, flowers, snowflakes, gears...) in local coordinates. */
import { polar, type Pt } from './svg/num';
import { M, L, Q, C, Mp, Lp, polyD, circleD, heartD, roundStarD } from './svg/path';
import { h } from './svg/xml';

/** Flame pointing up: base centre at (0,0), height s. Three tongues. */
export function flameD(s: number): string {
  return (
    M(0, 0) +
    C(-s * 0.42, 0, -s * 0.5, -s * 0.34, -s * 0.3, -s * 0.58) +
    Q(-s * 0.26, -s * 0.38, -s * 0.12, -s * 0.36) +
    C(-s * 0.22, -s * 0.66, -s * 0.06, -s * 0.84, 0, -s) +
    C(s * 0.04, -s * 0.8, s * 0.2, -s * 0.72, s * 0.16, -s * 0.44) +
    Q(s * 0.26, -s * 0.5, s * 0.34, -s * 0.66) +
    C(s * 0.52, -s * 0.38, s * 0.42, 0, 0, 0) +
    'Z'
  );
}

/** Inner flame core for a two-tone flame. */
export function flameCoreD(s: number): string {
  return (
    M(0, -s * 0.04) +
    C(-s * 0.24, -s * 0.04, -s * 0.24, -s * 0.3, -s * 0.06, -s * 0.56) +
    C(-s * 0.02, -s * 0.36, s * 0.12, -s * 0.32, s * 0.12, -s * 0.22) +
    C(s * 0.24, -s * 0.12, s * 0.16, -s * 0.04, 0, -s * 0.04) +
    'Z'
  );
}

export function flame(s: number, outer: string, inner: string, line: string, w: number): string {
  return (
    h('path', {
      d: flameD(s),
      fill: outer,
      stroke: line,
      'stroke-width': w,
      'stroke-linejoin': 'round',
    }) + h('path', { d: flameCoreD(s), fill: inner })
  );
}

/** Heart-shaped leaf pointing up from (0,0), length s. */
export function heartLeafD(s: number): string {
  return (
    M(0, 0) +
    C(-s * 0.15, -s * 0.2, -s * 0.62, -s * 0.42, -s * 0.5, -s * 0.8) +
    C(-s * 0.4, -s * 1.08, -s * 0.08, -s * 1.06, 0, -s * 0.84) +
    C(s * 0.08, -s * 1.06, s * 0.4, -s * 1.08, s * 0.5, -s * 0.8) +
    C(s * 0.62, -s * 0.42, s * 0.15, -s * 0.2, 0, 0) +
    'Z'
  );
}

/** Three-leaf clover centred at (cx, cy), radius s. */
export function clover(
  cx: number,
  cy: number,
  s: number,
  fill: string,
  line: string,
  w: number,
  vein = true,
): string {
  let out = '';
  for (const a of [-90, 30, 150]) {
    out += h('path', {
      d: heartLeafD(s),
      fill,
      stroke: line,
      'stroke-width': w,
      'stroke-linejoin': 'round',
      transform: `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${a + 90})`,
    });
  }
  if (vein) {
    let v = '';
    for (const a of [-90, 30, 150]) {
      const p = polar(cx, cy, s * 0.62, a);
      v += M(cx, cy) + L(p.x, p.y);
    }
    out += h('path', {
      d: v,
      stroke: line,
      'stroke-width': w * 0.6,
      'stroke-linecap': 'round',
      opacity: 0.45,
      fill: 'none',
    });
  }
  return out;
}

/** Flower with n round petals. */
export function flower(
  cx: number,
  cy: number,
  s: number,
  n: number,
  petal: string,
  center: string,
  line: string,
  w: number,
  rot = -90,
): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 360) / n;
    const p = polar(cx, cy, s * 0.52, a);
    out += h('ellipse', {
      cx: p.x,
      cy: p.y,
      rx: s * 0.5,
      ry: s * (n > 5 ? 0.3 : 0.38),
      fill: petal,
      stroke: line,
      'stroke-width': w,
      transform: `rotate(${a.toFixed(2)} ${p.x.toFixed(2)} ${p.y.toFixed(2)})`,
    });
  }
  out += h('circle', { cx, cy, r: s * 0.32, fill: center, stroke: line, 'stroke-width': w });
  out += h('circle', {
    cx: cx - s * 0.1,
    cy: cy - s * 0.1,
    r: s * 0.1,
    fill: '#ffffff',
    opacity: 0.6,
  });
  return out;
}

/** Snowflake with `arms` arms (8 by default) and side branches. */
export function snowflake(
  cx: number,
  cy: number,
  r: number,
  arms: number,
  color: string,
  w: number,
  rot = -90,
): string {
  let d = '';
  for (let i = 0; i < arms; i++) {
    const a = rot + (i * 360) / arms;
    const tip = polar(cx, cy, r, a);
    d += M(cx, cy) + Lp(tip);
    for (const k of [0.45, 0.72]) {
      const b = polar(cx, cy, r * k, a);
      const len = r * (k < 0.5 ? 0.28 : 0.2);
      d += Mp(b) + Lp(polar(b.x, b.y, len, a - 42)) + Mp(b) + Lp(polar(b.x, b.y, len, a + 42));
    }
  }
  return (
    h('path', {
      d,
      fill: 'none',
      stroke: color,
      'stroke-width': w,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }) + h('circle', { cx, cy, r: w * 1.2, fill: color })
  );
}

/** Gear outline with a hole (evenodd). */
export function gearD(cx: number, cy: number, r: number, teeth: number, hole = 0.32): string {
  const pts: Pt[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i * 360) / (teeth * 4) - 90 + 360 / (teeth * 8);
    const outer = i % 4 === 1 || i % 4 === 2;
    pts.push(polar(cx, cy, outer ? r : r * 0.8, a));
  }
  return polyD(pts) + circleD(cx, cy, r * hole);
}

/** Cute rounded star. */
export function star(
  cx: number,
  cy: number,
  r: number,
  fill: string,
  line: string,
  w: number,
  points = 5,
): string {
  return h('path', {
    d: roundStarD(cx, cy, points, r, r * 0.5, -90, 0.2),
    fill,
    stroke: line,
    'stroke-width': w,
    'stroke-linejoin': 'round',
  });
}

/** Four-point sparkle (twinkle) centred at (cx, cy). */
export function sparkleD(cx: number, cy: number, r: number): string {
  const k = r * 0.22;
  return (
    M(cx, cy - r) +
    Q(cx + k * 0.4, cy - k * 0.4, cx + r, cy) +
    Q(cx + k * 0.4, cy + k * 0.4, cx, cy + r) +
    Q(cx - k * 0.4, cy + k * 0.4, cx - r, cy) +
    Q(cx - k * 0.4, cy - k * 0.4, cx, cy - r) +
    'Z'
  );
}

export function heart(
  cx: number,
  cy: number,
  w: number,
  fill: string,
  line: string,
  sw: number,
): string {
  return h('path', {
    d: heartD(cx, cy, w),
    fill,
    stroke: line,
    'stroke-width': sw,
    'stroke-linejoin': 'round',
  });
}

/** Pearl with iridescent highlight. */
export function pearl(cx: number, cy: number, r: number, line: string, w: number): string {
  return (
    h('circle', { cx, cy, r, fill: '#fbf7f2', stroke: line, 'stroke-width': w }) +
    h('circle', {
      cx: cx + r * 0.18,
      cy: cy + r * 0.22,
      r: r * 0.62,
      fill: '#e9e2f5',
      opacity: 0.7,
    }) +
    h('circle', { cx: cx - r * 0.3, cy: cy - r * 0.32, r: r * 0.3, fill: '#ffffff' })
  );
}
