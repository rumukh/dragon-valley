/**
 * Golden trace: a child's first session on the walking-skeleton rules.
 *
 * Start a session on 2026-10-06, skip the prologue, choose the Bubbles egg, start Sunny Meadow 1
 * (its story beat is skipped; the skeleton skips the Egg Grid minigame), answer the eight Feeding
 * Time problems with problem 2 deliberately wrong, and land on the results screen.
 *
 * Every step runs through the public `runCommandTrace` helper. Named checks come first and say
 * what broke; the golden hash and trajectory are change detectors checked last.
 *
 * Answers come from an oracle independent of the rules: the test multiplies or divides the two
 * numbers of the problem itself and never calls the contract's `expectedAnswer`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hashString } from '@aegis/core';
import {
  createRuntimeHost,
  parseContentJson,
  requireValue,
  runCommandTrace,
  success,
} from '@aegis/runtime';
import type { RuntimeAdapter } from '@aegis/runtime';
import { dragonValleyAdapter } from '../../src/rules/adapter';
import { contentRegistration } from '../../src/rules/contract';
import type {
  AnswerValue,
  ContentData,
  GameAction,
  GameView,
  ProfileState,
  Problem,
} from '../../src/rules/contract';

type Adapter = RuntimeAdapter<ProfileState, GameAction, GameView, ContentData>;

/**
 * Golden final-state hash. Captured once from the first green run of this scenario (Windows,
 * Node 24, Aegis SDK 5949a7f, content 1.0.0 skeleton) and pinned as a literal, so a regression
 * changes the run but never this number. Re-pin only for a deliberate rules or content change,
 * with the reason in the commit message (docs/testing.md, "When a golden moves").
 */
const GOLDEN_HASH = '86f276f9ed5b4c3f';

/** Golden digest of every commit hash in order: catches timing changes the final hash misses. */
const GOLDEN_TRAJECTORY = '0755946640d0a77a';

const DAY = '2026-10-06';
const SEED = 'golden-first-session';
const MISSED_ANSWER = 2;

const content = requireValue(
  parseContentJson(
    readFileSync(
      join(import.meta.dirname, '..', '..', 'content', 'dragon-valley.content.json'),
      'utf8',
    ),
    contentRegistration,
    'dragon-valley.content.json',
  ),
);

/** The independent oracle: the product or quotient of the problem's two numbers. */
function oracle(problem: Problem): number {
  if (problem.kind !== 'equation' || problem.left.kind !== 'op') {
    throw new Error('unexpected problem');
  }
  const { op, left, right } = problem.left;
  if (left.kind !== 'num' || right.kind !== 'num' || problem.right.kind !== 'blank') {
    throw new Error('unexpected problem shape');
  }
  return op === 'mul' ? left.value * right.value : left.value / right.value;
}

interface Observation {
  failures: string[];
  events: { turn: number; type: string; data: unknown }[];
  answers: { turn: number; item: string; index: number; reask: boolean }[];
  commitHashes: string[];
  view: GameView;
  state: ProfileState;
  hash: string;
  turn: number;
}

async function playFirstSession(adapter: Adapter, seed = SEED): Promise<Observation> {
  const host = createRuntimeHost({ adapter, content, seed });
  const events: Observation['events'] = [];
  const commitHashes: string[] = [];
  const answers: Observation['answers'] = [];
  const failures: string[] = [];
  host.subscribeCommits((commit) => {
    commitHashes.push(commit.hash);
    for (const event of commit.events) {
      events.push({ turn: commit.turn, type: event.type, data: event.data });
    }
  });
  /** Runs one traced step. Returns false only if the action itself was rejected. */
  const step = async (action: GameAction, expectedTurn: number): Promise<boolean> => {
    const trace = await runCommandTrace(host, [{ action, ruleIds: [action.type], expectedTurn }]);
    if (trace.failure) failures.push(`${action.type}: ${trace.failure.error.code}`);
    return trace.failure?.error.code !== 'trace-outcome';
  };
  const choose = async (choice: string | null, turn: number): Promise<boolean> => {
    const story = host.getView().story;
    if (story === null) return false;
    return step(
      { type: 'storyChoice', beat: story.beat, node: story.node, revision: story.revision, choice },
      turn,
    );
  };
  let turn = 0;
  const ready =
    (await step({ type: 'startSession', day: DAY }, turn)) &&
    (await choose(null, turn)) &&
    (await choose('bubbles', turn)) &&
    (await step({ type: 'startLevel', level: 'sunny-meadow.1' }, turn)) &&
    (await choose(null, turn));
  for (let answered = 1; ready && answered <= 20; answered++) {
    const round = host.getView().round;
    if (round?.type !== 'problems' || round.status !== 'active' || !round.problem) break;
    const correct = oracle(round.problem.problem);
    const value: AnswerValue = {
      kind: 'number',
      value: answered === MISSED_ANSWER ? correct + 1 : correct,
    };
    turn += 1;
    answers.push({
      turn,
      item: round.problem.item,
      index: round.problem.index,
      reask: round.problem.reask,
    });
    if (!(await step({ type: 'answer', value, elapsedMs: 1500 }, turn))) break;
  }
  const observation: Observation = {
    failures,
    events,
    answers,
    commitHashes,
    view: host.getView(),
    state: host.inspect().state as ProfileState,
    hash: host.hash(),
    turn: host.getStatus().turn,
  };
  await host.dispose();
  return observation;
}

