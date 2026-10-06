import { M, L, Q, C, polyD, heartD, roundStarD, roundRectD } from '../svg/path';
import { h } from '../svg/xml';
import { rng } from '../svg/prng';
import { darken, lighten } from '../svg/color';
import { flower, sparkleD, pearl, star } from '../glyphs';
import { cloudUnion } from '../dragon/shapes';
import type { CosmeticAnchors, CosmeticDef } from './types';

export type { CosmeticAnchors, CosmeticDef } from './types';

/** Every cosmetic, keyed by asset id. Prices and unlocks live in content, not here. */
export const COSMETICS: readonly CosmeticDef[] = [
  { id: 'hat-party', slot: 'head', name: 'Party Hat' },
  { id: 'hat-wizard', slot: 'head', name: 'Wizard Hat' },
  { id: 'hat-top', slot: 'head', name: 'Top Hat' },
  { id: 'hat-beanie', slot: 'head', name: 'Cozy Beanie' },
  { id: 'hat-flower-crown', slot: 'head', name: 'Flower Crown' },
  { id: 'hat-pirate', slot: 'head', name: 'Captain Hat' },
  { id: 'hat-chef', slot: 'head', name: 'Chef Hat' },
  { id: 'hat-cap', slot: 'head', name: 'Sports Cap' },
  { id: 'hat-propeller', slot: 'head', name: 'Propeller Hat' },
  { id: 'hat-straw', slot: 'head', name: 'Straw Sun Hat' },
  { id: 'scarf-striped', slot: 'neck', name: 'Striped Scarf' },
  { id: 'scarf-cozy', slot: 'neck', name: 'Knitted Scarf' },
  { id: 'bow-tie', slot: 'neck', name: 'Bow Tie' },
  { id: 'ribbon-bow', slot: 'neck', name: 'Ribbon Bow' },
  { id: 'pearl-necklace', slot: 'neck', name: 'Pearl Necklace' },
  { id: 'gold-medal', slot: 'neck', name: 'Gold Medal' },
  { id: 'bandana', slot: 'neck', name: 'Bandana' },
  { id: 'bell-collar', slot: 'neck', name: 'Bell Collar' },
  { id: 'glasses-round', slot: 'eyes', name: 'Round Glasses' },
  { id: 'glasses-star', slot: 'eyes', name: 'Star Glasses' },
  { id: 'glasses-heart', slot: 'eyes', name: 'Heart Glasses' },
  { id: 'sunglasses', slot: 'eyes', name: 'Sunglasses' },
  { id: 'monocle', slot: 'eyes', name: 'Monocle' },
  { id: 'goggles', slot: 'eyes', name: 'Flying Goggles' },
  { id: 'mask-hero', slot: 'eyes', name: 'Hero Mask' },
  { id: 'glasses-square', slot: 'eyes', name: 'Square Glasses' },
  { id: 'paint-stripes', slot: 'wings', name: 'Striped Wings' },
  { id: 'paint-dots', slot: 'wings', name: 'Polka-Dot Wings' },
  { id: 'paint-stars', slot: 'wings', name: 'Starry Wings' },
  { id: 'paint-hearts', slot: 'wings', name: 'Heart Wings' },
  { id: 'paint-flames', slot: 'wings', name: 'Flame Wings' },
  { id: 'paint-galaxy', slot: 'wings', name: 'Galaxy Wings' },
  { id: 'paint-rainbow', slot: 'wings', name: 'Rainbow Wings' },
  { id: 'paint-checker', slot: 'wings', name: 'Checkered Wings' },
  { id: 'nest-pillow', slot: 'nest', name: 'Plump Pillow' },
  { id: 'nest-lantern', slot: 'nest', name: 'Glowing Lantern' },
  { id: 'nest-flowers', slot: 'nest', name: 'Flower Bed' },
  { id: 'nest-number-blocks', slot: 'nest', name: 'Number Blocks' },
  { id: 'nest-quilt', slot: 'nest', name: 'Patchwork Quilt' },
  { id: 'nest-mushrooms', slot: 'nest', name: 'Mushroom Patch' },
  { id: 'nest-treasure', slot: 'nest', name: 'Treasure Pile' },
  { id: 'nest-books', slot: 'nest', name: 'Book Stack' },
];

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export function cosmeticById(id: string): CosmeticDef | undefined {
  return BY_ID.get(id);
}

const INK = '#2a2140';
const SW = 4;

function place(x: number, y: number, k: number, rot: number, inner: string): string {
  return h(
    'g',
    {
      transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})${rot ? ` rotate(${rot})` : ''} scale(${k.toFixed(4)})`,
    },
    inner,
  );
}

function st(fill: string, line = INK, w = SW): Record<string, string | number> {
  return {
    fill,
    stroke: line,
    'stroke-width': w,
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round',
  };
}

// ---------------------------------------------------------------- hats (design: head width 200, top at 0,0)

function hatParty(): string {
  const d = M(-50, 16) + Q(0, 30, 50, 16) + L(10, -118) + Q(4, -122, -2, -118) + 'Z';
  const clip = 'hp';
  const stripes = [-90, -60, -30, 0].map((y) => M(-80, y + 20) + L(80, y - 6)).join('');
  return (
    h('defs', null, h('clipPath', { id: `${clip}` }, h('path', { d }))) +
    h('path', { d, ...st('#ff7eb6') }) +
    h('path', {
      d: stripes,
      stroke: '#ffe066',
      'stroke-width': 14,
      'clip-path': `url(#${clip})`,
      fill: 'none',
    }) +
    h('path', { d, fill: 'none', stroke: INK, 'stroke-width': SW, 'stroke-linejoin': 'round' }) +
    cloudUnion(
      [
        { x: 6, y: -124, r: 15 },
        { x: -6, y: -116, r: 10 },
        { x: 18, y: -116, r: 10 },
      ],
      '#7fd8ff',
      INK,
      SW,
    ) +
    h('path', {
      d: M(-46, 14) + Q(0, 28, 46, 14),
      stroke: '#fff3b0',
      'stroke-width': 6,
      fill: 'none',
      'stroke-linecap': 'round',
    })
  );
}

function hatWizard(): string {
  const cone =
    M(-58, 10) +
    C(-40, -40, -20, -100, 10, -150) +
    C(30, -160, 54, -150, 70, -132) +
    C(44, -132, 32, -120, 28, -100) +
    C(38, -60, 52, -20, 58, 10) +
    'Z';
  const stars =
    star(-14, -50, 12, '#ffe066', INK, 3) +
    star(22, -92, 9, '#ffe066', INK, 3) +
    h('path', { d: sparkleD(30, -30, 9), fill: '#ffffff' });
  return (
    h('ellipse', { cx: 0, cy: 14, rx: 92, ry: 18, ...st('#4b3fb5') }) +
    h('path', { d: cone, ...st('#5b4fd6') }) +
    h('path', {
      d: M(-56, 2) + Q(0, 16, 56, 2) + L(54, -12) + Q(0, 2, -54, -12) + 'Z',
      ...st('#ffd23f'),
    }) +
    stars +
    h('circle', { cx: 70, cy: -132, r: 8, ...st('#ffe066') })
  );
}

