/**
 * The preview game: a deliberately tiny runtime adapter that stands in for the real Dragon
 * Valley rules until the domain contract (S1) and rules (S2) land. It lets the placeholder hub
 * exercise the whole shell path for real: commands with logical turns, transient events for
 * sounds, strict durable checkpoints per answer, restore, backups and the save status.
 *
 * It keeps its own save namespace (`dragon-valley-preview`), so nothing it stores can ever be
 * mistaken for a real game save. The real adapter replaces it without touching the shell.
 */
import { failure, schema, success } from '@aegis/runtime';
import type { ContentPack, RuntimeAdapter, RuntimeDiagnostic, Schema } from '@aegis/runtime';
import type { GameDefinition } from '../persistence/game-session';
import type { AnswerValue, Problem } from '../../rules/contract';

const int = (min: number, max: number): Schema<number> =>
  schema.number({ integer: true, min, max });
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type PreviewProblem =
  | {
      readonly kind: 'mul';
      readonly a: number;
      readonly b: number;
      readonly input: 'choice' | 'keypad';
      readonly choices: readonly number[];
    }
  | {
      readonly kind: 'divrem';
      readonly dividend: number;
      readonly divisor: number;
      readonly input: 'keypad';
      readonly choices: readonly number[];
    };

export interface PreviewContent {
  problems: PreviewProblem[];
  warmthPerCorrect: number;
  coinsPerCorrect: number;
  maxWarmth: number;
}

export interface PreviewRound {
  index: number;
  correct: number;
  misses: number;
  streak: number;
  last: 'correct' | 'miss' | null;
  finished: boolean;
  stars: number;
  coinsEarned: number;
}

export interface PreviewState {
  day: string | null;
  sessions: number;
  warmth: number;
  coins: number;
  round: PreviewRound | null;
}

export type PreviewAnswer =
  { kind: 'number'; value: number } | { kind: 'remainder'; quotient: number; remainder: number };

export type PreviewAction =
  | { type: 'startSession'; day: string }
  | { type: 'startRound' }
  | { type: 'answer'; value: PreviewAnswer; elapsedMs: number }
  | { type: 'endRound' };

export interface PreviewRoundView {
  readonly index: number;
  readonly total: number;
  readonly problem: Problem;
  readonly input: 'choice' | 'keypad';
  readonly answerKind: 'number' | 'remainder';
  readonly choices: readonly number[];
  readonly last: 'correct' | 'miss' | null;
  readonly streak: number;
  readonly finished: boolean;
  readonly stars: number;
  readonly correct: number;
  readonly coinsEarned: number;
  /** The fact solved by the last correct answer, for the "Yes!" line. */
  readonly solved: { readonly problem: Problem; readonly answer: AnswerValue } | null;
  /** The picture shown after a miss: a rows-by-columns array, or equal groups and leftovers. */
  readonly model:
    | { readonly kind: 'array'; readonly rows: number; readonly columns: number }
    | { readonly kind: 'groups'; readonly total: number; readonly size: number }
    | null;
}

export interface PreviewView {
  readonly sessions: number;
  readonly warmth: number;
  readonly maxWarmth: number;
  readonly coins: number;
  readonly round: PreviewRoundView | null;
}

const problemSchema: Schema<PreviewProblem> = schema.union(
  schema.object({
    kind: schema.literal('mul'),
    a: int(0, 10),
    b: int(0, 10),
    input: schema.union(schema.literal('choice'), schema.literal('keypad')),
    choices: schema.array(int(0, 1000), { max: 4 }),
  }),
  schema.object({
    kind: schema.literal('divrem'),
    dividend: int(0, 100),
    divisor: int(1, 10),
    input: schema.literal('keypad'),
    choices: schema.array(int(0, 1000), { max: 0 }),
  }),
);

const contentSchema: Schema<PreviewContent> = schema.object({
  problems: schema.array(problemSchema, { min: 1, max: 12 }),
  warmthPerCorrect: int(1, 100),
  coinsPerCorrect: int(1, 5),
  maxWarmth: int(1, 1000),
});

const stateSchema: Schema<PreviewState> = schema.object({
  day: schema.union(schema.string({ pattern: DAY }), schema.literal(null)),
  sessions: int(0, 1_000_000),
  warmth: int(0, 1000),
  coins: int(0, 1_000_000),
  round: schema.union(
    schema.object({
      index: int(0, 12),
      correct: int(0, 12),
      misses: int(0, 1000),
      streak: int(0, 12),
      last: schema.union(schema.literal('correct'), schema.literal('miss'), schema.literal(null)),
      finished: schema.boolean,
      stars: int(0, 3),
      coinsEarned: int(0, 100),
    }),
    schema.literal(null),
  ),
});

