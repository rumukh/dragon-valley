import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_DRAGON_IDS,
  CANONICAL_REGION_IDS,
  COSMETIC_SLOTS,
  DRAGON_EXPRESSIONS,
  DRAGON_STAGES,
  KEEPER_AVATARS,
  isContentId,
} from '../../../src/rules/contract/ids';
import {
  ANIMATIONS_CSS,
  buildCatalog,
  catalogIds,
  renderAvatar,
  renderDragon,
  renderIcon,
} from '../../../src/app/art';
import { checkChildSafe } from './svg-check';

type Catalog = ReturnType<typeof buildCatalog> & {
  dragons: Array<{ id: string; recipe: string; homeRegion: string; table?: number }>;
  characters: Array<{ id: string }>;
  cosmetics: Array<{ id: string; slot: string; name: string }>;
  avatars: Array<{ id: string }>;
  icons: Record<string, string[]>;
  regions: Array<{ id: string; emblem: string }>;
};

const committed = JSON.parse(readFileSync('assets/art/catalog.json', 'utf8')) as Catalog;

describe('art catalog', () => {
  it('is up to date with the generators (npm run art:build)', () => {
    expect(committed).toEqual(buildCatalog());
    expect(readFileSync('src/app/art/dragon/animations.css', 'utf8')).toBe(ANIMATIONS_CSS);
  });

  it('lists the closed vocabularies of the contract exactly', () => {
    expect(committed.dragonStages).toEqual([...DRAGON_STAGES]);
    expect(committed.dragonExpressions).toEqual([...DRAGON_EXPRESSIONS]);
    expect(committed.cosmeticSlots).toEqual([...COSMETIC_SLOTS]);
    expect(committed.avatars.map((a) => a.id)).toEqual([...KEEPER_AVATARS]);
    expect(committed.regions.map((r) => r.id)).toEqual([...CANONICAL_REGION_IDS]);
  });

  it('covers every canonical dragon, with a recipe file and a home region', () => {
    expect(committed.dragons.map((d) => d.id).sort()).toEqual([...CANONICAL_DRAGON_IDS].sort());
    for (const d of committed.dragons) {
      expect(statSync(d.recipe).isFile(), d.recipe).toBe(true);
      expect((CANONICAL_REGION_IDS as readonly string[]).includes(d.homeRegion), d.id).toBe(true);
    }
    const tables = committed.dragons.filter((d) => d.table !== undefined).map((d) => d.table);
    expect(tables.sort((a, b) => a! - b!)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('uses unique, well-formed content ids', () => {
    const ids: string[] = [];
    ids.push(...committed.dragons.map((d) => d.id), ...committed.characters.map((c) => c.id));
    ids.push(...committed.cosmetics.map((c) => c.id), ...committed.avatars.map((a) => a.id));
    for (const list of Object.values(committed.icons)) ids.push(...list);
    for (const id of ids) expect(isContentId(id), id).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(catalogIds(committed).has('hat-wizard')).toBe(true);
  });

  it('renders every catalog id', () => {
    for (const c of committed.cosmetics) {
      checkChildSafe(
        renderDragon({ dragon: 'bubbles', stage: 'youngling', outfit: { [c.slot]: c.id } }),
      );
    }
    for (const list of Object.values(committed.icons))
      for (const id of list) checkChildSafe(renderIcon(id, { idPrefix: 'i' }));
    for (const a of committed.avatars) checkChildSafe(renderAvatar(a.id, { idPrefix: 'a' }));
    for (const r of committed.regions)
      expect(Object.values(committed.icons).flat()).toContain(r.emblem);
    for (const c of committed.characters)
      checkChildSafe(renderDragon({ dragon: c.id, stage: 'adult' }));
  });

  it('keeps every recipe file referenced by the catalog', () => {
    const files = readdirSync('assets/art/dragons').filter(
      (f) => f.endsWith('.json') && !f.includes('schema'),
    );
    const referenced = new Set(
      [...committed.dragons, ...committed.characters].map((d) => `${d.id}.json`),
    );
    expect(new Set(files)).toEqual(referenced);
  });

  it('stays within the art size budget', () => {
    let total = 0;
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const s = statSync(p);
        if (s.isDirectory()) walk(p);
        else total += s.size;
      }
    };
    walk('assets/art');
    walk('assets/backgrounds');
    expect(total).toBeLessThan(3 * 1024 * 1024);
  });
});
