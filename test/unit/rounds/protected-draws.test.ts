/**
 * Review draws while the child's success is protected (docs/design.md §6.3): the boss's spaced
 * review, snack time and the Feeding Time that draws the weakest facts serve the likeliest success
 * first, and the most overdue fact otherwise. Each round is started on a hand-built state through
 * the rules' own round start; the expectations are worked out here.
 */
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import { initialProfileState } from '../../../src/rules/contract';
import type {
  ContentData,
  ItemState,
  ProblemActivityKind,
  RoundSource,
} from '../../../src/rules/contract';
import { itemIndex } from '../../../src/rules/learning/index-cache';
import { startProblemRound } from '../../../src/rules/progression/problems';
import type { Ctx } from '../../../src/rules/types';
import { loadPack } from '../../traces/support';

const DAY = 20_000;
// A copy of the pack whose Bridge Troll reviews on every problem: its first problem is a review.
const data: ContentData = structuredClone(loadPack().data);
data.bosses.find((boss) => boss.id === 'bridge-troll')!.reviewShare = 100;

/** Answered right last time, due yesterday; and missed last time, five days overdue. */
const ITEMS: Record<string, ItemState> = {
  'mul:2x3': { box: 2, due: DAY - 1, seen: 2, correct: 2, recent: ['ok', 'ok'], lastDay: DAY - 2 },
  'mul:2x4': {
    box: 1,
    due: DAY - 5,
    seen: 2,
    correct: 1,
    recent: ['ok', 'miss'],
    lastDay: DAY - 5,
  },
};

interface Round {
  activity: ProblemActivityKind;
  source: RoundSource;
  skills: string[];
}

/** The first item a round serves when today's 20 answers had `correct` right ones. */
function firstItem(round: Round, correct: number): string {
  const state = initialProfileState({ dailyGoal: 30, arena: true });
  state.day = DAY;
  state.items = structuredClone(ITEMS);
  state.history = [{ day: DAY, answers: 20, correct, fast: 0 }];
  const streams = new Map<string, ReturnType<typeof createPrng>>();
  const ctx = {
    state,
    content: { data },
    emit: () => {},
    enterPhase: () => {},
    random: (name: string) => {
      if (!streams.has(name)) streams.set(name, createPrng(`draws:${name}`));
      return streams.get(name)!;
    },
  } as unknown as Ctx;
  startProblemRound(ctx, itemIndex(data), {
    ...round,
    input: 'auto',
    target: round.activity === 'boss' ? null : 6,
    meter: round.activity === 'boss' ? { value: 0, target: 15 } : null,
  });
  const current = state.round?.type === 'problems' ? state.round.current : null;
  if (current === null) throw new Error('the round serves a problem');
  return current.item;
}

const ROUNDS: Record<string, Round> = {
  // The boss's own facts are the tens, so the twos are spaced review.
  'the boss review': {
    activity: 'boss',
    source: { kind: 'level', level: 'sunny-meadow.boss', activity: 0 },
    skills: ['mul-10'],
  },
  'snack time': { activity: 'snack', source: { kind: 'snack', dragon: null }, skills: ['mul-2'] },
  'the Feeding Time of the weakest facts': {
    activity: 'feeding',
    source: { kind: 'level', level: 'dragon-castle.2', activity: 0 },
    skills: ['mul-all', 'div-all'],
  },
};

describe('review draws', () => {
  for (const [name, round] of Object.entries(ROUNDS)) {
    it(`${name}: the likeliest success below 70 %, the most overdue fact inside the band`, () => {
      expect(firstItem(round, 8), '40 %: right last time').toBe('mul:2x3');
      expect(firstItem(round, 18), '90 %: five days overdue').toBe('mul:2x4');
    });
  }

  it('the Feeding Time draws the weakest facts in the pack as it is', () => {
    const level = data.levels.find((l) => l.id === 'dragon-castle.2')!;
    expect(level.activities[0]).toMatchObject({ kind: 'feeding', options: { draw: 'weakest' } });
  });
});
