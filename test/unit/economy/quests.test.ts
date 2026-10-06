/**
 * Daily quests: drawing, progress, completion, claims and the next-day payout. Targets and
 * coins are read from content.quests by hand.
 */
import { describe, expect, it } from 'vitest';
import type { ContentPack } from '@aegis/runtime';
import { PERFECT, Player, loadPack } from '../../traces/support';
import type { ContentData, QuestView } from '../../../src/rules/contract';

const pack = loadPack();

async function today(seed: string): Promise<Player> {
  const player = new Player(PERFECT, seed);
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('sunny');
  return player;
}

describe('drawing the daily quests', () => {
  it('draws three quests with different goals, never one that is still locked', async () => {
    const goals = new Map<string, number>();
    for (let seed = 0; seed < 60; seed++) {
      const player = await today(`quests-${seed}`);
      const quests = player.view().daily!.quests;
      expect(quests).toHaveLength(3);
      expect(new Set(quests.map((q) => q.goal)).size).toBe(3);
      expect(
        quests.map((q) => q.template),
        'snack quests wait for a hungry dragon',
      ).not.toContain('snack-5');
      expect(quests.every((q) => q.id === `${q.template}@20732`)).toBe(true);
      for (const q of quests) goals.set(q.template, (goals.get(q.template) ?? 0) + 1);
      await player.dispose();
    }
    // Weighted: streak-8 has half the weight of the others.
    expect(goals.get('streak-8')!).toBeLessThan(goals.get('correct-20')!);
    expect(goals.size).toBe(5);
  });

  it('never draws two quests with the same goal, even when templates share one', async () => {
    const pack: ContentPack<ContentData> = JSON.parse(JSON.stringify(loadPack()));
    pack.data.quests.push({ ...pack.data.quests[0]!, id: 'correct-40', target: 40, weight: 100 });
    for (let seed = 0; seed < 25; seed++) {
      const player = new Player(PERFECT, `same-goal-${seed}`, undefined, pack);
      await player.act({ type: 'startSession', day: '2026-10-06' });
      const goals = player.view().daily!.quests.map((q) => q.goal);
      expect(new Set(goals).size, goals.join()).toBe(goals.length);
      await player.dispose();
    }
  });
});

function quest(player: Player, template: string): QuestView | undefined {
  return player.view().daily!.quests.find((q) => q.template === template);
}

/** A seed whose first day draws the correct-answers quest (found by trying seeds in order). */
async function withCorrectQuest(): Promise<Player> {
  for (let seed = 0; ; seed++) {
    const player = await today(`claim-${seed}`);
    if (quest(player, 'correct-20')) return player;
    await player.dispose();
  }
}

describe('quest progress and claims', () => {
  it('counts right answers, completes once at the target and pays when claimed', async () => {
    const player = await withCorrectQuest();
    const template = pack.data.quests.find((q) => q.id === 'correct-20')!;
    await player.playLevel('sunny-meadow.1');
    expect(quest(player, 'correct-20')!.progress, 'eight right answers').toBe(8);
    expect(
      await player.reject(
        { type: 'claimQuest', quest: quest(player, 'correct-20')!.id },
        'quest-not-done',
      ),
    ).toBe(true);
    await player.playLevel('sunny-meadow.2');
    await player.playLevel('sunny-meadow.3');
    const done = quest(player, 'correct-20')!;
    expect(done).toMatchObject({ progress: 20, done: true, claimed: false });
    expect(player.data('quest.completed')).toContainEqual({ quest: done.id });
    expect(
      player.data('quest.completed').filter((e) => JSON.stringify(e).includes('correct-20')),
    ).toHaveLength(1);
    const coins = player.view().coins;
    await player.act({ type: 'claimQuest', quest: done.id });
    expect(player.view().coins).toBe(coins + template.coins);
    expect(player.data('quest.claimed')).toContainEqual({ quest: done.id, coins: template.coins });
    expect(player.state().questsClaimed).toBe(1);
    expect(await player.reject({ type: 'claimQuest', quest: done.id }, 'quest-claimed')).toBe(true);
    expect(
      await player.reject({ type: 'claimQuest', quest: 'correct-20@1' }, 'unknown-quest'),
    ).toBe(true);
    await player.dispose();
  });

  it('pays a finished but unclaimed quest when the next day starts', async () => {
    const player = await withCorrectQuest();
    await player.playLevel('sunny-meadow.1');
    await player.playLevel('sunny-meadow.2');
    await player.playLevel('sunny-meadow.3');
    const done = quest(player, 'correct-20')!;
    expect(done.done && !done.claimed).toBe(true);
    const coins = player.view().coins;
    await player.act({ type: 'startSession', day: '2026-10-07' });
    expect(player.data('quest.claimed')).toContainEqual({ quest: done.id, coins: 10 });
    expect(player.view().coins).toBeGreaterThanOrEqual(coins + 10);
    expect(player.view().daily!.quests.every((q) => q.id.endsWith('@20733'))).toBe(true);
    await player.dispose();
  });
});
