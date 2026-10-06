import { lerp, polar, type Pt } from '../svg/num';
import { M, Q, L } from '../svg/path';
import { h, svgDoc } from '../svg/xml';
import { sparkleD } from '../glyphs';
import { ANIMATIONS_CSS } from './animations';
import { makeCtx, type Ctx } from './ctx';
import { crownAura } from './features';
import { ears, horns, royalCrown } from './head';
import {
  belly,
  body,
  bodyPathD,
  cheeks,
  eyes,
  feet,
  headPathD,
  headShape,
  headSheen,
  mouth,
  muzzle,
  shadow,
  arms,
} from './parts';
import { cloudUnion, pivot, taperD } from './shapes';
import { CANVAS, CX, GROUND, STAGE_SCALE, computeSkeleton, type Skeleton } from './skeleton';
import { tails } from './tail';
import type { DragonExpression, DragonRecipe, DragonRenderOptions } from './types';
import { wings } from './wings';
import { eggContent, eggShadow } from './egg';
import { f } from '../svg/num';

/** The seven personalities, left to right. */
export const SEVEN_HEADS = [
  'sleepy',
  'giggly',
  'grumpy',
  'brave',
  'shy',
  'curious',
  'dreamy',
] as const;
export type SevenHeadPersonality = (typeof SEVEN_HEADS)[number];

const BASE_EXPRESSION: Record<SevenHeadPersonality, DragonExpression> = {
  sleepy: 'sleepy',
  giggly: 'happy',
  grumpy: 'idle',
  brave: 'proud',
  shy: 'idle',
  curious: 'curious',
  dreamy: 'idle',
};

/** Draw order: outer heads first, the brave leader last (in front). */
const DRAW_ORDER = [0, 6, 1, 5, 2, 4, 3];

interface HeadSlot {
  index: number;
  personality: SevenHeadPersonality;
  centre: Pt;
  base: Pt;
  scale: number;
  tilt: number;
}

function headSlots(sk: Skeleton): HeadSlot[] {
  const t = sk.t;
  const top = sk.body.top;
  const R = lerp(150, 196, t);
  const origin = { x: CX, y: top + lerp(44, 40, t) };
  const slots: HeadSlot[] = [];
  for (let i = 0; i < 7; i++) {
    const a = -90 + (i - 3) * lerp(27, 25, t);
    const c = polar(origin.x, origin.y, R * (i === 3 ? 1.04 : 1), a);
    slots.push({
      index: i,
      personality: SEVEN_HEADS[i]!,
      centre: { x: c.x, y: origin.y + (c.y - origin.y) * 0.92 },
      base: { x: CX + (i - 3) * sk.body.w * 0.09, y: top + 34 + Math.abs(i - 3) * 9 },
      scale: i === 3 ? lerp(0.58, 0.52, t) : lerp(0.5, 0.45, t),
      tilt: (i - 3) * 7,
    });
  }
  return slots;
}

