/**
 * Rule facts (× 0, × 1, 0 : n, n : 1) and the focus egg in played rounds: a round that is not
 * about them serves at most one, and warms the eggs of the tables it practises. The scenario is
 * the one a playtest flagged: a strong child chooses the sunny egg (×5), passes the placement
 * check (which brings the Puff and Mirror eggs) and plays Sunny Meadow 1.
 */
import { describe, expect, it } from 'vitest';
import { isRuleFact } from '../../../src/rules/learning/selection';
import { PERFECT, Player } from '../../traces/support';

async function strongChild(): Promise<Player> {
  const player = new Player(PERFECT, 'rule-facts');
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('sunny');
  await player.act({ type: 'startActivity', activity: { kind: 'placement' } });
  await player.playRound();
  await player.act({ type: 'endRound', reason: 'done' });
  return player;
}

/** Items of each problem a level serves, and the Egg Grid products, as the child meets them. */
async function playLevel(player: Player, level: string) {
  const items: string[] = [];
  const products: number[] = [];
  const seen = new Set<string>();
  player.host.subscribeCommits(({ view }) => {
    const round = view.round;
    if (round?.type === 'problems' && round.problem) {
      const key = `${round.id}:${round.problem.index}`;
      if (!seen.has(key)) items.push(round.problem.item);
      seen.add(key);
    } else if (
      round?.type === 'minigame' &&
      round.status === 'active' &&
      round.current.kind === 'egg-grid'
    ) {
      const key = `${round.id}:${round.board}`;
      if (!seen.has(key)) products.push(round.current.product);
      seen.add(key);
    }
  });
  await player.playLevel(level);
  return { items, products };
}

describe('rule facts and the focus egg', () => {
  it('keep a round of twos, fives and tens on its tables: one rule fact at most', async () => {
    const player = await strongChild();
    expect(Object.keys(player.state().dragons)).toEqual(expect.arrayContaining(['puff', 'mirror']));
    const { items, products } = await playLevel(player, 'sunny-meadow.1');
    expect(items, 'eight problems').toHaveLength(8);
    expect(items.filter(isRuleFact).length, items.join(' ')).toBeLessThanOrEqual(1);
    expect(
      player.view().dragons.find((d) => d.id === 'puff')?.stage,
      'Puff does not hatch on stray zeros',
    ).toBe('egg');
    expect(products, 'three Egg Grid boards').toHaveLength(3);
    expect(
      products.every((p, i) => i === 0 || p > products[i - 1]!),
      `boards go from easy to hard: ${products.join(' → ')}`,
    ).toBe(true);
    await player.dispose();
  });

  it('still practise the rules in the level about zeros and ones', async () => {
    const player = await strongChild();
    await player.act({
      type: 'setSetting',
      setting: { key: 'unlockAhead', value: ['sunny-meadow'] },
    });
    const { items } = await playLevel(player, 'sunny-meadow.3');
    expect(items.filter(isRuleFact).length, items.join(' ')).toBeGreaterThanOrEqual(3);
    await player.dispose();
  });
});
