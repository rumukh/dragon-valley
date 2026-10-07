/**
 * Sticker criteria added for v1: a share of a skill's items at a mastery level
 * (`skill-mastered`) and a number of dragons of a kind at a stage (`dragons-stage`). Test stickers
 * are added to a copy of the pack; the counts are the test's own (Sunny Meadow 1 serves eight
 * different facts of the 2, 5 and 10 tables, Sunny Meadow 2 brings the other first eggs).
 */
import { describe, expect, it } from 'vitest';
import type { ContentPack } from '@aegis/runtime';
import type { ContentData, StickerCriteria } from '../../../src/rules/contract';
import { PERFECT, Player, loadPack } from '../../traces/support';

function withStickers(criteria: Record<string, StickerCriteria>): ContentPack<ContentData> {
  const pack: ContentPack<ContentData> = JSON.parse(JSON.stringify(loadPack()));
  for (const [id, rule] of Object.entries(criteria)) {
    pack.data.stickers.push({
      id,
      nameKey: 'sticker.first-hatch',
      page: 'sunny-meadow',
      criteria: rule,
      icon: 'egg',
      color: '#ffffff',
      frame: 'frame-round',
    });
  }
  return pack;
}

describe('v1 sticker criteria', () => {
  it('skill-mastered: a share of the skill’s items at a mastery level', async () => {
    const pack = withStickers({
      'test-some-seen': { kind: 'skill-mastered', skill: 'mul-2-5-10', level: 'seen', share: 5 },
      'test-all-seen': { kind: 'skill-mastered', skill: 'mul-2-5-10', level: 'seen', share: 100 },
      'test-some-gold': { kind: 'skill-mastered', skill: 'mul-2-5-10', level: 'gold', share: 5 },
    });
    const player = new Player(PERFECT, 'stickers', undefined, pack);
    await player.act({ type: 'startSession', day: '2026-10-06' });
    await player.choose(null);
    await player.choose('bubbles');
    expect(player.state().stickers['test-some-seen']).toBeUndefined();
    await player.playLevel('sunny-meadow.1');
    const earned = player.state().stickers;
    expect(earned['test-some-seen'], '4 of the 63 facts answered right').toBeDefined();
    expect(earned['test-all-seen'], 'not every fact yet').toBeUndefined();
    expect(earned['test-some-gold'], 'nothing is gold on the first day').toBeUndefined();
    await player.dispose();
  });

  it('dragons-stage: a number of dragons of a kind, or all of them', async () => {
    const pack = withStickers({
      'test-three-eggs': { kind: 'dragons-stage', dragonKind: 'table', stage: 'egg', count: 3 },
      'test-every-egg': { kind: 'dragons-stage', dragonKind: 'table', stage: 'egg', count: null },
      'test-special': { kind: 'dragons-stage', dragonKind: 'special', stage: 'egg', count: 1 },
    });
    const player = new Player(PERFECT, 'stickers', undefined, pack);
    await player.act({ type: 'startSession', day: '2026-10-06' });
    await player.choose(null);
    await player.choose('bubbles');
    await player.playLevel('sunny-meadow.1');
    expect(player.state().stickers['test-three-eggs'], 'one egg so far').toBeUndefined();
    await player.playLevel('sunny-meadow.2');
    const earned = player.state().stickers;
    expect(Object.keys(player.state().dragons).sort()).toEqual(['bubbles', 'goldie', 'sunny']);
    expect(earned['test-three-eggs'], 'three table dragons').toBeDefined();
    expect(earned['test-every-egg'], 'all eleven table dragons').toBeUndefined();
    expect(earned['test-special']).toBeUndefined();
    expect(earned['every-table']).toBeUndefined();
    await player.dispose();
  });
});
