/**
 * The placement check: the ladder rules (pure) and the check as a child plays it. Expected
 * placements are read off content.placement by hand: step 1 (×2 and ×5) places Sunny Meadow 2,
 * step 2 (×0, ×1, ×10) places 3, step 3 (÷2, ÷5, ÷10) places 4, step 4 (missing factors) places 5.
 */
import { describe, expect, it } from 'vitest';
import { advanceLadder, ladderDone } from '../../../src/rules/progression/ladder';
import type { Placement, PlacementProgress } from '../../../src/rules/contract';
import { PERFECT, Player } from '../../traces/support';

const ladder: Placement = {
  steps: [
    { skill: 'a', problems: 2, passAccuracy: 50, levels: ['l1', 'l2'] },
    { skill: 'b', problems: 3, passAccuracy: 100, levels: ['l3'] },
    { skill: 'c', problems: 1, passAccuracy: 100, levels: ['l4'] },
  ],
  minProblems: 0,
  maxProblems: 6,
  stopAfterMisses: 2,
};

function climb(answers: boolean[]): PlacementProgress {
  const progress = { step: 0, stepAsked: 0, stepCorrect: 0, missesInRow: 0, placed: [] };
  for (const correct of answers) advanceLadder(progress, ladder, correct);
  return progress;
}

describe('the placement ladder', () => {
  it('places a step’s levels when its accuracy reaches the pass mark, then climbs', () => {
    expect(climb([true, false])).toMatchObject({ step: 1, placed: ['l1', 'l2'], stepAsked: 0 });
  });

  it('ends at the first step that is not passed, even if a later one would be', () => {
    const progress = climb([true, true, true, false, true, true]);
    expect(progress.placed).toEqual(['l1', 'l2']);
    expect(ladderDone(progress, ladder, 6)).toBe(true);
    expect(progress.step, 'the ladder is over').toBe(3);
  });

  it('stops gently after the allowed misses in a row', () => {
    const progress = climb([false, false]);
    expect(progress.placed).toEqual([]);
    expect(ladderDone(progress, ladder, 2)).toBe(true);
  });

  it('stops at the most problems allowed', () => {
    const progress = climb([true, true, true, true, true]);
    expect(ladderDone(progress, ladder, 5)).toBe(false);
    expect(ladderDone(progress, ladder, 6)).toBe(true);
  });
});

async function newChild(style = PERFECT, seed = 'placement'): Promise<Player> {
  const player = new Player(style, seed);
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('bubbles');
  return player;
}