const answerSchema: Schema<PreviewAnswer> = schema.union(
  schema.object({ kind: schema.literal('number'), value: int(0, 100_000) }),
  schema.object({
    kind: schema.literal('remainder'),
    quotient: int(0, 100_000),
    remainder: int(0, 100_000),
  }),
);

const actionSchema: Schema<PreviewAction> = schema.union(
  schema.object({ type: schema.literal('startSession'), day: schema.string({ pattern: DAY }) }),
  schema.object({ type: schema.literal('startRound') }),
  schema.object({
    type: schema.literal('answer'),
    value: answerSchema,
    elapsedMs: int(0, 3_600_000),
  }),
  schema.object({ type: schema.literal('endRound') }),
);

export function problemOf(problem: PreviewProblem): Problem {
  return problem.kind === 'mul'
    ? {
        kind: 'equation',
        left: {
          kind: 'op',
          op: 'mul',
          left: { kind: 'num', value: problem.a },
          right: { kind: 'num', value: problem.b },
        },
        right: { kind: 'blank' },
      }
    : { kind: 'divrem', dividend: problem.dividend, divisor: problem.divisor };
}

export function expectedOf(problem: PreviewProblem): AnswerValue {
  if (problem.kind === 'mul') return { kind: 'number', value: problem.a * problem.b };
  const remainder = problem.dividend % problem.divisor;
  return {
    kind: 'remainder',
    quotient: (problem.dividend - remainder) / problem.divisor,
    remainder,
  };
}

function matches(expected: AnswerValue, answer: PreviewAnswer): boolean {
  if (expected.kind === 'number')
    return answer.kind === 'number' && answer.value === expected.value;
  if (expected.kind === 'remainder') {
    return (
      answer.kind === 'remainder' &&
      answer.quotient === expected.quotient &&
      answer.remainder === expected.remainder
    );
  }
  return false;
}

/** 3 stars at 95% accuracy, 2 at 80%, otherwise 1: finishing always earns a star. */
export function starsFor(correct: number, misses: number): number {
  const percent = (correct * 100) / Math.max(1, correct + misses);
  return percent >= 95 ? 3 : percent >= 80 ? 2 : 1;
}

function validateContent(data: {
  readonly problems: readonly PreviewProblem[];
}): RuntimeDiagnostic[] {
  const problems: RuntimeDiagnostic[] = [];
  data.problems.forEach((problem, index) => {
    if (problem.input !== 'choice') return;
    const expected = expectedOf(problem);
    const choices = problem.choices;
    if (
      expected.kind !== 'number' ||
      choices.length < 2 ||
      !choices.includes(expected.value) ||
      new Set(choices).size !== choices.length
    ) {
      problems.push({
        code: 'invalid-choices',
        message: 'Choices must be unique and include the answer.',
        path: `problems[${index}].choices`,
      });
    }
  });
  return problems;
}

export const previewAdapter: RuntimeAdapter<
  PreviewState,
  PreviewAction,
  PreviewView,
  PreviewContent
