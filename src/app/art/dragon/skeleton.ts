import { lerp, type Pt } from '../svg/num';
import type { DragonRecipe, DragonStage } from './types';

/** Design canvas for every dragon: 512 x 512 units, feet on GROUND. */
export const CANVAS = 512;
export const CX = 256;
export const GROUND = 470;

/** Growth factor per stage: hatchling 0 ... adult 1. Eggs use the hatchling skeleton. */
export const STAGE_GROWTH: Record<DragonStage, number> = {
  egg: 0,
  hatchling: 0,
  youngling: 0.5,
  adult: 1,
  crowned: 1,
};

/** Uniform scale applied in `stage` framing so dragons visibly grow on a shared canvas. */
export const STAGE_SCALE: Record<DragonStage, number> = {
  egg: 0.56,
  hatchling: 0.62,
  youngling: 0.78,
  adult: 0.9,
  crowned: 0.9,
};

export interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface Skeleton {
  stage: DragonStage;
  t: number;
  /** Line width scale relative to the adult (thinner lines on smaller parts look neater). */
  line: number;
  body: { top: number; bottom: number; w: number; h: number };
  belly: Ellipse;
  neck: { w: number; top: number; bottom: number } | null;
  head: Ellipse;
  muzzle: Ellipse;
  eye: { y: number; dx: number; r: number };
  cheek: { dx: number; y: number; rx: number; ry: number };
  nostril: { dx: number; y: number; r: number };
  mouth: { y: number; w: number };
  horn: { dx: number; y: number; len: number; base: number; spread: number };
  ear: { dx: number; y: number; size: number };
  arm: { shoulder: Pt; paw: Pt; thick: number };
  foot: { dx: number; y: number; rx: number; ry: number };
  shoulder: { dx: number; y: number };
  wing: { span: number; height: number };
  tail: { p0: Pt; p1: Pt; p2: Pt; p3: Pt; w0: number; w1: number };
  /** Pivot for head tilt animations. */
  neckPivot: Pt;
}

export function growth(stage: DragonStage): number {
  return STAGE_GROWTH[stage];
}

export function computeSkeleton(recipe: DragonRecipe, stage: DragonStage): Skeleton {
  const t = growth(stage);
  const b = recipe.build;
  const bw = lerp(172, 204, t) * (0.9 + 0.2 * b.chub) * b.body;
  const bh = lerp(146, 206, t) * b.body;
  const bottom = GROUND - 8;
  const top = bottom - bh;

  const hw = lerp(252, 214, t) * b.head;
  const hh = lerp(208, 176, t) * b.head;
  const neckGap = lerp(-34, 6, t);
  const headBottom = top - neckGap;
  const hcy = headBottom - hh / 2;
  const head: Ellipse = { cx: CX, cy: hcy, rx: hw / 2, ry: hh / 2 };

  const eyeR = lerp(0.135, 0.118, t) * hw;
  const eyeY = hcy + lerp(0.05, -0.02, t) * hh;
  const eyeDx = lerp(0.222, 0.212, t) * hw;

  const mrx = lerp(0.235, 0.285, t) * hw * b.snout;
  const mry = lerp(0.165, 0.2, t) * hh * b.snout;
  const mcy = eyeY + eyeR * 1.12 + mry * 0.5;
  const muzzle: Ellipse = { cx: CX, cy: mcy, rx: mrx, ry: mry };

  // Dragons whose mnemonic lives on the belly get a bigger belly so it can be counted at 120-200 px.
  const emblem = hasBellyEmblem(recipe);
  const bellyCy = top + bh * 0.6;
  const tailLen = lerp(92, 160, t) * recipe.tail.length;
  const curl = recipe.tail.curl ?? 0.62;

  return {
    stage,
    t,
    line: lerp(0.86, 1, t),
    body: { top, bottom, w: bw, h: bh },
    belly: {
      cx: CX,
      cy: bellyCy,
      rx: bw * (emblem ? 0.375 : 0.31),
      ry: bh * (emblem ? 0.37 : 0.35),
    },
    neck: t > 0.2 ? { w: hw * 0.4, top: hcy, bottom: top + bh * 0.25 } : null,
    head,
    muzzle,
    eye: { y: eyeY, dx: eyeDx, r: eyeR },
    cheek: { dx: eyeDx + eyeR * 0.5, y: eyeY + eyeR * 1.32, rx: hw * 0.085, ry: hw * 0.05 },
    nostril: { dx: mrx * 0.3, y: mcy - mry * 0.3, r: Math.max(3, mrx * 0.075) },
    mouth: { y: mcy + mry * 0.28, w: mrx * 0.62 },
    horn: {
      dx: lerp(0.19, 0.23, t) * hw,
      y: hcy - hh * 0.4,
      len: lerp(18, 62, t) * recipe.horns.length,
      base: lerp(18, 27, t),
      spread: lerp(16, 22, t),
    },
    ear: { dx: hw * 0.47, y: hcy - hh * 0.06, size: lerp(30, 50, t) * recipe.ears.size },
    arm: {
      shoulder: { x: bw * 0.34, y: top + bh * 0.3 },
      paw: { x: bw * 0.17, y: top + bh * 0.56 },
      thick: lerp(26, 30, t),
    },
    foot: { dx: bw * 0.27, y: GROUND - 15, rx: lerp(35, 43, t), ry: lerp(21, 25, t) },
    shoulder: { dx: bw * lerp(0.3, 0.26, t), y: top + bh * lerp(0.36, 0.2, t) },
    wing: {
      span: lerp(92, 182, t) * recipe.wings.size,
      height: lerp(76, 160, t) * recipe.wings.size,
    },
    tail: {
      p0: { x: CX + bw * 0.28, y: bottom - 28 },
      p1: { x: CX + bw * 0.58, y: bottom + 6 },
      p2: { x: CX + bw * 0.52 + tailLen * 0.62, y: bottom - 2 - tailLen * (curl - 0.62) * 0.3 },
      p3: {
        x: CX + bw * 0.46 + tailLen * (0.8 - (curl - 0.62) * 0.25),
        y: bottom - tailLen * curl,
      },
      w0: lerp(36, 46, t),
      w1: lerp(9, 11, t),
    },
    neckPivot: { x: CX, y: headBottom - hh * 0.12 },
  };
}

const BELLY_EMBLEMS = new Set([
  'rainbow-belly',
  'clock-belly',
  'snowflake-belly',
  'ten-frame-stars',
  'clover-spots',
  'gears',
  'place-value',
  'counting-dots',
  'plus-belly',
  'minus-belly',
  'abacus-belly',
  'carry-belly',
  'coin-belly',
]);

/** True when the dragon's mnemonic is drawn on its belly (bigger belly, paws rest at the sides). */
export function hasBellyEmblem(recipe: DragonRecipe): boolean {
  return recipe.markings.some((m) => BELLY_EMBLEMS.has(m));
}