function hatTop(): string {
  return (
    h('ellipse', { cx: 0, cy: 14, rx: 78, ry: 15, ...st('#3b2f5c') }) +
    h('path', {
      d: M(-44, 12) + L(-48, -84) + Q(0, -96, 48, -84) + L(44, 12) + Q(0, 22, -44, 12) + 'Z',
      ...st('#463873'),
    }) +
    h('ellipse', { cx: 0, cy: -86, rx: 48, ry: 10, ...st('#5a4a8f') }) +
    h('path', {
      d: M(-45, -10) + Q(0, 0, 45, -10) + L(44, 6) + Q(0, 16, -44, 6) + 'Z',
      ...st('#e0335a'),
    }) +
    h('path', {
      d: M(-30, -70) + L(-32, -24),
      stroke: '#ffffff',
      'stroke-width': 6,
      opacity: 0.35,
      'stroke-linecap': 'round',
    }) +
    flower(28, -2, 11, 5, '#fff3f6', '#ffd23f', INK, 2.5)
  );
}

function hatBeanie(): string {
  const dome = M(-82, 18) + C(-84, -46, -40, -70, 0, -70) + C(40, -70, 84, -46, 82, 18) + 'Z';
  let ribs = '';
  for (let x = -70; x <= 70; x += 14) ribs += M(x, 8) + L(x, 34);
  return (
    h('path', { d: dome, ...st('#2fb4a6') }) +
    h('path', {
      d: M(-80, -20) + Q(0, -40, 80, -20),
      stroke: '#fff3d6',
      'stroke-width': 10,
      fill: 'none',
    }) +
    h('path', {
      d: M(-76, -44) + Q(0, -62, 76, -44),
      stroke: '#fff3d6',
      'stroke-width': 8,
      fill: 'none',
      opacity: 0.9,
    }) +
    h('path', { d: dome, fill: 'none', stroke: INK, 'stroke-width': SW }) +
    h('path', { d: roundRectD(-88, 4, 176, 34, 14), ...st('#259c90') }) +
    h('path', { d: ribs, stroke: '#1b7a70', 'stroke-width': 3, opacity: 0.7 }) +
    cloudUnion(
      [
        { x: 0, y: -80, r: 20 },
        { x: -14, y: -72, r: 13 },
        { x: 14, y: -72, r: 13 },
      ],
      '#fff3d6',
      INK,
      SW,
    )
  );
}

function hatFlowerCrown(): string {
  let out = '';
  const colors = ['#ff7eb6', '#ffd23f', '#ffffff', '#b98cff', '#ff9b6b', '#7fd8ff', '#ff7eb6'];
  const leaves = [-60, -20, 20, 60]
    .map((x) =>
      h('path', {
        d:
          M(x, 12 - Math.abs(x) * 0.12) +
          Q(x + 10, -6 - Math.abs(x) * 0.12, x + 24, 2 - Math.abs(x) * 0.12) +
          Q(x + 12, 14 - Math.abs(x) * 0.12, x, 12 - Math.abs(x) * 0.12) +
          'Z',
        ...st('#5cc46b', INK, 3),
      }),
    )
    .join('');
  out += h('path', {
    d: M(-84, 26) + Q(0, -16, 84, 26),
    stroke: '#3f9a4f',
    'stroke-width': 6,
    fill: 'none',
  });
  out += leaves;
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = -78 + t * 156;
    const y = 22 - (1 - (2 * t - 1) * (2 * t - 1)) * 26;
    out += flower(x, y, i % 2 ? 13 : 16, 5, colors[i]!, '#ffd23f', INK, 2.5);
  }
  return out;
}

function hatPirate(): string {
  const d =
    M(-96, 8) +
    C(-80, -60, -40, -64, 0, -50) +
    C(40, -64, 80, -60, 96, 8) +
    C(60, -14, -60, -14, -96, 8) +
    'Z';
  return (
    h('path', { d, ...st('#3b2f5c') }) +
    h('path', {
      d: M(-90, 2) + C(-56, -20, 56, -20, 90, 2),
      stroke: '#ffd23f',
      'stroke-width': 7,
      fill: 'none',
      'stroke-linecap': 'round',
    }) +
    star(0, -26, 17, '#ffd23f', INK, 3) +
    h('path', {
      d: M(-60, -36) + Q(-50, -48, -34, -50),
      stroke: '#ffffff',
      'stroke-width': 5,
      opacity: 0.3,
      fill: 'none',
      'stroke-linecap': 'round',
    })
  );
}

function hatChef(): string {
  return (
    h('path', { d: roundRectD(-56, -34, 112, 50, 8), ...st('#ffffff') }) +
    cloudUnion(
      [
        { x: -40, y: -56, r: 30 },
        { x: 0, y: -74, r: 36 },
        { x: 40, y: -56, r: 30 },
        { x: -18, y: -44, r: 26 },
        { x: 20, y: -44, r: 26 },
      ],
      '#ffffff',
      INK,
      SW,
    ) +
    h('path', { d: roundRectD(-56, -16, 112, 32, 8), ...st('#f4f0ff') }) +
    h('path', {
      d: M(-20, -14) + L(-20, 14) + M(20, -14) + L(20, 14),
      stroke: '#d8d0ef',
      'stroke-width': 3,
    })
  );
}

function hatCap(): string {
  const dome =
    M(-78, 12) +
    C(-80, -50, -36, -66, 0, -66) +
    C(36, -66, 80, -50, 78, 12) +
    Q(0, 0, -78, 12) +
    'Z';
  return (
    h('path', { d: dome, ...st('#e8423f') }) +
    h('path', {
      d:
        M(0, -66) +
        Q(-6, -30, 0, 6) +
        M(-40, -56) +
        Q(-34, -24, -30, 8) +
        M(40, -56) +
        Q(34, -24, 30, 8),
      stroke: '#b5262d',
      'stroke-width': 3,
      fill: 'none',
    }) +
    h('circle', { cx: 0, cy: -68, r: 7, ...st('#ffffff', INK, 3) }) +
    star(-2, -30, 15, '#ffffff', INK, 3) +
    h('path', {
      d: M(-70, 8) + C(-60, 40, 60, 40, 70, 8) + Q(0, 22, -70, 8) + 'Z',
      ...st('#c92f33'),
    })
  );
}

