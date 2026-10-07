/**
 * The Daily Adventure (docs/design.md §4.2) as the hub's `next` step, and replaying one activity
 * of a finished level (`startLevel { level, activity }`): the step that brings a minigame into a
 * day that had none, without completing the level again. Pacing: after the day's first level, a
 * further new level only while today's success is at least 70 %; below it the Daily Adventure
 * reviews (snacks for hungry dragons, else a replay of a finished level's activity).
 */
import { describe, expect, it } from 'vitest';
import { PERFECT, Player } from '../../traces/support';
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
    expect(player.view().hub.next, 'still reviewing').toEqual(review);

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
});
