/**
 * Golden trace: a child's first session.
 *
 * On 2026-10-06 the child skips the prologue, chooses the sunny yellow egg (×5), takes the
 * placement check (knows ×2 and ×5, misses one ×0/×1/×10 problem, so only Sunny Meadow 2 is
 * placed and its Bubbles and Goldie eggs arrive), plays Sunny Meadow 1 (three Egg Grid boards,
 * then eight Feeding Time problems with the second one deliberately wrong), sees the Sunny egg
 * hatch first and the other two after it, buys the flower crown and puts it on Sunny. The
 * design's hook (docs/design.md §4.1): first hatch, first stickers and coins, a hat, and the
 * next level glowing on the map.
 *
 * Named checks come first and say what broke; the golden hash and trajectory are change
 * detectors checked last. Answers come from the harness's independent oracle.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { success } from '@aegis/runtime';
import { dragonValleyAdapter } from '../../src/rules/adapter';
import type { GameView } from '../../src/rules/contract';
import { PERFECT, Player, trajectoryDigest } from './support';
import type { Adapter } from './support';

/**
 * Golden final-state hash and commit trajectory. Captured once from the first green run of this
 * scenario (Windows, Node 24, Aegis SDK 5949a7f, content 1.0.0 with the Region 1 slice) and
 * pinned as literals. Re-pin only for a deliberate rules or content change, with the reason and
 * the old and new values in the commit message (docs/testing.md, "When a golden moves").
 */
const GOLDEN_HASH = '4a85e807d2c3c2fd';
const GOLDEN_TRAJECTORY = '82d63fa1b1405b89';

const SEED = 'golden-first-session';
const PLACEMENT_MISS = 6;
const FEEDING_MISS = 2;
const PLACEMENT_ANSWERS = 7;

interface Observation {
  player: Player;
  nextAfterEgg: GameView['hub']['next'] | null;
  feeding: { item: string; index: number; reask: boolean; input: string }[];
  placementInputs: string[];
  final: GameView;
}

async function playFirstSession(adapter: Adapter = dragonValleyAdapter, seed = SEED) {
  const player = new Player(
    {
      ...PERFECT,
      right: (n) => n !== PLACEMENT_MISS && n !== PLACEMENT_ANSWERS + FEEDING_MISS,
    },
    seed,
    adapter,
  );
  const observation: Observation = {
    player,
    nextAfterEgg: null,
    feeding: [],
    placementInputs: [],
    final: player.view(),
  };
  const ok =
    (await player.act({ type: 'startSession', day: '2026-10-06' })) &&
    (await player.choose(null)) &&
    (await player.choose('sunny'));
  if (ok) {
    observation.nextAfterEgg = player.view().hub.next;
    await player.act({ type: 'startActivity', activity: { kind: 'placement' } });
    for (let guard = 0; guard < 30; guard++) {
      const round = player.view().round;
      if (round?.type !== 'problems' || round.status !== 'active' || !round.problem) break;
      observation.placementInputs.push(round.problem.input);
      if (!(await player.answer())) break;
    }
    await player.act({ type: 'endRound', reason: 'done' });
    await player.act({ type: 'startLevel', level: 'sunny-meadow.1' });
    await player.settleStory();
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
    await player.act({ type: 'startActivity', activity: { kind: 'level', index: 1 } });
    for (let guard = 0; guard < 30; guard++) {
      const round = player.view().round;
      if (round?.type !== 'problems' || round.status !== 'active' || !round.problem) break;
      const { item, index, reask, input } = round.problem;
      observation.feeding.push({ item, index, reask, input });
      if (!(await player.answer())) break;
    }
    await player.act({ type: 'endRound', reason: 'done' });
    await player.act({ type: 'buy', item: 'hat-flower-crown' });
    await player.act({ type: 'equip', dragon: 'sunny', slot: 'head', item: 'hat-flower-crown' });
  }
  observation.final = player.view();
  return observation;
}

