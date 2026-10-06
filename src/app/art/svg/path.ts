import { f, polar, type Pt } from './num';

/** Path command builders (deterministic formatting). */
export const M = (x: number, y: number): string => `M${f(x)} ${f(y)}`;
export const L = (x: number, y: number): string => `L${f(x)} ${f(y)}`;
export const C = (x1: number, y1: number, x2: number, y2: number, x: number, y: number): string =>
  `C${f(x1)} ${f(y1)} ${f(x2)} ${f(y2)} ${f(x)} ${f(y)}`;
export const Q = (x1: number, y1: number, x: number, y: number): string =>
  `Q${f(x1)} ${f(y1)} ${f(x)} ${f(y)}`;
export const A = (
  rx: number,
  ry: number,
  rot: number,
  large: 0 | 1,
  sweep: 0 | 1,
  x: number,
  y: number,
): string => `A${f(rx)} ${f(ry)} ${f(rot)} ${large} ${sweep} ${f(x)} ${f(y)}`;
export const Z = 'Z';

export const Mp = (p: Pt): string => M(p.x, p.y);
export const Lp = (p: Pt): string => L(p.x, p.y);
export const Cp = (a: Pt, b: Pt, p: Pt): string => C(a.x, a.y, b.x, b.y, p.x, p.y);
export const Qp = (a: Pt, p: Pt): string => Q(a.x, a.y, p.x, p.y);

/** Ellipse as a path (two arcs), useful inside clip paths and compound paths. */
export function ellipseD(cx: number, cy: number, rx: number, ry: number): string {
  return `${M(cx - rx, cy)}${A(rx, ry, 0, 1, 0, cx + rx, cy)}${A(rx, ry, 0, 1, 0, cx - rx, cy)}Z`;
}

export function circleD(cx: number, cy: number, r: number): string {
  return ellipseD(cx, cy, r, r);
}

export function polyD(points: readonly Pt[], close = true): string {
  return points.map((p, i) => (i === 0 ? Mp(p) : Lp(p))).join('') + (close ? Z : '');
}

/** Closed Catmull-Rom spline through points, as cubic Beziers. */
export function smoothClosedD(points: readonly Pt[], tension = 1): string {
  const n = points.length;
  if (n < 3) return polyD(points);
  let d = Mp(points[0]!);
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % n]!;
    const p3 = points[(i + 2) % n]!;
    const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * tension, y: p1.y + ((p2.y - p0.y) / 6) * tension };
    const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * tension, y: p2.y - ((p3.y - p1.y) / 6) * tension };
    d += Cp(c1, c2, p2);
  }
  return d + Z;
}

/** Open Catmull-Rom spline through points. */
export function smoothOpenD(points: readonly Pt[], tension = 1, moveTo = true): string {
  const n = points.length;
  if (n < 2) return '';
  let d = moveTo ? Mp(points[0]!) : '';
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(n - 1, i + 2)]!;
    const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * tension, y: p1.y + ((p2.y - p0.y) / 6) * tension };
    const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * tension, y: p2.y - ((p3.y - p1.y) / 6) * tension };
    d += Cp(c1, c2, p2);
  }
  return d;
}

/** Star polygon points. rot = angle (deg) of the first outer point; -90 points up. */
export function starPoints(
  cx: number,
  cy: number,
  n: number,
  rOuter: number,
  rInner: number,
  rot = -90,
): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    pts.push(polar(cx, cy, r, rot + (i * 180) / n));
  }
  return pts;
}

export function starD(
  cx: number,
  cy: number,
  n: number,
  rOuter: number,
  rInner: number,
  rot = -90,
): string {
  return polyD(starPoints(cx, cy, n, rOuter, rInner, rot));
}

/** Star with softly rounded tips and valleys (friendly, cartoon star). */
export function roundStarD(
  cx: number,
  cy: number,
  n: number,
  rOuter: number,
  rInner: number,
  rot = -90,
  roundness = 0.18,
): string {
  const pts = starPoints(cx, cy, n, rOuter, rInner, rot);
  const m = pts.length;
  let d = '';
  for (let i = 0; i < m; i++) {
    const prev = pts[(i - 1 + m) % m]!;
    const cur = pts[i]!;
    const next = pts[(i + 1) % m]!;
    const a = { x: cur.x + (prev.x - cur.x) * roundness, y: cur.y + (prev.y - cur.y) * roundness };
    const b = { x: cur.x + (next.x - cur.x) * roundness, y: cur.y + (next.y - cur.y) * roundness };
    d += (i === 0 ? Mp(a) : Lp(a)) + Qp(cur, b);
  }
  return d + Z;
}

