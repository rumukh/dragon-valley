import { f } from '../svg/num';
import { h, svgDoc } from '../svg/xml';
import { lerp } from '../svg/num';
import {
  renderEyewear,
  renderHat,
  renderNeckwear,
  renderNest,
  renderWingPaint,
} from '../cosmetics';
import type { CosmeticAnchors } from '../cosmetics/types';
import { ANIMATIONS_CSS } from './animations';
import { makeCtx, type Ctx } from './ctx';
import { eggContent, eggShadow, EGG } from './egg';
import {
  beard,
  bubbles,
  bushyBrows,
  crownAura,
  hasFeature,
  joySparkles,
  pearlPile,
  proudGlow,
  shawl,
  shineSparkles,
  smokeRing,
  spectacles,
  windKey,
  zzz,
} from './features';
import {
  cloudTuft,
  crownTen,
  ears,
  flowerCrest,
  horns,
  royalCrown,
  shellCrest,
  sunCrest,
} from './head';
import { bellyLayer, bodyMarks, headMarks } from './markings';
import {
  arms,
  armPoseFor,
  body,
  bodyPathD,
  bodySheen,
  brows,
  cheeks,
  eyes,
  feet,
  headPathD,
  headShape,
  headSheen,
  mouth,
  muzzle,
  neck,
  shadow,
} from './parts';
import { getRecipe } from './recipes';
import { pivot } from './shapes';
import { CANVAS, CX, GROUND, STAGE_SCALE, computeSkeleton } from './skeleton';
import { tails, tailExtent } from './tail';
import type {
  AnchorPoint,
  DragonAnchors,
  DragonRecipe,
  DragonRenderOptions,
  DragonStage,
} from './types';
import { wings } from './wings';
import { renderSevenHeaded } from './seven';

export function resolveRecipe(dragon: string | DragonRecipe): DragonRecipe {
  return typeof dragon === 'string' ? getRecipe(dragon) : dragon;
}

/** Cosmetic anchors in design space. */
export function cosmeticAnchors(ctx: Ctx): CosmeticAnchors {
  const sk = ctx.sk;
  const hd = sk.head;
  return {
    head: { x: hd.cx, y: hd.cy - hd.ry, w: hd.rx * 2, ry: hd.ry },
    eyes: { x: CX, y: sk.eye.y, dx: sk.eye.dx, r: sk.eye.r },
    neck: { x: CX, y: hd.cy + hd.ry - lerp(2, 8, sk.t), w: sk.body.w * lerp(0.84, 0.7, sk.t) },
    nest: { x: CX, y: GROUND, w: sk.body.w * 1.25 },
    t: sk.t,
  };
}

function headPose(ctx: Ctx): string {
  switch (ctx.expression) {
    case 'curious':
      return 'rotate(-9)';
    case 'sleepy':
      return 'translate(0 7) rotate(5)';
    case 'proud':
      return 'translate(0 -5) rotate(-3)';
    case 'happy':
      return 'rotate(3)';
    default:
      return '';
  }
}