function hatPropeller(): string {
  const dome =
    M(-80, 16) +
    C(-82, -46, -40, -66, 0, -66) +
    C(40, -66, 82, -46, 80, 16) +
    Q(0, 4, -80, 16) +
    'Z';
  const segs = ['#ff5a5f', '#ffd93d', '#4aa8ff', '#5ccc6b'];
  const clip = 'pp';
  let fill = '';
  segs.forEach((c, i) => {
    fill += h('path', { d: M(0, -70) + L(-100 + i * 50, 20) + L(-50 + i * 50, 20) + 'Z', fill: c });
  });
  return (
    h('defs', null, h('clipPath', { id: clip }, h('path', { d: dome }))) +
    h('g', { 'clip-path': `url(#${clip})` }, fill) +
    h('path', { d: dome, fill: 'none', stroke: INK, 'stroke-width': SW }) +
    h('path', {
      d: M(-2, -66) + L(-2, -86) + M(2, -66) + L(2, -86),
      stroke: INK,
      'stroke-width': 4,
    }) +
    h(
      'g',
      { transform: 'translate(0 -88)' },
      h(
        'g',
        { class: 'dv-propeller' },
        h('path', {
          d: M(0, 0) + C(-14, -12, -50, -10, -56, 0) + C(-50, 10, -14, 12, 0, 0) + 'Z',
          ...st('#ffd93d', INK, 3),
        }),
        h('path', {
          d: M(0, 0) + C(14, -12, 50, -10, 56, 0) + C(50, 10, 14, 12, 0, 0) + 'Z',
          ...st('#ff5a5f', INK, 3),
        }),
      ),
    ) +
    h('circle', { cx: 0, cy: -88, r: 6, ...st('#4aa8ff', INK, 3) })
  );
}

function hatStraw(): string {
  let weave = '';
  for (let x = -100; x <= 100; x += 16) weave += M(x, 10) + L(x * 1.08, 24);
  return (
    h('ellipse', { cx: 0, cy: 14, rx: 116, ry: 24, ...st('#f2c96b') }) +
    h('path', { d: weave, stroke: '#c9973e', 'stroke-width': 2.5, opacity: 0.7 }) +
    h('path', {
      d:
        M(-54, 12) +
        C(-56, -40, -30, -54, 0, -54) +
        C(30, -54, 56, -40, 54, 12) +
        Q(0, 22, -54, 12) +
        'Z',
      ...st('#f5d27e'),
    }) +
    h('path', {
      d: M(-55, -6) + Q(0, 6, 55, -6) + L(54, 8) + Q(0, 20, -54, 8) + 'Z',
      ...st('#ff6f8f'),
    }) +
    flower(38, 0, 13, 5, '#ffffff', '#ffd23f', INK, 2.5) +
    h('path', {
      d: M(-30, -40) + Q(-20, -48, -6, -50),
      stroke: '#ffffff',
      'stroke-width': 5,
      opacity: 0.45,
      fill: 'none',
      'stroke-linecap': 'round',
    })
  );
}

const HATS: Record<string, { draw: () => string; lift: number; tilt: number }> = {
  'hat-party': { draw: hatParty, lift: 6, tilt: 10 },
  'hat-wizard': { draw: hatWizard, lift: 8, tilt: -6 },
  'hat-top': { draw: hatTop, lift: 8, tilt: 6 },
  'hat-beanie': { draw: hatBeanie, lift: 24, tilt: 0 },
  'hat-flower-crown': { draw: hatFlowerCrown, lift: 10, tilt: 0 },
  'hat-pirate': { draw: hatPirate, lift: 10, tilt: -4 },
  'hat-chef': { draw: hatChef, lift: 8, tilt: 4 },
  'hat-cap': { draw: hatCap, lift: 22, tilt: 0 },
  'hat-propeller': { draw: hatPropeller, lift: 20, tilt: 0 },
  'hat-straw': { draw: hatStraw, lift: 14, tilt: -5 },
};