/** Rounded rectangle path. */
export function roundRectD(x: number, y: number, w: number, hgt: number, r: number): string {
  const rr = Math.min(r, w / 2, hgt / 2);
  return (
    M(x + rr, y) +
    L(x + w - rr, y) +
    Q(x + w, y, x + w, y + rr) +
    L(x + w, y + hgt - rr) +
    Q(x + w, y + hgt, x + w - rr, y + hgt) +
    L(x + rr, y + hgt) +
    Q(x, y + hgt, x, y + hgt - rr) +
    L(x, y + rr) +
    Q(x, y, x + rr, y) +
    Z
  );
}

/** Heart centred at (cx, cy) with total width w. */
export function heartD(cx: number, cy: number, w: number): string {
  const s = w / 2;
  return (
    M(cx, cy + s * 0.9) +
    C(cx - s * 0.2, cy + s * 0.72, cx - s, cy + s * 0.2, cx - s, cy - s * 0.3) +
    C(cx - s, cy - s * 0.85, cx - s * 0.2, cy - s * 1.0, cx, cy - s * 0.45) +
    C(cx + s * 0.2, cy - s * 1.0, cx + s, cy - s * 0.85, cx + s, cy - s * 0.3) +
    C(cx + s, cy + s * 0.2, cx + s * 0.2, cy + s * 0.72, cx, cy + s * 0.9) +
    Z
  );
}

/** Egg outline centred at (cx, cy): narrower top, fuller bottom. */
export function eggD(cx: number, cy: number, w: number, hgt: number): string {
  const rx = w / 2;
  const top = cy - hgt / 2;
  const bot = cy + hgt / 2;
  const waist = cy + hgt * 0.1;
  return (
    M(cx, top) +
    C(cx + rx * 0.62, top, cx + rx, waist - hgt * 0.32, cx + rx, waist) +
    C(cx + rx, bot - hgt * 0.12, cx + rx * 0.56, bot, cx, bot) +
    C(cx - rx * 0.56, bot, cx - rx, bot - hgt * 0.12, cx - rx, waist) +
    C(cx - rx, waist - hgt * 0.32, cx - rx * 0.62, top, cx, top) +
    Z
  );
}

/** Scalloped ring of bumps around an ellipse (clouds, flower centres, frills). */
export function scallopD(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  bumps: number,
  depth: number,
  rot = -90,
): string {
  let d = '';
  for (let i = 0; i < bumps; i++) {
    const a0 = rot + (i * 360) / bumps;
    const am = rot + ((i + 0.5) * 360) / bumps;
    const a1 = rot + ((i + 1) * 360) / bumps;
    const p0 = ell(cx, cy, rx, ry, a0);
    const pm = ell(cx, cy, rx + depth, ry + depth, am);
    const p1 = ell(cx, cy, rx, ry, a1);
    const c = { x: 2 * pm.x - (p0.x + p1.x) / 2, y: 2 * pm.y - (p0.y + p1.y) / 2 };
    d += (i === 0 ? Mp(p0) : '') + Qp(c, p1);
  }
  return d + Z;
}

function ell(cx: number, cy: number, rx: number, ry: number, deg: number): Pt {
  const p = polar(0, 0, 1, deg);
  return { x: cx + p.x * rx, y: cy + p.y * ry };
}

export function ellipsePoint(cx: number, cy: number, rx: number, ry: number, deg: number): Pt {
  return ell(cx, cy, rx, ry, deg);
}

/** Translate + rotate + scale transform string (omits identity parts). */
export function tf(x: number, y: number, rot = 0, sx = 1, sy = sx): string {
  let s = `translate(${f(x)} ${f(y)})`;
  if (rot !== 0) s += ` rotate(${f(rot)})`;
  if (sx !== 1 || sy !== 1) s += sx === sy ? ` scale(${f(sx)})` : ` scale(${f(sx)} ${f(sy)})`;
  return s;
}
