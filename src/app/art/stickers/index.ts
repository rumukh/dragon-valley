/**
 * Data-driven sticker composer: content can add stickers without new art by combining a frame,
 * a color and an icon (any icon id) or a dragon portrait.
 */
import { polar, type Pt } from '../svg/num';
import { M, L, Q, roundStarD, heartD, scallopD, smoothClosedD, circleD } from '../svg/path';
import { h, svgDoc, ids as scoped } from '../svg/xml';
import { darken, isHex, lighten, outlineOf } from '../svg/color';
import { sparkleD } from '../glyphs';
import { renderIcon, ICON_IDS } from '../icons';
import { getDragonAnchors, renderDragon, DRAGON_RECIPES } from '../dragon';
import { paletteColor } from '../palette';
import { cosmeticById } from '../cosmetics';
import { renderCosmeticIcon } from '../cosmetics/icon';
import paletteJson from '../../../../assets/art/palette.json';

/** Sticker frame ids (prefixed so they never collide with other art ids). */
export const STICKER_FRAMES = [
  'frame-round',
  'frame-scallop',
  'frame-shield',
  'frame-star',
  'frame-hexagon',
  'frame-heart',
  'frame-ribbon',
  'frame-cloud',
] as const;
export type StickerFrame = (typeof STICKER_FRAMES)[number];

const BRAND_COLORS: Record<string, string> = {
  primary: 'brand.primary',
  sun: 'brand.sun',
  coral: 'brand.coral',
  sky: 'brand.sky',
  meadow: 'brand.meadow',
  gold: 'mastery.gold',
  silver: 'mastery.silver',
  bronze: 'mastery.bronze',
};

/** Named sticker colors: every region id plus a few brand colors. Hex colors are also accepted. */
export const STICKER_COLORS: readonly string[] = [
  ...Object.keys(paletteJson.regions),
  ...Object.keys(BRAND_COLORS),
];

export interface StickerSpec {
  frame: StickerFrame;
  /** A STICKER_COLORS name or a #rrggbb color. */
  color: string;
  /** Any renderIcon id (coin, star-filled, apple, emblem-...) or cosmetic id (hat-party, ...). Ignored when `dragon` is set. */
  icon?: string;
  /** A dragon id: shows its portrait instead of an icon. */
  dragon?: string;
  /** Dragon stage for the portrait (default youngling). */
  stage?: 'hatchling' | 'youngling' | 'adult' | 'crowned';
  idPrefix?: string;
  size?: number;
  title?: string;
}

function resolveColor(color: string): string {
  if (isHex(color)) return color.toLowerCase();
  const regions = paletteJson.regions as Record<string, { accent: string }>;
  if (regions[color]) return regions[color].accent;
  const key = BRAND_COLORS[color];
  if (!key) throw new Error(`Unknown sticker color: ${color}`);
  return paletteColor(key);
}

const C = 60;

function frameD(frame: StickerFrame, r: number): string {
  switch (frame) {
    case 'frame-scallop':
      return scallopD(C, C, r * 0.86, r * 0.86, 14, r * 0.12);
    case 'frame-shield':
      return (
        M(C, C - r) +
        Q(C + r * 0.55, C - r * 0.82, C + r * 0.92, C - r * 0.86) +
        L(C + r * 0.9, C - r * 0.05) +
        Q(C + r * 0.82, C + r * 0.62, C, C + r) +
        Q(C - r * 0.82, C + r * 0.62, C - r * 0.9, C - r * 0.05) +
        L(C - r * 0.92, C - r * 0.86) +
        Q(C - r * 0.55, C - r * 0.82, C, C - r) +
        'Z'
      );
    case 'frame-star':
      return roundStarD(C, C + r * 0.06, 5, r * 1.04, r * 0.62, -90, 0.24);
    case 'frame-hexagon': {
      const pts: Pt[] = [];
      for (let i = 0; i < 6; i++) pts.push(polar(C, C, r, -90 + i * 60));
      return smoothClosedD(
        pts.flatMap((p, i) => {
          const n = pts[(i + 1) % 6]!;
          return [
            { x: p.x + (n.x - p.x) * 0.12, y: p.y + (n.y - p.y) * 0.12 },
            { x: p.x + (n.x - p.x) * 0.88, y: p.y + (n.y - p.y) * 0.88 },
          ];
        }),
        0.35,
      );
    }
    case 'frame-heart':
      return heartD(C, C + r * 0.04, r * 2.05);
    case 'frame-cloud':
      return scallopD(C, C + r * 0.04, r * 0.8, r * 0.66, 9, r * 0.2);
    case 'frame-ribbon':
      return circleD(C, C - 4, r * 0.82);
    default:
      return circleD(C, C, r * 0.94);
  }
}

