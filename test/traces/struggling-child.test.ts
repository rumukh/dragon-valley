/**
 * Golden trace: a struggling child plays Sunny Meadow over two days.
 *
 * The child misses the first three placement problems, then about two answers in five, answers
 * slowly (9 s), and makes a mistake on every minigame board before solving it. Its answers to
 * facts are slow; a story's answer has its reading time on top (docs/design.md §6.2), so the
 * same 9 s is not slow there. Day 1: the
 * placement check, Sunny Meadow 1 and 2. Day 2: snack time, then Sunny Meadow 3-6 and the Bridge
 * Troll. The design's kindness rules (docs/design.md §1, §5, §6.5) must hold throughout: no
 * failing, no lost coins, dragons that never shrink, gentle stops and capped re-asks, and a boss
 * that cannot be lost.
 *
 * Named checks first; the golden hash and trajectory are change detectors checked last.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { ContentPack } from '@aegis/runtime';
import { dragonValleyAdapter } from '../../src/rules/adapter';
import { DRAGON_STAGES, dayNumber } from '../../src/rules/contract';
import type { ContentData, GameView } from '../../src/rules/contract';
import { Player, loadPack, trajectoryDigest } from './support';
import type { Adapter, Style } from './support';

// Whole sessions are replayed here, one commit at a time with the full content pack: give them
// room on a busy machine (Vitest's default is 60 s per test).
vi.setConfig({ testTimeout: 300_000 });

/** Golden values: see first-session.test.ts for their provenance rules. */
const GOLDEN_HASH = 'f20541f07514aa4f';
const GOLDEN_TRAJECTORY = '34b42df73f0cbadd';

const SEED = 'golden-struggling-child';
const STRUGGLING: Style = {
  right: (n) => n > 3 && n % 5 !== 1 && n % 5 !== 3,
  elapsedMs: () => 9000,
  clumsy: true,
};
const DAY_ONE = '2026-10-06';
const DAY_TWO = '2026-10-07';

interface Observation {
  player: Player;
  stages: Record<string, string>[];
  placementAnswers: number;
  day1Hatched: string[];
  final: GameView;
}

async function playStruggling(
  adapter: Adapter = dragonValleyAdapter,
  seed = SEED,
  pack: ContentPack<ContentData> = loadPack(),
): Promise<Observation> {
  const player = new Player(STRUGGLING, seed, adapter, pack);
  const observation: Observation = {
    player,
    stages: [],
    placementAnswers: 0,
    day1Hatched: [],
    final: player.view(),
  };
  const level = async (id: string) => {
    await player.playLevel(id);
    observation.stages.push(Object.fromEntries(player.view().dragons.map((d) => [d.id, d.stage])));
  };
  await player.act({ type: 'startSession', day: DAY_ONE });
  await player.choose(null);
  await player.choose('goldie');
  await player.act({ type: 'startActivity', activity: { kind: 'placement' } });
  await player.playRound();
  observation.placementAnswers = player.answered;
  await player.act({ type: 'endRound', reason: 'done' });
  await level('sunny-meadow.1');
  await level('sunny-meadow.2');
  observation.day1Hatched = player
    .data('dragon.hatched')
    .map((e) => (e as { dragon: string }).dragon);
  await player.act({ type: 'startSession', day: DAY_TWO });
  if (player.view().hub.next.kind === 'snack') {
    await player.act({ type: 'startActivity', activity: { kind: 'snack', dragon: null } });
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
  }
  for (const id of ['sunny-meadow.3', 'sunny-meadow.4', 'sunny-meadow.5', 'sunny-meadow.6']) {
    await level(id);
  }
  await player.act({ type: 'startLevel', level: 'sunny-meadow.boss' });
  await player.settleStory();
  await player.playRound();
  await player.act({ type: 'endRound', reason: 'done' });
  await player.settleStory();
  observation.final = player.view();
  return observation;
}