function scopeIds(markup: string, prefix: string): string {
  // Local clip ids inside cosmetics are scoped per dragon instance.
  return markup
    .replace(/id="(hp|pp)"/g, `id="${prefix}-$1"`)
    .replace(/url\(#(hp|pp)\)/g, `url(#${prefix}-$1)`);
}

export function renderHat(id: string, a: CosmeticAnchors, prefix: string): string {
  const hat = HATS[id];
  if (!hat) return '';
  const k = a.head.w / 200;
  return h(
    'g',
    { class: `dv-cosmetic dv-hat dv-${id}` },
    scopeIds(place(a.head.x, a.head.y + hat.lift * k, k, hat.tilt, hat.draw()), prefix),
  );
}

// ---------------------------------------------------------------- eyes

export function renderEyewear(id: string, a: CosmeticAnchors, prefix: string): string {
  const { x, y, dx, r } = a.eyes;
  const lr = r * 1.3;
  const w = Math.max(3, r * 0.17);
  const bridge = (color: string, yy = y - r * 0.2): string =>
    h('path', {
      d: M(x - dx + lr * 0.92, yy) + Q(x, yy - r * 0.5, x + dx - lr * 0.92, yy),
      fill: 'none',
      stroke: color,
      'stroke-width': w * 1.1,
      'stroke-linecap': 'round',
    });
  const temples = (color: string, yy = y - r * 0.1): string =>
    h('path', {
      d:
        M(x - dx - lr, yy) +
        L(x - dx - lr - r * 0.7, yy - r * 0.25) +
        M(x + dx + lr, yy) +
        L(x + dx + lr + r * 0.7, yy - r * 0.25),
      stroke: color,
      'stroke-width': w,
      'stroke-linecap': 'round',
    });
  const glint = (cx: number, cy: number, rr: number): string =>
    h('path', {
      d: M(cx - rr * 0.45, cy - rr * 0.35) + L(cx - rr * 0.15, cy - rr * 0.62),
      stroke: '#ffffff',
      'stroke-width': w * 0.9,
      'stroke-linecap': 'round',
      opacity: 0.85,
    });
  let out = '';
  switch (id) {
    case 'glasses-round':
      out =
        temples('#8a5a00') +
        bridge('#8a5a00') +
        [-1, 1]
          .map(
            (s) =>
              h('circle', {
                cx: x + s * dx,
                cy: y,
                r: lr,
                fill: '#e8f6ff',
                'fill-opacity': 0.25,
                stroke: '#b8862b',
                'stroke-width': w * 1.3,
              }) + glint(x + s * dx, y, lr),
          )
          .join('');
      break;
    case 'glasses-square':
      out =
        temples('#2c5fb8') +
        bridge('#2c5fb8') +
        [-1, 1]
          .map(
            (s) =>
              h('path', {
                d: roundRectD(x + s * dx - lr, y - lr * 0.85, lr * 2, lr * 1.7, lr * 0.35),
                fill: '#e8f6ff',
                'fill-opacity': 0.25,
                stroke: '#2c5fb8',
                'stroke-width': w * 1.6,
              }) + glint(x + s * dx, y, lr),
          )
          .join('');
      break;
    case 'glasses-star':
      out =
        temples('#ff5aa8') +
        bridge('#ff5aa8') +
        [-1, 1]
          .map(
            (s) =>
              h('path', {
                d: roundStarD(x + s * dx, y, 5, lr * 1.3, lr * 0.75, -90, 0.18),
                fill: '#ffe066',
                'fill-opacity': 0.35,
                stroke: '#ff5aa8',
                'stroke-width': w * 1.5,
                'stroke-linejoin': 'round',
              }) + glint(x + s * dx, y, lr),
          )
          .join('');
      break;
    case 'glasses-heart':
      out =
        temples('#e8423f') +
        bridge('#e8423f') +
        [-1, 1]
          .map(
            (s) =>
              h('path', {
                d: heartD(x + s * dx, y + lr * 0.05, lr * 2.3),
                fill: '#ff9fbf',
                'fill-opacity': 0.4,
                stroke: '#e8423f',
                'stroke-width': w * 1.5,
                'stroke-linejoin': 'round',
              }) + glint(x + s * dx, y, lr),
          )
          .join('');
      break;
    case 'sunglasses': {
      const lens = (s: number): string =>
        M(x + s * dx - lr * 1.05, y - lr * 0.7) +
        L(x + s * dx + lr * 1.05, y - lr * 0.7) +
        Q(x + s * dx + lr * 1.1, y + lr * 0.95, x + s * dx, y + lr * 0.9) +
        Q(x + s * dx - lr * 1.1, y + lr * 0.95, x + s * dx - lr * 1.05, y - lr * 0.7) +
        'Z';
      out =
        temples(INK, y - lr * 0.6) +
        h('path', {
          d: M(x - dx - lr * 1.1, y - lr * 0.72) + L(x + dx + lr * 1.1, y - lr * 0.72),
          stroke: INK,
          'stroke-width': w * 1.6,
          'stroke-linecap': 'round',
        }) +
        [-1, 1]
          .map(
            (s) =>
              h('path', {
                d: lens(s),
                fill: '#2b2550',
                stroke: INK,
                'stroke-width': w * 1.2,
                'stroke-linejoin': 'round',
              }) +
              h('path', {
                d: M(x + s * dx - lr * 0.6, y - lr * 0.3) + L(x + s * dx - lr * 0.1, y - lr * 0.55),
                stroke: '#ffffff',
                'stroke-width': w * 1.4,
                'stroke-linecap': 'round',
                opacity: 0.75,
              }),
          )
          .join('');
      break;
    }
    case 'monocle': {
      const cx = x + dx;
      out =
        h('path', {
          d:
            M(cx + lr * 0.3, y + lr * 0.95) +
            Q(cx + lr * 0.9, y + r * 3.4, cx - lr * 0.2, y + r * 4.2),
          fill: 'none',
          stroke: '#d9a520',
          'stroke-width': w * 0.9,
          'stroke-dasharray': `${(w * 1.2).toFixed(2)} ${(w * 0.6).toFixed(2)}`,
          'stroke-linecap': 'round',
        }) +
        h('circle', {
          cx,
          cy: y,
          r: lr,
          fill: '#e8f6ff',
          'fill-opacity': 0.3,
          stroke: '#d9a520',
          'stroke-width': w * 1.6,
        }) +
        glint(cx, y, lr);
      break;
    }
    case 'goggles': {
      const strapY = y - r * 0.1;
      out =
        h('path', {
          d: M(x - dx - lr * 2.1, strapY + r * 0.2) + L(x + dx + lr * 2.1, strapY + r * 0.2),
          stroke: '#7a4a24',
          'stroke-width': r * 0.75,
          'stroke-linecap': 'round',
        }) +
        [-1, 1]
          .map(
            (s) =>
              h('circle', {
                cx: x + s * dx,
                cy: y,
                r: lr * 1.12,
                fill: '#a86a3a',
                stroke: INK,
                'stroke-width': w,
              }) +
              h('circle', {
                cx: x + s * dx,
                cy: y,
                r: lr * 0.86,
                fill: '#9fe0ff',
                'fill-opacity': 0.45,
                stroke: '#5a3418',
                'stroke-width': w * 0.8,
              }) +
              glint(x + s * dx, y, lr * 0.9),
          )
          .join('') +
        h('rect', {
          x: x - dx * 0.35,
          y: y - r * 0.2,
          width: dx * 0.7,
          height: r * 0.4,
          rx: r * 0.15,
          fill: '#a86a3a',
          stroke: INK,
          'stroke-width': w * 0.8,
        });
      break;
    }
    case 'mask-hero': {
      const band =
        M(x - dx - lr * 1.5, y - lr * 0.2) +
        Q(x - dx, y - lr * 1.25, x, y - lr * 0.75) +
        Q(x + dx, y - lr * 1.25, x + dx + lr * 1.5, y - lr * 0.2) +
        Q(x + dx + lr * 1.2, y + lr * 1.05, x + dx * 0.4, y + lr * 0.85) +
        Q(x, y + lr * 0.55, x - dx * 0.4, y + lr * 0.85) +
        Q(x - dx - lr * 1.2, y + lr * 1.05, x - dx - lr * 1.5, y - lr * 0.2) +
        'Z';
      const holes = [-1, 1]
        .map(
          (s) =>
            M(x + s * dx - r * 1.05, y) +
            Q(x + s * dx, y - r * 1.25, x + s * dx + r * 1.05, y) +
            Q(x + s * dx, y + r * 1.15, x + s * dx - r * 1.05, y) +
            'Z',
        )
        .join('');
      out =
        h('path', {
          d: band + holes,
          'fill-rule': 'evenodd',
          fill: '#7b4fd6',
          stroke: INK,
          'stroke-width': w,
          'stroke-linejoin': 'round',
        }) +
        h('path', {
          d:
            M(x - dx - lr * 1.5, y - lr * 0.2) +
            Q(x - dx - lr * 2.3, y + lr * 0.4, x - dx - lr * 2.0, y + lr * 1.2) +
            M(x - dx - lr * 1.5, y - lr * 0.2) +
            Q(x - dx - lr * 2.6, y - lr * 0.1, x - dx - lr * 2.7, y + lr * 0.6),
          stroke: '#7b4fd6',
          'stroke-width': w * 1.6,
          'stroke-linecap': 'round',
          fill: 'none',
        });
      break;
    }
    default:
      return '';
  }
  return h(
    'g',
    { class: `dv-cosmetic dv-eyewear dv-${id}`, 'data-prefix': prefix ? undefined : undefined },
    out,
  );
}

// ---------------------------------------------------------------- neck (design: collar width 160, centre 0,0)

function scarfStriped(): string {
  const band = M(-82, -8) + Q(0, 18, 82, -8) + L(84, 14) + Q(0, 44, -84, 14) + 'Z';
  const tail = M(28, 18) + L(44, 92) + L(76, 86) + L(62, 14) + 'Z';
  const stripes = [36, 52, 68]
    .map((y) => M(30 + (y - 18) * 0.2, y) + L(70 + (y - 18) * 0.2, y - 4))
    .join('');
  const fringe = [48, 56, 64, 72].map((x) => M(x - 4, 90) + L(x - 6, 102)).join('');
  return (
    h('path', { d: tail, ...st('#ff5a5f') }) +
    h('path', { d: stripes, stroke: '#ffffff', 'stroke-width': 7, fill: 'none' }) +
    h('path', { d: fringe, stroke: '#ff5a5f', 'stroke-width': 4 }) +
    h('path', { d: band, ...st('#ff5a5f') }) +
    h('path', {
      d:
        M(-60, 6) +
        Q(-52, 28, -40, 30) +
        M(-20, 12) +
        Q(-14, 34, -4, 36) +
        M(20, 12) +
        Q(26, 34, 36, 34) +
        M(56, 4) +
        Q(62, 26, 70, 26),
      stroke: '#ffffff',
      'stroke-width': 7,
      fill: 'none',
    }) +
    h('path', {
      d: band,
      fill: 'none',
      stroke: INK,
      'stroke-width': SW,
      'stroke-linejoin': 'round',
    })
  );
}

function scarfCozy(): string {
  const band = M(-86, -10) + Q(0, 22, 86, -10) + L(88, 18) + Q(0, 52, -88, 18) + 'Z';
  const end1 = M(-40, 20) + L(-50, 104) + L(-20, 106) + L(-12, 26) + 'Z';
  const end2 = M(-14, 26) + L(-6, 96) + L(20, 92) + L(14, 24) + 'Z';
  let knit = '';
  for (let x = -76; x <= 76; x += 13)
    knit += M(x, -2 + Math.abs(x) * -0.05) + Q(x + 4, 10, x, 22 + Math.abs(x) * -0.05);
  return (
    h('path', { d: end2, ...st('#f2b631') }) +
    h('path', { d: end1, ...st('#ffc93d') }) +
    h('path', {
      d:
        M(-46, 50) +
        L(-16, 52) +
        M(-48, 72) +
        L(-18, 74) +
        M(-8, 50) +
        L(16, 48) +
        M(-6, 70) +
        L(18, 68),
      stroke: '#2fb4a6',
      'stroke-width': 7,
      fill: 'none',
    }) +
    h('path', { d: band, ...st('#ffc93d') }) +
    h('path', { d: knit, stroke: '#d99a16', 'stroke-width': 3, fill: 'none', opacity: 0.7 })
  );
}

function bowTie(): string {
  return (
    h('path', { d: M(0, 8) + L(-46, -16) + Q(-56, 8, -46, 34) + Z1(), ...st('#7b4fd6') }) +
    h('path', { d: M(0, 8) + L(46, -16) + Q(56, 8, 46, 34) + Z1(), ...st('#7b4fd6') }) +
    [-30, -18, 22, 34]
      .map((x, i) => h('circle', { cx: x, cy: 4 + (i % 2) * 10, r: 4, fill: '#ffe066' }))
      .join('') +
    h('path', { d: roundRectD(-12, -6, 24, 28, 7), ...st('#9b74ec') })
  );
}

function Z1(): string {
  return 'Z';
}

function ribbonBow(): string {
  return (
    h('path', {
      d: M(-6, 14) + L(-26, 70) + L(-14, 64) + L(-8, 76) + L(4, 16) + 'Z',
      ...st('#ff7eb6'),
    }) +
    h('path', {
      d: M(6, 14) + L(26, 70) + L(14, 64) + L(8, 76) + L(-4, 16) + 'Z',
      ...st('#ff7eb6'),
    }) +
    h('path', {
      d: M(0, 8) + C(-30, -40, -70, -10, -54, 22) + C(-44, 40, -16, 26, 0, 8) + 'Z',
      ...st('#ff8fc4'),
    }) +
    h('path', {
      d: M(0, 8) + C(30, -40, 70, -10, 54, 22) + C(44, 40, 16, 26, 0, 8) + 'Z',
      ...st('#ff8fc4'),
    }) +
    h('path', {
      d: M(-40, 0) + Q(-30, -8, -18, 0) + M(40, 0) + Q(30, -8, 18, 0),
      stroke: '#ffffff',
      'stroke-width': 4,
      opacity: 0.6,
      fill: 'none',
    }) +
    h('circle', { cx: 0, cy: 10, r: 12, ...st('#ff5aa8') })
  );
}

function pearlNecklace(): string {
  let out = '';
  const n = 11;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = -74 + t * 148;
    const y = 2 + (1 - (2 * t - 1) * (2 * t - 1)) * 34;
    out += pearl(x, y, i === 5 ? 11 : 8, '#8d86a6', 2.5);
  }
  return out;
}

function goldMedal(): string {
  return (
    h('path', { d: M(-46, -6) + L(-14, 50) + L(2, 44) + L(-22, -8) + 'Z', ...st('#e0335a') }) +
    h('path', { d: M(46, -6) + L(14, 50) + L(-2, 44) + L(22, -8) + 'Z', ...st('#3d7be0') }) +
    h('circle', { cx: 0, cy: 66, r: 26, ...st('#ffd23f', '#8a5a00') }) +
    h('circle', { cx: 0, cy: 66, r: 19, fill: 'none', stroke: '#e0a020', 'stroke-width': 3 }) +
    star(0, 66, 12, '#fff3b0', '#8a5a00', 2.5) +
    h('path', {
      d: M(-14, 50) + Q(-8, 44, 0, 44),
      stroke: '#ffffff',
      'stroke-width': 4,
      opacity: 0.7,
      fill: 'none',
      'stroke-linecap': 'round',
    })
  );
}

function bandana(): string {
  const d = M(-80, -6) + Q(0, 18, 80, -6) + L(0, 78) + 'Z';
  const dots = [
    [-40, 12],
    [0, 20],
    [40, 12],
    [-18, 40],
    [20, 40],
    [0, 60],
  ]
    .map(([x, y]) => h('circle', { cx: x!, cy: y!, r: 4.5, fill: '#ffffff' }))
    .join('');
  return (
    h('path', { d, ...st('#3d7be0') }) +
    dots +
    h('path', {
      d: M(-80, -6) + Q(-92, -2, -96, 8) + M(80, -6) + Q(92, -2, 96, 8),
      stroke: '#3d7be0',
      'stroke-width': 9,
      'stroke-linecap': 'round',
      fill: 'none',
    })
  );
}

function bellCollar(): string {
  const band = M(-80, -8) + Q(0, 18, 80, -8) + L(80, 6) + Q(0, 32, -80, 6) + 'Z';
  return (
    h('path', { d: band, ...st('#e8423f') }) +
    [-56, -28, 28, 56]
      .map((x) =>
        h('circle', { cx: x, cy: 5 + (1 - (x / 80) * (x / 80)) * 9, r: 3, fill: '#ffd23f' }),
      )
      .join('') +
    h('path', {
      d: M(-18, 24) + Q(-20, 4, 0, 2) + Q(20, 4, 18, 24) + L(22, 34) + L(-22, 34) + 'Z',
      ...st('#ffd23f', '#8a5a00'),
    }) +
    h('circle', { cx: 0, cy: 36, r: 5, fill: '#8a5a00' }) +
    h('path', {
      d: M(-8, 12) + Q(-6, 6, 0, 6),
      stroke: '#ffffff',
      'stroke-width': 3.5,
      fill: 'none',
      'stroke-linecap': 'round',
      opacity: 0.8,
    })
  );
}

const NECK: Record<string, () => string> = {
  'scarf-striped': scarfStriped,
  'scarf-cozy': scarfCozy,
  'bow-tie': bowTie,
  'ribbon-bow': ribbonBow,
  'pearl-necklace': pearlNecklace,
  'gold-medal': goldMedal,
  bandana,
  'bell-collar': bellCollar,
};

export function renderNeckwear(id: string, a: CosmeticAnchors): string {
  const draw = NECK[id];
  if (!draw) return '';
  const k = a.neck.w / 160;
  return h(
    'g',
    { class: `dv-cosmetic dv-neckwear dv-${id}` },
    place(a.neck.x, a.neck.y, k, 0, draw()),
  );
}

// ---------------------------------------------------------------- wing paints (local wing space, S x H)

export function renderWingPaint(
  id: string,
  membrane: string,
  S: number,
  H: number,
  clipId: string,
): string {
  const r = rng(id);
  const big = Math.max(S, H);
  const unit = Math.max(9, big * 0.11);
  let art = '';
  switch (id) {
    case 'paint-stripes': {
      let d = '';
      for (let i = -6; i < 14; i++) d += M(i * unit * 1.6, 20) + L(i * unit * 1.6 + big, -big - 20);
      art = h('path', {
        d,
        stroke: '#ffffff',
        'stroke-width': unit * 0.65,
        opacity: 0.55,
        fill: 'none',
      });
      break;
    }
    case 'paint-dots': {
      for (let y = -big; y < big * 0.2; y += unit * 1.5) {
        for (let x = -unit; x < big * 1.1; x += unit * 1.5) {
          const off = Math.round((y / (unit * 1.5)) % 2) ? unit * 0.75 : 0;
          art += h('circle', {
            cx: x + off,
            cy: y,
            r: unit * 0.38,
            fill: '#ffffff',
            opacity: 0.75,
          });
        }
      }
      break;
    }
    case 'paint-stars':
      for (let i = 0; i < 9; i++) {
        art += h('path', {
          d: roundStarD(
            r() * S,
            -r() * H,
            5,
            unit * (0.45 + r() * 0.3),
            unit * 0.22,
            -90 + r() * 40,
            0.2,
          ),
          fill: '#ffe066',
          stroke: '#c47f0a',
          'stroke-width': 1.5,
        });
      }
      break;
    case 'paint-hearts':
      for (let i = 0; i < 8; i++) {
        art += h('path', {
          d: heartD(r() * S, -r() * H, unit * (0.9 + r() * 0.5)),
          fill: i % 2 ? '#ff7eb6' : '#ff5a8a',
          stroke: '#b0306f',
          'stroke-width': 1.5,
        });
      }
      break;
    case 'paint-flames': {
      let d = '';
      for (let i = 0; i < 6; i++) {
        const x = (i / 5) * S;
        const y = -0.1 * H + (i / 5) * -0.35 * H;
        d +=
          M(x - unit * 0.9, y + unit) +
          Q(x - unit * 0.5, y - unit * 1.2, x, y - unit * 2.2) +
          Q(x + unit * 0.2, y - unit, x + unit * 0.9, y + unit) +
          'Z';
      }
      art =
        h('path', { d, fill: '#ff8a2a', opacity: 0.85 }) +
        h('path', { d, fill: '#ffd447', opacity: 0.6, transform: 'translate(0 6) scale(1 0.9)' });
      break;
    }
    case 'paint-galaxy': {
      art =
        h('path', { d: membrane, fill: '#2a2878', opacity: 0.8 }) +
        h('ellipse', {
          cx: S * 0.5,
          cy: -H * 0.55,
          rx: S * 0.4,
          ry: H * 0.22,
          fill: '#b98cff',
          opacity: 0.45,
          transform: `rotate(-30 ${(S * 0.5).toFixed(2)} ${(-H * 0.55).toFixed(2)})`,
        });
      for (let i = 0; i < 22; i++)
        art += h('circle', {
          cx: r() * S * 1.05,
          cy: -r() * H * 1.05,
          r: 0.8 + r() * 2.2,
          fill: '#ffffff',
          opacity: 0.9,
        });
      art += h('path', {
        d: sparkleD(S * 0.62, -H * 0.62, unit * 0.7) + sparkleD(S * 0.3, -H * 0.3, unit * 0.5),
        fill: '#ffffff',
      });
      break;
    }
    case 'paint-rainbow': {
      const cols = ['#ff5a5f', '#ff9f40', '#ffd93d', '#5ccc6b', '#4aa8ff', '#5b6cf0', '#a66cf0'];
      cols.forEach((c, i) => {
        const rr = big * (1.05 - i * 0.12);
        art += h('circle', {
          cx: 0,
          cy: 0,
          r: rr,
          fill: 'none',
          stroke: c,
          'stroke-width': big * 0.12 + 0.5,
          opacity: 0.8,
        });
      });
      break;
    }
    case 'paint-checker': {
      const s = unit * 1.3;
      for (let y = -big - s; y < s; y += s) {
        for (let x = -s; x < big + s; x += s) {
          if ((Math.round(x / s) + Math.round(y / s)) % 2 === 0)
            art += h('rect', { x, y, width: s, height: s, fill: '#ffffff', opacity: 0.55 });
        }
      }
      break;
    }
    default:
      return '';
  }
  return h(
    'g',
    { class: `dv-cosmetic dv-wingpaint dv-${id}` },
    h('defs', null, h('clipPath', { id: clipId }, h('path', { d: membrane }))),
    h('g', { 'clip-path': `url(#${clipId})` }, art),
  );
}

// ---------------------------------------------------------------- nest (ground centre 0,0; footprint width 240)

function nestPillow(): { back: string; front: string } {
  const d =
    M(-150, 4) +
    C(-160, -40, -120, -46, 0, -42) +
    C(120, -46, 160, -40, 150, 4) +
    C(156, 34, 120, 40, 0, 38) +
    C(-120, 40, -156, 34, -150, 4) +
    'Z';
  const tassel = (x: number, y: number): string =>
    h('path', {
      d: M(x, y) + L(x - 8, y + 18) + L(x + 8, y + 18) + 'Z',
      ...st('#ffd23f', '#8a5a00', 2.5),
    });
  return {
    back:
      h('path', { d, ...st('#9b74ec') }) +
      h('path', {
        d: M(-120, -14) + Q(0, -2, 120, -14),
        stroke: '#b99cf5',
        'stroke-width': 8,
        fill: 'none',
        'stroke-linecap': 'round',
      }) +
      h('path', {
        d: M(-140, 12) + Q(0, 30, 140, 12),
        stroke: '#ffd23f',
        'stroke-width': 4,
        fill: 'none',
        'stroke-dasharray': '10 8',
      }) +
      tassel(-150, 4) +
      tassel(150, 4),
    front: '',
  };
}

function nestLantern(): { back: string; front: string } {
  const x = -170;
  const glow = h(
    'g',
    { transform: `translate(${x} -60)` },
    h(
      'g',
      { class: 'dv-lantern-glow' },
      h('circle', { cx: 0, cy: 0, r: 56, fill: '#ffd36b', opacity: 0.35 }),
    ),
  );
  return {
    back: '',
    front:
      glow +
      h('path', {
        d: M(x - 24, -18) + L(x - 30, -96) + L(x + 30, -96) + L(x + 24, -18) + 'Z',
        ...st('#3b2f5c'),
      }) +
      h('path', {
        d: M(x - 18, -26) + L(x - 22, -88) + L(x + 22, -88) + L(x + 18, -26) + 'Z',
        fill: '#ffe08a',
      }) +
      h('path', {
        d: M(x, -40) + Q(x - 9, -54, x, -70) + Q(x + 9, -54, x, -40) + 'Z',
        fill: '#ff9a2e',
      }) +
      h('path', { d: M(x - 34, -96) + L(x, -120) + L(x + 34, -96) + 'Z', ...st('#5a4a8f') }) +
      h('circle', { cx: x, cy: -126, r: 7, fill: 'none', stroke: INK, 'stroke-width': 4 }) +
      h('path', { d: roundRectD(x - 30, -20, 60, 14, 5), ...st('#5a4a8f') }),
  };
}

function nestFlowers(): { back: string; front: string } {
  const r = rng('nest-flowers');
  const cols = ['#ff7eb6', '#ffd23f', '#ffffff', '#b98cff', '#ff9b6b'];
  let out = '';
  const xs = [-170, -136, -104, 104, 136, 170, -60, 60];
  xs.forEach((x, i) => {
    const hgt = 30 + r() * 26;
    out += h('path', {
      d: M(x, 6) + Q(x + 4, -hgt / 2, x, -hgt),
      stroke: '#3f9a4f',
      'stroke-width': 4,
      fill: 'none',
    });
    out += h('path', {
      d:
        M(x, -hgt * 0.4) +
        Q(x + 14, -hgt * 0.6, x + 18, -hgt * 0.3) +
        Q(x + 8, -hgt * 0.25, x, -hgt * 0.4) +
        'Z',
      ...st('#5cc46b', INK, 2),
    });
    out += flower(x, -hgt, i > 5 ? 10 : 13, 5, cols[i % cols.length]!, '#ffd23f', INK, 2.2);
  });
  return {
    back: '',
    front:
      h('path', {
        d: M(-200, 8) + Q(0, 22, 200, 8),
        stroke: '#5cc46b',
        'stroke-width': 10,
        'stroke-linecap': 'round',
        fill: 'none',
        opacity: 0.7,
      }) + out,
  };
}

/** Digit glyphs drawn as strokes (no fonts). */
function digitD(n: number, x: number, y: number, s: number): string {
  switch (n) {
    case 1:
      return (
        M(x - s * 0.15, y - s * 0.35) + L(x + s * 0.05, y - s * 0.5) + L(x + s * 0.05, y + s * 0.5)
      );
    case 2:
      return (
        M(x - s * 0.3, y - s * 0.25) +
        Q(x - s * 0.2, y - s * 0.55, x + s * 0.05, y - s * 0.5) +
        Q(x + s * 0.4, y - s * 0.4, x + s * 0.2, y - s * 0.05) +
        L(x - s * 0.32, y + s * 0.5) +
        L(x + s * 0.34, y + s * 0.5)
      );
    case 3:
      return (
        M(x - s * 0.3, y - s * 0.4) +
        Q(x, y - s * 0.62, x + s * 0.24, y - s * 0.36) +
        Q(x + s * 0.3, y - s * 0.08, x - s * 0.06, y - s * 0.02) +
        Q(x + s * 0.36, y + s * 0.04, x + s * 0.26, y + s * 0.34) +
        Q(x, y + s * 0.62, x - s * 0.32, y + s * 0.4)
      );
    default:
      return '';
  }
}

function nestNumberBlocks(): { back: string; front: string } {
  const block = (x: number, y: number, s: number, c: string, n: number): string =>
    h('path', {
      d:
        M(x, y) + L(x + s * 0.25, y - s * 0.22) + L(x + s * 1.25, y - s * 0.22) + L(x + s, y) + 'Z',
      ...st(lighten(c, 0.35)),
    }) +
    h('path', {
      d:
        M(x + s, y) +
        L(x + s * 1.25, y - s * 0.22) +
        L(x + s * 1.25, y + s * 0.78) +
        L(x + s, y + s) +
        'Z',
      ...st(darken(c, 0.2)),
    }) +
    h('rect', { x, y, width: s, height: s, rx: 4, ...st(c) }) +
    h('path', {
      d: digitD(n, x + s / 2, y + s / 2, s * 0.62),
      stroke: '#ffffff',
      'stroke-width': s * 0.12,
      fill: 'none',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
  return {
    back: '',
    front:
      block(-230, -52, 52, '#ff5a5f', 1) +
      block(-174, -52, 52, '#4aa8ff', 2) +
      block(-204, -108, 52, '#ffd23f', 3),
  };
}

function nestQuilt(): { back: string; front: string } {
  const cols = ['#ff9fbf', '#ffd76a', '#9fd8ff', '#b7e48c', '#d4b8ff'];
  const d = M(-170, -20) + L(170, -20) + L(196, 40) + L(-196, 40) + 'Z';
  let patches = '';
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 6; i++) {
      const y0 = -20 + row * 30;
      const y1 = y0 + 30;
      const k0 = 1 + ((row * 30) / 60) * 0.15;
      const k1 = 1 + (((row + 1) * 30) / 60) * 0.15;
      const x0 = -170 + i * (340 / 6);
      const x1 = x0 + 340 / 6;
      patches += h('path', {
        d: polyD([
          { x: x0 * k0, y: y0 },
          { x: x1 * k0, y: y0 },
          { x: x1 * k1, y: y1 },
          { x: x0 * k1, y: y1 },
        ]),
        fill: cols[(i + row * 2) % cols.length]!,
      });
    }
  }
  return {
    back:
      patches +
      h('path', { d, fill: 'none', stroke: INK, 'stroke-width': SW, 'stroke-linejoin': 'round' }) +
      h('path', {
        d: M(-164, -14) + L(164, -14) + L(188, 34) + L(-188, 34) + 'Z',
        fill: 'none',
        stroke: '#ffffff',
        'stroke-width': 2.5,
        'stroke-dasharray': '7 6',
        opacity: 0.9,
      }),
    front: '',
  };
}

function nestMushrooms(): { back: string; front: string } {
  const shroom = (x: number, s: number, cap: string): string =>
    h('path', {
      d:
        M(x - s * 0.28, 4) +
        Q(x - s * 0.34, -s * 0.5, x - s * 0.2, -s * 0.7) +
        L(x + s * 0.2, -s * 0.7) +
        Q(x + s * 0.34, -s * 0.5, x + s * 0.28, 4) +
        'Z',
      ...st('#fff3dc', INK, 3),
    }) +
    h('path', {
      d:
        M(x - s * 0.62, -s * 0.62) +
        C(x - s * 0.62, -s * 1.3, x + s * 0.62, -s * 1.3, x + s * 0.62, -s * 0.62) +
        Q(x, -s * 0.5, x - s * 0.62, -s * 0.62) +
        'Z',
      ...st(cap, INK, 3),
    }) +
    h('ellipse', {
      cx: x - s * 0.22,
      cy: -s * 0.98,
      rx: s * 0.14,
      ry: s * 0.08,
      fill: '#ffffff',
      opacity: 0.5,
    });
  return {
    back: '',
    front:
      shroom(-186, 62, '#a8642e') +
      shroom(-140, 40, '#c27a3c') +
      shroom(160, 50, '#a8642e') +
      shroom(194, 32, '#ff8a3d'),
  };
}

function nestTreasure(): { back: string; front: string } {
  const coin = (x: number, y: number, r: number): string =>
    h('ellipse', { cx: x, cy: y, rx: r, ry: r * 0.42, ...st('#ffd23f', '#8a5a00', 2.5) }) +
    h('ellipse', {
      cx: x,
      cy: y - 1,
      rx: r * 0.6,
      ry: r * 0.22,
      fill: 'none',
      stroke: '#e0a020',
      'stroke-width': 2,
    });
  let pile = h('path', {
    d: M(-262, 6) + Q(-250, -60, -196, -64) + Q(-146, -60, -134, 6) + 'Z',
    ...st('#ffcf3a', '#8a5a00', 3),
  });
  for (const [x, y] of [
    [-236, -10],
    [-200, -30],
    [-168, -8],
    [-214, -52],
    [-180, -56],
    [-150, -30],
  ])
    pile += coin(x!, y!, 16);
  pile += h('path', {
    d: polyD([
      { x: -206, y: -66 },
      { x: -192, y: -84 },
      { x: -178, y: -66 },
      { x: -192, y: -54 },
    ]),
    ...st('#4ad0ff', INK, 2.5),
  });
  pile += coin(-112, 0, 15);
  pile += h('path', { d: sparkleD(-150, -78, 10), fill: '#ffffff' });
  return { back: '', front: pile };
}

function nestBooks(): { back: string; front: string } {
  const book = (y: number, w: number, c: string, dx: number): string =>
    h('path', { d: roundRectD(-230 + dx, y, w, 22, 4), ...st(c, INK, 3) }) +
    h('path', {
      d: M(-226 + dx + w - 14, y + 4) + L(-226 + dx + w - 14, y + 18),
      stroke: '#ffffff',
      'stroke-width': 3,
      opacity: 0.6,
    }) +
    h('rect', {
      x: -226 + dx + 6,
      y: y + 6,
      width: w * 0.5,
      height: 4,
      rx: 2,
      fill: '#ffffff',
      opacity: 0.6,
    });
  const apple =
    h('circle', { cx: -170, cy: -96, r: 16, ...st('#e8423f', INK, 3) }) +
    h('path', { d: M(-170, -110) + L(-168, -122), stroke: '#7a5230', 'stroke-width': 4 }) +
    h('path', {
      d: M(-168, -116) + Q(-156, -126, -150, -114) + Q(-160, -110, -168, -116) + 'Z',
      ...st('#5cc46b', INK, 2),
    });
  return {
    back: '',
    front:
      book(-22, 118, '#4aa8ff', 0) +
      book(-44, 106, '#ff7eb6', 6) +
      book(-66, 112, '#5ccc6b', -4) +
      apple,
  };
}

const NESTS: Record<string, () => { back: string; front: string }> = {
  'nest-pillow': nestPillow,
  'nest-lantern': nestLantern,
  'nest-flowers': nestFlowers,
  'nest-number-blocks': nestNumberBlocks,
  'nest-quilt': nestQuilt,
  'nest-mushrooms': nestMushrooms,
  'nest-treasure': nestTreasure,
  'nest-books': nestBooks,
};

export function renderNest(id: string, a: CosmeticAnchors): { back: string; front: string } {
  const draw = NESTS[id];
  if (!draw) return { back: '', front: '' };
  const k = a.nest.w / 240;
  const parts = draw();
  const wrap = (s: string): string =>
    s ? h('g', { class: `dv-cosmetic dv-nest dv-${id}` }, place(a.nest.x, a.nest.y, k, 0, s)) : '';
  return { back: wrap(parts.back), front: wrap(parts.front) };
}