describe('the placement check as played', () => {
  it('is the Daily Adventure step right after the first egg', async () => {
    const player = await newChild();
    expect(player.view().hub.next).toEqual({ kind: 'placement' });
    await player.dispose();
  });

  it('places every lesson a confident child knows, but never the intro level', async () => {
    const player = await newChild();
    await player.act({ type: 'startActivity', activity: { kind: 'placement' } });
    expect(player.view().round).toMatchObject({ activity: 'placement', input: 'keypad' });
    await player.playRound();
    const levels = player.state().levels;
    expect(player.data('placement.completed')).toEqual([
      { placed: ['sunny-meadow.2', 'sunny-meadow.3', 'sunny-meadow.4', 'sunny-meadow.5'] },
    ]);
    expect(player.answered, 'four steps: 4 + 3 + 3 + 3 problems').toBe(13);
    expect(levels['sunny-meadow.3']).toMatchObject({ stars: 1, placed: true, paidStars: 0 });
    expect(levels['sunny-meadow.1'], 'the intro level is always played').toBeUndefined();
    expect(player.state().onboarding.placement).toBe('done');
    expect(player.count('reask.scheduled'), 'the check never re-asks').toBe(0);
    expect(player.data('coins.earned')).toContainEqual({ amount: 10, reason: 'placement' });
    expect(player.state().stickers['show-what-you-know']).toBeDefined();
    const eggs = player.data('egg.received').map((e) => (e as { dragon: string }).dragon);
    expect(eggs, 'placed levels give their first-time eggs').toEqual([
      'bubbles',
      'sunny',
      'goldie',
      'mirror',
      'puff',
    ]);
    expect(player.state().cosmetics.owned, 'and their cosmetics').toContain('scarf-striped');
    await player.act({ type: 'endRound', reason: 'done' });
    expect(player.view().hub.next).toEqual({ kind: 'level', level: 'sunny-meadow.1' });
    await player.dispose();
  });

  it('warms the chosen egg and counts its facts exactly, without announcing it again', async () => {
    const player = new Player(PERFECT, 'placement-egg');
    await player.act({ type: 'startSession', day: '2026-10-06' });
    await player.choose(null);
    await player.choose('sunny');
    const eggsBefore = player.count('egg.received');
    const served: string[] = [];
    const seen = new Set<string>();
    player.host.subscribeCommits(({ view }) => {
      const round = view.round;
      if (round?.type !== 'problems' || !round.problem) return;
      if (!seen.has(`${round.problem.index}`)) served.push(round.problem.item);
      seen.add(`${round.problem.index}`);
    });
    await player.act({ type: 'startActivity', activity: { kind: 'placement' } });
    await player.playRound();
    const fives = (item: string) => /^mul:(5x\d+|\d+x5)$/.test(item);
    expect(
      [served[0], served[2]].every((item) => item !== undefined && fives(item)),
      `every other problem of the first step is a fact of the sunny egg: ${served.join(' ')}`,
    ).toBe(true);
    const sunny = player.view().dragons.find((d) => d.id === 'sunny')!;
    expect(sunny.next, 'exact counts, not rounded percentages').toEqual({
      stage: 'hatchling',
      share: 30,
      mastery: 'seen',
      have: new Set(served.filter(fives)).size,
      need: 7,
    });
    const eggs = player.data('egg.received').slice(eggsBefore);
    expect(eggs, 'the chosen egg is not announced again').not.toContainEqual({ dragon: 'sunny' });
    expect(eggs).toContainEqual({ dragon: 'bubbles' });
    await player.dispose();
  });

  it('gives no sticker for something the child did not do: Dressed Up waits for dressing', async () => {
    const player = await newChild();
    await player.act({ type: 'startActivity', activity: { kind: 'placement' } });
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
    expect(player.state().cosmetics.owned, 'a placed level gave a scarf').toContain(
      'scarf-striped',
    );
    expect(player.state().stickers['first-outfit'], 'but nobody is dressed yet').toBeUndefined();
    await player.act({ type: 'equip', dragon: 'bubbles', slot: 'neck', item: 'scarf-striped' });
    expect(player.data('sticker.earned')).toContainEqual({ sticker: 'first-outfit' });
    await player.dispose();
  });

  it('stops after three misses in a row and places nothing, kindly', async () => {
    const player = await newChild({ ...PERFECT, right: () => false });
    await player.act({ type: 'startActivity', activity: { kind: 'placement' } });
    await player.playRound();
    expect(player.answered).toBe(3);
    expect(player.data('placement.completed')).toEqual([{ placed: [] }]);
    expect(player.state().onboarding.placement).toBe('done');
    expect(player.view().coins, 'only the check’s own coins').toBe(10);
    await player.dispose();
  });

  it('keeps passed steps and marks the check skipped when the child leaves early', async () => {
    const player = await newChild();
    await player.act({ type: 'startActivity', activity: { kind: 'placement' } });
    for (let i = 0; i < 5; i++) await player.answer();
    await player.act({ type: 'endRound', reason: 'quit' });
    expect(player.data('placement.completed')).toEqual([{ placed: ['sunny-meadow.2'] }]);
    expect(player.state().onboarding.placement).toBe('skipped');
    expect(player.state().levels['sunny-meadow.2']?.placed).toBe(true);
    expect(player.data('coins.earned')).not.toContainEqual({ amount: 10, reason: 'placement' });
    expect(player.view().round).toBeNull();
    await player.dispose();
  });

  it('is skipped when the child goes straight to a level', async () => {
    const player = await newChild();
    await player.act({ type: 'startLevel', level: 'sunny-meadow.1' });
    expect(player.state().onboarding.placement).toBe('skipped');
    expect(player.view().hub.next.kind).not.toBe('placement');
    await player.dispose();
  });

  it('takes placement answers only in the check, and plain answers only outside it', async () => {
    const player = await newChild();
    await player.act({ type: 'startActivity', activity: { kind: 'placement' } });
    const value = { kind: 'number' as const, value: 1 };
    expect(await player.reject({ type: 'answer', value, elapsedMs: 900 }, 'wrong-action')).toBe(
      true,
    );
    await player.act({ type: 'endRound', reason: 'quit' });
    await player.act({ type: 'startLevel', level: 'sunny-meadow.1' });
    await player.settleStory();
    expect(
      await player.reject({ type: 'placementAnswer', value, elapsedMs: 900 }, 'no-problem'),
      'the level starts with a board, not a problem',
    ).toBe(true);
    await player.dispose();
  });
});
