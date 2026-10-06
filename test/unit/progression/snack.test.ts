/**
 * Snack time: hungry dragons and their due facts across days. Hunger is read from the rules'
 * own definition in docs/design.md §6.5: a hatched dragon with a due fact is hungry; a fact
 * practised today is not due again today.
 */
import { describe, expect, it } from 'vitest';
import { snackTarget } from '../../../src/rules/progression/snack';
import { PERFECT, Player } from '../../traces/support';

/** A child who hatched Bubbles in Sunny Meadow 1 on day one. */
async function hatched(): Promise<Player> {
  const player = new Player(PERFECT, 'snack');
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('bubbles');
  await player.playLevel('sunny-meadow.1');
  return player;
}

describe('snack time', () => {
  it('serves one problem per due fact, never fewer than 6 or more than 10', () => {
    expect([0, 2, 6, 7, 10, 25].map(snackTarget)).toEqual([6, 6, 6, 7, 10, 10]);
  });

  it('has no hungry dragon on the day the facts were practised', async () => {
    const player = await hatched();
    expect(player.data('dragon.hatched')).toEqual([{ dragon: 'bubbles' }]);
    expect(player.view().hub.hungry).toEqual([]);
    expect(player.view().dragons.find((d) => d.id === 'bubbles')).toMatchObject({
      hungry: false,
      dueItems: 0,
    });
    expect(
      await player.reject(
        { type: 'startActivity', activity: { kind: 'snack', dragon: null } },
        'not-hungry',
      ),
    ).toBe(true);
    await player.dispose();
  });

  it('makes the dragon hungry the next day and opens the day with snack time', async () => {
    const player = await hatched();
    await player.act({ type: 'startSession', day: '2026-10-07' });
    const bubbles = player.view().dragons.find((d) => d.id === 'bubbles')!;
    expect(bubbles.hungry).toBe(true);
    expect(bubbles.dueItems).toBeGreaterThan(0);
    expect(player.view().hub.hungry).toContain('bubbles');
    expect(player.view().hub.next).toEqual({ kind: 'snack', dragon: null });
    await player.dispose();
  });

  it('serves the due facts first, 6 to 10 problems, then the dragon is fed', async () => {
    const player = await hatched();
    await player.act({ type: 'startSession', day: '2026-10-07' });
    const day = player.state().day!;
    const due = new Set(
      Object.entries(player.state().items)
        .filter(([, item]) => item.correct > 0 && item.due <= day && item.lastDay < day)
        .map(([id]) => id),
    );
    await player.act({ type: 'startActivity', activity: { kind: 'snack', dragon: 'bubbles' } });
    const round = player.view().round;
    if (round?.type !== 'problems') throw new Error('a snack is a problem round');
    const bubblesDue = new Set([...due].filter((id) => /x2$|^mul:2x/.test(id)));
    expect(bubblesDue.size).toBeGreaterThan(0);
    expect(round.progress.target).toBe(Math.min(10, Math.max(6, bubblesDue.size)));
    expect(round.source).toEqual({ kind: 'snack', dragon: 'bubbles' });
    const served: string[] = [];
    while (player.view().round?.status === 'active') {
      const now = player.view().round;
      if (now?.type !== 'problems' || !now.problem) break;
      served.push(now.problem.item);
      await player.answer();
    }
    const first = served.slice(0, Math.min(served.length, bubblesDue.size));
    expect(
      first.every((id) => bubblesDue.has(id)),
      'due facts come first',
    ).toBe(true);
    expect(player.view().dragons.find((d) => d.id === 'bubbles')!.hungry).toBe(false);
    expect(player.view().hub.hungry).toEqual([]);
    await player.dispose();
  });

  it('only feeds a dragon that is hungry', async () => {
    const player = await hatched();
    await player.act({ type: 'startSession', day: '2026-10-07' });
    expect(
      await player.reject(
        { type: 'startActivity', activity: { kind: 'snack', dragon: 'goldie' } },
        'unknown-dragon',
      ),
    ).toBe(true);
    await player.dispose();
  });
});