function checks(o: Observation): Record<string, boolean> {
  const p = o.player;
  const state = p.state();
  const rank = (stage: string) => DRAGON_STAGES.indexOf(stage as (typeof DRAGON_STAGES)[number]);
  const reasksPerRound = new Map<string, number>();
  let round = '';
  for (const event of p.events) {
    if (event.type === 'round.started') round = (event.data as { round: string }).round;
    if (event.type === 'reask.scheduled') {
      reasksPerRound.set(round, (reasksPerRound.get(round) ?? 0) + 1);
    }
  }
  const slowPromotions = p.events.filter(
    (e) =>
      e.type === 'answer.correct' &&
      (e.data as { bucket: string }).bucket === 'slow' &&
      p.events.some(
        (f) =>
          f.type === 'item.promoted' &&
          f.revision === e.revision &&
          (f.data as { item: string }).item === (e.data as { item: string }).item,
      ),
  );
  const earned = p
    .data('coins.earned')
    .reduce((sum: number, e) => sum + (e as { amount: number }).amount, 0);
  const right = p.data('answer.correct') as { item: string; bucket: string }[];
  const stories = right.filter((e) => e.item.startsWith('word:'));
  const completed = p.data('level.completed') as { level: string; stars: number }[];
  const stickerDays = new Set(Object.values(state.stickers).map((s) => s.day));
  return {
    'every step was accepted at the expected logical turn': p.failures.length === 0,
    'the placement check stopped gently after three misses in a row':
      o.placementAnswers === 3 &&
      JSON.stringify(p.data('placement.completed')) === '[{"placed":[]}]' &&
      state.onboarding.placement === 'done',
    'no item was re-asked more than twice in one round': [...reasksPerRound.values()].every(
      (count) => count <= 2,
    ),
    'misses were re-asked at all': p.count('reask.scheduled') > 0,
    'every right answer of the slow child to a fact was recorded as slow': right
      .filter((e) => !e.item.startsWith('word:'))
      .every((e) => e.bucket === 'slow'),
    'its right answers to stories had time to read (design §6.2), so none was slow':
      stories.length > 0 && stories.every((e) => e.bucket !== 'slow'),
    'a slow right answer never moved a box up':
      slowPromotions.length === 0 && p.data('answer.correct').length > 0,
    'no answer ever cost a coin (the wallet is all that was earned)':
      o.final.coins === earned && p.count('item.purchased') === 0,
    'dragons never shrank': o.stages.every((stages, i) =>
      i === 0
        ? true
        : Object.entries(o.stages[i - 1]!).every(([id, stage]) => rank(stages[id]!) >= rank(stage)),
    ),
    'the chosen egg still hatched on the first day': o.day1Hatched[0] === 'goldie',
    'every level was completed, none failed':
      completed.length === 7 && completed.every((c) => c.stars >= 1),
    'low accuracy meant one star, never a lock': completed.some((c) => c.stars === 1),
    'the troll could not be lost':
      JSON.stringify(p.data('boss.defeated')) === '[{"boss":"bridge-troll"}]',
    'a sticker was earned on each day':
      stickerDays.has(dayNumber(DAY_ONE)!) && stickerDays.has(dayNumber(DAY_TWO)!),
  };
}

const failedChecks = (o: Observation) =>
  Object.entries(checks(o))
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

describe('golden trace: a struggling child in Sunny Meadow', () => {
  // The scenario runs once; both tests read the same observation.
  let main: ReturnType<typeof playStruggling> | undefined;
  const scenario = () => (main ??= playStruggling());
  afterAll(async () => (await main)?.player.dispose());

  it('keeps every kindness rule while the child struggles', async () => {
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
  it('unlimited re-asks break the re-ask cap check', async () => {
    const pack: ContentPack<ContentData> = JSON.parse(JSON.stringify(loadPack()));
    pack.data.balance.reask.maxPerRound = 10;
    const observation = await playStruggling(dragonValleyAdapter, SEED, pack);
    expect(failedChecks(observation)).toContain(
      'no item was re-asked more than twice in one round',
    );
    await observation.player.dispose();
  });

  it('timing every answer as quick breaks the slow-answer checks', async () => {
    const quick: Adapter = {
      ...dragonValleyAdapter,
      commands: dragonValleyAdapter.commands.map((rule) =>
        rule.id !== 'answer'
          ? rule
          : {
              ...rule,
              start(context, pending) {
                rule.start!(context, {
                  ...pending,
                  payload: { ...(pending.payload as object), elapsedMs: 1000 },
                });
              },
            },
      ),
    };
    const observation = await playStruggling(quick);
    const failed = failedChecks(observation);
    expect(failed).toContain('every right answer of the slow child to a fact was recorded as slow');
    await observation.player.dispose();
  });

  it('without the reading time its story answers are slow again', async () => {
    const pack: ContentPack<ContentData> = JSON.parse(JSON.stringify(loadPack()));
    delete pack.data.balance.response.word;
    const observation = await playStruggling(dragonValleyAdapter, SEED, pack);
    expect(failedChecks(observation)).toContain(
      'its right answers to stories had time to read (design §6.2), so none was slow',
    );
    await observation.player.dispose();
  });

  it('the golden hash and trajectory detect a run with a different seed', async () => {
    const reseeded = await playStruggling(dragonValleyAdapter, `${SEED}-other`);
    expect(reseeded.player.host.hash()).not.toBe(GOLDEN_HASH);
    expect(trajectoryDigest(reseeded.player.hashes)).not.toBe(GOLDEN_TRAJECTORY);
    await reseeded.player.dispose();
  });
});
