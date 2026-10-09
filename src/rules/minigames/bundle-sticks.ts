/**
 * Bundle Sticks (`dv.place-value`): loose sticks can be bundled into tens or unbundled for
 * borrowing. Build tasks start empty; add and sub tasks start from `a`. A wrong submit only marks
 * the board and leaves it editable.
 *
 * Config `{ task, target, a, b, item }`; state `{ bundles, loose, last, done, attempts }`.
 */
import type { MinigameAdapter } from '@aegis/narrative';
import type { BundleSticksBoard, BundleSticksMove } from '../contract';
import { boolean, integer, invalid, literal, object } from './decode';

export const BUNDLE_STICKS_KIND = 'dv.place-value';

export interface BundleSticksConfig {
  task: 'build' | 'add' | 'sub';
  target: number | null;
  a: number | null;
  b: number | null;
  item: string;
}

export interface BundleSticksState {
  bundles: number;
  loose: number;
  last: 'right' | 'wrong' | null;
  done: boolean;
  attempts: number;
}

const valueOf = (state: Pick<BundleSticksState, 'bundles' | 'loose'>) =>
  state.bundles * 10 + state.loose;

function start(config: BundleSticksConfig): { bundles: number; loose: number } {
  const value = config.task === 'build' ? 0 : (config.a ?? 0);
  return { bundles: Math.floor(value / 10), loose: value % 10 };
}

function expected(config: BundleSticksConfig): number {
  if (config.task === 'build') return config.target ?? 0;
  if (config.task === 'add') return (config.a ?? 0) + (config.b ?? 0);
  return (config.a ?? 0) - (config.b ?? 0);
}

export const bundleSticksAdapter: MinigameAdapter<
  BundleSticksConfig,
  BundleSticksState,
  BundleSticksMove,
  Omit<BundleSticksBoard, 'kind'>
> = {
  kind: BUNDLE_STICKS_KIND,
  schema: 1,
  config(value) {
    const o = object(value, '$.config', ['task', 'target', 'a', 'b', 'item']);
    const config = {
      task: literal(o.task, '$.config.task', ['build', 'add', 'sub'] as const),
      target: o.target === null ? null : integer(o.target, '$.config.target', 0, 100),
      a: o.a === null ? null : integer(o.a, '$.config.a', 0, 100),
      b: o.b === null ? null : integer(o.b, '$.config.b', 0, 100),
      item: typeof o.item === 'string' ? o.item : invalid('$.config.item', 'Expected item ID.'),
    };
    if (
      config.task === 'build' &&
      (config.target === null || config.a !== null || config.b !== null)
    ) {
      invalid('$.config', 'A build task has target and no operands.');
    }
    if (
      config.task !== 'build' &&
      (config.target !== null || config.a === null || config.b === null)
    ) {
      invalid('$.config', 'An add/sub task has operands and no target.');
    }
    if (expected(config) < 0 || expected(config) > 100)
      invalid('$.config', 'Result must be 0..100.');
    return config;
  },
  state(value) {
    const o = object(value, '$.progress', ['bundles', 'loose', 'last', 'done', 'attempts']);
    return {
      bundles: integer(o.bundles, '$.progress.bundles', 0, 10),
      loose: integer(o.loose, '$.progress.loose', 0, 100),
      last:
        o.last === null ? null : literal(o.last, '$.progress.last', ['right', 'wrong'] as const),
      done: boolean(o.done, '$.progress.done'),
      attempts: integer(o.attempts, '$.progress.attempts', 0, 1_000_000),
    };
  },
  action(value) {
    const o = object(value, '$.move', ['type', 'what']);
    const type = literal(o.type, '$.move.type', [
      'bundle',
      'unbundle',
      'add',
      'remove',
      'submit',
    ] as const);
    if (type === 'bundle' || type === 'unbundle' || type === 'submit') {
      object(value, '$.move', ['type']);
      return { type };
    }
    object(value, '$.move', ['type', 'what']);
    return { type, what: literal(o.what, '$.move.what', ['bundle', 'stick'] as const) };
  },
  initial: (config) => ({ ...start(config), last: null, done: false, attempts: 0 }),
  reduce(config, state, move) {
    if (move.type === 'submit') {
      const right = valueOf(state) === expected(config) && state.loose < 10;
      return {
        ...state,
        last: right ? 'right' : 'wrong',
        done: right,
        attempts: state.attempts + 1,
      };
    }
    if (move.type === 'bundle') {
      if (state.loose < 10) invalid('$.move', 'Need ten loose sticks to make a bundle.');
      return {
        ...state,
        bundles: state.bundles + 1,
        loose: state.loose - 10,
        last: null,
        done: false,
      };
    }
    if (move.type === 'unbundle') {
      if (state.bundles < 1) invalid('$.move', 'Need a bundle to unbundle.');
      return {
        ...state,
        bundles: state.bundles - 1,
        loose: state.loose + 10,
        last: null,
        done: false,
      };
    }
    const delta = move.what === 'bundle' ? 10 : 1;
    const next = move.type === 'add' ? valueOf(state) + delta : valueOf(state) - delta;
    if (next < 0 || next > 100) invalid('$.move', 'The sticks must stay within 0..100.');
    if (move.type === 'remove' && move.what === 'bundle' && state.bundles < 1) {
      invalid('$.move', 'No bundle to remove.');
    }
    if (move.type === 'remove' && move.what === 'stick' && state.loose < 1) {
      invalid('$.move', 'No loose stick to remove.');
    }
    return {
      ...state,
      bundles:
        move.what === 'bundle' ? state.bundles + (move.type === 'add' ? 1 : -1) : state.bundles,
      loose: move.what === 'stick' ? state.loose + (move.type === 'add' ? 1 : -1) : state.loose,
      last: null,
      done: false,
    };
  },
  project: (config, state) => ({
    task: config.task,
    target: config.target,
    a: config.a,
    b: config.b,
    bundles: state.bundles,
    loose: state.loose,
    last: state.last,
    attempts: state.attempts,
  }),
  completed: (_config, state) => state.done,
};