/** Where the icon sits per frame: [cx, cy, size]. */
function iconBox(frame: StickerFrame, r: number): [number, number, number] {
  switch (frame) {
    case 'frame-star':
      return [C, C + r * 0.1, r * 0.92];
    case 'frame-heart':
      return [C, C - r * 0.04, r * 0.98];
    case 'frame-shield':
      return [C, C - r * 0.04, r * 1.12];
    case 'frame-ribbon':
      return [C, C - 4, r * 1.08];
    default:
      return [C, C, r * 1.2];
  }
}

/** Nests a rendered SVG (its own scoped ids) at a square box. */
function nest(svg: string, x: number, y: number, size: number, viewBox?: string): string {
  const open = /^<svg[^>]*>/.exec(svg)?.[0] ?? '';
  const inner = svg.slice(open.length, svg.length - '</svg>'.length);
  const vb = viewBox ?? /viewBox="([^"]+)"/.exec(open)?.[1] ?? '0 0 64 64';
  return h('svg', { x, y, width: size, height: size, viewBox: vb, overflow: 'hidden' }, inner);
}

/** Composes a sticker (120 x 120 viewBox) with a white die-cut border. */
export function renderSticker(spec: StickerSpec): string {
  if (!(STICKER_FRAMES as readonly string[]).includes(spec.frame)) {
    throw new Error(`Unknown sticker frame: ${spec.frame}`);
  }
  const prefix = spec.idPrefix ?? 'dv-sticker';
  const sc = scoped(prefix);
  const base = resolveColor(spec.color);
  const line = outlineOf(base, 0.62);
  const r = 46;
  const d = frameD(spec.frame, r);
  const grad = sc.id('fill');
  const clip = sc.id('clip');
  const [ix, iy, isz] = iconBox(spec.frame, r);
  let content: string;
  if (spec.dragon) {
    if (!DRAGON_RECIPES.has(spec.dragon)) throw new Error(`Unknown dragon id: ${spec.dragon}`);
    const stage = spec.stage ?? 'youngling';
    const a = getDragonAnchors({ dragon: spec.dragon, stage, framing: 'fit' });
    const side = a.head.width * 1.75;
    const cx = a.head.x;
    const cy = a.head.y + a.head.width * 0.52;
    const vb = `${(cx - side / 2).toFixed(2)} ${(cy - side / 2).toFixed(2)} ${side.toFixed(2)} ${side.toFixed(2)}`;
    const svg = renderDragon({
      dragon: spec.dragon,
      stage,
      expression: 'happy',
      framing: 'fit',
      idPrefix: `${prefix}-d`,
      animated: false,
    });
    content = h(
      'g',
      { 'clip-path': `url(#${clip})` },
      nest(svg, ix - isz * 0.62, iy - isz * 0.6, isz * 1.24, vb),
    );
  } else {
    const icon = spec.icon ?? 'star-filled';
    let svg: string;
    if (ICON_IDS.includes(icon)) svg = renderIcon(icon, { idPrefix: `${prefix}-i` });
    else if (cosmeticById(icon)) svg = renderCosmeticIcon(icon, { idPrefix: `${prefix}-c` });
    else throw new Error(`Unknown sticker icon: ${icon}`);
    content = h('g', { color: darken(base, 0.55) }, nest(svg, ix - isz / 2, iy - isz / 2, isz));
  }
  const tail = (s: number): string =>
    h('path', {
      d:
        M(C + s * 26, C + 16) +
        L(C + s * 36, C + 56) +
        L(C + s * 23, C + 48) +
        L(C + s * 13, C + 58) +
        L(C + s * 6, C + 24) +
        'Z',
      fill: darken(base, 0.15),
      stroke: line,
      'stroke-width': 3,
      'stroke-linejoin': 'round',
    });
  const ribbon = spec.frame === 'frame-ribbon' ? tail(-1) + tail(1) : '';
  const body =
    h(
      'defs',
      null,
      h(
        'radialGradient',
        { id: grad, cx: '0.35', cy: '0.3', r: '0.85' },
        h('stop', { offset: '0', 'stop-color': lighten(base, 0.6) }),
        h('stop', { offset: '0.6', 'stop-color': lighten(base, 0.2) }),
        h('stop', { offset: '1', 'stop-color': base }),
      ),
      h('clipPath', { id: clip }, h('path', { d })),
    ) +
    ribbon +
    h('path', {
      d,
      fill: '#2a2140',
      opacity: 0.18,
      transform: 'translate(2 4)',
      stroke: '#2a2140',
      'stroke-width': 12,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d,
      fill: '#ffffff',
      stroke: '#ffffff',
      'stroke-width': 12,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d,
      fill: `url(#${grad})`,
      stroke: line,
      'stroke-width': 3,
      'stroke-linejoin': 'round',
    }) +
    h('path', {
      d,
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': 2,
      opacity: 0.6,
      transform: `translate(${C} ${C}) scale(0.88) translate(${-C} ${-C})`,
    }) +
    content +
    h('path', { d: sparkleD(C + r * 0.62, C - r * 0.6, 6), fill: '#ffffff', opacity: 0.9 });
  return svgDoc(
    {
      viewBox: [0, 0, 120, 120],
      width: spec.size,
      height: spec.size,
      className: 'dv-sticker',
      title: spec.title,
      idPrefix: prefix,
      data: { frame: spec.frame },
    },
    body,
  );
}

