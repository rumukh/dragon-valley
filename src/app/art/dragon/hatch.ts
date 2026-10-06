import { f, polar } from '../svg/num';
import { M, L } from '../svg/path';
import { h, svgDoc } from '../svg/xml';
import { sparkleD } from '../glyphs';
import { ANIMATIONS_CSS } from './animations';
import { makeCtx } from './ctx';
import { EGG, bottomHalfClipD, crackD, eggArt, eggShadow, topHalfClipD } from './egg';
import { renderDragon, resolveRecipe } from './render';
import { pivot } from './shapes';
import { CANVAS, CX, GROUND, STAGE_SCALE, computeSkeleton } from './skeleton';
import type { DragonRecipe, Outfit } from './types';

export interface HatchOptions {
  dragon: string | DragonRecipe;
  idPrefix?: string;
  outfit?: Outfit;
  size?: number;
  title?: string;
  embedStyles?: boolean;
}

/** Total length of the hatch sequence in milliseconds (keep in sync with animations.ts). */
export const HATCH_DURATION_MS = 3600;

/**
 * The hatch sequence as one SVG: wobble, cracks, pop, hatchling reveal. It plays once when the
 * markup is inserted (re-insert to replay). Without CSS or under reduced motion it shows the
 * hatchling directly, so the end state is always correct.
 */
export function renderHatch(opts: HatchOptions): string {
  const recipe = resolveRecipe(opts.dragon);
  const prefix = opts.idPrefix ?? `dv-hatch-${recipe.id}`;
  const sk = computeSkeleton(recipe, 'hatchling');
  const ctx = makeCtx(recipe, sk, prefix, 'happy', {});
  const art = eggArt(ctx);
  const topClip = ctx.def('hatch-top', (id) =>
    h('clipPath', { id }, h('path', { d: topHalfClipD() })),
  );
  const botClip = ctx.def('hatch-bottom', (id) =>
    h('clipPath', { id }, h('path', { d: bottomHalfClipD() })),
  );
  const eggScale = STAGE_SCALE.egg;
  const babyScale = STAGE_SCALE.hatchling;
  const scaleAt = (s: number, inner: string): string =>
    h(
      'g',
      { transform: `translate(${CX} ${GROUND}) scale(${f(s)}) translate(${-CX} ${-GROUND})` },
      inner,
    );

  // The hatchling itself, rendered by the rig and inlined (its own ids use a sub-prefix).
  const babySvg = renderDragon({
    dragon: recipe,
    stage: 'hatchling',
    expression: 'happy',
    idPrefix: `${prefix}-baby`,
    outfit: opts.outfit,
    animated: false,
  });
  const babyInner = babySvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = i * 36 - 90;
    const p0 = polar(CX, EGG.cy - 20, 70, a);
    const p1 = polar(CX, EGG.cy - 20, 190, a);
    return M(p0.x, p0.y) + L(p1.x, p1.y);
  }).join('');
  const burst = pivot(
    CX,
    EGG.cy - 20,
    'dv-hatch-burst',
    h(
      'g',
      { opacity: 0 },
      h('circle', { cx: CX, cy: EGG.cy - 20, r: 150, fill: '#fff3b0', opacity: 0.6 }),
      h('path', { d: rays, stroke: '#ffd23f', 'stroke-width': 14, 'stroke-linecap': 'round' }),
      h('path', {
        d:
          sparkleD(CX - 150, EGG.cy - 120, 22) +
          sparkleD(CX + 160, EGG.cy - 80, 18) +
          sparkleD(CX + 40, EGG.cy - 210, 16),
        fill: '#ffffff',
      }),
    ),
  );
  const crack = (level: number, i: number): string =>
    h('path', {
      class: `dv-hatch-crack-${i}`,
      opacity: 0,
      d: crackD(level),
      fill: 'none',
      stroke: '#4a2f22',
      'stroke-width': 6,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    });
  const topCentre = { x: CX, y: EGG.cy - EGG.h * 0.3 };
  const egg = pivot(
    CX,
    GROUND,
    'dv-hatch-egg',
    h(
      'g',
      { class: 'dv-hatch-bottom', opacity: 0 },
      h('g', { 'clip-path': `url(#${botClip})` }, art.body),
    ) +
      pivot(
        topCentre.x,
        topCentre.y,
        'dv-hatch-top',
        h('g', { opacity: 0 }, h('g', { 'clip-path': `url(#${topClip})` }, art.body)),
      ) +
      crack(0.35, 1) +
      crack(0.65, 2) +
      crack(1, 3),
  );
  const content =
    scaleAt(eggScale, eggShadow()) +
    scaleAt(eggScale, burst) +
    pivot(CX, GROUND, 'dv-hatch-baby', babyInner) +
    scaleAt(eggScale, egg);
  void babyScale;
  return svgDoc(
    {
      viewBox: [0, 0, CANVAS, CANVAS],
      width: opts.size,
      height: opts.size,
      className: 'dv-dragon dv-hatch dv-animated',
      title: opts.title,
      idPrefix: prefix,
      data: { dragon: recipe.id, stage: 'hatchling', expression: 'happy' },
      style: opts.embedStyles ? ANIMATIONS_CSS : undefined,
    },
    ctx.defs.length ? h('defs', null, ...ctx.defs) : '',
    content,
  );
}
