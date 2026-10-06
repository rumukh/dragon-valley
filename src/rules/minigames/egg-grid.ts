/**
 * Egg Grid (`dv.egg-grid`): build rows × columns of eggs for a product and find the rectangles
 * that make it. Every rectangle with the right number of eggs is accepted; the board lists the
 * rectangles found (`3 × 4`, `4 × 3`, `2 × 6`, …), which shows factor pairs and commutativity, and
 * is complete once `find` of them are found (the rules ask for all of them).
 *
 * Config `{ product, maxSide, split, find }`; moves `{ type: 'set', rows, columns }` (1..maxSide)
 * and `{ type: 'submit' }`; projection `{ product, maxSide, split, find, rows, columns, found,
 * last }` where `last` is `found`, `again` (found before) or `wrong` (rows × columns is not the
 * product). A wrong submit never costs anything: it only answers "not yet".
 */
import type { MinigameAdapter } from '@aegis/narrative';
import { EGG_GRID_SPLITS } from '../contract';
import type { EggGridBoard, EggGridMove, EggGridSplit } from '../contract';
import { array, integer, invalid, literal, object } from './decode';

export const EGG_GRID_KIND = 'dv.egg-grid';
const MAX_PRODUCT = 10_000;

export interface EggGridConfig {
  product: number;
  maxSide: number;
  split: EggGridSplit;
  /** Rectangles to find before the board is complete. */
  find: number;
}

export interface EggGridState {
  rows: number;
  columns: number;
  /** Rectangles found, as `<rows>x<columns>`, in the order found. */
  found: string[];
  last: 'found' | 'again' | 'wrong' | null;
  attempts: number;
}

/** Every rectangle (rows, columns) with both sides up to `maxSide` that holds `product` eggs. */
export function rectangles(product: number, maxSide: number): { rows: number; columns: number }[] {
  const result: { rows: number; columns: number }[] = [];
  for (let rows = 1; rows <= maxSide; rows++) {
    if (product % rows !== 0) continue;
    const columns = product / rows;
    if (columns <= maxSide) result.push({ rows, columns });
  }
  return result;
}

function key(rows: number, columns: number): string {
  return `${rows}x${columns}`;
}

function parseKey(text: unknown, path: string, config: EggGridConfig): string {
  const match = typeof text === 'string' ? /^([1-9][0-9]?)x([1-9][0-9]?)$/.exec(text) : null;
  if (!match) invalid(path, 'Expected a rectangle like 3x4.');
  const [rows, columns] = [Number(match[1]), Number(match[2])];
  if (rows * columns !== config.product) invalid(path, 'That rectangle does not hold the product.');
  if (rows > config.maxSide || columns > config.maxSide) {
    invalid(path, 'That rectangle does not fit the nest.');
  }
  return key(rows, columns);
}

export const eggGridAdapter: MinigameAdapter<
  EggGridConfig,
  EggGridState,
  EggGridMove,
  Omit<EggGridBoard, 'kind'>
> = {
  kind: EGG_GRID_KIND,
  schema: 1,
  config(value) {
    const o = object(value, '$.config', ['product', 'maxSide', 'split', 'find']);
    const product = integer(o.product, '$.config.product', 1, MAX_PRODUCT);
    const maxSide = integer(o.maxSide, '$.config.maxSide', 1, 10);
    const possible = rectangles(product, maxSide).length;
    if (possible === 0) invalid('$.config.product', 'No rectangle in the nest holds this product.');
    return {
      product,
      maxSide,
      split: literal(o.split, '$.config.split', EGG_GRID_SPLITS),
      find: integer(o.find, '$.config.find', 1, possible),
    };
  },
  state(value, config) {
    const o = object(value, '$.progress', ['rows', 'columns', 'found', 'last', 'attempts']);
    const found = array(o.found, '$.progress.found', { min: 0, max: 10 }).map((entry, i) =>
      parseKey(entry, `$.progress.found[${i}]`, config),
    );
    if (new Set(found).size !== found.length) invalid('$.progress.found', 'Found twice.');
    return {
      rows: integer(o.rows, '$.progress.rows', 1, config.maxSide),
      columns: integer(o.columns, '$.progress.columns', 1, config.maxSide),
      found,
      last:
        o.last === null
          ? null
          : literal(o.last, '$.progress.last', ['found', 'again', 'wrong'] as const),
      attempts: integer(o.attempts, '$.progress.attempts', 0, 1_000_000),
    };
  },
  action(value, config) {
    const o = object(value, '$.move', ['type', 'rows', 'columns']);
    const type = literal(o.type, '$.move.type', ['set', 'submit'] as const);
    if (type === 'submit') {
      object(value, '$.move', ['type']);
      return { type };
    }
    return {
      type,
      rows: integer(o.rows, '$.move.rows', 1, config.maxSide),
      columns: integer(o.columns, '$.move.columns', 1, config.maxSide),
    };
  },
  initial: () => ({ rows: 1, columns: 1, found: [], last: null, attempts: 0 }),
  reduce(config, state, move) {
    if (move.type === 'set') {
      return { ...state, rows: move.rows, columns: move.columns, last: null };
    }
    const attempts = state.attempts + 1;
    if (state.rows * state.columns !== config.product) return { ...state, attempts, last: 'wrong' };
    const found = key(state.rows, state.columns);
    return state.found.includes(found)
      ? { ...state, attempts, last: 'again' }
      : { ...state, attempts, found: [...state.found, found], last: 'found' };
  },
  project: (config, state) => ({
    product: config.product,
    maxSide: config.maxSide,
    split: config.split,
    find: config.find,
    rows: state.rows,
    columns: state.columns,
    found: state.found.map((entry) => {
      const [rows, columns] = entry.split('x').map(Number) as [number, number];
      return { rows, columns };
    }),
    last: state.last,
  }),
  completed: (config, state) => state.found.length >= config.find,
};
