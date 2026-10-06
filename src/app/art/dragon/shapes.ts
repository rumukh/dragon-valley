import { bez, bezTangent, f, type Pt } from '../svg/num';
import { smoothClosedD } from '../svg/path';
import { h } from '../svg/xml';

/**
 * Outline of a stroke that tapers from width w0 to w1 along a cubic Bezier, with a round tip.
 * Returns a smooth closed path.
 */
export function taperD(
  p0: Pt,
  p1: Pt,
  p2: Pt,
  p3: Pt,
  w0: number,
  w1: number,
  samples = 9,
): string {
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = bez(p0, p1, p2, p3, t);
    const tg = bezTangent(p0, p1, p2, p3, t);
    const w = (w0 + (w1 - w0) * t) / 2;
    left.push({ x: p.x + tg.y * w, y: p.y - tg.x * w });
    right.push({ x: p.x - tg.y * w, y: p.y + tg.x * w });
  }
  const end = bez(p0, p1, p2, p3, 1);
  const tg = bezTangent(p0, p1, p2, p3, 1);
  const cap = { x: end.x + tg.x * w1 * 0.5, y: end.y + tg.y * w1 * 0.5 };
  const start = bez(p0, p1, p2, p3, 0);
  const tg0 = bezTangent(p0, p1, p2, p3, 0);
  const back = { x: start.x - tg0.x * w0 * 0.35, y: start.y - tg0.y * w0 * 0.35 };
  return smoothClosedD([back, ...left, cap, ...right.reverse()], 1);
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** Union of circles with a single outer outline (clouds, puffs, pom-poms). */
export function cloudUnion(
  circles: readonly Circle[],
  fill: string,
  line: string,
  w: number,
  cls?: string,
): string {
  const outline = circles
    .map((c) => h('circle', { cx: c.x, cy: c.y, r: c.r + w / 2, fill: line }))
    .join('');
  const body = circles.map((c) => h('circle', { cx: c.x, cy: c.y, r: c.r })).join('');
  return h('g', { class: cls }, h('g', null, outline), h('g', { fill }, body));
}

/** Thick rounded limb (capsule) with an outline. */
export function limb(
  points: readonly Pt[],
  thick: number,
  fill: string,
  line: string,
  w: number,
): string {
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x)} ${f(p.y)}`).join('');
  return (
    h('path', {
      d,
      fill: 'none',
      stroke: line,
      'stroke-width': thick + w * 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d,
      fill: 'none',
      stroke: fill,
      'stroke-width': thick,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    })
  );
}

/**
 * Wraps content in a pivot so CSS transforms (rotate/scale) on `cls` turn around (x, y).
 * `pose` is an optional static transform (e.g. a resting head tilt) that survives reduced motion.
 */
export function pivot(x: number, y: number, cls: string, inner: string, pose = ''): string {
  if (inner === '') return '';
  return h(
    'g',
    { transform: `translate(${f(x)} ${f(y)})${pose ? ' ' + pose : ''}` },
    h('g', { class: cls }, h('g', { transform: `translate(${f(-x)} ${f(-y)})` }, inner)),
  );
}

/** Mirror helper: content drawn for the right side, reflected around x = cx. */
export function mirrorX(cx: number, inner: string): string {
  return h('g', { transform: `translate(${f(2 * cx)} 0) scale(-1 1)` }, inner);
}
