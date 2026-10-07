/**
 * Mix control for a child who is not succeeding (docs/design.md §6.3, the coordinator's decision
 * after the learner simulations): recent success is measured over the last `mix.window` answers
 * across days; and below the success band (`LOW_SUCCESS`, 70 %) the mix protects the child's
 * success: a due fact missed last time is a learning item, not a likely success, and reviews,
 * learning draws and snacks serve the likeliest successes first. Inside the band the spaced order
 * is unchanged. States are built by hand; the expectations are worked out here.
 */
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import {
  LOW_SUCCESS,
  itemTier,
  learningShare,
  likely,
  lowSuccess,
  lowToday,
  missedTwice,
  mixTier,
  pickLearning,
  pickMixed,
  pickSnack,
  recentSuccess,
  todaySuccess,
} from '../../../src/rules/learning/selection';
import { easierRetrieval, inputFor, teachFirst } from '../../../src/rules/progression/problems';
import { initialProfileState } from '../../../src/rules/contract';
import type {
  DayRecord,
  ItemState,
  ProfileState,
  ResponseBucket,
} from '../../../src/rules/contract';
import { loadPack } from '../../traces/support';

const data = loadPack().data;
const DAY = 20_000;

function item(
  recent: ResponseBucket[],
  options: { box?: number; due?: number; lastDay?: number; correct?: number } = {},
): ItemState {
  const correct = options.correct ?? recent.filter((b) => b !== 'miss').length;
  return {
    box: options.box ?? 1,
    due: options.due ?? DAY,
    seen: recent.length,
    correct,
    recent,
    lastDay: options.lastDay ?? DAY - 1,
  };
}

/** Day records, oldest first; the last is today's. */
function history(...days: [answers: number, correct: number][]): DayRecord[] {
  return days.map(([answers, correct], i) => ({
    day: DAY - (days.length - 1 - i),
    answers,
    correct,
    fast: 0,
  }));
}

function state(patch: Partial<ProfileState> = {}): ProfileState {
  const s: ProfileState = {
    ...initialProfileState({ dailyGoal: 30, arena: true }),
    day: DAY,
    ...patch,
  };
  const today = s.history[s.history.length - 1];
  if (today?.day === DAY && patch.daily === undefined) {
    s.daily = {
      day: DAY,
      answers: today.answers,
      correct: today.correct,
      fast: 0,
      levels: 0,
      minigames: 0,
      goal: 30,
      quests: [],
      gift: 'locked',
    };
  }
  return s;
}

describe('recent success', () => {
  it('is unknown before five answers, then the share of the last 20 answers that were right', () => {
    expect(recentSuccess(state(), data)).toBeNull();
    expect(recentSuccess(state({ history: history([4, 4]) }), data)).toBeNull();
    expect(recentSuccess(state({ history: history([10, 7]) }), data)).toBe(70);
  });

  it('reaches back into earlier days for the rest of the window, at their own success rate', () => {
    // Today 10 of 10 right; yesterday 20 answers, 5 right: its last 10 count at 25 % (2 right).
    const s = state({ history: history([20, 5], [10, 10]) });
    expect(recentSuccess(s, data)).toBe(60);
    // A full window today leaves yesterday out.
    expect(recentSuccess(state({ history: history([20, 0], [20, 20]) }), data)).toBe(100);
    // A day without answers is skipped.
    expect(recentSuccess(state({ history: history([20, 10], [0, 0], [0, 0]) }), data)).toBe(50);
  });

  it('starts the day protected after a poor yesterday', () => {
    const s = state({ history: history([30, 12], [0, 0]) });
    expect(todaySuccess(s), 'nothing answered today yet').toBeNull();
    expect(recentSuccess(s, data)).toBe(40);
    expect(lowSuccess(s, data)).toBe(true);
    expect(learningShare(s, data), 'the learning share is at its floor from the start').toBe(
      data.balance.mix.minLearningShare,
    );
  });

  it('protects success below 70 %, the lower edge of the success band', () => {
    const at = (correct: number) => state({ history: history([20, correct]) });
    expect(LOW_SUCCESS).toBe(70);
    expect([lowSuccess(at(14), data), lowSuccess(at(13), data)]).toEqual([false, true]);
    expect(lowSuccess(state({ history: history([4, 0]) }), data), 'too few answers').toBe(false);
  });

  it("paces new levels on today's success alone, from five answers", () => {
    const at = (answers: number, correct: number) =>
      state({ history: history([20, 0], [answers, correct]) });
    expect([lowToday(at(20, 14)), lowToday(at(20, 13))]).toEqual([false, true]);
    expect(lowToday(at(4, 0)), 'too few answers today').toBe(false);
    expect(lowToday(state({ history: history([20, 0], [0, 0]) })), 'a poor yesterday').toBe(false);
    expect(todaySuccess(at(20, 13))).toBe(65);
  });
});

