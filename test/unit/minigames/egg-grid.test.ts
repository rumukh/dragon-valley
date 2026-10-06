/**
 * The Egg Grid adapter (`dv.egg-grid`) through the public narrative minigame API: rectangles,
 * moves, completion at `find`, projection, restore round trips and rejected moves. Expected
 * rectangles are written by hand from the factor pairs of each product.
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
import { rectangles } from '../../../src/rules/minigames/egg-grid';
import type { EggGridBoard, EggGridMove } from '../../../src/rules/contract';

function definition(product: number, find = 4, extra: Record<string, unknown> = {}) {
  const def: MinigameDefinition = {
    schema: 1,
    id: `grid-${product}`,
    revision: '1',
    kind: 'dv.egg-grid',
    adapterSchema: 1,
    config: { product, maxSide: 10, split: 'none', find, ...extra },
    outputs: [],
  };
  return def;
}

function play(def: MinigameDefinition, moves: EggGridMove[]): MinigameState {
  let state = createMinigame(def, 'board-1', MINIGAMES);
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

const board = (def: MinigameDefinition, state: MinigameState) =>
  projectMinigame(def, state, MINIGAMES).view as unknown as Omit<EggGridBoard, 'kind'>;

const build = (rows: number, columns: number): EggGridMove[] => [
  { type: 'set', rows, columns },
  { type: 'submit' },
];

describe('Egg Grid rectangles', () => {
  it('finds every factor pair up to 10 × 10, both ways round', () => {
    const shapes = (product: number) =>
      rectangles(product, 10).map((r) => `${r.rows}x${r.columns}`);
    expect(shapes(12)).toEqual(['2x6', '3x4', '4x3', '6x2']);
    expect(shapes(10)).toEqual(['1x10', '2x5', '5x2', '10x1']);
    expect(shapes(25)).toEqual(['5x5']);
    expect(shapes(7)).toEqual(['1x7', '7x1']);
    expect(shapes(36)).toEqual(['4x9', '6x6', '9x4']);
    expect(shapes(90)).toEqual(['9x10', '10x9']);
  });
});

describe('playing an Egg Grid', () => {
  const def = definition(12);

  it('starts with a single egg and nothing found, in the ruled projection shape', () => {
    expect(board(def, play(def, []))).toEqual({
      product: 12,
      maxSide: 10,
      split: 'none',
      find: 4,
      rows: 1,
      columns: 1,
      found: [],
      last: null,
    });
  });

  it('answers a wrong rectangle with "not yet" and keeps the board unchanged otherwise', () => {
    const state = play(def, build(3, 3));
    expect(board(def, state)).toMatchObject({ found: [], last: 'wrong', rows: 3, columns: 3 });
    expect(state.status).toBe('active');
  });

  it('accepts a right rectangle once and recognises it the second time', () => {
    const once = play(def, build(3, 4));
    expect(board(def, once).found).toEqual([{ rows: 3, columns: 4 }]);
    expect(board(def, once).last).toBe('found');
    const twice = play(def, [...build(3, 4), ...build(3, 4)]);
    expect(board(def, twice).found).toHaveLength(1);
    expect(board(def, twice).last).toBe('again');
  });

  it('treats the swapped rectangle as a new one (commutativity) and completes at `find`', () => {
    const three = play(def, [...build(3, 4), ...build(4, 3), ...build(2, 6)]);
    expect(three.status).toBe('active');
    const all = play(def, [...build(3, 4), ...build(4, 3), ...build(2, 6), ...build(6, 2)]);
    expect(all.status).toBe('completed');
    expect(all.result?.id).toBe('board-1:complete');
    expect(board(def, all).found.map((r) => `${r.rows}x${r.columns}`)).toEqual([
      '3x4',
      '4x3',
      '2x6',
      '6x2',
    ]);
    const quick = definition(12, 2);
    expect(play(quick, [...build(3, 4), ...build(4, 3)]).status).toBe('completed');
  });

  it('round-trips a half-finished board through JSON and restore', () => {
    const state = play(def, [...build(3, 4), ...build(5, 5)]);
    const restored = restoreMinigame(def, JSON.parse(JSON.stringify(state)), MINIGAMES);
    expect(restored).toEqual(state);
    expect(board(def, restored)).toEqual(board(def, state));
  });

  it('refuses to restore progress that is not true of the board', () => {
    const state = play(def, build(3, 4));
    const forged = { ...state, progress: { ...(state.progress as object), found: ['3x5'] } };
    expect(() => restoreMinigame(def, forged, MINIGAMES)).toThrow(ToolkitError);
    const early = { ...state, status: 'completed' };
    expect(() => restoreMinigame(def, early, MINIGAMES)).toThrow(ToolkitError);
  });

  it('rejects moves outside the nest or of an unknown shape', () => {
    const state = play(def, []);
    const attempt = (value: unknown) => () =>
      reduceMinigame(def, state, { type: 'move', revision: 0, value: value as never }, MINIGAMES);
    expect(attempt({ type: 'set', rows: 0, columns: 3 })).toThrow(ToolkitError);
    expect(attempt({ type: 'set', rows: 11, columns: 1 })).toThrow(ToolkitError);
    expect(attempt({ type: 'submit', rows: 3 })).toThrow(ToolkitError);
    expect(attempt({ type: 'flip' })).toThrow(ToolkitError);
  });

  it('rejects a board no rectangle can hold, or asking for more rectangles than exist', () => {
    expect(() => createMinigame(definition(11 * 13), 'x', MINIGAMES)).toThrow(ToolkitError);
    expect(() => createMinigame(definition(25, 2), 'x', MINIGAMES)).toThrow(ToolkitError);
    expect(() => createMinigame(definition(12, 4, { split: 'sideways' }), 'x', MINIGAMES)).toThrow(
      ToolkitError,
    );
  });
});
