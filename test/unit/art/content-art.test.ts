/**
 * Content and art agree beyond ids. `npm run validate:content -- --strict-art` checks that every
 * art id in the content pack exists somewhere in assets/art/catalog.json. These tests render each
 * reference in the role the pack gives it, so an id of the wrong kind fails here: a boss id as a
 * background, a region id as a sticker icon, a hat in the neck slot, or another table's dragon.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ContentData } from '../../../src/rules/contract';
import {
  BOSS_MOOD,
  BOSS_STATES,
  DRAGON_STAGES,
  cosmeticById,
  renderBoss,
  renderCosmeticIcon,
  renderDragon,
  renderSticker,
  type StickerFrame,
} from '../../../src/app/art';
import { checkChildSafe } from './svg-check';

const content = (
  JSON.parse(readFileSync('content/dragon-valley.content.json', 'utf8')) as { data: ContentData }
).data;
const catalog = JSON.parse(readFileSync('assets/art/catalog.json', 'utf8')) as {
  dragons: Array<{ id: string; kind: string; table?: number }>;
  backgrounds: Array<{ id: string; kind: string }>;
};

describe('content pack art references', () => {
  it('give every region a region scene (with the battle layout)', () => {
    for (const r of content.regions) {
      const bg = catalog.backgrounds.find((b) => b.id === r.background);
      expect(bg?.kind, `region ${r.id} background "${r.background}"`).toBe('region');
    }
  });

  it('give every dragon the rig drawn for its kind and table', () => {
    for (const d of content.dragons) {
      const rig = catalog.dragons.find((x) => x.id === d.rig);
      expect([rig?.kind, rig?.table ?? null], `dragon ${d.id} rig "${d.rig}"`).toEqual([
        d.kind,
        d.table,
      ]);
      for (const stage of DRAGON_STAGES)
        checkChildSafe(renderDragon({ dragon: d.rig, stage, idPrefix: 'cd' }));
    }
  });

  it('end every boss in the mood its won pose shows', () => {
    for (const b of content.bosses) {
      expect(BOSS_MOOD[b.id], `boss ${b.id} mood`).toBe(b.mood);
      for (const state of BOSS_STATES) checkChildSafe(renderBoss(b.id, state, { idPrefix: 'cb' }));
    }
  });

  it('put every cosmetic in the slot its art is drawn for, on every content dragon', () => {
    for (const c of content.cosmetics) {
      expect(cosmeticById(c.assetId)?.slot, `cosmetic ${c.id} asset "${c.assetId}"`).toBe(c.slot);
      checkChildSafe(renderCosmeticIcon(c.assetId, { idPrefix: 'cc' }));
      for (const d of content.dragons)
        checkChildSafe(
          renderDragon({
            dragon: d.rig,
            stage: 'youngling',
            outfit: { [c.slot]: c.assetId },
            idPrefix: 'co',
          }),
        );
    }
  });

  it('compose every sticker from its frame, color and icon', () => {
    for (const s of content.stickers) {
      let svg = '';
      expect(() => {
        svg = renderSticker({
          frame: s.frame as StickerFrame,
          color: s.color,
          icon: s.icon,
          idPrefix: 'cs',
        });
      }, `sticker ${s.id}`).not.toThrow();
      checkChildSafe(svg);
    }
  });
});
