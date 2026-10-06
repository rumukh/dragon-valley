/**
 * Minigame rounds inside a level run: boards one after another, stale and illegal moves,
 * credits and coins per board, quitting, and a restore in the middle of a board.
 */
import { describe, expect, it } from 'vitest';
import { createRuntimeHost } from '@aegis/runtime';
import { dragonValleyAdapter } from '../../../src/rules/adapter';
import type { MinigameRoundView } from '../../../src/rules/contract';
import { PERFECT, Player, loadPack } from '../../traces/support';

async function atEggGrid(): Promise<Player> {
  const player = new Player(PERFECT, 'minigames');
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('goldie');
  await player.act({ type: 'startLevel', level: 'sunny-meadow.1' });
  await player.settleStory();
  return player;
}

const round = (player: Player) => player.view().round as MinigameRoundView;

describe('a minigame round', () => {
  it('starts Sunny Meadow 1 with three Egg Grid boards for the egg’s own table', async () => {
    const player = await atEggGrid();
    const view = round(player);
    expect(view).toMatchObject({ type: 'minigame', activity: 'egg-grid', board: 0, boards: 3 });
    expect(view.current.kind).toBe('egg-grid');
    if (view.current.kind !== 'egg-grid') return;
    expect(view.current.product % 10, 'the Goldie egg warms with ×10 facts').toBe(0);
    expect(view.minigame.revision).toBe(0);
    await player.dispose();
  });

  it('rejects stale and impossible moves without changing anything', async () => {
    const player = await atEggGrid();
    const before = player.hashes.length;
    expect(
      await player.reject(
        { type: 'minigameMove', revision: 5, move: { type: 'submit' } },
        'stale-move',
      ),
    ).toBe(true);
    expect(
      await player.reject(
        { type: 'minigameMove', revision: 0, move: { type: 'set', rows: 0, columns: 4 } },
        'invalid-move',
      ),
    ).toBe(true);
    expect(
      await player.reject(
        { type: 'minigameMove', revision: 0, move: { type: 'jump' } },
        'invalid-move',
      ),
    ).toBe(true);
    expect(player.hashes.length, 'no commit for a rejected move').toBe(before);
    await player.dispose();
  });

  it('moves to the next board when one is finished and ends the round after the last', async () => {
    const player = await atEggGrid();
    const first = round(player).minigame.definition;
    await player.playBoard();
    expect(player.data('minigame.completed')).toEqual([{ round: round(player).id, board: 1 }]);
    expect(round(player).board).toBe(1);
    expect(round(player).minigame.definition).not.toBe(first);
    expect(round(player).minigame.revision, 'a fresh board').toBe(0);
    await player.playBoard();
    await player.playBoard();
    expect(player.count('minigame.completed')).toBe(3);
    expect(round(player).status).toBe('complete');
    expect(player.view().run?.next, 'the run moves on to Feeding Time').toBe(1);
    expect(player.view().screen).toBe('results');
    await player.dispose();
  });

  it('pays a coin for each rectangle found and credits the round’s facts', async () => {
    const player = await atEggGrid();
    const coins = player.view().coins;
    const view = round(player).current;
    if (view.kind !== 'egg-grid') throw new Error('egg grid expected');
    const tens = (n: number) => n % 10 === 0;
    await player.playBoard();
    const after = player.view().coins;
    expect(after - coins, 'one coin per rectangle').toBe(view.find);
    const credited = player.data('item.promoted').map((e) => (e as { item: string }).item);
    expect(credited.length).toBeGreaterThan(0);
    for (const item of credited) {
      const [a, b] = item.slice(4).split('x').map(Number);
      expect(a! * b!, `${item} makes the board's product`).toBe(view.product);
      expect([2, 5, 10].includes(a!) || [2, 5, 10].includes(b!), `${item} is in the round`).toBe(
        true,
      );
    }
    expect(tens(view.product)).toBe(true);
    await player.dispose();
  });

  it('keeps what was earned when the child quits, and leaves the activity to finish later', async () => {
    const player = await atEggGrid();
    await player.playBoard();
    const coins = player.view().coins;
    await player.act({ type: 'endRound', reason: 'quit' });
    expect(player.view().coins).toBe(coins);
    expect(player.view().round).toBeNull();
    expect(player.view().run).toMatchObject({ next: 0 });
    expect(player.count('round.completed')).toBe(1);
    expect(player.count('level.completed')).toBe(0);
    await player.dispose();
  });

  it('restores in the middle of a board and plays on to the same result', async () => {
    const player = await atEggGrid();
    const view = round(player).current;
    if (view.kind !== 'egg-grid') throw new Error('egg grid expected');
    await player.move({ type: 'set', rows: 2, columns: 3 });
    await player.move({ type: 'submit' });
    const snapshot = player.host.snapshot();
    const copy = createRuntimeHost({
      adapter: dragonValleyAdapter,
      content: loadPack(),
      seed: 'other',
    });
    const restored = await copy.restore(JSON.parse(JSON.stringify(snapshot)));
    expect(restored.ok).toBe(true);
    expect(copy.getView().round).toEqual(player.view().round);
    const move = {
      type: 'minigameMove' as const,
      revision: round(player).minigame.revision,
      move: { type: 'set', rows: 1, columns: 1 },
    };
    await player.act(move);
    await copy.dispatch(move);
    expect(copy.getView()).toEqual(player.view());
    await copy.dispose();
    await player.dispose();
  });

  it('answers a move with no board to play with no-board', async () => {
    const player = new Player(PERFECT, 'no-board');
    await player.act({ type: 'startSession', day: '2026-10-06' });
    expect(
      await player.reject(
        { type: 'minigameMove', revision: 0, move: { type: 'submit' } },
        'no-board',
      ),
    ).toBe(true);
    await player.dispose();
  });
});