/** One head drawn at the canonical position, then placed. */
function sevenHead(base: Ctx, slot: HeadSlot, sneezy: boolean, refSk: Skeleton): string {
  const ctx = { ...base, expression: BASE_EXPRESSION[slot.personality], sk: refSk } as Ctx;
  const hd = refSk.head;
  const e = refSk.eye;
  let extra = '';
  if (slot.personality === 'grumpy') {
    const d = [-1, 1]
      .map((s) => {
        const x = CX + s * e.dx;
        const y = e.y - e.r * 1.5;
        return M(x - s * e.r * 0.6, y - e.r * 0.25) + L(x + s * e.r * 0.55, y + e.r * 0.2);
      })
      .join('');
    extra += h('path', {
      d,
      stroke: ctx.paint.line,
      'stroke-width': e.r * 0.2,
      'stroke-linecap': 'round',
    });
  }
  if (slot.personality === 'shy') {
    extra += [-1, 1]
      .map((s) =>
        h('ellipse', {
          cx: CX + s * (e.dx + e.r * 0.4),
          cy: e.y + e.r * 1.3,
          rx: e.r * 0.75,
          ry: e.r * 0.4,
          fill: ctx.paint.cheek,
          opacity: 0.85,
        }),
      )
      .join('');
  }
  if (slot.personality === 'dreamy') {
    extra += h('path', {
      d: sparkleD(hd.cx + hd.rx * 0.95, hd.cy - hd.ry * 0.9, e.r * 0.6),
      fill: '#ffe680',
      stroke: '#c47f0a',
      'stroke-width': 2,
    });
  }
  if (sneezy) {
    const m = refSk.muzzle;
    extra += h('ellipse', {
      cx: m.cx,
      cy: refSk.nostril.y,
      rx: m.rx * 0.55,
      ry: m.ry * 0.42,
      fill: '#ff6b6b',
      opacity: 0.75,
    });
    extra += [-1, 1]
      .map((s) =>
        h('path', {
          d:
            M(CX + s * (e.dx + e.r * 0.85), e.y + e.r * 0.6) +
            Q(
              CX + s * (e.dx + e.r * 1.25),
              e.y + e.r * 1.25,
              CX + s * (e.dx + e.r * 0.9),
              e.y + e.r * 1.4,
            ) +
            Q(
              CX + s * (e.dx + e.r * 0.6),
              e.y + e.r * 1.1,
              CX + s * (e.dx + e.r * 0.85),
              e.y + e.r * 0.6,
            ) +
            'Z',
          fill: '#9fdcff',
          stroke: '#3a7bc8',
          'stroke-width': 2,
        }),
      )
      .join('');
    if (slot.personality === 'giggly' || slot.personality === 'curious') {
      extra += cloudUnion(
        [
          { x: hd.cx + hd.rx * 0.2, y: m.cy + m.ry * 2.2, r: m.rx * 0.5 },
          { x: hd.cx + hd.rx * 0.65, y: m.cy + m.ry * 2.0, r: m.rx * 0.38 },
          { x: hd.cx - hd.rx * 0.2, y: m.cy + m.ry * 2.4, r: m.rx * 0.34 },
        ],
        '#ffffff',
        '#9a8fc8',
        4,
        'dv-puff',
      );
    }
  }
  const inner =
    ears(ctx) +
    horns(ctx) +
    headShape(ctx, headPathD(ctx)) +
    headSheen(ctx) +
    muzzle(ctx) +
    cheeks(ctx) +
    eyes(ctx) +
    mouth(ctx) +
    extra;
  const sneezeCls =
    sneezy && (slot.personality === 'giggly' || slot.personality === 'curious') ? 'dv-sneeze' : '';
  const placed = h(
    'g',
    {
      transform: `translate(${f(slot.centre.x)} ${f(slot.centre.y)}) rotate(${f(slot.tilt)}) scale(${f(slot.scale)}) translate(${f(-hd.cx)} ${f(-hd.cy)})`,
    },
    sneezeCls ? pivot(hd.cx, hd.cy + hd.ry, sneezeCls, inner) : inner,
  );
  return h(
    'g',
    { class: `dv-seven-head dv-seven-${slot.personality}`, 'data-head': String(slot.index + 1) },
    placed,
  );
}

function neckPath(ctx: Ctx, slot: HeadSlot): string {
  const b = slot.base;
  const c = slot.centre;
  const p1 = { x: b.x + (c.x - b.x) * 0.1, y: b.y - (b.y - c.y) * 0.45 };
  const p2 = { x: b.x + (c.x - b.x) * 0.75, y: c.y + (b.y - c.y) * 0.4 };
  const d = taperD(b, p1, p2, c, lerp(36, 48, ctx.sk.t), lerp(26, 32, ctx.sk.t), 10);
  return h('path', {
    d,
    fill: ctx.paint.body,
    stroke: ctx.paint.line,
    'stroke-width': ctx.W,
    'stroke-linejoin': 'round',
  });
}

