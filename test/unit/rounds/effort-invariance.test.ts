/**
 * The effort path changes what the child sees and how dragons grow, never what is asked
 * (docs/design.md §6.5): scheduling reads the Leitner box, not the mastery level. The same child,
 * answering the same way on the same days with the same seed, is asked exactly the same problems,
 * the same way, with and without `balance.mastery.effort`, and its boxes and review days end up
 * the same. Only the counts, the panes and the dragons differ.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ContentPack } from '@aegis/runtime';
import type { ContentData, GameView, ItemState } from '../../../src/rules/contract';
import { Player, loadPack } from '../../traces/support';
import type { Style } from '../../traces/support';

// Six sessions are replayed twice with the full content pack: room on a busy machine.
vi.setConfig({ testTimeout: 300_000 });

/** The pack without the effort path, as content 1.2.0 and earlier shipped it. */
const plain = JSON.parse(JSON.stringify(loadPack())) as ContentPack<ContentData>;
delete plain.data.balance.mastery.effort;
const effort = JSON.parse(JSON.stringify(plain)) as ContentPack<ContentData>;
effort.data.balance.mastery.effort = { bronzeDays: 2, silverDays: 4, gapDays: 2 };

/** A steady child: right but slow (12 s), and every seventh answer wrong. */
const STEADY: Style = { right: (n) => n % 7 !== 3, elapsedMs: () => 12_000, clumsy: false };

/** Everything the rules decided for the child, in order. */
interface Played {
  /** Every problem as first shown: the item, how it is asked and with which choices. */
  served: unknown[];
  /** What the Daily Adventure offered, before each activity. */
  offered: GameView['hub']['next'][];
  /** Each item's scheduling record: box, review day, counts and recent buckets. */
  leitner: Record<string, Omit<ItemState, 'rightDays' | 'lastCountedDay'>>;
  items: Record<string, ItemState>;
  view: GameView;
}

async function play(pack: ContentPack<ContentData>): Promise<Played> {
  const player = new Player(STEADY, 'effort-invariance', undefined, pack);
  const served: unknown[] = [];
  const offered: GameView['hub']['next'][] = [];
  const seen = new Set<string>();
  player.host.subscribeCommits(({ view }) => {
    const round = view.round;
    if (round?.type !== 'problems' || !round.problem) return;
    const p = round.problem;
    const key = `${round.id}:${p.index}:${p.step}`;
    if (seen.has(key)) return;
    seen.add(key);
    served.push({
      round: round.id,
      item: p.item,
      step: p.step,
      input: p.input,
      problem: p.problem,
      choices: p.choices,
      reask: p.reask,
      teach: p.teach ?? false,
    });
  });
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('bubbles');
  offered.push(player.view().hub.next);
  await player.playLevel('sunny-meadow.1');
  await player.playLevel('sunny-meadow.2');
  // Every other day: what the Daily Adventure offers, a few steps.
  for (const day of ['2026-10-08', '2026-10-10', '2026-10-12', '2026-10-14', '2026-10-16']) {
    await player.act({ type: 'startSession', day });
    for (let step = 0; step < 4; step++) {
      await player.settleStory();
      const next = player.view().hub.next;
      offered.push(next);
      if (next.kind === 'snack') {
        await player.act({
          type: 'startActivity',
          activity: { kind: 'snack', dragon: next.dragon },
        });
        await player.playRound();
        await player.act({ type: 'endRound', reason: 'done' });
      } else if (next.kind === 'level') await player.playLevel(next.level);
      else break;
    }
  }
  expect(player.failures).toEqual([]);
  const items = structuredClone(player.state().items);
  const leitner = Object.fromEntries(
    Object.entries(items).map(([item, record]) => {
      const { rightDays: _days, lastCountedDay: _day, ...rest } = record;
      return [item, rest];
    }),
  );
  const view = player.view();
  await player.dispose();
  return { served, offered, leitner, items, view };
}

const lit = (view: GameView) =>
  [...view.window.cells, ...view.window.division].filter((cell) => cell.level !== 'dim').length;

describe('the effort path and what the child is asked', () => {
  // Both runs play once; every check reads the same two.
  let runs: Promise<[Played, Played]> | undefined;
  const both = () => (runs ??= Promise.all([play(plain), play(effort)]));

  it('asks the same problems, the same way, and offers the same activities', async () => {
    const [without, withEffort] = await both();
    expect(without.served.length, 'six sessions of problems').toBeGreaterThan(150);
    expect(withEffort.served, 'every problem, its input and its choices').toEqual(without.served);
    expect(withEffort.offered, "the Daily Adventure's offers").toEqual(without.offered);
  });

  it('keeps the boxes and review days the same', async () => {
    const [without, withEffort] = await both();
    expect(withEffort.leitner).toEqual(without.leitner);
    expect(
      Object.values(without.items).some((r) => r.rightDays !== undefined),
      'no counts',
    ).toBe(false);
  });

  it('changes what the child sees: counts, lit panes and growing dragons', async () => {
    const [without, withEffort] = await both();
    const counted = Object.values(withEffort.items).filter((r) => (r.rightDays ?? 0) >= 2);
    expect(counted.length, 'facts right on two counted days or more').toBeGreaterThan(10);
    expect(lit(withEffort.view), 'more panes lit').toBeGreaterThan(lit(without.view));
  });
});
