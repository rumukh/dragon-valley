/**
 * Dragon Castle: the parent's unlock-ahead, the Seven-Headed Dragon won over one head at a time,
 * and the finale. The tests open Dragon Castle ahead (as a parent can) to reach the finale boss
 * quickly; the head test gives the seven heads seven different times tables so that every served
 * fact can be traced to its head by the test's own arithmetic.
 */
import { describe, expect, it } from 'vitest';
import type { ContentPack } from '@aegis/runtime';
import type { ContentData } from '../../../src/rules/contract';
import { PERFECT, Player, loadPack } from '../../traces/support';

const DAY = 20732; // 2026-10-06

async function child(pack?: ContentPack<ContentData>): Promise<Player> {
  const player = new Player(PERFECT, 'castle', undefined, pack);
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('goldie');
  return player;
}

async function unlockCastle(player: Player): Promise<void> {
  await player.act({
    type: 'setSetting',
    setting: { key: 'unlockAhead', value: ['dragon-castle'] },
  });
}

const castle = (player: Player) => player.view().hub.regions.find((r) => r.id === 'dragon-castle')!;

describe('unlocking a region ahead (parent area)', () => {
  it('opens every level of the region at once; the map keeps its own order', async () => {
    const player = await child();
    expect(castle(player).unlocked).toBe(false);
    expect(
      await player.reject({ type: 'startLevel', level: 'dragon-castle.boss' }, 'locked-level'),
    ).toBe(true);
    await unlockCastle(player);
    expect(castle(player).unlocked).toBe(true);
    expect(castle(player).levels.map((l) => l.status)).toEqual(['open', 'open', 'open', 'open']);
    expect(castle(player).boss).toMatchObject({ id: 'seven-headed', heads: 7, defeated: false });
    expect(
      player.view().hub.regions.find((r) => r.id === 'fire-mountain')!.unlocked,
      'only the chosen region',
    ).toBe(false);
    expect(await player.act({ type: 'startLevel', level: 'dragon-castle.boss' })).toBe(true);
    await player.dispose();
  });
});

describe('the Seven-Headed Dragon', () => {
  it('is won over one head after another, each head with its own kind of problem', async () => {
    const pack: ContentPack<ContentData> = JSON.parse(JSON.stringify(loadPack()));
    const tables = [2, 3, 4, 5, 6, 7, 8];
    const boss = pack.data.levels.find((l) => l.id === 'dragon-castle.boss')!;
    boss.activities[0]!.skills = tables.map((t) => `mul-${t}`);
    const player = await child(pack);
    await unlockCastle(player);
    await player.act({ type: 'startLevel', level: 'dragon-castle.boss' });
    await player.settleStory();
    const heads: number[] = [];
    while (player.view().round?.status === 'active') {
      const round = player.view().round;
      if (round?.type !== 'problems' || !round.problem) break;
      const [a, b] = round.problem.item.slice(4).split('x').map(Number) as [number, number];
      const head = (round.progress.meter!.value - (round.progress.meter!.value % 3)) / 3;
      expect([a, b], `answer ${heads.length + 1} is for head ${head + 1}`).toContain(tables[head]);
      heads.push(head);
      await player.answer();
    }
    expect(heads, 'three right answers cure each head, in order').toEqual(
      tables.flatMap((_, head) => [head, head, head]),
    );
    expect(player.data('boss.defeated')).toEqual([{ boss: 'seven-headed' }]);
    await player.dispose();
  });

  it('is the finale: the dragon hatches, the finale story plays and the sticker is earned once', async () => {
    const player = await child();
    await unlockCastle(player);
    expect(player.view().dragons.map((d) => d.id)).not.toContain('seven-headed');
    await player.act({ type: 'startLevel', level: 'dragon-castle.boss' });
    await player.settleStory();
    const strands = ['mul:', 'div:', 'rem:', 'mul2d1d:', 'order:', 'compare:', 'word:'];
    const served: string[] = [];
    for (let guard = 0; guard < 80 && player.view().round?.status === 'active'; guard++) {
      const round = player.view().round;
      if (round?.type !== 'problems' || !round.problem) break;
      const value = round.progress.meter!.value;
      const head = (value - (value % 3)) / 3;
      const label = `problem ${round.problem.index} (head ${head + 1}): ${round.problem.item}`;
      if (!served.includes(label)) served.push(label);
      expect(round.problem.item.startsWith(strands[head]!), label).toBe(true);
      await player.answer();
    }
    expect(served, 'seven heads, three problems each').toHaveLength(21);
    await player.act({ type: 'endRound', reason: 'done' });
    await player.settleStory();
    expect(player.count('answer.correct'), 'twenty-one right answers fill the meter').toBe(21);
    expect(player.data('boss.defeated')).toEqual([{ boss: 'seven-headed' }]);
    expect(player.data('finale.completed')).toEqual([{}]);
    expect(player.data('egg.received')).toContainEqual({ dragon: 'seven-headed' });
    expect(player.data('dragon.hatched')).toContainEqual({ dragon: 'seven-headed' });
    expect(player.state().finale.day).toBe(DAY);
    expect(player.view().dragons.find((d) => d.id === 'seven-headed')).toMatchObject({
      kind: 'finale',
      stage: 'hatchling',
    });
    expect(player.state().stickers['seven-heads-cured']).toEqual({ day: DAY });
    expect(player.state().cosmetics.owned).toContain('gold-medal');
    expect(castle(player).boss).toMatchObject({ defeated: true });

    const beats = player.data('story.advanced').map((e) => (e as { beat: string }).beat);
    expect(beats, 'the finale story is told').toContain('beat.finale');

    await player.playLevel('dragon-castle.boss');
    expect(player.data('finale.completed'), 'a replay is just a replay').toHaveLength(1);
    expect(
      player.data('dragon.hatched').filter((e) => JSON.stringify(e).includes('seven')),
    ).toHaveLength(1);
    await player.dispose();
  });
});