/** Layers of a non-egg dragon in design space. */
function dragonLayers(ctx: Ctx): {
  back: string;
  figure: string;
  front: string;
  nestBack: string;
  nestFront: string;
} {
  const r = ctx.recipe;
  const sk = ctx.sk;
  const outfit = ctx.outfit;
  const anchors = cosmeticAnchors(ctx);
  const crowned = sk.stage === 'crowned';
  const hat = outfit.head ? renderHat(outfit.head, anchors, ctx.ids.id('c')) : '';
  const eyewear = outfit.eyes ? renderEyewear(outfit.eyes, anchors, ctx.ids.id('c')) : '';
  const neckwear = outfit.neck ? renderNeckwear(outfit.neck, anchors) : '';
  const nest = outfit.nest ? renderNest(outfit.nest, anchors) : { back: '', front: '' };
  const paintId = outfit.wings;
  const wingSet = wings(
    ctx,
    paintId
      ? (membrane, side, index, S, H) =>
          renderWingPaint(paintId, membrane, S, H, ctx.ids.id(`wp-${side}${index}`))
      : undefined,
  );

  // head ------------------------------------------------------------
  const crestBack = r.crest.style === 'sun' ? sunCrest(ctx) : '';
  let crestTop = '';
  if (!hat) {
    if (r.crest.style === 'crown10') crestTop = crownTen(ctx, crowned);
    else if (r.crest.style === 'flower') crestTop = flowerCrest(ctx);
    else if (r.crest.style === 'shell') crestTop = shellCrest(ctx);
    else if (r.crest.style === 'cloud-tuft') crestTop = cloudTuft(ctx);
  }
  const crown = crowned && !hat && r.crest.style !== 'crown10' ? royalCrown(ctx) : '';
  const headD = headPathD(ctx);
  const headInner =
    crestBack +
    ears(ctx) +
    horns(ctx) +
    (hasFeature(ctx, 'cloud-body') ? cloudHead(ctx, headD) : headShape(ctx, headD)) +
    headSheen(ctx) +
    headMarks(ctx) +
    muzzle(ctx) +
    cheeks(ctx) +
    eyes(ctx) +
    (hasFeature(ctx, 'bushy-brows') ? bushyBrows(ctx) : brows(ctx)) +
    mouth(ctx) +
    (hasFeature(ctx, 'beard') ? beard(ctx) : '') +
    (hasFeature(ctx, 'spectacles') ? spectacles(ctx) : '') +
    crestTop +
    crown +
    eyewear +
    hat;
  const head = pivot(sk.neckPivot.x, sk.neckPivot.y, 'dv-head', headInner, headPose(ctx));

  // body ------------------------------------------------------------
  const bodyD = bodyPathD(ctx);
  const armsFront = armPoseFor(ctx).front;
  const armMarkup = arms(ctx);
  const bodyInner =
    wingSet.back +
    tails(ctx) +
    (hasFeature(ctx, 'wind-key') ? windKey(ctx) : '') +
    neck(ctx) +
    (hasFeature(ctx, 'cloud-body') ? cloudBody(ctx, bodyD) : body(ctx, bodyD)) +
    bodySheen(ctx) +
    bodyMarks(ctx) +
    bellyLayer(ctx) +
    feet(ctx) +
    (armsFront ? '' : armMarkup) +
    (hasFeature(ctx, 'shawl') ? shawl(ctx) : '') +
    neckwear +
    head +
    (armsFront ? armMarkup : '');

  const breathe = pivot(
    CX,
    GROUND,
    'dv-breathe',
    bodyInner,
    ctx.expression === 'proud' ? 'scale(1.02)' : '',
  );

  let back = '';
  let front = '';
  if (ctx.expression === 'proud') back += proudGlow(ctx);
  if (crowned) {
    const aura = crownAura(ctx);
    back = aura.back + back;
    front += aura.front;
  }
  if (hasFeature(ctx, 'smoke-ring')) front += smokeRing(ctx);
  if (hasFeature(ctx, 'bubbles')) front += bubbles(ctx);
  if (hasFeature(ctx, 'shine')) front += shineSparkles(ctx);
  if (ctx.expression === 'sleepy') front += zzz(ctx);
  if (ctx.expression === 'happy') front += joySparkles(ctx);
  const ground = hasFeature(ctx, 'pearl-pile') ? pearlPile(ctx) : '';

  return {
    back,
    figure: pivot(CX, GROUND, 'dv-bounce', breathe) + ground,
    front,
    nestBack: nest.back,
    nestFront: nest.front,
  };
}

