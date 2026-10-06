/**
 * Design tokens come from S4's master palette and the SDK's child-safe preset, and the
 * stylesheets read no color or size that is not a published token or a local variable.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHILD_SAFE_PRESET } from '@aegis/browser/ui';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../../src/app/art/palette';
import { tokenEntries } from '../../../src/app/design/tokens';
import { CANONICAL_REGION_IDS } from '../../../src/rules/contract/ids';

/** Custom properties set locally by components or the SDK rather than by the token table. */
const LOCAL = new Set([
  '--dv-accent',
  '--dv-accent-deep',
  '--dv-accent-soft',
  '--dv-on-accent',
  '--aegis-text-scale',
  '--face',
  '--lip',
  '--label',
  '--value',
  '--progress',
  '--columns',
]);

function files(directory: string, extension: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'art' ? [] : files(path, extension);
    return entry.name.endsWith(extension) ? [path] : [];
  });
}

describe('design tokens', () => {
  const tokens = new Map(tokenEntries());

  it('publish the master palette under predictable names', () => {
    expect(tokens.get('--dv-ink')).toBe(PALETTE.ink.ink);
    expect(tokens.get('--dv-paper')).toBe(PALETTE.surface.paper);
    expect(tokens.get('--dv-primary-deep')).toBe(PALETTE.brand.primaryDeep);
    expect(tokens.get('--dv-success-soft')).toBe(PALETTE.feedback.successSoft);
    expect(tokens.get('--dv-mastery-gold')).toBe(PALETTE.mastery.gold);
    expect(tokens.get('--dv-rainbow-7')).toBe(PALETTE.rainbow[6]);
    for (const region of CANONICAL_REGION_IDS) {
      for (const part of ['accent', 'deep', 'soft', 'on-accent']) {
        expect(tokens.has(`--dv-region-${region}-${part}`), `${region} ${part}`).toBe(true);
      }
    }
  });

  it('derive sizes from the SDK child-safe preset', () => {
    expect(tokens.get('--dv-target')).toBe(`${CHILD_SAFE_PRESET.targetPixels}px`);
    expect(tokens.get('--dv-reading')).toBe(`${CHILD_SAFE_PRESET.readingPixels}px`);
    expect(CHILD_SAFE_PRESET.targetPixels).toBeGreaterThanOrEqual(48);
    expect(CHILD_SAFE_PRESET.readingPixels).toBeGreaterThanOrEqual(24);
  });

  it('are the only custom properties the stylesheets and components read', () => {
    const sources = [
      ...files(join('src', 'app', 'styles'), '.css'),
      ...files(join('src', 'app'), '.ts'),
    ];
    const unknown = new Set<string>();
    for (const path of sources) {
      for (const match of readFileSync(path, 'utf8').matchAll(/var\((--[a-z0-9-]+)[,)]/g)) {
        const name = match[1]!;
        if (!tokens.has(name) && !LOCAL.has(name)) unknown.add(`${path}: ${name}`);
      }
    }
    expect([...unknown]).toEqual([]);
  });

  it('keep raw colors out of the stylesheets, except the pre-boot splash and the backdrop', () => {
    const offenders: string[] = [];
    for (const path of files(join('src', 'app', 'styles'), '.css')) {
      const css = readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\.dv-splash[\s\S]*?\n}\n/g, '')
        .replace(/::backdrop\s*{[^}]*}/g, '')
        .replace(/var\(--[a-z0-9-]+,\s*#[0-9a-fA-F]{3,8}\)/g, '');
      for (const match of css.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)) {
        offenders.push(`${path}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
