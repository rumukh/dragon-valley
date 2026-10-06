/**
 * Standalone cosmetic thumbnails (for Glimmer's Market and stickers): the item alone, centred in a
 * square view box, drawn by the same code that dresses the dragons.
 */
import { M, Q, C } from '../svg/path';
import { h, svgDoc } from '../svg/xml';
import { outlineOf } from '../svg/color';
import {
  cosmeticById,
  renderEyewear,
  renderHat,
  renderNeckwear,
  renderNest,
  renderWingPaint,
} from './index';
import type { CosmeticAnchors } from './types';

/** Approximate design bounds [x0, y0, x1, y1] of each item at its anchor (k = 1). */
const BOUNDS: Record<string, [number, number, number, number]> = {
  'hat-party': [-58, -142, 64, 40],
  'hat-wizard': [-98, -160, 94, 44],
  'hat-top': [-82, -96, 84, 40],
  'hat-beanie': [-92, -80, 92, 66],
  'hat-flower-crown': [-100, -14, 100, 48],
  'hat-pirate': [-100, -62, 100, 26],
  'hat-chef': [-74, -104, 76, 26],
  'hat-cap': [-84, -56, 84, 64],
  'hat-propeller': [-86, -80, 86, 38],
  'hat-straw': [-120, -44, 120, 54],
  'scarf-striped': [-88, -12, 88, 106],
  'scarf-cozy': [-92, -14, 92, 108],
  'bow-tie': [-58, -18, 58, 36],
  'ribbon-bow': [-72, -26, 72, 78],
  'pearl-necklace': [-84, -10, 84, 50],
  'gold-medal': [-48, -10, 48, 94],
  bandana: [-100, -12, 100, 82],
  'bell-collar': [-82, -12, 82, 44],
  'glasses-round': [-86, -34, 86, 34],
  'glasses-square': [-86, -30, 86, 30],
  'glasses-star': [-86, -40, 86, 40],
  'glasses-heart': [-86, -32, 86, 36],
  sunglasses: [-86, -24, 86, 28],
  monocle: [-8, -34, 82, 96],
  goggles: [-102, -36, 102, 36],
  'mask-hero': [-122, -42, 88, 36],
  'nest-pillow': [-162, -52, 162, 46],
  'nest-lantern': [-218, -136, -122, -2],
  'nest-flowers': [-206, -76, 206, 24],
  'nest-number-blocks': [-234, -124, -106, 4],
  'nest-quilt': [-198, -22, 198, 42],
  'nest-mushrooms': [-228, -84, -108, 8],
  'nest-treasure': [-264, -90, -102, 10],
  'nest-books': [-236, -128, -104, 4],
};

const WING_D =
  M(0, -14) +
  C(6, -50, 18, -72, 36, -76) +
  C(56, -82, 78, -92, 95, -90) +
  Q(90, -60, 100, -38) +
  Q(82, -30, 74, -9) +
  Q(56, -14, 42, 5) +
  Q(20, 2, 4, 13) +
  'Z';

export interface CosmeticIconOptions {
  size?: number;
  idPrefix?: string;
  title?: string;
}

/** Renders one cosmetic on its own (square view box) for shop tiles and stickers. */
export function renderCosmeticIcon(id: string, opts: CosmeticIconOptions = {}): string {
  const def = cosmeticById(id);
  if (!def) throw new Error(`Unknown cosmetic id: ${id}`);
  const prefix = opts.idPrefix ?? `dv-cos-${id}`;
  const anchors: CosmeticAnchors = {
    head: { x: 0, y: 0, w: 200, ry: 90 },
    eyes: { x: 0, y: 0, dx: 40, r: 22 },
    neck: { x: 0, y: 0, w: 160 },
    nest: { x: 0, y: 0, w: 240 },
    t: 1,
  };
  let body: string;
  let box: [number, number, number, number];
  switch (def.slot) {
    case 'head':
      body = renderHat(id, anchors, `${prefix}-h`);
      box = BOUNDS[id]!;
      break;
    case 'eyes':
      body = renderEyewear(id, anchors, prefix);
      box = BOUNDS[id]!;
      break;
    case 'neck':
      body = renderNeckwear(id, anchors);
      box = BOUNDS[id]!;
      break;
    case 'nest': {
      const parts = renderNest(id, anchors);
      body = parts.back + parts.front;
      box = BOUNDS[id]!;
      break;
    }
    default: {
      const base = '#cdbdf5';
      body =
        h('path', { d: WING_D, fill: base }) +
        renderWingPaint(id, WING_D, 100, 90, `${prefix}-wing`) +
        h('path', {
          d: WING_D,
          fill: 'none',
          stroke: outlineOf(base, 0.6),
          'stroke-width': 3.5,
          'stroke-linejoin': 'round',
        });
      box = [-6, -96, 104, 18];
    }
  }
  const [x0, y0, x1, y1] = box;
  const side = Math.max(x1 - x0, y1 - y0) * 1.12;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return svgDoc(
    {
      viewBox: [cx - side / 2, cy - side / 2, side, side],
      width: opts.size,
      height: opts.size,
      className: 'dv-cosmetic-icon',
      title: opts.title,
      idPrefix: prefix,
      data: { cosmetic: id, slot: def.slot },
    },
    body,
  );
}
