/**
 * The Daily Adventure (docs/design.md §4.2) as the hub's `next` step, and replaying one activity
 * of a finished level (`startLevel { level, activity }`): the step that brings a minigame into a
 * day that had none, without completing the level again. Pacing: after the day's first level, a
 * further new level only while today's success is at least 70 %; below it the Daily Adventure
 * reviews (snacks for hungry dragons, else a replay of an activity of the last finished levels,
 * a different one each time).
 */
import { describe, expect, it } from 'vitest';
import { initialProfileState } from '../../../src/rules/contract';
import { itemIndex } from '../../../src/rules/learning/index-cache';
import { REVIEW_LEVELS, reviewReplay } from '../../../src/rules/view';
import { PERFECT, Player, loadPack } from '../../traces/support';
import type { Style } from '../../traces/support';

/** Every other answer right: well below the 70 % pacing line. */
const UNSURE: Style = { right: (n) => n % 2 === 0, elapsedMs: () => 4000, clumsy: false };

async function child(style: Style = PERFECT): Promise<Player> {
  const player = new Player(style, 'daily');
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('sunny');
  return player;
}

/** Today's success, worked out from the day record. */
function today(player: Player): number {
  const day = player.state().daily!;
  return (100 * day.correct) / day.answers;
}

describe('the Daily Adventure', () => {
  it('goes story, placement, snacks, a level, a minigame for variety, then the next level', async () => {
    const player = await child();
    expect(player.view().hub.next).toEqual({ kind: 'placement' });
    await player.playLevel('sunny-meadow.1');
    expect(player.view().daily).toMatchObject({ answers: 8 });
    expect(player.state().daily).toMatchObject({ levels: 1, minigames: 1 });
    expect(player.view().hub.next, 'the day already had a minigame').toEqual({
      kind: 'level',
      level: 'sunny-meadow.2',
    });

    await player.act({ type: 'startSession', day: '2026-10-07' });
    expect(player.view().hub.next, 'hungry dragons first').toEqual({ kind: 'snack', dragon: null });
    await player.act({ type: 'startActivity', activity: { kind: 'snack', dragon: null } });
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
    expect(player.view().hub.next).toEqual({ kind: 'level', level: 'sunny-meadow.2' });

    // A parent opened Sharing Lake; Missing Pieces has Feeding Time only.
    await player.act({
      type: 'setSetting',
      setting: { key: 'unlockAhead', value: ['sharing-lake'] },
    });
    await player.playLevel('sharing-lake.2');
    expect(player.state().daily).toMatchObject({ levels: 1, minigames: 0 });
    expect(
      player.view().hub.next,
      'a minigame of the furthest finished level that has one',
    ).toEqual({
      kind: 'minigame',
      level: 'sunny-meadow.1',
      activity: 0,
    });

    const before = player.state().levels['sunny-meadow.1'];
    const completed = player.count('level.completed');
    await player.act({ type: 'startLevel', level: 'sunny-meadow.1', activity: 0 });
    expect(player.view().round).toMatchObject({ type: 'minigame', activity: 'egg-grid' });
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
    expect(player.count('level.completed'), 'the level is not completed again').toBe(completed);
    expect(player.state().levels['sunny-meadow.1']).toEqual(before);
    expect(player.view().run, 'the replay leaves no run behind').toBeNull();
    expect(player.state().daily).toMatchObject({ minigames: 1 });
    expect(player.view().hub.next).toEqual({ kind: 'level', level: 'sunny-meadow.2' });
    expect(player.failures).toEqual([]);
    await player.dispose();
  });

  it('replays single activities of finished levels only, and only those that can be played', async () => {
    const player = await child();
    await player.playLevel('sunny-meadow.1');
    expect(
      await player.reject(
        { type: 'startLevel', level: 'sunny-meadow.2', activity: 1 },
        'locked-activity',
      ),
    ).toBe(true);
    expect(
      await player.reject(
        { type: 'startLevel', level: 'sunny-meadow.1', activity: 2 },
        'locked-activity',
      ),
    ).toBe(true);
    expect(await player.act({ type: 'startLevel', level: 'sunny-meadow.1', activity: 1 })).toBe(
      true,
    );
    expect(player.view().round).toMatchObject({ type: 'problems', activity: 'feeding' });
    await player.dispose();
  });

  it('holds new levels after the first while today is below 70 %, and reviews instead', async () => {
    const player = await child(UNSURE);
    await player.playLevel('sunny-meadow.1');
    expect(today(player), 'today is below the pacing line').toBeLessThan(70);
    expect(player.state().daily).toMatchObject({ levels: 1, minigames: 1 });
    // Nothing is due on the day it was practised: the review replays Sunny Meadow 1's Feeding Time.
    const review = { kind: 'minigame', level: 'sunny-meadow.1', activity: 1 };
    expect(player.view().hub.next).toEqual(review);
    await player.act({ type: 'startLevel', level: 'sunny-meadow.1', activity: 1 });
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
    expect(today(player)).toBeLessThan(70);
    // Still reviewing, but not the same activity again: Sunny Meadow 1 has one problem activity,
    // so its Egg Grid takes turns with it.
    expect(player.view().hub.next, 'another review').toEqual({ ...review, activity: 0 });

    // The next day opens with snacks, then the day's first level whatever yesterday was like.
    await player.act({ type: 'startSession', day: '2026-10-07' });
    expect(player.view().hub.next).toEqual({ kind: 'snack', dragon: null });
    await player.act({ type: 'startActivity', activity: { kind: 'snack', dragon: null } });
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
    expect(player.view().hub.next).toEqual({ kind: 'level', level: 'sunny-meadow.2' });
    await player.playLevel('sunny-meadow.2');
    expect(today(player)).toBeLessThan(70);
    expect(player.view().hub.next, 'hungry dragons are the review').toEqual({
      kind: 'snack',
      dragon: null,
    });
    expect(player.failures).toEqual([]);
    await player.dispose();
  });

  it('offers further new levels while today is at 70 % or more', async () => {
    const player = await child({ ...UNSURE, right: (n) => n % 4 !== 0 });
    await player.playLevel('sunny-meadow.1');
    expect(today(player)).toBeGreaterThanOrEqual(70);
    expect(player.view().hub.next).toEqual({ kind: 'level', level: 'sunny-meadow.2' });
    await player.dispose();
  });

  it('continues a level already under way, and keeps every open level playable', async () => {
    const player = await child(UNSURE);
    await player.playLevel('sunny-meadow.1');
    expect(player.view().hub.next).not.toMatchObject({ kind: 'level' });
    // The map still opens Sunny Meadow 2; once begun, the Daily Adventure carries it on.
    await player.act({ type: 'startLevel', level: 'sunny-meadow.2' });
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
    expect(today(player)).toBeLessThan(70);
    expect(player.view().hub.next).toEqual({ kind: 'level', level: 'sunny-meadow.2' });
    expect(player.failures).toEqual([]);
    await player.dispose();
  });

  it('rotates the review over the problem activities of the last three finished levels', async () => {
    const player = await child();
    for (const id of ['sunny-meadow.1', 'sunny-meadow.2', 'sunny-meadow.3', 'sunny-meadow.4']) {
      await player.playLevel(id);
    }
    const data = loadPack().data;
    const state = player.state();
    const at = (roundCounter: number) =>
      reviewReplay({ ...state, roundCounter }, data, itemIndex(data));
    expect(REVIEW_LEVELS).toBe(3);
    // Sunny Meadow 4's Feeding Time (its third activity), then 3's and 2's (their first);
    // Sunny Meadow 1 is four levels back. Minigames and the boss are not reviews.
    const reviews = [
      { level: 'sunny-meadow.4', activity: 2 },
      { level: 'sunny-meadow.3', activity: 0 },
      { level: 'sunny-meadow.2', activity: 0 },
    ];
    expect([0, 1, 2, 3, 4, 5].map(at)).toEqual([...reviews, ...reviews]);
    for (let n = 6; n < 12; n++) {
      expect(at(n + 1), 'two successive reviews differ').not.toEqual(at(n));
    }
    await player.dispose();
  });

  it('never reviews with the boss, and adds minigames while problem activities are few', () => {
    const data = loadPack().data;
    const done = { stars: 1, bestAccuracy: 80, plays: 1, placed: false, paidStars: 1 };
    const base = initialProfileState({ dailyGoal: 30, arena: true });
    const at = (levels: string[], roundCounter: number) =>
      reviewReplay(
        { ...base, roundCounter, levels: Object.fromEntries(levels.map((id) => [id, done])) },
        data,
        itemIndex(data),
      );
    // The boss level, Sunny Meadow 6 (Riddle Scrolls) and 5 (Feeding Time, then Memory Match).
    const last = ['sunny-meadow.5', 'sunny-meadow.6', 'sunny-meadow.boss'];
    expect([0, 1, 2].map((n) => at(last, n))).toEqual([
      { level: 'sunny-meadow.6', activity: 0 },
      { level: 'sunny-meadow.5', activity: 0 },
      { level: 'sunny-meadow.6', activity: 0 },
    ]);
    // Only Sunny Meadow 1: its Feeding Time, then its Egg Grid.
    expect([0, 1].map((n) => at(['sunny-meadow.1'], n))).toEqual([
      { level: 'sunny-meadow.1', activity: 1 },
      { level: 'sunny-meadow.1', activity: 0 },
    ]);
    expect(at([], 0), 'nothing finished yet').toBeNull();
  });
});
