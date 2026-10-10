/**
 * Ten Frame (`dv.ten-frame`): two ten-frames model numbers 0..20. The board deliberately keeps a
 * wrong check editable: children can add/remove counters and try again without losing anything.
 *
 * Config `{ task, a, b, target, item }`; state `{ frames, last, done, attempts }`. `show` starts
 * empty and is right when the frames show `target` with the first frame filled before the second.
 * `make-ten` starts with `a` counters and is right when the first frame has ten. `cross` starts
 * with `a` counters and is right when frame 1 has ten and frame 2 has the rest of `b`.
 */
import type { MinigameAdapter } from '@aegis/narrative';
import type { TenFrameBoard, TenFrameMove } from '../contract';
import { array, boolean, integer, invalid, literal, object } from './decode';

export const TEN_FRAME_KIND = 'dv.ten-frame';

export interface TenFrameConfig {
  task: 'show' | 'make-ten' | 'cross';
  a: number;
  b: number | null;
  target: number;
  item: string;
}

export interface TenFrameState {
  frames: [number, number];
  last: 'right' | 'wrong' | null;
  done: boolean;
  attempts: number;
}

function expected(config: TenFrameConfig): [number, number] {
  if (config.task === 'show') return [Math.min(config.target, 10), Math.max(0, config.target - 10)];
  if (config.task === 'make-ten') return [10, 0];
  const b = config.b ?? 0;
  return [10, b - (10 - config.a)];
}

function check(config: TenFrameConfig, frames: readonly number[], value?: number): boolean {
  const want = expected(config);
  const valueOk =
    config.task === 'show'
      ? value === undefined || value === config.target
      : config.task === 'make-ten'
        ? value === undefined || value === 10 - config.a
        : value === config.target;
  return frames[0] === want[0] && frames[1] === want[1] && valueOk;
}

export const tenFrameAdapter: MinigameAdapter<
  TenFrameConfig,
  TenFrameState,
  TenFrameMove,
  Omit<TenFrameBoard, 'kind'>
> = {
  kind: TEN_FRAME_KIND,
  schema: 1,
  config(value) {
    const o = object(value, '$.config', ['task', 'a', 'b', 'target', 'item']);
    const config = {
      task: literal(o.task, '$.config.task', ['show', 'make-ten', 'cross'] as const),
      a: integer(o.a, '$.config.a', 0, 20),
      b: o.b === null ? null : integer(o.b, '$.config.b', 0, 10),
      target: integer(o.target, '$.config.target', 0, 20),
      item: typeof o.item === 'string' ? o.item : invalid('$.config.item', 'Expected item ID.'),
    };
    if (config.task === 'show' && (config.b !== null || config.a !== 0)) {
      invalid('$.config', 'A show task uses a = 0 and b = null.');
    }
    if (
      config.task === 'make-ten' &&
      (config.b !== null || config.target !== 10 || config.a > 10)
    ) {
      invalid('$.config', 'A make-ten task uses a <= 10, b = null, target = 10.');
    }
    if (
      config.task === 'cross' &&
      (config.b === null || config.a > 10 || config.a + config.b <= 10 || config.a + config.b > 20)
    ) {
      invalid('$.config', 'A cross task needs a + b crossing ten within 20.');
    }
    return config;
  },
  state(value) {
    const o = object(value, '$.progress', ['frames', 'last', 'done', 'attempts']);
    const frames = array(o.frames, '$.progress.frames', { min: 2, max: 2 }).map((count, i) =>
      integer(count, `$.progress.frames[${i}]`, 0, 10),
    ) as [number, number];
    return {
      frames,
      last:
        o.last === null ? null : literal(o.last, '$.progress.last', ['right', 'wrong'] as const),
      done: boolean(o.done, '$.progress.done'),
      attempts: integer(o.attempts, '$.progress.attempts', 0, 1_000_000),
    };
  },
  action(value) {
    const o = object(value, '$.move', ['type', 'frame', 'count', 'value']);
    const type = literal(o.type, '$.move.type', ['add', 'remove', 'submit'] as const);
    if (type === 'submit') {
      object(value, '$.move', ['type', 'value']);
      return {
        type,
        value: o.value === undefined ? undefined : integer(o.value, '$.move.value', 0, 20),
      };
    }
    object(value, '$.move', ['type', 'frame', 'count']);
    return {
      type,
      frame: integer(o.frame, '$.move.frame', 0, 1),
      count: o.count === undefined ? 1 : integer(o.count, '$.move.count', 1, 10),
    };
  },
  initial: (config) => ({
    frames: config.task === 'show' ? [0, 0] : [config.a, 0],
    last: null,
    done: false,
    attempts: 0,
  }),
  reduce(config, state, move) {
    if (move.type === 'submit') {
      const right = check(config, state.frames, move.value);
      return {
        ...state,
        last: right ? 'right' : 'wrong',
        done: right,
        attempts: state.attempts + 1,
      };
    }
    const frames: [number, number] = [...state.frames];
    const count = move.count ?? 1;
    const current = frames[move.frame] ?? 0;
    frames[move.frame] =
      move.type === 'add' ? Math.min(10, current + count) : Math.max(0, current - count);
    return { ...state, frames, last: null, done: false };
  },
  project: (config, state) => ({
    task: config.task,
    a: config.a,
    b: config.b,
    target: config.target,
    frames: [...state.frames] as [number, number],
    last: state.last,
    attempts: state.attempts,
  }),
  completed: (_config, state) => state.done,
};