/** Puff: body silhouette made of cloud puffs (union outline: outline layer, then fill layer). */
function cloudBody(ctx: Ctx, d: string): string {
  const { top, w, h: bh } = ctx.sk.body;
  const pts: Array<[number, number, number]> = [
    [-0.4, 0.3, 0.15],
    [-0.47, 0.52, 0.16],
    [-0.46, 0.76, 0.16],
    [-0.28, 0.93, 0.15],
    [0, 0.98, 0.15],
    [0.28, 0.93, 0.15],
    [0.46, 0.76, 0.16],
    [0.47, 0.52, 0.16],
    [0.4, 0.3, 0.15],
  ];
  const circles = pts.map(([x, y, r]) => ({ x: CX + x * w, y: top + y * bh, r: r * w }));
  const grad = `url(#${ctx.ids.id('body-grad')})`;
  body(ctx, d); // registers the shared body gradient
  return h(
    'g',
    { class: 'dv-body' },
    h(
      'g',
      { fill: ctx.paint.line },
      ...circles.map((c) => h('circle', { cx: c.x, cy: c.y, r: c.r + ctx.W / 2 })),
      h('path', {
        d,
        stroke: ctx.paint.line,
        'stroke-width': ctx.W * 2,
        'stroke-linejoin': 'round',
      }),
    ),
    h(
      'g',
      { fill: grad },
      ...circles.map((c) => h('circle', { cx: c.x, cy: c.y, r: c.r })),
      h('path', { d }),
    ),
  );
}

/** Puff: head with a soft cloudy rim. */
function cloudHead(ctx: Ctx, d: string): string {
  return headShape(ctx, d);
}

/** Bounding box of the drawing in design space (for `fit` framing). */
function designBounds(ctx: Ctx, stage: DragonStage): [number, number, number, number] {
  if (stage === 'egg') {
    const pad = 26;
    return [
      EGG.cx - EGG.w / 2 - pad - 30,
      EGG.cy - EGG.h / 2 - pad,
      EGG.cx + EGG.w / 2 + pad + 30,
      GROUND + 14,
    ];
  }
  const sk = ctx.sk;
  const r = ctx.recipe;
  const hd = sk.head;
  const wingX =
    sk.shoulder.dx +
    sk.wing.span * (r.wings.style === 'leaf' || r.wings.style === 'petal' ? 1.0 : 1.06);
  let minX = CX - Math.max(wingX, sk.ear.dx + sk.ear.size * 1.1, sk.body.w * 0.62);
  let maxX = CX + Math.max(wingX, sk.ear.dx + sk.ear.size * 1.1, sk.body.w * 0.62);
  let minY = Math.min(
    sk.shoulder.y - sk.wing.height * 1.08,
    hd.cy - hd.ry - sk.horn.len * 1.05 - 8,
  );
  const maxY = GROUND + 16;
  const tail = tailExtent(ctx);
  maxX = Math.max(maxX, tail.x + tail.r * 0.75);
  minY = Math.min(minY, tail.y - tail.r);
  if (r.tail.count === 2) minX = Math.min(minX, 2 * CX - tail.x - tail.r * 0.75);
  if (r.crest.style === 'sun')
    minY = Math.min(minY, hd.cy - hd.ry * 1.62 - lerp(46, 72, sk.t) - 10);
  if (r.crest.style !== 'none' && r.crest.style !== 'sun')
    minY = Math.min(minY, hd.cy - hd.ry - 50);
  const hasHat = Boolean(ctx.outfit.head);
  if (hasHat) minY = Math.min(minY, hd.cy - hd.ry - hd.rx * 1.2);
  if (sk.stage === 'crowned') minY = Math.min(minY, hd.cy - hd.ry * 1.45 - 10);
  if (hasFeature(ctx, 'smoke-ring'))
    minX = Math.min(minX, hd.cx - hd.rx - lerp(30, 40, sk.t) * 1.9);
  if (hasFeature(ctx, 'bubbles')) {
    minX = Math.min(minX, hd.cx - hd.rx - 70);
    maxX = Math.max(maxX, hd.cx + hd.rx + 64);
  }
  if (hasFeature(ctx, 'pearl-pile')) minX = Math.min(minX, CX - sk.body.w * 0.62 - 90);
  if (ctx.outfit.nest) {
    minX = Math.min(minX, CX - sk.body.w * 1.25);
    maxX = Math.max(maxX, CX + sk.body.w * 0.9);
  }
  if (ctx.expression === 'sleepy') {
    maxX = Math.max(maxX, hd.cx + hd.rx * 0.95 + 80);
    minY = Math.min(minY, hd.cy - hd.ry * 0.85 - 50);
  }
  if (r.features.includes('reflection')) return [minX - 10, minY - 10, maxX + 10, GROUND + 120];
  return [minX - 10, minY - 10, maxX + 10, maxY];
}