describe('the mix for a child who is not succeeding', () => {
  it('counts a due fact missed last time as a learning item while success is protected', () => {
    const s = state({
      items: {
        'mul:2x3': item(['ok', 'miss'], { box: 1 }),
        'mul:2x4': item(['ok', 'slow'], { box: 0 }),
        'mul:2x5': item(['ok', 'ok', 'ok'], { box: 3 }),
      },
    });
    expect(itemTier(s, 'mul:2x3', DAY), 'a due review in the spaced order').toBe('due');
    expect(mixTier(s, 'mul:2x3', DAY, false)).toBe('due');
    expect(mixTier(s, 'mul:2x3', DAY, true), 'missed last time').toBe('learning');
    expect(mixTier(s, 'mul:2x4', DAY, true), 'right last time, slowly').toBe('due');
    expect(mixTier(s, 'mul:2x5', DAY, true)).toBe('due');
  });

  it('finds the likeliest successes: right last time and practised most recently, then new', () => {
    const s = state({
      items: {
        'mul:2x3': item(['ok'], { lastDay: DAY - 1 }),
        'mul:2x4': item(['ok'], { lastDay: DAY - 3 }),
        'mul:2x5': item(['miss'], { lastDay: DAY - 1, correct: 1 }),
        'mul:2x6': item(['miss'], { lastDay: DAY - 4, correct: 1 }),
      },
    });
    expect(likely(s, ['mul:2x6', 'mul:2x5', 'mul:2x4', 'mul:2x3', 'mul:2x7'])).toEqual(['mul:2x3']);
    expect(likely(s, ['mul:2x6', 'mul:2x5', 'mul:2x7']), 'a new fact before a missed one').toEqual([
      'mul:2x7',
    ]);
    expect(likely(s, ['mul:2x6', 'mul:2x5']), 'else the most recently missed').toEqual(['mul:2x5']);
  });

  it('feeds snacks of the likeliest successes while success is protected', () => {
    const s = state({
      items: {
        recent: item(['ok'], { due: DAY - 1, lastDay: DAY - 1 }),
        old: item(['ok'], { due: DAY - 6, lastDay: DAY - 7 }),
        missed: item(['ok', 'miss'], { due: DAY - 2, lastDay: DAY - 2 }),
      },
    } as Partial<ProfileState>);
    const pool = ['old', 'missed', 'recent'];
    const random = createPrng('snack');
    expect(pickSnack({ state: s, pool, blocked: [], random }), 'most overdue first').toBe('old');
    expect(pickSnack({ state: s, pool, blocked: [], random, likelyFirst: true })).toBe('recent');
  });

  it('serves due reviews by likelihood below the band, most overdue first inside it', () => {
    const items = {
      'mul:2x3': item(['ok'], { due: DAY - 1, lastDay: DAY - 1 }),
      'mul:2x4': item(['ok'], { due: DAY - 6, lastDay: DAY - 7 }),
    };
    const pool = ['mul:2x3', 'mul:2x4'];
    const pick = (s: ProfileState) =>
      pickMixed({ state: s, data, pool, blocked: [], focus: null, random: createPrng('mix') });
    expect(pick(state({ items, history: history([20, 18]) })), '90 %').toBe('mul:2x4');
    expect(pick(state({ items, history: history([20, 14]) })), '70 %: inside the band').toBe(
      'mul:2x4',
    );
    expect(pick(state({ items, history: history([20, 10]) })), '50 %').toBe('mul:2x3');
  });

  it('serves learning items by likelihood while protected: what was right before new facts', () => {
    const s = state({
      history: history([20, 8]),
      items: {
        'mul:6x7': item(['miss', 'ok'], { box: 0, due: DAY + 1, lastDay: DAY }),
        'mul:6x8': item(['miss'], { box: 1, due: DAY + 1, lastDay: DAY, correct: 0 }),
      },
    });
    const learning = ['mul:6x7', 'mul:6x8', 'mul:6x9'];
    const random = createPrng('learning');
    for (let i = 0; i < 10; i++) {
      expect(pickLearning(s, learning, null, random, [], true)).toBe('mul:6x7');
      expect(pickLearning(s, ['mul:6x8', 'mul:6x9'], null, random, [], true)).toBe('mul:6x9');
    }
  });

  it('draws only the likeliest learning item in a mixed round while protected', () => {
    // Nothing is due or known: every draw is a learning draw, by the share or as the fallback.
    const items = {
      'mul:6x7': item(['miss', 'ok'], { box: 0, due: DAY + 1, lastDay: DAY }),
      'mul:6x8': item(['miss'], { box: 1, due: DAY + 1, lastDay: DAY, correct: 0 }),
    };
    const pool = ['mul:6x7', 'mul:6x8', 'mul:6x9'];
    const picks = (s: ProfileState) =>
      new Set(
        Array.from({ length: 60 }, (_, i) =>
          pickMixed({ state: s, data, pool, blocked: [], focus: null, random: createPrng(`${i}`) }),
        ),
      );
    expect(picks(state({ items, history: history([20, 8]) })), '40 %').toEqual(
      new Set(['mul:6x7']),
    );
    expect(picks(state({ items, history: history([20, 18]) })), '90 %: new and weak share').toEqual(
      new Set(pool),
    );
  });

  it('teaches a fact missed twice in a row before asking it', () => {
    expect(missedTwice(item(['ok', 'miss', 'miss']))).toBe(true);
    expect(missedTwice(item(['miss', 'ok', 'miss']))).toBe(false);
    expect(missedTwice(item(['miss']))).toBe(false);
    expect(missedTwice(undefined)).toBe(false);
  });
});