> = {
  id: 'dragon-valley-preview',
  stateVersion: 1,
  state: stateSchema,
  action: actionSchema,
  content: { schemaVersion: 1, schema: contentSchema, validate: validateContent },
  eventPhases: ['play'],
  initialize: () => ({ day: null, sessions: 0, warmth: 0, coins: 0, round: null }),
  resolve(action, read) {
    const round = read.state.round;
    switch (action.type) {
      case 'startSession':
        return success({ rule: 'session.start', payload: { day: action.day }, turns: 0 });
      case 'startRound':
        if (round && !round.finished) return failure('round-active', 'A round is in progress.');
        return success({ rule: 'round.start', payload: null, turns: 0 });
      case 'answer': {
        if (!round || round.finished) return failure('no-round', 'There is no question to answer.');
        const problem = read.content.data.problems[round.index];
        if (!problem) return failure('no-round', 'The round has no question here.');
        return success({
          rule: 'answer',
          payload: {
            correct: matches(expectedOf(problem), action.value),
            elapsedMs: action.elapsedMs,
          },
          turns: 1,
        });
      }
      case 'endRound':
        if (!round) return failure('no-round', 'There is no round to end.');
        return success({ rule: 'round.end', payload: null, turns: 0 });
    }
  },
  commands: [
    {
      id: 'session.start',
      payload: schema.object({ day: schema.string({ pattern: DAY }) }),
      progress: schema.literal(null),
      start(context, action) {
        const { day } = action.payload as { day: string };
        if (context.state.day !== day) {
          context.state.day = day;
          context.state.sessions += 1;
        }
        context.emit('session.started', { day });
      },
    },
    {
      id: 'round.start',
      payload: schema.literal(null),
      progress: schema.literal(null),
      start(context) {
        context.state.round = {
          index: 0,
          correct: 0,
          misses: 0,
          streak: 0,
          last: null,
          finished: false,
          stars: 0,
          coinsEarned: 0,
        };
        context.emit('round.started', null);
      },
    },
    {
      id: 'answer',
      payload: schema.object({ correct: schema.boolean, elapsedMs: int(0, 3_600_000) }),
      progress: schema.literal(null),
      finish(context, action) {
        const round = context.state.round;
        if (!round) return;
        const { correct } = action.payload as { correct: boolean };
        const data = context.content.data;
        if (!correct) {
          round.misses += 1;
          round.streak = 0;
          round.last = 'miss';
          context.emit('answer.incorrect', { index: round.index });
          return;
        }
        round.correct += 1;
        round.streak += 1;
        round.last = 'correct';
        round.coinsEarned += data.coinsPerCorrect;
        context.state.coins += data.coinsPerCorrect;
        context.state.warmth = Math.min(
          data.maxWarmth,
          context.state.warmth + data.warmthPerCorrect,
        );
        context.emit('answer.correct', { index: round.index, streak: round.streak });
        context.emit('coins.earned', { amount: data.coinsPerCorrect });
        round.index += 1;
        if (round.index >= data.problems.length) {
          round.finished = true;
          round.stars = starsFor(round.correct, round.misses);
          context.emit('round.completed', { stars: round.stars });
        }
      },
    },
    {
      id: 'round.end',
      payload: schema.literal(null),
      progress: schema.literal(null),
      start(context) {
        context.state.round = null;
        context.emit('round.ended', null);
      },
    },
  ],
  view(read) {
    const state = read.state;
    const data = read.content.data;
    const round = state.round;
    let view: PreviewRoundView | null = null;
    if (round) {
      const total = data.problems.length;
      const current = data.problems[Math.min(round.index, total - 1)]!;
      const previous =
        round.last === 'correct' && round.index > 0 ? data.problems[round.index - 1] : undefined;
      view = {
        index: round.index,
        total,
        problem: problemOf(current),
        input: current.input,
        answerKind: current.kind === 'divrem' ? 'remainder' : 'number',
        choices: [...current.choices],
        last: round.last,
        streak: round.streak,
        finished: round.finished,
        stars: round.stars,
        correct: round.correct,
        coinsEarned: round.coinsEarned,
        solved: previous ? { problem: problemOf(previous), answer: expectedOf(previous) } : null,
        model:
          round.last !== 'miss' || round.finished
            ? null
            : current.kind === 'mul'
              ? { kind: 'array', rows: current.a, columns: current.b }
              : { kind: 'groups', total: current.dividend, size: current.divisor },
      };
    }
    return {
      sessions: state.sessions,
      warmth: state.warmth,
      maxWarmth: data.maxWarmth,
      coins: state.coins,
      round: view,
    };
  },
};

export const PREVIEW_CONTENT: ContentPack<PreviewContent> = {
  id: 'dragon-valley-preview',
  revision: 'preview-1',
  schemaVersion: 1,
  data: {
    problems: [
      { kind: 'mul', a: 2, b: 4, input: 'choice', choices: [6, 8, 10] },
      { kind: 'mul', a: 5, b: 3, input: 'choice', choices: [8, 15, 51] },
      { kind: 'mul', a: 10, b: 6, input: 'keypad', choices: [] },
      { kind: 'divrem', dividend: 23, divisor: 5, input: 'keypad', choices: [] },
    ],
    warmthPerCorrect: 25,
    coinsPerCorrect: 1,
    maxWarmth: 100,
  },
};

export const PREVIEW_GAME: GameDefinition<
  PreviewState,
  PreviewAction,
  PreviewView,
  PreviewContent
> = {
  gameId: 'dragon-valley-preview',
  adapter: previewAdapter,
  content: PREVIEW_CONTENT,
};
