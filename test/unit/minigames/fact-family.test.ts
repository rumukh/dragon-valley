/**
 * The Fact Family Nest adapter (`dv.fact-family`): filling, checking, duplicates, completion,
 * restore round trips and rejected moves. The family's four sentences are written by hand.
 */
import { describe, expect, it } from 'vitest';
import {
  ToolkitError,
  createMinigame,
  projectMinigame,
  reduceMinigame,
  restoreMinigame,
} from '@aegis/narrative';
import type { MinigameDefinition, MinigameState } from '@aegis/narrative';
import { MINIGAMES } from '../../../src/rules/minigames/boards';
import type { FactFamilyBoard, FactFamilyMove } from '../../../src/rules/contract';

const def: MinigameDefinition = {
  schema: 1,
  id: 'family-6-7',
  revision: '1',
  kind: 'dv.fact-family',
  adapterSchema: 1,
  config: { a: 6, b: 7, product: 42 },
  outputs: [],
};

function play(moves: FactFamilyMove[]): MinigameState {
  let state = createMinigame(def, 'nest-1', MINIGAMES);
  for (const move of moves) {
    state = reduceMinigame(
      def,
      state,
      { type: 'move', revision: state.revision, value: move },
      MINIGAMES,
    );
  }
  return state;
}

const view = (state: MinigameState) =>
  projectMinigame(def, state, MINIGAMES).view as unknown as FactFamilyBoard;

function write(equation: number, values: [number, number, number]): FactFamilyMove[] {
  return values.map((value, slot) => ({ type: 'fill' as const, equation, slot, value }));
}

const RIGHT: FactFamilyMove[] = [
  ...write(0, [6, 7, 42]),
  ...write(1, [7, 6, 42]),
  ...write(2, [42, 6, 7]),
  ...write(3, [42, 7, 6]),
];

describe('playing a Fact Family Nest', () => {
  it('shows the nest numbers smallest first and four empty equations: two ·, two :', () => {
    const board = view(play([]));
    expect(board.numbers).toEqual([6, 7, 42]);
    expect(board.equations.map((e) => e.op)).toEqual(['mul', 'mul', 'div', 'div']);
    expect(board.equations.every((e) => e.slots.every((s) => s === null))).toBe(true);
  });

  it('completes when all four family sentences are checked right', () => {
    const state = play([...RIGHT, { type: 'submit' }]);
    expect(state.status).toBe('completed');
    expect(view(state).equations.map((e) => e.correct)).toEqual([true, true, true, true]);
    expect(view(state).attempts).toBe(1);
  });

  it('does not count an equation that repeats an earlier one', () => {
    const state = play([
      ...write(0, [6, 7, 42]),
      ...write(1, [6, 7, 42]),
      ...write(2, [42, 6, 7]),
      ...write(3, [42, 7, 6]),
      { type: 'submit' },
    ]);
    expect(state.status).toBe('active');
    expect(view(state).equations.map((e) => e.correct)).toEqual([true, false, true, true]);
    expect(view(state).submitted).toBe(true);
  });

  it('marks a false sentence not yet right, and clears the mark when it is edited', () => {
    const wrong = play([...write(0, [7, 7, 42]), { type: 'submit' }]);
    expect(view(wrong).equations[0]!.correct).toBe(false);
    const edited = play([...write(0, [7, 7, 42]), { type: 'submit' }, ...write(0, [6, 7, 42])]);
    expect(view(edited).equations[0]!.correct).toBeNull();
    expect(view(edited).submitted).toBe(false);
  });

  it('completes on a later check after a wrong first one', () => {
    const state = play([...write(0, [7, 7, 42]), { type: 'submit' }, ...RIGHT, { type: 'submit' }]);
    expect(state.status).toBe('completed');
    expect(view(state).attempts).toBe(2);
  });

  it('round-trips a half-filled board through JSON and restore', () => {
    const state = play([...write(0, [6, 7, 42]), { type: 'submit' }, ...write(1, [7, 6, 42])]);
    expect(restoreMinigame(def, JSON.parse(JSON.stringify(state)), MINIGAMES)).toEqual(state);
  });

  it('refuses to restore a "right" mark the slots do not support', () => {
    const state = play(write(0, [7, 7, 42]));
    const progress = state.progress as { correct: (boolean | null)[] };
    const forged = { ...state, progress: { ...progress, correct: [true, null, null, null] } };
    expect(() => restoreMinigame(def, forged, MINIGAMES)).toThrow(ToolkitError);
  });

  it('only lets nest numbers into the blanks, and only real slots', () => {
    const state = play([]);
    const attempt = (value: unknown) => () =>
      reduceMinigame(def, state, { type: 'move', revision: 0, value: value as never }, MINIGAMES);
    expect(attempt({ type: 'fill', equation: 0, slot: 0, value: 5 })).toThrow(ToolkitError);
    expect(attempt({ type: 'fill', equation: 4, slot: 0, value: 6 })).toThrow(ToolkitError);
    expect(attempt({ type: 'fill', equation: 0, slot: 3, value: 6 })).toThrow(ToolkitError);
    expect(attempt({ type: 'fill', equation: 0, slot: 0, value: null })).not.toThrow();
  });

  it('needs two different factors and their product', () => {
    const bad = (config: unknown) => () =>
      createMinigame({ ...def, config: config as never }, 'x', MINIGAMES);
    expect(bad({ a: 5, b: 5, product: 25 })).toThrow(ToolkitError);
    expect(bad({ a: 6, b: 7, product: 43 })).toThrow(ToolkitError);
  });
});
