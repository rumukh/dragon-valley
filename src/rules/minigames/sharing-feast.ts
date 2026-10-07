/**
 * Sharing Feast (`dv.sharing-feast`): share `total` fruit between `baskets` baskets so that every
 * basket has the same number; what cannot be shared stays in the bowl (the remainder, always
 * fewer than the baskets). The child moves fruit (`put`, `take`, or `deal` one into every basket),
 * then says how many each basket got and how many are left (`submit`). The board is complete when
 * the baskets are equal, the bowl cannot go round once more, and the answer matches the baskets.
 *
 * Config `{ total, baskets, remainder }` (`remainder`: leftovers are expected); a check that is
 * not right answers `uneven` (the baskets differ), `more` (the bowl can go round again) or `count`
 * (the numbers do not match the baskets). Nothing is ever taken away.
 */
import type { MinigameAdapter } from '@aegis/narrative';
import type { SharingFeastBoard, SharingFeastMove } from '../contract';
import { array, boolean, integer, invalid, literal, object } from './decode';

export const SHARING_FEAST_KIND = 'dv.sharing-feast';
const MAX_TOTAL = 999;

export interface SharingFeastConfig {
  total: number;
  baskets: number;
  remainder: boolean;
}

export interface SharingFeastState {
  inBaskets: number[];
  last: 'uneven' | 'more' | 'count' | null;
  /** True once a check was right (the board is then complete). */
  shared: boolean;
  attempts: number;
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

export function bowlOf(config: SharingFeastConfig, inBaskets: readonly number[]): number {
  return config.total - sum(inBaskets);
}

/** The check of a submitted answer against the baskets: `null` when it is right. */
export function checkShare(
  config: SharingFeastConfig,
  inBaskets: readonly number[],
  each: number,
  left: number,
): 'uneven' | 'more' | 'count' | null {
  const first = inBaskets[0] ?? 0;
  if (inBaskets.some((count) => count !== first)) return 'uneven';
  const bowl = bowlOf(config, inBaskets);
  if (bowl >= config.baskets) return 'more';
  return each === first && left === bowl ? null : 'count';
}

export const sharingFeastAdapter: MinigameAdapter<
  SharingFeastConfig,
  SharingFeastState,
  SharingFeastMove,
  Omit<SharingFeastBoard, 'kind'>
> = {
  kind: SHARING_FEAST_KIND,
  schema: 1,
  config(value) {
    const o = object(value, '$.config', ['total', 'baskets', 'remainder']);
    const config = {
      total: integer(o.total, '$.config.total', 1, MAX_TOTAL),
      baskets: integer(o.baskets, '$.config.baskets', 2, 10),
      remainder: boolean(o.remainder, '$.config.remainder'),
    };
    if (!config.remainder && config.total % config.baskets !== 0) {
      invalid('$.config.remainder', 'This feast has leftovers: set remainder.');
    }
    return config;
  },
  state(value, config) {
    const o = object(value, '$.progress', ['inBaskets', 'last', 'shared', 'attempts']);
    const inBaskets = array(o.inBaskets, '$.progress.inBaskets', {
      min: config.baskets,
      max: config.baskets,
    }).map((count, i) => integer(count, `$.progress.inBaskets[${i}]`, 0, config.total));
    if (sum(inBaskets) > config.total) invalid('$.progress.inBaskets', 'More fruit than exists.');
    const shared = boolean(o.shared, '$.progress.shared');
    if (shared) {
      const first = inBaskets[0]!;
      const answer = checkShare(config, inBaskets, first, bowlOf(config, inBaskets));
      if (answer !== null) invalid('$.progress.shared', 'The fruit is not shared out yet.');
    }
    return {
      inBaskets,
      last:
        o.last === null
          ? null
          : literal(o.last, '$.progress.last', ['uneven', 'more', 'count'] as const),
      shared,
      attempts: integer(o.attempts, '$.progress.attempts', 0, 1_000_000),
    };
  },
  action(value, config) {
    const o = object(value, '$.move', ['type', 'basket', 'count', 'each', 'left']);
    const type = literal(o.type, '$.move.type', ['put', 'take', 'deal', 'submit'] as const);
    if (type === 'deal') {
      object(value, '$.move', ['type']);
      return { type };
    }
    if (type === 'submit') {
      object(value, '$.move', ['type', 'each', 'left']);
      return {
        type,
        each: integer(o.each, '$.move.each', 0, config.total),
        left: integer(o.left, '$.move.left', 0, config.total),
      };
    }
    object(value, '$.move', ['type', 'basket', 'count']);
    return {
      type,
      basket: integer(o.basket, '$.move.basket', 0, config.baskets - 1),
      count: o.count === undefined ? 1 : integer(o.count, '$.move.count', 1, config.total),
    };
  },
  initial: (config) => ({
    inBaskets: Array.from({ length: config.baskets }, () => 0),
    last: null,
    shared: false,
    attempts: 0,
  }),
  reduce(config, state, move) {
    if (move.type === 'submit') {
      const last = checkShare(config, state.inBaskets, move.each, move.left);
      return { ...state, last, shared: last === null, attempts: state.attempts + 1 };
    }
    const bowl = bowlOf(config, state.inBaskets);
    if (move.type === 'deal') {
      if (bowl < config.baskets) invalid('$.move', 'Not enough fruit to go round.');
      return { ...state, inBaskets: state.inBaskets.map((count) => count + 1), last: null };
    }
    const count = move.count ?? 1;
    const inBaskets = [...state.inBaskets];
    if (move.type === 'put') {
      if (count > bowl) invalid('$.move.count', 'Not that much fruit in the bowl.');
      inBaskets[move.basket] = inBaskets[move.basket]! + count;
    } else {
      if (count > inBaskets[move.basket]!) invalid('$.move.count', 'Not that much in the basket.');
      inBaskets[move.basket] = inBaskets[move.basket]! - count;
    }
    return { ...state, inBaskets, last: null };
  },
  project: (config, state) => ({
    total: config.total,
    baskets: config.baskets,
    remainder: config.remainder,
    inBaskets: [...state.inBaskets],
    bowl: bowlOf(config, state.inBaskets),
    last: state.last,
    attempts: state.attempts,
  }),
  completed: (config, state) => state.shared,
};
