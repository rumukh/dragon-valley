/**
 * Deterministic number helpers for SVG generation.
 *
 * Only IEEE-754 basic arithmetic, `Math.round`, `Math.floor`, `Math.abs`, `Math.min`, `Math.max`
 * and `Math.sqrt` (all exactly specified) are used, so output is byte-identical on every platform.
 * Trigonometry uses our own polynomial approximations instead of the platform `Math.sin` family.
 */

export const PI = 3.141592653589793;
const TWO_PI = 6.283185307179586;
const HALF_PI = 1.5707963267948966;

/** Formats a coordinate with at most two decimals, never `-0`, never exponent notation. */
export function f(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`Non-finite SVG number: ${n}`);
  const r = Math.round(n * 100) / 100;
  if (r === 0) return '0';
  return String(r);
}

/** Formats with at most one decimal (used for large background scenes to save bytes). */
export function f1(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`Non-finite SVG number: ${n}`);
  const r = Math.round(n * 10) / 10;
  if (r === 0) return '0';
  return String(r);
}

export function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** sin(x) for radians via range reduction and a Taylor polynomial (error < 1e-9). */
export function sinRad(x: number): number {
  let r = x - TWO_PI * Math.round(x / TWO_PI);
  if (r > HALF_PI) r = PI - r;
  else if (r < -HALF_PI) r = -PI - r;
  const x2 = r * r;
  return (
    r *
    (1 -
      (x2 / 6) *
        (1 -
          (x2 / 20) *
            (1 -
              (x2 / 42) * (1 - (x2 / 72) * (1 - (x2 / 110) * (1 - (x2 / 156) * (1 - x2 / 210)))))))
  );
}

export function cosRad(x: number): number {
  return sinRad(x + HALF_PI);
}

export function sinDeg(deg: number): number {
  return sinRad((deg * PI) / 180);
}

export function cosDeg(deg: number): number {
  return cosRad((deg * PI) / 180);
}

function atanSmall(z: number): number {
  // Two argument halvings bring |z| <= tan(pi/16) ~ 0.199, where the series converges fast.
  let k = 1;
  let t = z;
  for (let i = 0; i < 2; i++) {
    t = t / (1 + Math.sqrt(1 + t * t));
    k *= 2;
  }
  const t2 = t * t;
  let sum = 0;
  let term = t;
  for (let n = 0; n < 9; n++) {
    sum += term / (2 * n + 1);
    term *= -t2;
  }
  return k * sum;
}

/** atan2 in degrees, deterministic. */
export function atan2Deg(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  let a: number;
  if (Math.abs(x) >= Math.abs(y)) {
    a = atanSmall(y / x);
    if (x < 0) a += y >= 0 ? PI : -PI;
  } else {
    a = HALF_PI - atanSmall(x / y);
    if (y < 0) a -= PI;
  }
  return (a * 180) / PI;
}

export interface Pt {
  x: number;
  y: number;
}

export function pt(x: number, y: number): Pt {
  return { x, y };
}

/** Point on a circle; 0deg points right, 90deg points down (SVG orientation). */
export function polar(cx: number, cy: number, r: number, deg: number): Pt {
  return { x: cx + r * cosDeg(deg), y: cy + r * sinDeg(deg) };
}

export function dist(a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function mid(a: Pt, b: Pt, t = 0.5): Pt {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

/** Rotates p around c by deg. */
export function rotate(p: Pt, c: Pt, deg: number): Pt {
  const s = sinDeg(deg);
  const k = cosDeg(deg);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * k - dy * s, y: c.y + dx * s + dy * k };
}

/** Cubic Bezier point. */
export function bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** Unit tangent of a cubic Bezier at t. */
export function bezTangent(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const x = 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
  const y = 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
  const len = Math.sqrt(x * x + y * y) || 1;
  return { x: x / len, y: y / len };
}
