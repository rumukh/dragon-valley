/**
 * Dragon Valley art: every renderer is a pure function returning an SVG string.
 * Import from here (or the sub-modules) in the app shell. See docs/art.md.
 */
export * from './dragon';
export {
  COSMETICS,
  cosmeticById,
  renderHat,
  renderEyewear,
  renderNeckwear,
  renderNest,
  renderWingPaint,
} from './cosmetics';
export type { CosmeticAnchors, CosmeticDef } from './cosmetics';
export { PALETTE, paletteColor, regionAccent, type Palette, type RegionAccent } from './palette';
export {
  renderIcon,
  ICON_IDS,
  ITEM_ICON_IDS,
  GLYPH_ICON_IDS,
  FRUIT_IDS,
  type IconOptions,
} from './icons';
export { REGION_EMBLEM_IDS } from './icons/emblems';
export { renderAvatar, KEEPER_AVATARS, type AvatarOptions } from './characters/avatars';
export { buildCatalog, catalogIds, CATALOG_SCHEMA_VERSION } from './catalog';
