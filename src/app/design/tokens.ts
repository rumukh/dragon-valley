/**
 * Design tokens: S4's master palette (`assets/art/palette.json`) and the SDK's child-safe
 * thresholds, published as CSS custom properties on the document root at boot. Stylesheets
 * read colors only through `var(--dv-…)` (test/unit/app/tokens.test.ts holds them to it).
 */
import { CHILD_SAFE_PRESET } from '@aegis/browser/ui';
import { PALETTE } from '../art/palette';
import type { Palette, RegionAccent } from '../art/palette';

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
}

function regions(palette: Palette): Record<string, RegionAccent> {
  return palette.regions as Record<string, RegionAccent>;
}

function onAccent(region: RegionAccent, palette: Palette): string {
  return region.onAccent === 'white' ? palette.surface.card : palette.ink.ink;
}

/** Every token as `[custom property, value]`, in a stable order. */
export function tokenEntries(palette: Palette = PALETTE): [string, string][] {
  const entries: [string, string][] = [];
  for (const group of [palette.ink, palette.surface, palette.brand, palette.feedback]) {
    for (const [name, value] of Object.entries(group)) entries.push([`--dv-${kebab(name)}`, value]);
  }
  for (const [name, value] of Object.entries(palette.mastery)) {
    entries.push([`--dv-mastery-${kebab(name)}`, value]);
  }
  for (const [id, region] of Object.entries(regions(palette))) {
    entries.push(
      [`--dv-region-${id}-accent`, region.accent],
      [`--dv-region-${id}-deep`, region.deep],
      [`--dv-region-${id}-soft`, region.soft],
      [`--dv-region-${id}-on-accent`, onAccent(region, palette)],
    );
  }
  palette.rainbow.forEach((color, index) => entries.push([`--dv-rainbow-${index + 1}`, color]));
  entries.push(
    ['--dv-target', `${CHILD_SAFE_PRESET.targetPixels}px`],
    ['--dv-reading', `${CHILD_SAFE_PRESET.readingPixels}px`],
  );
  return entries;
}

export function applyTokens(root: HTMLElement, palette: Palette = PALETTE): void {
  for (const [name, value] of tokenEntries(palette)) root.style.setProperty(name, value);
}

/**
 * Region accent for a screen: `--dv-accent*` follow the region, or the brand violet outside
 * any region. Unknown region IDs (from a later content revision) use the brand accent.
 */
export function applyRegion(
  element: HTMLElement,
  region: string | null,
  palette: Palette = PALETTE,
): void {
  const colors = region === null ? undefined : regions(palette)[region];
  if (colors && region) element.dataset['region'] = region;
  else delete element.dataset['region'];
  element.style.setProperty('--dv-accent', colors?.accent ?? palette.brand.primary);
  element.style.setProperty('--dv-accent-deep', colors?.deep ?? palette.brand.primaryDeep);
  element.style.setProperty('--dv-accent-soft', colors?.soft ?? palette.brand.primarySoft);
  element.style.setProperty(
    '--dv-on-accent',
    colors ? onAccent(colors, palette) : palette.surface.card,
  );
}
