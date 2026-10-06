/**
 * Parametric dragon rig: pure, DOM-free, deterministic SVG string generation.
 * See docs/art.md for the API contract.
 */
export { renderDragon, getDragonAnchors, cosmeticAnchors } from './render';
export { renderHatch, HATCH_DURATION_MS, type HatchOptions } from './hatch';
export { ANIMATIONS_CSS } from './animations';
export { DRAGON_RECIPES, getRecipe, parseRecipe } from './recipes';
export { SEVEN_HEADS, type SevenHeadPersonality } from './seven';
export { STAGE_SCALE, CANVAS } from './skeleton';
export * from './types';
