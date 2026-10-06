/**
 * Fact Family Nest (`dv.fact-family`): three numbers sit in a nest (for example 6, 7 and 42) and
 * the child completes two multiplications and two divisions with them: `6 · 7 = 42`,
 * `7 · 6 = 42`, `42 : 6 = 7`, `42 : 7 = 6`. Only nest numbers go into the blanks. A check marks
 * each equation right or not yet; an equation that repeats an earlier one is not right. The
 * board is complete when all four are right.
 *
 * Config `{ a, b, product }` (a ≠ b, both at least 1); moves
 * `{ type: 'fill', equation: 0-3, slot: 0-2, value }` and `{ type: 'submit' }`.
 */
import type { MinigameAdapter } from '@aegis/narrative';
import type { FactFamilyBoard, FactFamilyMove } from '../contract';
import { array, boolean, integer, invalid, literal, nullableInteger, object } from './decode';

export const FACT_FAMILY_KIND = 'dv.fact-family';

/** The operator of each of the four equations, in board order. */
export const FAMILY_OPS = ['mul', 'mul', 'div', 'div'] as const;

export interface FactFamilyConfig {
  a: number;
  b: number;
  product: number;
}

export interface FactFamilyState {
  /** Four equations × three slots: left operand, right operand, result. */
  slots: (number | null)[][];
  correct: (boolean | null)[];
  submitted: boolean;
  attempts: number;
}

function nest(config: FactFamilyConfig): number[] {
  return [config.a, config.b, config.product].sort((x, y) => x - y);
}

/** Which equations are right: true sentences of the family, each a different fact. */
export function checkFamily(config: FactFamilyConfig, slots: readonly (number | null)[][]) {
  const seen: string[] = [];
  return FAMILY_OPS.map((operator, index) => {
    const [left, right, result] = slots[index] ?? [];
    if (left === null || right === null || result === null) return false;
    if (left === undefined || right === undefined || result === undefined) return false;
    const fact = `${operator}:${left}:${right}`;
    const isTrue =
      operator === 'mul'
        ? left * right === result && result === config.product
        : right !== 0 && left === config.product && right * result === left;
    if (!isTrue || seen.includes(fact)) return false;
    seen.push(fact);
    return true;
  });
}

export const factFamilyAdapter: MinigameAdapter<
  FactFamilyConfig,
  FactFamilyState,
  FactFamilyMove,
  Omit<FactFamilyBoard, 'kind'>
> = {
  kind: FACT_FAMILY_KIND,
  schema: 1,
  config(value) {
    const o = object(value, '$.config', ['a', 'b', 'product']);
    const config = {
      a: integer(o.a, '$.config.a', 1, 100),
      b: integer(o.b, '$.config.b', 1, 100),
      product: integer(o.product, '$.config.product', 1, 10_000),
    };
    if (config.a === config.b || config.a * config.b !== config.product) {
      invalid('$.config', 'A family needs two different factors and their product.');
    }
    return config;
  },
  state(value, config) {
    const o = object(value, '$.progress', ['slots', 'correct', 'submitted', 'attempts']);
    const allowed = nest(config);
    const slots = array(o.slots, '$.progress.slots', { min: 4, max: 4 }).map((row, i) =>
      array(row, `$.progress.slots[${i}]`, { min: 3, max: 3 }).map((cell, j) => {
        const parsed = nullableInteger(cell, `$.progress.slots[${i}][${j}]`, 0, 10_000);
        if (parsed !== null && !allowed.includes(parsed)) {
          invalid(`$.progress.slots[${i}][${j}]`, 'Only nest numbers go into the blanks.');
        }
        return parsed;
      }),
    );
    const correct = array(o.correct, '$.progress.correct', { min: 4, max: 4 }).map((entry, i) =>
      entry === null ? null : boolean(entry, `$.progress.correct[${i}]`),
    );
    const submitted = boolean(o.submitted, '$.progress.submitted');
    const actual = checkFamily(config, slots);
    correct.forEach((entry, i) => {
      if (entry === true && !actual[i]) {
        invalid(`$.progress.correct[${i}]`, 'This equation is not right.');
      }
    });
    if (submitted && correct.some((entry) => entry === null)) {
      invalid('$.progress.submitted', 'A checked board has a result for every equation.');
    }
    return {
      slots,
      correct,
      submitted,
      attempts: integer(o.attempts, '$.progress.attempts', 0, 1_000_000),
    };
  },
  action(value, config) {
    const o = object(value, '$.move', ['type', 'equation', 'slot', 'value']);
    const type = literal(o.type, '$.move.type', ['fill', 'submit'] as const);
    if (type === 'submit') {
      object(value, '$.move', ['type']);
      return { type };
    }
    const filled = nullableInteger(o.value, '$.move.value', 0, 10_000);
    if (filled !== null && !nest(config).includes(filled)) {
      invalid('$.move.value', 'Only nest numbers go into the blanks.');
    }
    return {
      type,
      equation: integer(o.equation, '$.move.equation', 0, 3),
      slot: integer(o.slot, '$.move.slot', 0, 2),
      value: filled,
    };
  },
  initial: () => ({
    slots: FAMILY_OPS.map(() => [null, null, null]),
    correct: FAMILY_OPS.map(() => null),
    submitted: false,
    attempts: 0,
  }),
  reduce(config, state, move) {
    if (move.type === 'fill') {
      const slots = state.slots.map((row, i) =>
        i === move.equation ? row.map((cell, j) => (j === move.slot ? move.value : cell)) : row,
      );
      const correct = state.correct.map((entry, i) => (i === move.equation ? null : entry));
      return { ...state, slots, correct, submitted: false };
    }
    return {
      ...state,
      correct: checkFamily(config, state.slots),
      submitted: true,
      attempts: state.attempts + 1,
    };
  },
  project: (config, state) => ({
    numbers: nest(config),
    equations: FAMILY_OPS.map((operator, i) => ({
      op: operator,
      slots: [...(state.slots[i] ?? [])],
      correct: state.correct[i] ?? null,
    })),
    submitted: state.submitted,
    attempts: state.attempts,
  }),
  completed: (config, state) => state.submitted && state.correct.every((entry) => entry === true),
};
