import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_DRAGON_IDS,
  CANONICAL_REGION_IDS,
  GUIDE_ID,
} from '../../../src/rules/contract/ids';
import { PALETTE, paletteColor } from '../../../src/app/art';
import { contrast, isHex } from '../../../src/app/art/svg/color';

describe('master palette', () => {
  it('is the committed assets/art/palette.json', () => {
    const file = JSON.parse(readFileSync('assets/art/palette.json', 'utf8'));
    expect(PALETTE).toEqual(file);
  });

  it('meets every declared accessible pair', () => {
    for (const pair of PALETTE.accessiblePairs) {
      const ratio = contrast(paletteColor(pair.fg), paletteColor(pair.bg));
      expect(ratio, `${pair.fg} on ${pair.bg} (${pair.use})`).toBeGreaterThanOrEqual(pair.min);
    }
  });

  it('gives every region an accent family with accessible text pairs', () => {
    const regions = PALETTE.regions as Record<
      string,
      { accent: string; deep: string; soft: string; onAccent: string }
    >;
    expect(Object.keys(regions)).toEqual([...CANONICAL_REGION_IDS]);
    const paper = PALETTE.surface.paper;
    const ink = PALETTE.ink.ink;
    for (const [id, r] of Object.entries(regions)) {
      for (const c of [r.accent, r.deep, r.soft]) expect(isHex(c), id).toBe(true);
      expect(contrast(r.deep, paper), `${id} deep on paper`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(r.deep, r.soft), `${id} deep on soft`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(ink, r.soft), `${id} ink on soft`).toBeGreaterThanOrEqual(7);
      const on = r.onAccent === 'white' ? '#ffffff' : ink;
      expect(contrast(on, r.accent), `${id} label on accent (large text)`).toBeGreaterThanOrEqual(
        3,
      );
    }
  });

  it('has a signature color for every dragon and seven rainbow colors', () => {
    const sig = PALETTE.dragonSignature as Record<string, string>;
    for (const id of [...CANONICAL_DRAGON_IDS, GUIDE_ID]) expect(isHex(sig[id]), id).toBe(true);
    expect(PALETTE.rainbow).toHaveLength(7);
  });

  it('only contains #rrggbb colors outside the descriptive fields', () => {
    const walk = (v: unknown, path: string): void => {
      if (typeof v === 'string') {
        if (/^#/.test(v)) expect(isHex(v), path).toBe(true);
      } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (v && typeof v === 'object')
        for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(PALETTE, 'palette');
  });
});