const count = (o: Observation, type: string) => o.events.filter((e) => e.type === type).length;
const dataOf = (o: Observation, type: string) =>
  JSON.stringify(o.events.find((e) => e.type === type)?.data);

/** Named checks: each names a capability, so a failure reads as a bug report. */
function checks(o: Observation): Record<string, boolean> {
  const missed = o.answers[MISSED_ANSWER - 1];
  const reask = o.answers.find((a) => a.reask);
  return {
    'every step was accepted at the expected logical turn': o.failures.length === 0,
    'the session started exactly once': count(o, 'session.started') === 1,
    'choosing the blue egg gave the Bubbles egg':
      dataOf(o, 'egg.received') === '{"dragon":"bubbles"}',
    'the level started one Feeding Time round': count(o, 'round.started') === 1,
    'each answer cost exactly one logical turn': o.answers.length === 8 && o.turn === 8,
    'the deliberate miss was reported once': count(o, 'answer.incorrect') === 1,
    'the miss scheduled one re-ask': count(o, 'reask.scheduled') === 1,
    'the missed item came back three problems later as a re-ask':
      missed !== undefined &&
      reask !== undefined &&
      reask.item === missed.item &&
      reask.index === missed.index + 3,
    'seven answers were correct': count(o, 'answer.correct') === 7,
    'the round and the level completed with two stars on the first try':
      count(o, 'round.completed') === 1 &&
      dataOf(o, 'level.completed') === '{"level":"sunny-meadow.1","stars":2,"firstTime":true}',
    'Bubbles hatched in the first session': dataOf(o, 'dragon.hatched') === '{"dragon":"bubbles"}',
    'the first-hatch sticker was earned': o.state.stickers['first-hatch'] !== undefined,
    'coins: 7 answers + one 5-streak bonus + 5 and 10 star coins = 24': o.view.coins === 24,
    'the next level glows on the map':
      o.view.hub.regions[0]?.levels.find((l) => l.glowing)?.id === 'sunny-meadow.2',
    'the results screen is shown': o.view.screen === 'results',
  };
}

const failedChecks = (o: Observation) =>
  Object.entries(checks(o))
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

function trajectoryDigest(hashes: readonly string[]): string {
  return hashString(hashes.join('|'));
}

describe('golden trace: first session', () => {
  it('plays the first session with every named capability intact', async () => {
    const observation = await playFirstSession(dragonValleyAdapter);
    expect(failedChecks(observation), observation.failures.join('; ')).toEqual([]);
  });

  it('matches the pinned golden hash and trajectory', async () => {
    const observation = await playFirstSession(dragonValleyAdapter);
    expect(observation.hash, 'final state hash (GOLDEN_HASH)').toBe(GOLDEN_HASH);
    expect(
      trajectoryDigest(observation.commitHashes),
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
    const failed = failedChecks(await playFirstSession(free));
    expect(failed).toContain('the missed item came back three problems later as a re-ask');
    expect(failed).toContain('each answer cost exactly one logical turn');
  });

  it('grading every answer as wrong breaks hatching, stars and coins', async () => {
    const harsh: Adapter = {
      ...dragonValleyAdapter,
      commands: dragonValleyAdapter.commands.map((rule) =>
        rule.id !== 'answer'
          ? rule
          : {
              ...rule,
              start(context, pending) {
                const action = pending.payload as { value: { value: number } };
                rule.start!(context, {
                  ...pending,
                  payload: {
                    ...(pending.payload as object),
                    value: { kind: 'number', value: action.value.value + 1 },
                  },
                });
              },
            },
      ),
    };
    const failed = failedChecks(await playFirstSession(harsh));
    expect(failed).toContain('seven answers were correct');
    expect(failed).toContain('Bubbles hatched in the first session');
    expect(failed).toContain('coins: 7 answers + one 5-streak bonus + 5 and 10 star coins = 24');
  });

  it('the golden hash and trajectory detect a run with a different seed', async () => {
    const reseeded = await playFirstSession(dragonValleyAdapter, `${SEED}-other`);
    expect(reseeded.hash).not.toBe(GOLDEN_HASH);
    expect(trajectoryDigest(reseeded.commitHashes)).not.toBe(GOLDEN_TRAJECTORY);
  });
});