function squareBox(b: [number, number, number, number]): [number, number, number, number] {
  const w = b[2] - b[0];
  const hgt = b[3] - b[1];
  const side = Math.max(w, hgt);
  const cx = (b[0] + b[2]) / 2;
  const cy = (b[1] + b[3]) / 2;
  return [cx - side / 2, cy - side / 2, side, side];
}

function framing(
  stage: DragonStage,
  mode: 'stage' | 'fit',
  bounds: [number, number, number, number],
): { viewBox: [number, number, number, number]; transform: string; scale: number } {
  if (mode === 'fit') return { viewBox: squareBox(bounds), transform: '', scale: 1 };
  const s = STAGE_SCALE[stage];
  return {
    viewBox: [0, 0, CANVAS, CANVAS],
    transform: `translate(${CX} ${GROUND}) scale(${f(s)}) translate(${-CX} ${-GROUND})`,
    scale: s,
  };
}

function reflectionLayer(ctx: Ctx, figureId: string): string {
  const mask = ctx.def('refl-mask', (id) =>
    h(
      'mask',
      { id, maskUnits: 'userSpaceOnUse', x: -200, y: GROUND, width: CANVAS + 400, height: 260 },
      h(
        'linearGradient',
        {
          id: `${id}-g`,
          gradientUnits: 'userSpaceOnUse',
          x1: 0,
          y1: GROUND,
          x2: 0,
          y2: GROUND + 150,
        },
        h('stop', { offset: '0', 'stop-color': '#ffffff', 'stop-opacity': 0.55 }),
        h('stop', { offset: '1', 'stop-color': '#ffffff', 'stop-opacity': 0 }),
      ),
      h('rect', { x: -200, y: GROUND, width: CANVAS + 400, height: 260, fill: `url(#${id}-g)` }),
    ),
  );
  return (
    h('ellipse', { cx: CX, cy: GROUND + 40, rx: 210, ry: 46, fill: '#cfe3f5', opacity: 0.45 }) +
    h('path', {
      d: `M${CX - 200} ${GROUND + 2}L${CX + 200} ${GROUND + 2}`,
      stroke: '#ffffff',
      'stroke-width': 3,
      opacity: 0.8,
    }) +
    h(
      'g',
      { mask: `url(#${mask})` },
      h('use', {
        href: `#${figureId}`,
        transform: `translate(0 ${f(2 * GROUND + 4)}) scale(1 -1)`,
      }),
    )
  );
}

