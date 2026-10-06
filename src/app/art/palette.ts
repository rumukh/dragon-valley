import paletteJson from '../../../assets/art/palette.json';

/** The master palette (assets/art/palette.json); the UI design system adopts these tokens. */
export const PALETTE = paletteJson;
export type Palette = typeof paletteJson;

export type RegionAccent = {
  name: string;
  accent: string;
  deep: string;
  soft: string;
  onAccent: string;
};

export function regionAccent(regionId: string): RegionAccent {
  const regions = PALETTE.regions as Record<string, RegionAccent>;
  const accent = regions[regionId];
  if (!accent) throw new Error(`Unknown region id: ${regionId}`);
  return accent;
}

/** Resolves a dotted palette key such as `brand.primary` or `regions.sunny-meadow.accent`. */
export function paletteColor(key: string): string {
  let node: unknown = PALETTE;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || !Object.hasOwn(node, part))
      throw new Error(`Unknown palette key: ${key}`);
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== 'string') throw new Error(`Palette key is not a color: ${key}`);
  return node;
}
