/**
 * The boss challenge: a mood meter that only fills, the kindness cap (a boss cannot be lost) and
 * the spaced review share. These tests open the boss level from the start in a copy of the pack
 * (and, for the review share, give the boss division skills only) to reach it quickly.
 */
import { describe, expect, it } from 'vitest';
import type { ContentPack } from '@aegis/runtime';
import type { ContentData } from '../../../src/rules/contract';
import { PERFECT, Player, loadPack } from '../../traces/support';
import type { Style } from '../../traces/support';

function bossFirst(patch: (data: ContentData) => void = () => {}): ContentPack<ContentData> {
  const pack: ContentPack<ContentData> = JSON.parse(JSON.stringify(loadPack()));
  const boss = pack.data.levels.find((l) => l.id === 'sunny-meadow.boss')!;
  boss.unlock.after = [];
  patch(pack.data);
  return pack;
}

async function child(style: Style, pack = bossFirst()): Promise<Player> {
  const player = new Player(style, 'boss', undefined, pack);
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('bubbles');
  return player;
}

const meter = (player: Player) => {
  const round = player.view().round;
  return round?.type === 'problems' ? round.progress.meter : null;
};

describe('the Bridge Troll', () => {
  it('fills the laughing meter with right answers only, and never lowers it', async () => {
    const player = await child({ ...PERFECT, right: (n) => n % 3 !== 0 });
    await player.act({ type: 'startLevel', level: 'sunny-meadow.boss' });
    await player.settleStory();
    expect(meter(player)).toEqual({ value: 0, target: 15 });
    const values: number[] = [];
    while (player.view().round?.status === 'active') {
      await player.answer();
      values.push(meter(player)!.value);
    }
    expect(
      values.every((v, i) => i === 0 || v >= values[i - 1]!),
      'the meter never drops',
    ).toBe(true);
    expect(values[values.length - 1]).toBe(15);
    expect(player.data('boss.defeated')).toEqual([{ boss: 'bridge-troll' }]);
    await player.dispose();
  });

  it('cannot be lost: after the problem cap the meter fills and the troll laughs anyway', async () => {
    const player = await child({ ...PERFECT, right: () => false });
    await player.act({ type: 'startLevel', level: 'sunny-meadow.boss' });
    await player.settleStory();
    await player.playRound();
    expect(player.answered, 'the kindness cap: 20 problems').toBe(20);
    expect(meter(player), 'filled with a final flourish').toEqual({ value: 15, target: 15 });
    expect(player.data('boss.defeated')).toEqual([{ boss: 'bridge-troll' }]);
    expect(player.data('level.completed')).toEqual([
      { level: 'sunny-meadow.boss', stars: 1, firstTime: true },
    ]);
    expect(player.data('coins.earned')).toContainEqual({ amount: 30, reason: 'boss' });
    expect(player.view().story?.beat, 'the outro beat follows').toBe('beat.troll-laughs');
    expect(player.state().coins).toBeGreaterThan(0);
    await player.dispose();
  });

  it('mixes in spaced review of facts from outside the boss’s own skills', async () => {
    const review = bossFirst((data) => {
      data.levels.find((l) => l.id === 'sunny-meadow.boss')!.activities[0]!.skills = ['div-2-5-10'];
      data.bosses[0]!.reviewShare = 100;
    });
    const player = await child(PERFECT, review);
    await player.playLevel('sunny-meadow.1');
    await player.act({ type: 'startLevel', level: 'sunny-meadow.boss' });
    await player.settleStory();
    const served: string[] = [];
    while (player.view().round?.status === 'active') {
      const round = player.view().round;
      if (round?.type === 'problems' && round.problem) served.push(round.problem.item);
      await player.answer();
    }
    expect(served.length).toBe(15);
    expect(
      served.every((id) => id.startsWith('mul:')),
      'review draws are known × facts',
    ).toBe(true);

    const none = bossFirst((data) => {
      data.levels.find((l) => l.id === 'sunny-meadow.boss')!.activities[0]!.skills = ['div-2-5-10'];
      data.bosses[0]!.reviewShare = 0;
    });
    const other = await child(PERFECT, none);
    await other.playLevel('sunny-meadow.1');
    await other.act({ type: 'startLevel', level: 'sunny-meadow.boss' });
    await other.settleStory();
    const own: string[] = [];
    while (other.view().round?.status === 'active') {
      const round = other.view().round;
      if (round?.type === 'problems' && round.problem) own.push(round.problem.item);
      await other.answer();
    }
    expect(
      own.every((id) => id.startsWith('div:')),
      'no review: only the boss’s skills',
    ).toBe(true);
    await player.dispose();
    await other.dispose();
  });
});
