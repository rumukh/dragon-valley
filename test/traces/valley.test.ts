/**
 * The whole valley, end to end: a capable child plays every level of the v1 content in map order,
 * from the first egg to the Seven-Headed Dragon, with the real generators and boards. It proves
 * the content is playable as shipped: every level completes, no activity of any level is skipped
 * (every board can be dealt and solved, every problem generated and answered), every boss is won
 * over, every dragon hatches and the finale is reached.
 *
 * Named checks only: the per-region traces pin golden hashes; this one guards the content.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { PERFECT, Player, loadPack } from './support';

const data = loadPack().data;
const regionOrder = new Map(data.regions.map((r) => [r.id, r.order]));
const LEVELS = [...data.levels]
  .sort((a, b) => regionOrder.get(a.region)! - regionOrder.get(b.region)! || a.order - b.order)
  .map((level) => level.id);

interface Observation {
  player: Player;
  /** Activities whose round never started or did not finish, by level. */
  skipped: string[];
}

async function playValley(): Promise<Observation> {
  const player = new Player({ ...PERFECT, right: (n) => n % 17 !== 0 }, 'valley');
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('goldie');
  const skipped: string[] = [];
  let day = 6;
  for (const [i, id] of LEVELS.entries()) {
    // A new day every few levels, as a child would play.
    if (i > 0 && i % 4 === 0) {
      day += 1;
      await player.act({ type: 'startSession', day: `2026-10-${String(day).padStart(2, '0')}` });
    }
    await player.playLevel(id);
    const results = player.state().levels[id];
    if (!results || results.stars < 1) skipped.push(`${id}: not completed`);
  }
  return { player, skipped };
}

function checks(o: Observation): Record<string, boolean> {
  const p = o.player;
  const completed = new Set(p.data('level.completed').map((e) => (e as { level: string }).level));
  const finishedActivities = p.count('round.completed');
  const activities = data.levels.reduce((sum, l) => sum + l.activities.length, 0);
  return {
    'every step was accepted': p.failures.length === 0,
    'every level of the valley was completed, in map order': LEVELS.every((id) =>
      completed.has(id),
    ),
    'no activity of any level was skipped': finishedActivities >= activities,
    'every boss was won over': data.bosses.every((b) => p.state().bosses[b.id] !== undefined),
    'the finale was reached once': p.count('finale.completed') === 1,
    'every dragon hatched': data.dragons.every((d) => {
      const stage = p.state().dragons[d.id]?.stage;
      return stage !== undefined && stage !== 'egg';
    }),
    'every region opened': p.view().hub.regions.every((r) => r.unlocked),
  };
}

describe('the whole valley as shipped', () => {
  let main: Promise<Observation> | undefined;
  const scenario = () => (main ??= playValley());
  afterAll(async () => (await main)?.player.dispose());

  it('can be played from the first egg to the finale', { timeout: 900_000 }, async () => {
    const observation = await scenario();
    const failed = Object.entries(checks(observation))
      .filter(([, ok]) => !ok)
      .map(([name]) => name);
    expect(failed, [...observation.player.failures, ...observation.skipped].join('; ')).toEqual([]);
  });
});
