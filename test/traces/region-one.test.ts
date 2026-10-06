/**
 * Golden trace: a capable child plays the whole of Sunny Meadow over two days.
 *
 * Day 1 (2026-10-06): skip the prologue, choose the bubbly blue egg (×2), go straight to the map
 * (the placement check is skipped), play Sunny Meadow 1-3, claim finished quests, buy a straw hat
 * and put it on Bubbles. Day 2: snack time for the hungry dragons, then Sunny Meadow 4-6 and the
 * Bridge Troll, the daily gift and the quests. Every thirteenth answer is wrong; answers are fast.
 *
 * Named checks first; the golden hash and trajectory are change detectors checked last.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { success } from '@aegis/runtime';
import { dragonValleyAdapter } from '../../src/rules/adapter';
import { DRAGON_STAGES } from '../../src/rules/contract';
import type { GameView } from '../../src/rules/contract';
import { PERFECT, Player, trajectoryDigest } from './support';
import type { Adapter } from './support';

/** Golden values: see first-session.test.ts for their provenance rules. */
const GOLDEN_HASH = '30cea0c9f7de4622';
const GOLDEN_TRAJECTORY = '34c1577d43e627f2';

const SEED = 'golden-region-one';
const LEVELS = [
  'sunny-meadow.1',
  'sunny-meadow.2',
  'sunny-meadow.3',
  'sunny-meadow.4',
  'sunny-meadow.5',
  'sunny-meadow.6',
  'sunny-meadow.boss',
];

interface Observation {
  player: Player;
  /** Dragon stages after every level, in order. */
  stages: Record<string, string>[];
  /** Hub views at key moments. */
  day2Next: GameView['hub']['next'] | null;
  snackItems: string[];
  arenaBeforeBoss: boolean;
  beatAtBossStart: string | null;
  final: GameView;
}

async function claimAll(player: Player): Promise<void> {
  for (const quest of player.view().daily?.quests ?? []) {
    if (quest.done && !quest.claimed) await player.act({ type: 'claimQuest', quest: quest.id });
  }
}

async function playRegion(adapter: Adapter = dragonValleyAdapter, seed = SEED) {
  const player = new Player({ ...PERFECT, right: (n) => n % 13 !== 0 }, seed, adapter);
  const observation: Observation = {
    player,
    stages: [],
    day2Next: null,
    snackItems: [],
    arenaBeforeBoss: false,
    beatAtBossStart: null,
    final: player.view(),
  };
  const level = async (id: string) => {
    if (id === 'sunny-meadow.boss') {
      observation.arenaBeforeBoss = player.view().hub.arena.available;
      await player.act({ type: 'startLevel', level: id });
      observation.beatAtBossStart = player.view().story?.beat ?? null;
      await player.settleStory();
      await player.playRound();
      await player.act({ type: 'endRound', reason: 'done' });
      await player.settleStory();
    } else {
      await player.playLevel(id);
    }
    observation.stages.push(Object.fromEntries(player.view().dragons.map((d) => [d.id, d.stage])));
  };
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('bubbles');
  for (const id of LEVELS.slice(0, 3)) await level(id);
  await claimAll(player);
  await player.act({ type: 'buy', item: 'hat-straw' });
  await player.act({ type: 'equip', dragon: 'bubbles', slot: 'head', item: 'hat-straw' });

  await player.act({ type: 'startSession', day: '2026-10-07' });
  observation.day2Next = player.view().hub.next;
  await player.act({ type: 'startActivity', activity: { kind: 'snack', dragon: null } });
  for (let guard = 0; guard < 20; guard++) {
    const round = player.view().round;
    if (round?.type !== 'problems' || round.status !== 'active' || !round.problem) break;
    observation.snackItems.push(round.problem.item);
    await player.answer();
  }
  await player.act({ type: 'endRound', reason: 'done' });
  for (const id of LEVELS.slice(3)) await level(id);
  if (player.view().daily?.gift === 'ready') await player.act({ type: 'openGift' });
  await claimAll(player);
  observation.final = player.view();
  return observation;
}

