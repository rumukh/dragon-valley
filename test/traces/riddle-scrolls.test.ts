/**
 * Golden trace: Riddle Scrolls, both steps of every story.
 *
 * On 2026-10-06 a child who chose the bubbly blue egg goes straight to Meadow Stories (a parent
 * opened Sunny Meadow ahead). Each story first asks "which sign do we need?": the child picks the
 * operation from the four offered, then answers the number. The first story's operation is picked
 * wrong on purpose: that is the story's miss, shown with the right operation, and the story comes
 * back later as a re-ask. Every other step is answered right.
 *
 * Named checks come first and say what broke; the golden hash and trajectory are change
 * detectors checked last. Answers come from the harness's independent oracle.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import { OPERATORS } from '../../src/rules/contract';
import type { AnswerValue, Feedback, ProblemView } from '../../src/rules/contract';
import { PERFECT, Player, oracle, trajectoryDigest } from './support';

// Whole sessions are replayed here, one commit at a time with the full content pack: give them
// room on a busy machine (Vitest's default is 60 s per test).
vi.setConfig({ testTimeout: 300_000 });

/** Golden values: see first-session.test.ts for their provenance rules. */
const GOLDEN_HASH = '82d356827b74ac90';
const GOLDEN_TRAJECTORY = '5951d1970053bde3';

const SEED = 'golden-riddle-scrolls';

interface Step {
  problem: ProblemView;
  /** The feedback after answering this step. */
  feedback: Feedback | null;
  /** The problem on screen after answering (the same story's next step, or the next story). */
  after: ProblemView | null;
  given: AnswerValue;
}

interface Observation {
  player: Player;
  steps: Step[];
  completed: boolean;
}

async function playStories(seed = SEED): Promise<Observation> {
  const player = new Player(PERFECT, seed);
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('bubbles');
  await player.act({
    type: 'setSetting',
    setting: { key: 'unlockAhead', value: ['sunny-meadow'] },
  });
  await player.act({ type: 'startLevel', level: 'sunny-meadow.6' });
  await player.settleStory();
  const steps: Step[] = [];
  for (let guard = 0; guard < 40; guard++) {
    const round = player.view().round;
    if (round?.type !== 'problems' || round.status !== 'active' || !round.problem) break;
    const problem = round.problem;
    const right = oracle(problem.problem, problem.step);
    const wrongFirst =
      steps.length === 0 && problem.step === 'operation' && right.kind === 'operation';
    const given: AnswerValue = wrongFirst
      ? { kind: 'operation', operation: right.operation === 'add' ? 'sub' : 'add' }
      : right;
    await player.act({ type: 'answer', value: given, elapsedMs: 2000 });
    const after = player.view().round;
    steps.push({
      problem,
      feedback: after?.type === 'problems' ? after.feedback : null,
      after: after?.type === 'problems' ? after.problem : null,
      given,
    });
  }
  const completed = player.view().round?.status === 'complete';
  return { player, steps, completed };
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const FOUR = OPERATORS.map((operation) => ({ kind: 'operation', operation }));

function checks(o: Observation): Record<string, boolean> {
  const p = o.player;
  const operationSteps = o.steps.filter((s) => s.problem.step === 'operation');
  const numberSteps = o.steps.filter((s) => s.problem.step === 'answer');
  const [first] = o.steps;
  const missed = first?.problem.item;
  const rightPicks = operationSteps.slice(1);
  return {
    'every step was accepted at the expected logical turn': p.failures.length === 0,
    'Meadow Stories was played to the end': o.completed,
    'every story opened on its operation step, offering + − · : in that order':
      operationSteps.length >= 6 &&
      operationSteps.every((s) => s.problem.problem.kind === 'word') &&
      operationSteps.every((s) => sameJson(s.problem.choices, FOUR)),
    'a right operation moved the same story to its number step, with number choices':
      rightPicks.length >= 5 &&
      rightPicks.every(
        (s) =>
          s.feedback?.step === 'operation' &&
          s.feedback.correct &&
          s.after?.index === s.problem.index &&
          s.after.step === 'answer' &&
          (s.after.input !== 'choice' ||
            (s.after.choices !== null &&
              s.after.choices.every((c) => c.kind === 'number') &&
              s.after.choices.some((c) => sameJson(c, oracle(s.problem.problem, 'answer'))))),
      ),
    'the right number finished each story as a right answer':
      numberSteps.length === rightPicks.length &&
      numberSteps.every((s) => s.feedback?.step === 'answer' && s.feedback.correct) &&
      p.count('answer.correct') === numberSteps.length,
    'a wrong operation was the story’s miss, shown with the right operation':
      first?.problem.step === 'operation' &&
      first.feedback?.step === 'operation' &&
      first.feedback.correct === false &&
      sameJson(first.feedback.expected, oracle(first.problem.problem, 'operation')) &&
      first.after?.index !== first.problem.index &&
      p.count('answer.incorrect') === 1,
    'the missed story came back as a re-ask':
      sameJson(
        p.data('reask.scheduled').map((e) => (e as { item: string }).item),
        [missed],
      ) && o.steps.some((s) => s.problem.reask && s.problem.item === missed),
  };
}

const failedChecks = (o: Observation) =>
  Object.entries(checks(o))
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

describe('golden trace: Riddle Scrolls, operation then number', () => {
  let main: Promise<Observation> | undefined;
  const scenario = () => (main ??= playStories());
  afterAll(async () => (await main)?.player.dispose());

  it('asks every story in two steps with every named capability intact', async () => {
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
  it('a child who always picks the wrong operation never reaches a number step', async () => {
    const player = new Player({ ...PERFECT, right: () => false }, SEED);
    await player.act({ type: 'startSession', day: '2026-10-06' });
    await player.choose(null);
    await player.choose('bubbles');
    await player.act({
      type: 'setSetting',
      setting: { key: 'unlockAhead', value: ['sunny-meadow'] },
    });
    await player.act({ type: 'startLevel', level: 'sunny-meadow.6' });
    await player.settleStory();
    const steps: Step[] = [];
    for (let guard = 0; guard < 40; guard++) {
      const round = player.view().round;
      if (round?.type !== 'problems' || round.status !== 'active' || !round.problem) break;
      const problem = round.problem;
      await player.answer();
      const after = player.view().round;
      steps.push({
        problem,
        feedback: after?.type === 'problems' ? after.feedback : null,
        after: after?.type === 'problems' ? after.problem : null,
        given: { kind: 'operation', operation: 'add' },
      });
    }
    const failed = failedChecks({ player, steps, completed: true });
    expect(failed).toContain(
      'a right operation moved the same story to its number step, with number choices',
    );
    expect(failed).toContain('the right number finished each story as a right answer');
    await player.dispose();
  });

  it('the golden hash and trajectory detect a run with a different seed', async () => {
    const reseeded = await playStories(`${SEED}-other`);
    expect(reseeded.player.host.hash()).not.toBe(GOLDEN_HASH);
    expect(trajectoryDigest(reseeded.player.hashes)).not.toBe(GOLDEN_TRAJECTORY);
    await reseeded.player.dispose();
  });
});