/** Named checks: each names a capability, so a failure reads as a bug report. */
function checks(o: Observation): Record<string, boolean> {
  const p = o.player;
  const state = p.state();
  const activities = p.data('round.started').map((e) => (e as { activity: string }).activity);
  const missed = o.feeding[FEEDING_MISS - 1];
  const reask = o.feeding.find((f) => f.reask);
  const earned = p
    .data('coins.earned')
    .reduce((sum: number, e) => sum + (e as { amount: number }).amount, 0);
  const stars = p.data('coins.earned').filter((e) => (e as { reason: string }).reason === 'stars');
  return {
    'every step was accepted at the expected logical turn': p.failures.length === 0,
    'the session started exactly once': p.count('session.started') === 1,
    'choosing the sunny egg gave the Sunny egg first':
      JSON.stringify(p.data('egg.received')[0]) === '{"dragon":"sunny"}',
    'the placement check was the next step after the first egg':
      o.nextAfterEgg?.kind === 'placement',
    'the placement check asked on the keypad and stopped after the failed second step':
      o.placementInputs.length === PLACEMENT_ANSWERS &&
      o.placementInputs.every((input) => input === 'keypad'),
    'the placement check placed only Sunny Meadow 2':
      JSON.stringify(p.data('placement.completed')) === '[{"placed":["sunny-meadow.2"]}]' &&
      state.levels['sunny-meadow.2']?.placed === true,
    'the placed level gave its eggs': ['bubbles', 'goldie'].every((d) =>
      p.data('egg.received').some((e) => (e as { dragon: string }).dragon === d),
    ),
    'the level played three Egg Grid boards and then Feeding Time':
      JSON.stringify(activities) === '["placement","egg-grid","feeding"]' &&
      p.count('minigame.completed') === 3,
    'each answer cost exactly one logical turn': p.turn === PLACEMENT_ANSWERS + 8,
    'the missed item came back three problems later as a re-ask':
      missed !== undefined &&
      reask !== undefined &&
      reask.item === missed.item &&
      reask.index === missed.index + 3,
    'no fact was served three times in one Feeding Time': o.feeding.every(
      (f) => o.feeding.filter((g) => g.item === f.item).length <= 2,
    ),
    'the chosen Sunny egg hatched first, in the first session':
      JSON.stringify(p.data('dragon.hatched')[0]) === '{"dragon":"sunny"}',
    'every egg the child owned hatched in the first session':
      o.final.dragons.length === 3 && o.final.dragons.every((d) => d.stage === 'hatchling'),
    'seven of eight right earned two stars on the first try':
      JSON.stringify(p.data('level.completed')) ===
      '[{"level":"sunny-meadow.1","stars":2,"firstTime":true}]',
    'the star coins were 5 and 10':
      JSON.stringify(stars) === '[{"amount":5,"reason":"stars"},{"amount":10,"reason":"stars"}]',
    'the placement check paid its 10 coins once':
      p.data('coins.earned').filter((e) => (e as { reason: string }).reason === 'placement')
        .length === 1,
    'the wallet is everything earned minus the 20-coin crown': o.final.coins === earned - 20,
    'the first stickers were earned': [
      'first-hatch',
      'meadow-first-steps',
      'show-what-you-know',
      'first-outfit',
    ].every((id) => state.stickers[id] !== undefined),
    'Sunny wears the flower crown':
      o.final.dragons.find((d) => d.id === 'sunny')?.outfit.head === 'hat-flower-crown',
    'the map makes the next level glow':
      o.final.hub.regions[0]?.levels.find((l) => l.glowing)?.id === 'sunny-meadow.3',
    'the child is back at the hub': o.final.screen === 'hub',
  };
}

const failedChecks = (o: Observation) =>
  Object.entries(checks(o))
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

describe('golden trace: first session', () => {
  // The scenario runs once; both tests read the same observation.
  let main: ReturnType<typeof playFirstSession> | undefined;
  const scenario = () => (main ??= playFirstSession());
  afterAll(async () => (await main)?.player.dispose());

  it('plays the first session with every named capability intact', async () => {
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
  it('answers that cost no turns never let the re-ask come back', async () => {
    const free: Adapter = {
      ...dragonValleyAdapter,
      resolve(action, read) {
        const plan = dragonValleyAdapter.resolve(action, read);
        return plan.ok ? success({ ...plan.value, turns: 0 }) : plan;
      },
    };
    const observation = await playFirstSession(free);
    const failed = failedChecks(observation);
    expect(failed).toContain('the missed item came back three problems later as a re-ask');
    expect(failed).toContain('each answer cost exactly one logical turn');
    await observation.player.dispose();
  });

  it('grading every answer as wrong breaks placement, hatching and stars', async () => {
    const wrong = (rule: (typeof dragonValleyAdapter.commands)[number]) => ({
      ...rule,
      start(context: never, pending: { payload: unknown }) {
        const action = pending.payload as { value: { value: number } };
        rule.start!(context, {
          ...(pending as object),
          payload: {
            ...(pending.payload as object),
            value: { kind: 'number', value: action.value.value + 1 },
          },
        } as never);
      },
    });
    const harsh: Adapter = {
      ...dragonValleyAdapter,
      commands: dragonValleyAdapter.commands.map((rule) =>
        rule.id === 'answer' || rule.id === 'placementAnswer' ? (wrong(rule) as never) : rule,
      ),
    };
    const observation = await playFirstSession(harsh);
    const failed = failedChecks(observation);
    expect(failed).toContain('the placement check placed only Sunny Meadow 2');
    expect(failed).toContain('the chosen Sunny egg hatched first, in the first session');
    expect(failed).toContain('seven of eight right earned two stars on the first try');
    await observation.player.dispose();
  });

  it('the golden hash and trajectory detect a run with a different seed', async () => {
    const reseeded = await playFirstSession(dragonValleyAdapter, `${SEED}-other`);
    expect(reseeded.player.host.hash()).not.toBe(GOLDEN_HASH);
    expect(trajectoryDigest(reseeded.player.hashes)).not.toBe(GOLDEN_TRAJECTORY);
    await reseeded.player.dispose();
  });
});