function checks(o: Observation): Record<string, boolean> {
  const p = o.player;
  const state = p.state();
  const completed = p.data('level.completed').map((e) => (e as { level: string }).level);
  const activities = p.data('round.started').map((e) => (e as { activity: string }).activity);
  const eggs = p.data('egg.received').map((e) => (e as { dragon: string }).dragon);
  const hatchedAt = p.events.find((e) => e.type === 'dragon.hatched');
  const firstLevelAt = p.events.find((e) => e.type === 'level.completed');
  const earned = p
    .data('coins.earned')
    .reduce((sum: number, e) => sum + (e as { amount: number }).amount, 0);
  const spent = p
    .data('item.purchased')
    .reduce((sum: number, e) => sum + (e as { price: number }).price, 0);
  const rank = (stage: string) => DRAGON_STAGES.indexOf(stage as (typeof DRAGON_STAGES)[number]);
  const neverShrank = o.stages.every((stages, i) =>
    i === 0
      ? true
      : Object.entries(o.stages[i - 1]!).every(([id, stage]) => rank(stages[id]!) >= rank(stage)),
  );
  const count = (kind: string) => activities.filter((a) => a === kind).length;
  return {
    'every step was accepted at the expected logical turn': p.failures.length === 0,
    'going straight to the map skipped the placement check':
      state.onboarding.placement === 'skipped' && p.count('placement.completed') === 0,
    'all seven Sunny Meadow levels were completed, in map order':
      JSON.stringify(completed) === JSON.stringify(LEVELS),
    'every Region 1 minigame was played (Egg Grid, Memory Match, Number Trail, Fact Family)':
      count('egg-grid') === 2 &&
      count('memory-match') === 2 &&
      count('number-trail') === 1 &&
      count('fact-family') === 1 &&
      p.count('minigame.completed') === 3 + 1 + 1 + 2 + 3 + 1,
    'the eggs arrived as designed: the choice, then levels 2 and 3':
      JSON.stringify(eggs) === '["bubbles","sunny","goldie","mirror","puff"]',
    'the first egg hatched before the first level was over':
      hatchedAt !== undefined &&
      firstLevelAt !== undefined &&
      hatchedAt.revision <= firstLevelAt.revision &&
      JSON.stringify(hatchedAt.data) === '{"dragon":"bubbles"}',
    'every Region 1 dragon hatched':
      o.final.dragons.length === 5 && o.final.dragons.every((d) => d.stage !== 'egg'),
    'dragons never shrank': neverShrank,
    'day two opened with snack time for the hungry dragons':
      o.day2Next?.kind === 'snack' && o.snackItems.length >= 6,
    'the troll was introduced, laughed, and left his party hat':
      o.beatAtBossStart === 'beat.bridge-troll' &&
      JSON.stringify(p.data('boss.defeated')) === '[{"boss":"bridge-troll"}]' &&
      state.story.done.includes('beat.troll-laughs') &&
      state.cosmetics.owned.includes('hat-party'),
    'the Lightning Arena opened only after the troll':
      !o.arenaBeforeBoss && o.final.hub.arena.available,
    'quests were claimed and the daily gift was opened':
      p.count('quest.claimed') >= 2 && p.count('gift.opened') === 1,
    'the Region 1 stickers were earned': [
      'first-hatch',
      'meadow-first-steps',
      'streak-ten',
      'first-outfit',
      'troll-giggles',
    ].every((id) => state.stickers[id] !== undefined),
    'Bubbles wears the straw hat':
      o.final.dragons.find((d) => d.id === 'bubbles')?.outfit.head === 'hat-straw',
    'the wallet is everything earned minus everything bought': o.final.coins === earned - spent,
  };
}

const failedChecks = (o: Observation) =>
  Object.entries(checks(o))
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

describe('golden trace: the whole of Sunny Meadow', () => {
  // The scenario runs once; both tests read the same observation.
  let main: ReturnType<typeof playRegion> | undefined;
  const scenario = () => (main ??= playRegion());
  afterAll(async () => (await main)?.player.dispose());

  it('plays Region 1 with every named capability intact', async () => {
    const observation = await scenario();
    expect(failedChecks(observation), observation.player.failures.join('; ')).toEqual([]);
  });

  it('matches the pinned golden hash and trajectory', async () => {
    const observation = await scenario();
    expect(observation.player.host.hash(), 'final state hash (GOLDEN_HASH)').toBe(GOLDEN_HASH);
    expect(
      trajectoryDigest(observation.player.hashes),
      'commit trajectory (GOLDEN_TRAJECTORY)',
    ).toBe(GOLDEN_TRAJECTORY);
  });
});

describe('mutation checks: the named checks fail when a capability breaks', () => {
  it('boards that take no moves break the minigame and level checks', async () => {
    const stuck: Adapter = {
      ...dragonValleyAdapter,
      resolve(action, read) {
        if (action.type === 'minigameMove') {
          return { ok: false, error: { code: 'invalid-move', messageKey: 'x', diagnostics: [] } };
        }
        return dragonValleyAdapter.resolve(action, read);
      },
    };
    const observation = await playRegion(stuck);
    const failed = failedChecks(observation);
    expect(failed).toContain(
      'every Region 1 minigame was played (Egg Grid, Memory Match, Number Trail, Fact Family)',
    );
    expect(failed).toContain('all seven Sunny Meadow levels were completed, in map order');
    await observation.player.dispose();
  });

  it('a day that never changes leaves the dragons full and day two without snacks', async () => {
    const sameDay: Adapter = {
      ...dragonValleyAdapter,
      resolve(action, read) {
        const fixed = action.type === 'startSession' ? { ...action, day: '2026-10-06' } : action;
        const plan = dragonValleyAdapter.resolve(fixed, read);
        return plan.ok ? success({ ...plan.value, payload: fixed }) : plan;
      },
    };
    const observation = await playRegion(sameDay);
    expect(failedChecks(observation)).toContain(
      'day two opened with snack time for the hungry dragons',
    );
    await observation.player.dispose();
  });

  it('the golden hash and trajectory detect a run with a different seed', async () => {
    const reseeded = await playRegion(dragonValleyAdapter, `${SEED}-other`);
    expect(reseeded.player.host.hash()).not.toBe(GOLDEN_HASH);
    expect(trajectoryDigest(reseeded.player.hashes)).not.toBe(GOLDEN_TRAJECTORY);
    await reseeded.player.dispose();
  });
});
