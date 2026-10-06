/**
 * State, days and actions. Calendar expectations are written from known dates, not derived from
 * the conversion under test.
 */
import { describe, expect, it } from 'vitest';
import { requireValue } from '@aegis/runtime';
import {
  ACTION_TURNS,
  dayNumber,
  gameActionSchema,
  initialProfileState,
  isoDay,
  profileStateSchema,
  weekday,
} from '../../../src/rules/contract';

describe('local days', () => {
  it('converts known dates', () => {
    expect(dayNumber('2000-01-01')).toBe(10957);
    expect(dayNumber('2026-10-06')).toBe(20732);
    expect(dayNumber('2024-02-29')).toBe(19782);
    expect(isoDay(20732)).toBe('2026-10-06');
  });

  it('round-trips every day from 2000 to 2100', () => {
    const first = dayNumber('2000-01-01')!;
    const last = dayNumber('2100-12-31')!;
    for (let day = first; day <= last; day++) {
      expect(dayNumber(isoDay(day))).toBe(day);
    }
    expect(last - first + 1).toBe(36890);
  });

  it('rejects text that is not a calendar date', () => {
    for (const text of [
      '2026-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-04-31',
      '26-10-06',
      '2026-10-6',
      '1999-12-31',
    ]) {
      expect(dayNumber(text), text).toBeNull();
    }
  });

  it('knows the weekday (Monday = 0): 2026-10-06 is a Tuesday', () => {
    expect(weekday(dayNumber('2026-10-06')!)).toBe(1);
    expect(weekday(dayNumber('2026-10-11')!)).toBe(6);
    expect(weekday(dayNumber('2026-10-12')!)).toBe(0);
  });
});

describe('profile state', () => {
  it('starts valid and empty', () => {
    const state = initialProfileState({ dailyGoal: 30, arena: true });
    expect(requireValue(profileStateSchema.parse(JSON.parse(JSON.stringify(state))))).toEqual(
      state,
    );
    expect(state.day).toBeNull();
    expect(state.coins).toBe(0);
    expect(state.dragons).toEqual({});
  });

  it('rejects unknown fields and out-of-range values', () => {
    const state = initialProfileState({ dailyGoal: 30, arena: true });
    expect(profileStateSchema.parse({ ...state, surprise: 1 }).ok).toBe(false);
    expect(profileStateSchema.parse({ ...state, coins: -1 }).ok).toBe(false);
    expect(
      profileStateSchema.parse({
        ...state,
        items: { 'mul:7x8': { box: 6, due: 0, seen: 1, correct: 1, recent: [], lastDay: 0 } },
      }).ok,
    ).toBe(false);
  });
});

describe('actions', () => {
  it('charges a logical turn for answers only', () => {
    const paid = Object.entries(ACTION_TURNS)
      .filter(([, turns]) => turns > 0)
      .map(([type]) => type)
      .sort();
    expect(paid).toEqual(['answer', 'placementAnswer']);
  });

  it('accepts well-formed actions and rejects malformed ones', () => {
    expect(gameActionSchema.parse({ type: 'startSession', day: '2026-10-06' }).ok).toBe(true);
    expect(
      gameActionSchema.parse({
        type: 'answer',
        value: { kind: 'number', value: 56 },
        elapsedMs: 2300,
      }).ok,
    ).toBe(true);
    expect(
      gameActionSchema.parse({ type: 'equip', dragon: 'bubbles', slot: 'head', item: null }).ok,
    ).toBe(true);
    expect(gameActionSchema.parse({ type: 'startSession', day: '6.10.2026' }).ok).toBe(false);
    expect(
      gameActionSchema.parse({ type: 'answer', value: { kind: 'number', value: 56 } }).ok,
    ).toBe(false);
    expect(
      gameActionSchema.parse({
        type: 'answer',
        value: { kind: 'number', value: 56 },
        elapsedMs: -5,
      }).ok,
    ).toBe(false);
    expect(
      gameActionSchema.parse({ type: 'equip', dragon: 'bubbles', slot: 'tail', item: null }).ok,
    ).toBe(false);
    expect(gameActionSchema.parse({ type: 'launchRocket' }).ok).toBe(false);
  });
});