/** Seven-headed dragon composition; `curedHeads` counts cured heads from the left (0..7). */
export function sevenLayers(ctx: Ctx, curedHeads: number): string {
  const sk = ctx.sk;
  const refSk = computeSkeleton(ctx.recipe, 'adult');
  const slots = headSlots(sk);
  const necks = DRAW_ORDER.map((i) => neckPath(ctx, slots[i]!)).join('');
  const heads = DRAW_ORDER.map((i) => sevenHead(ctx, slots[i]!, i >= curedHeads, refSk)).join('');
  const scarf =
    curedHeads < 7
      ? h('path', {
          d:
            M(CX - sk.body.w * 0.42, sk.body.top + 40) +
            Q(CX, sk.body.top + 78, CX + sk.body.w * 0.42, sk.body.top + 40),
          fill: 'none',
          stroke: '#ff5a5f',
          'stroke-width': lerp(16, 24, sk.t),
          'stroke-linecap': 'round',
          'stroke-dasharray': '18 10',
        })
      : '';
  const crowned = sk.stage === 'crowned';
  const wingSet = wings(ctx);
  const inner =
    wingSet.back +
    tails(ctx) +
    necks +
    body(ctx, bodyPathD(ctx)) +
    belly(ctx) +
    feet(ctx) +
    arms(ctx) +
    scarf +
    heads +
    (crowned
      ? h(
          'g',
          {
            transform: `translate(${f(slots[3]!.centre.x - CX)} ${f(slots[3]!.centre.y - refSk.head.cy - 6)})`,
          },
          h(
            'g',
            {
              transform: `translate(${CX} ${f(refSk.head.cy)}) scale(${f(slots[3]!.scale)}) translate(${-CX} ${f(-refSk.head.cy)})`,
            },
            royalCrown({ ...ctx, sk: refSk } as Ctx),
          ),
        )
      : '');
  return pivot(CX, GROUND, 'dv-bounce', pivot(CX, GROUND, 'dv-breathe', inner));
}

export function renderSevenHeaded(
  opts: DragonRenderOptions,
  recipe: DragonRecipe,
  curedOverride?: number,
): string {
  const stage = opts.stage;
  const prefix = opts.idPrefix ?? `dv-${recipe.id}`;
  const expression = opts.expression ?? 'idle';
  const sk = computeSkeleton(recipe, stage === 'egg' ? 'hatchling' : stage);
  const ctx = makeCtx(recipe, sk, prefix, expression, opts.outfit ?? {});
  const cured = curedOverride ?? (opts.condition === 'sneezy' ? 0 : 7);
  let content: string;
  if (stage === 'egg') {
    const egg = eggContent(ctx, opts.warmth);
    content = eggShadow() + egg.back + egg.body + egg.front;
  } else {
    let back = '';
    let front = '';
    if (stage === 'crowned') {
      const aura = crownAura(ctx);
      back = aura.back;
      front = aura.front;
    }
    content = back + shadow(ctx) + sevenLayers(ctx, cured) + front;
  }
  const s = STAGE_SCALE[stage];
  const fit = opts.framing === 'fit';
  const viewBox: [number, number, number, number] = fit
    ? [-4, -10, 520, 520]
    : [0, 0, CANVAS, CANVAS];
  const transform = fit
    ? ''
    : `translate(${CX} ${GROUND}) scale(${f(s)}) translate(${-CX} ${-GROUND})`;
  const animated = opts.animated ?? true;
  return svgDoc(
    {
      viewBox,
      width: opts.size,
      height: opts.size,
      className: ['dv-dragon', animated ? 'dv-animated' : ''].filter(Boolean).join(' '),
      title: opts.title,
      idPrefix: prefix,
      data: { dragon: recipe.id, stage, expression },
      style: opts.embedStyles ? ANIMATIONS_CSS : undefined,
    },
    ctx.defs.length ? h('defs', null, ...ctx.defs) : '',
    transform ? h('g', { transform }, content) : content,
  );
}
