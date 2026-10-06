/**
 * The Lightning Arena: opening after the Bridge Troll, a race of known facts ended by the shell's
 * clock (`time-up`), the personal best, and the parent's switch. The boss level is opened from
 * the start in a copy of the pack to reach the Arena quickly.
 */
import { describe, expect, it } from 'vitest';
import type { ContentPack } from '@aegis/runtime';
import type { ContentData } from '../../../src/rules/contract';
import { PERFECT, Player, loadPack } from '../../traces/support';
import type { Style } from '../../traces/support';

function bossFirst(): ContentPack<ContentData> {
  const pack: ContentPack<ContentData> = JSON.parse(JSON.stringify(loadPack()));
  pack.data.levels.find((l) => l.id === 'sunny-meadow.boss')!.unlock.after = [];
  return pack;
}

async function afterTheTroll(style: Style = PERFECT): Promise<Player> {
  const player = new Player(style, 'arena', undefined, bossFirst());
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('bubbles');
  expect(player.view().hub.arena.available, 'closed before the troll').toBe(false);
  expect(
    await player.reject({ type: 'startActivity', activity: { kind: 'arena' } }, 'arena-locked'),
  ).toBe(true);
  await player.act({ type: 'startLevel', level: 'sunny-meadow.boss' });
  await player.settleStory();
  await player.playRound();
  await player.act({ type: 'endRound', reason: 'done' });
  await player.settleStory();
  return player;
}

/** Answer `count` problems of the race, then the shell's clock runs out. */
async function race(player: Player, count: number): Promise<void> {
  await player.act({ type: 'startActivity', activity: { kind: 'arena' } });
  for (let i = 0; i < count; i++) await player.answer();
  await player.act({ type: 'endRound', reason: 'time-up' });
}

describe('the Lightning Arena', () => {
  it('opens after the Bridge Troll and races the facts the child already knows', async () => {
    const player = await afterTheTroll();
    expect(player.view().hub.arena).toEqual({ available: true, best: 0 });
    const known = new Set(
      Object.entries(player.state().items)
        .filter(([, item]) => item.correct > 0)
        .map(([id]) => id),
    );
    await player.act({ type: 'startActivity', activity: { kind: 'arena' } });
    const round = player.view().round;
    if (round?.type !== 'problems') throw new Error('the Arena is a problem round');
    expect(round).toMatchObject({ activity: 'arena', source: { kind: 'arena' } });
    expect(round.progress.target, 'capped by balance.arena.maxProblems').toBe(60);
    for (let i = 0; i < 8; i++) {
      const now = player.view().round;
      if (now?.type !== 'problems' || !now.problem) break;
      expect(known.has(now.problem.item), `${now.problem.item} was known before`).toBe(true);
      await player.answer();
    }
    await player.dispose();
  });

  it('ends on the shell’s clock and keeps the personal best', async () => {
    const player = await afterTheTroll();
    await race(player, 7);
    expect(player.data('arena.finished')).toEqual([{ score: 7, best: 7, record: true }]);
    expect(player.state().arena).toEqual({ best: 7, plays: 1 });
    await player.act({ type: 'endRound', reason: 'done' });
    await race(player, 4);
    expect(player.data('arena.finished')[1]).toEqual({ score: 4, best: 7, record: false });
    expect(player.view().hub.arena.best).toBe(7);
    await player.dispose();
  });

  it('never re-asks a miss and never costs anything', async () => {
    const player = await afterTheTroll({ ...PERFECT, right: (n) => n < 16 || n % 2 === 0 });
    const coins = player.view().coins;
    await race(player, 6);
    expect(player.count('reask.scheduled')).toBe(0);
    expect(player.view().coins).toBeGreaterThanOrEqual(coins);
    await player.dispose();
  });

  it('does not count a race the child left early', async () => {
    const player = await afterTheTroll();
    await player.act({ type: 'startActivity', activity: { kind: 'arena' } });
    await player.answer();
    await player.act({ type: 'endRound', reason: 'quit' });
    expect(player.count('arena.finished')).toBe(0);
    expect(player.state().arena.plays).toBe(0);
    await player.dispose();
  });

  it('stays closed when the parent switches it off', async () => {
    const player = await afterTheTroll();
    await player.act({ type: 'setSetting', setting: { key: 'arena', value: false } });
    expect(player.view().hub.arena.available).toBe(false);
    expect(
      await player.reject({ type: 'startActivity', activity: { kind: 'arena' } }, 'arena-locked'),
    ).toBe(true);
    await player.dispose();
  });
});
