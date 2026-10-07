/**
 * The Daily Adventure (docs/design.md §4.2) as the hub's `next` step, and replaying one activity
 * of a finished level (`startLevel { level, activity }`): the step that brings a minigame into a
 * day that had none, without completing the level again.
 */
import { describe, expect, it } from 'vitest';
import { PERFECT, Player } from '../../traces/support';

async function child(): Promise<Player> {
  const player = new Player(PERFECT, 'daily');
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('sunny');
  return player;
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
});
