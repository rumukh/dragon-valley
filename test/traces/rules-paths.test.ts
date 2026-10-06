/**
 * Rules paths beyond the golden traces: the edges a code review found broken in the walking
 * skeleton, kept as named regressions on the full rules.
 */
import { describe, expect, it } from 'vitest';
import { blockedRecent } from '../../src/rules/learning/selection';
import { PERFECT, Player } from './support';

async function session(seed = 'paths'): Promise<Player> {
  const player = new Player(PERFECT, seed);
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('bubbles');
  return player;
}

describe('rules paths', () => {
  it('rejects ending a round that is not timed on time, so no level completes unplayed', async () => {
    const player = await session();
    await player.act({ type: 'startLevel', level: 'sunny-meadow.1' });
    await player.settleStory();
    expect(await player.reject({ type: 'endRound', reason: 'time-up' }, 'not-timed')).toBe(true);
    expect(player.view().hub.regions[0]!.levels[0]!.stars).toBe(0);
    await player.dispose();
  });

  it('keeps a quit round out of the level result and lets the child finish later', async () => {
    const player = await session();
    await player.act({ type: 'startLevel', level: 'sunny-meadow.1' });
    await player.settleStory();
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
    await player.act({ type: 'startActivity', activity: { kind: 'level', index: 1 } });
    await player.answer();
    await player.act({ type: 'endRound', reason: 'quit' });
    expect(player.count('level.completed')).toBe(0);
    expect(player.view().run?.next).toBe(1);
    await player.act({ type: 'startActivity', activity: { kind: 'level', index: 1 } });
    await player.playRound();
    expect(player.count('level.completed')).toBe(1);
    await player.dispose();
  });

  it("unlocks the gift when the parent lowers the goal below today's right answers", async () => {
    const player = await session();
    await player.playLevel('sunny-meadow.1');
    await player.playLevel('sunny-meadow.2');
    expect(player.view().daily!.correct, 'two levels of Feeding Time: 8 + 10').toBe(18);
    expect(player.view().daily!.gift).toBe('locked');
    await player.act({ type: 'setSetting', setting: { key: 'dailyGoal', value: 15 } });
    expect(player.view().daily!.gift).toBe('ready');
    expect(player.count('daily.goal-reached')).toBe(1);
    await player.act({ type: 'openGift' });
    expect(player.count('gift.opened')).toBe(1);
    await player.dispose();
  });

  it('does not complete a finished level again when an activity is replayed', async () => {
    const player = await session();
    await player.act({ type: 'startLevel', level: 'sunny-meadow.1' });
    await player.settleStory();
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
    await player.act({ type: 'startActivity', activity: { kind: 'level', index: 1 } });
    await player.playRound();
    expect(player.count('level.completed')).toBe(1);
    await player.act({ type: 'startActivity', activity: { kind: 'level', index: 0 } });
    await player.playRound();
    expect(player.view().round?.status, 'the replayed Egg Grid was played').toBe('complete');
    expect(player.count('level.completed')).toBe(1);
    expect(player.state().levels['sunny-meadow.1']?.plays).toBe(1);
    await player.dispose();
  });

  it('plays the activities of a level in order', async () => {
    const player = await session();
    await player.act({ type: 'startLevel', level: 'sunny-meadow.1' });
    await player.settleStory();
    await player.act({ type: 'endRound', reason: 'quit' });
    expect(
      await player.reject(
        { type: 'startActivity', activity: { kind: 'level', index: 1 } },
        'locked-activity',
      ),
    ).toBe(true);
    await player.dispose();
  });

  it('blocks no recent items when noRepeatWithin is 0', () => {
    expect(blockedRecent(['a', 'b', 'c'], 0)).toEqual([]);
    expect(blockedRecent(['a', 'b', 'c'], 2)).toEqual(['b', 'c']);
  });
});