/** A varied, deterministic sample of stickers for the gallery and tests. */
export function stickerSamples(): StickerSpec[] {
  return [
    { frame: 'frame-round', color: 'sunny-meadow', icon: 'star-filled' },
    { frame: 'frame-scallop', color: 'whispering-woods', icon: 'emblem-whispering-woods' },
    { frame: 'frame-shield', color: 'fire-mountain', dragon: 'ember' },
    { frame: 'frame-star', color: 'gold', icon: 'coin' },
    { frame: 'frame-hexagon', color: 'crystal-caves', dragon: 'crystal' },
    { frame: 'frame-heart', color: 'giants-peaks', icon: 'apple' },
    { frame: 'frame-ribbon', color: 'dragon-castle', icon: 'chest-open' },
    { frame: 'frame-cloud', color: 'sky', dragon: 'puff' },
    { frame: 'frame-round', color: '#c77dff', icon: 'hat-party' },
    { frame: 'frame-scallop', color: 'leftover-lagoon', dragon: 'pearl' },
    { frame: 'frame-shield', color: 'riddle-ruins', icon: 'emblem-riddle-ruins' },
    { frame: 'frame-ribbon', color: 'primary', dragon: 'goldie', stage: 'crowned' },
    { frame: 'frame-star', color: 'sun', dragon: 'sunny' },
    { frame: 'frame-hexagon', color: 'meadow', icon: 'egg' },
    { frame: 'frame-heart', color: 'coral', dragon: 'petal' },
    { frame: 'frame-cloud', color: '#9fdcff', icon: 'check' },
  ];
}