describe('the input of a problem', () => {
  const base = { box: 0, keypadFromBox: 2, easier: false, typeable: true } as const;
  it('follows the round, the box and what can be typed', () => {
    expect(inputFor({ ...base, round: 'auto' })).toBe('choice');
    expect(inputFor({ ...base, round: 'auto', box: 2 })).toBe('keypad');
    expect(inputFor({ ...base, round: 'keypad' })).toBe('keypad');
    expect(inputFor({ ...base, round: 'keypad', typeable: false })).toBe('choice');
    expect(inputFor({ ...base, round: 'choice', box: 5 })).toBe('choice');
  });

  it('asks by choice when retrieval is made easier (a review or re-ask while success is low)', () => {
    expect(inputFor({ ...base, round: 'auto', box: 3, easier: true })).toBe('choice');
    expect(inputFor({ ...base, round: 'keypad', easier: true })).toBe('choice');
  });

  it('makes retrieval easier for re-asks and reviews while success is low, not in a race', () => {
    const serving = {
      activity: 'feeding',
      placement: false,
      reask: false,
      due: false,
      low: true,
    } as const;
    expect(easierRetrieval(serving), 'a new fact in a level').toBe(false);
    expect(easierRetrieval({ ...serving, reask: true }), 're-ask').toBe(true);
    expect(easierRetrieval({ ...serving, due: true }), 'a due review').toBe(true);
    expect(easierRetrieval({ ...serving, activity: 'snack' }), 'snack time').toBe(true);
    expect(easierRetrieval({ ...serving, reask: true, low: false }), 'success is fine').toBe(false);
    expect(easierRetrieval({ ...serving, activity: 'arena', due: true }), 'the Arena').toBe(false);
    expect(easierRetrieval({ ...serving, placement: true, reask: true }), 'placement').toBe(false);
  });

  it('teaches an item missed twice in a row, except in the Arena and the placement check', () => {
    const serving = { activity: 'snack', placement: false, reask: false } as const;
    const twice = item(['ok', 'miss', 'miss']);
    expect(teachFirst({ ...serving, record: twice })).toBe(true);
    expect(teachFirst({ ...serving, activity: 'boss', reask: true, record: twice })).toBe(true);
    expect(teachFirst({ ...serving, record: item(['miss', 'ok', 'miss']) })).toBe(false);
    expect(teachFirst({ ...serving, record: undefined })).toBe(false);
    expect(teachFirst({ ...serving, activity: 'arena', record: twice }), 'a race').toBe(false);
    expect(teachFirst({ ...serving, placement: true, record: twice }), 'placement').toBe(false);
  });
});