/** Renders one dragon as a standalone SVG string. Deterministic: same options, same bytes. */
export function renderDragon(opts: DragonRenderOptions): string {
  const recipe = resolveRecipe(opts.dragon);
  if (recipe.id === 'seven-headed') return renderSevenHeaded(opts, recipe);
  const stage = opts.stage;
  const expression = opts.expression ?? 'idle';
  const prefix = opts.idPrefix ?? `dv-${recipe.id}`;
  const outfit = opts.outfit ?? {};
  const sk = computeSkeleton(recipe, stage === 'egg' ? 'hatchling' : stage);
  const ctx = makeCtx(recipe, sk, prefix, expression, outfit);
  const figureId = ctx.ids.id('figure');

  let content: string;
  let shadowMarkup: string;
  if (stage === 'egg') {
    const egg = eggContent(ctx, opts.warmth);
    const nest = outfit.nest
      ? renderNest(outfit.nest, cosmeticAnchors(ctx))
      : { back: '', front: '' };
    shadowMarkup = eggShadow();
    content = egg.back + h('g', { id: figureId }, nest.back + egg.body + nest.front) + egg.front;
  } else {
    const layers = dragonLayers(ctx);
    shadowMarkup = shadow(ctx);
    content =
      layers.back +
      h('g', { id: figureId }, layers.nestBack + layers.figure + layers.nestFront) +
      layers.front;
  }
  const reflection = recipe.features.includes('reflection') ? reflectionLayer(ctx, figureId) : '';
  const frame = framing(stage, opts.framing ?? 'stage', designBounds(ctx, stage));
  const animated = opts.animated ?? true;
  const classes = ['dv-dragon', animated ? 'dv-animated' : ''].filter(Boolean).join(' ');
  const defs = ctx.defs.length ? h('defs', null, ...ctx.defs) : '';
  const inner = reflection + shadowMarkup + content;
  return svgDoc(
    {
      viewBox: frame.viewBox,
      width: opts.size,
      height: opts.size,
      className: classes,
      title: opts.title,
      idPrefix: prefix,
      data: { dragon: recipe.id, stage, expression },
      style: opts.embedStyles ? ANIMATIONS_CSS : undefined,
    },
    defs,
    frame.transform ? h('g', { transform: frame.transform }, inner) : inner,
  );
}

function toView(
  p: { x: number; y: number },
  frame: { transform: string; scale: number },
): { x: number; y: number } {
  if (!frame.transform) return p;
  return { x: CX + (p.x - CX) * frame.scale, y: GROUND + (p.y - GROUND) * frame.scale };
}

/** Anchor points in the rendered SVG's viewBox coordinates (rest pose). */
export function getDragonAnchors(
  opts: Pick<DragonRenderOptions, 'dragon' | 'stage' | 'framing' | 'outfit'> & {
    expression?: DragonRenderOptions['expression'];
  },
): DragonAnchors {
  const recipe = resolveRecipe(opts.dragon);
  const stage = opts.stage;
  const sk = computeSkeleton(recipe, stage === 'egg' ? 'hatchling' : stage);
  const ctx = makeCtx(recipe, sk, 'anchors', opts.expression ?? 'idle', opts.outfit ?? {});
  const frame = framing(stage, opts.framing ?? 'stage', designBounds(ctx, stage));
  const a = cosmeticAnchors(ctx);
  const s = frame.scale;
  const pt = (x: number, y: number, width: number, angle = 0): AnchorPoint => ({
    ...toView({ x, y }, frame),
    width: width * s,
    angle,
  });
  const hd = sk.head;
  if (stage === 'egg') {
    const top = pt(EGG.cx, EGG.cy - EGG.h / 2, EGG.w);
    const centre = pt(EGG.cx, EGG.cy, EGG.w);
    return {
      viewBox: frame.viewBox,
      head: top,
      eyes: centre,
      neck: centre,
      mouth: centre,
      belly: centre,
      nest: pt(CX, GROUND, EGG.w * 1.3),
      wingL: centre,
      wingR: centre,
      top,
    };
  }
  return {
    viewBox: frame.viewBox,
    head: pt(a.head.x, a.head.y, a.head.w),
    eyes: pt(a.eyes.x, a.eyes.y, (a.eyes.dx + a.eyes.r) * 2),
    neck: pt(a.neck.x, a.neck.y, a.neck.w),
    mouth: pt(CX, sk.mouth.y, sk.mouth.w),
    belly: pt(sk.belly.cx, sk.belly.cy, sk.belly.rx * 2),
    nest: pt(a.nest.x, a.nest.y, a.nest.w),
    wingL: pt(CX - sk.shoulder.dx, sk.shoulder.y, sk.wing.span),
    wingR: pt(CX + sk.shoulder.dx, sk.shoulder.y, sk.wing.span),
    top: pt(CX, Math.min(hd.cy - hd.ry - sk.horn.len, sk.shoulder.y - sk.wing.height), hd.rx * 2),
  };
}
