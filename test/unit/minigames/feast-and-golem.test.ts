/**
 * The Sharing Feast (`dv.sharing-feast`) and Golem Orders (`dv.golem-orders`) adapters through
 * the public narrative API: moves, checks, completion, projection, restore round trips and
 * rejected moves. Quotients, remainders and expression values are worked out by hand.
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
import {
  bracketed,
  readsAsComputed,
  readyOperations,
  reduceAt,
} from '../../../src/rules/minigames/golem-orders';
import { group, num, op } from '../../../src/rules/contract';
import type {
  Expr,
  ExprPath,
  GolemOrdersBoard,
  MinigameMove,
  Operator,
  SharingFeastBoard,
} from '../../../src/rules/contract';
import { textbookSteps, writtenText } from '../../traces/support';

function definition(kind: string, config: unknown): MinigameDefinition {
  return {
    schema: 1,
    id: `${kind}-board`,
    revision: '1',
    kind,
    adapterSchema: 1,
    config: config as never,
    outputs: [],
  };
}

function play(def: MinigameDefinition, moves: MinigameMove[]): MinigameState {
  let state = createMinigame(def, 'b1', MINIGAMES);
  for (const move of moves) {
    state = reduceMinigame(
      def,
      state,
      { type: 'move', revision: state.revision, value: move as never },
      MINIGAMES,
    );
  }
  return state;
}

const attempt = (def: MinigameDefinition, state: MinigameState, move: unknown) => () =>
  reduceMinigame(
    def,
    state,
    { type: 'move', revision: state.revision, value: move as never },
    MINIGAMES,
  );

describe('Sharing Feast', () => {
  // 23 berries, 5 baskets: 4 each, 3 left in the bowl.
  const feast = definition('dv.sharing-feast', { total: 23, baskets: 5, remainder: true });
  const view = (state: MinigameState) =>
    projectMinigame(feast, state, MINIGAMES).view as unknown as Omit<SharingFeastBoard, 'kind'>;
  const deal4: MinigameMove[] = Array.from({ length: 4 }, () => ({ type: 'deal' }));

  it('starts with everything in the bowl', () => {
    expect(view(play(feast, []))).toEqual({
      total: 23,
      baskets: 5,
      remainder: true,
      inBaskets: [0, 0, 0, 0, 0],
      bowl: 23,
      last: null,
      attempts: 0,
    });
  });

  it('deals one into every basket at a time, and puts or takes single pieces', () => {
    const dealt = play(feast, [{ type: 'deal' }, { type: 'put', basket: 2, count: 2 }]);
    expect(view(dealt)).toMatchObject({ inBaskets: [1, 1, 3, 1, 1], bowl: 16 });
    const back = play(feast, [{ type: 'deal' }, { type: 'take', basket: 0 }]);
    expect(view(back)).toMatchObject({ inBaskets: [0, 1, 1, 1, 1], bowl: 19 });
  });

  it('answers a check gently: uneven baskets, more to share, numbers that do not match', () => {
    const uneven = play(feast, [
      { type: 'put', basket: 0 },
      { type: 'submit', each: 1, left: 22 },
    ]);
    expect(view(uneven).last).toBe('uneven');
    const more = play(feast, [{ type: 'deal' }, { type: 'submit', each: 1, left: 18 }]);
    expect(view(more).last, '18 left can still go round').toBe('more');
    const count = play(feast, [...deal4, { type: 'submit', each: 4, left: 2 }]);
    expect(view(count).last).toBe('count');
    expect(count.status).toBe('active');
  });

  it('completes when shared out and answered: 23 : 5 = 4 r 3', () => {
    const done = play(feast, [...deal4, { type: 'submit', each: 4, left: 3 }]);
    expect(done.status).toBe('completed');
    expect(view(done)).toMatchObject({ inBaskets: [4, 4, 4, 4, 4], bowl: 3, attempts: 1 });
  });

  it('round-trips through JSON and restore, and refuses a forged "shared"', () => {
    const half = play(feast, [{ type: 'deal' }, { type: 'deal' }]);
    expect(restoreMinigame(feast, JSON.parse(JSON.stringify(half)), MINIGAMES)).toEqual(half);
    const forged = { ...half, progress: { ...(half.progress as object), shared: true } };
    expect(() => restoreMinigame(feast, forged, MINIGAMES)).toThrow(ToolkitError);
  });

  it('rejects impossible moves', () => {
    const start = play(feast, []);
    expect(attempt(feast, start, { type: 'take', basket: 0 })).toThrow(ToolkitError);
    expect(attempt(feast, start, { type: 'put', basket: 5 })).toThrow(ToolkitError);
    expect(attempt(feast, start, { type: 'put', basket: 0, count: 24 })).toThrow(ToolkitError);
    const low = play(feast, deal4);
    expect(attempt(feast, low, { type: 'deal' }), 'only 3 left for 5 baskets').toThrow(
      ToolkitError,
    );
  });

  it('needs the remainder flag when the fruit does not share out evenly', () => {
    expect(() =>
      createMinigame(
        definition('dv.sharing-feast', { total: 23, baskets: 5, remainder: false }),
        'x',
        MINIGAMES,
      ),
    ).toThrow(ToolkitError);
  });
});

describe('Golem Orders', () => {
  // 2 + 3 · 4 − 1 = 13: the multiplication goes first.
  const precedence: Expr = op('sub', op('add', num(2), op('mul', num(3), num(4))), num(1));
  const golem = definition('dv.golem-orders', { expr: precedence });
  const view = (state: MinigameState) =>
    projectMinigame(golem, state, MINIGAMES).view as unknown as Omit<GolemOrdersBoard, 'kind'>;

  it('lets only the multiplication go first in 2 + 3 · 4 − 1', () => {
    expect(readyOperations(precedence)).toEqual([['left', 'right']]);
    const early = play(golem, [{ type: 'pick', path: ['left'] }]);
    expect(view(early)).toMatchObject({ last: 'not-first', picked: null, mistakes: 1 });
  });

  it('shrinks the expression one right step at a time until one number is left', () => {
    const steps: MinigameMove[] = [
      { type: 'pick', path: ['left', 'right'] },
      { type: 'answer', value: 12 },
      { type: 'pick', path: ['left'] },
      { type: 'answer', value: 14 },
      { type: 'pick', path: [] },
      { type: 'answer', value: 13 },
    ];
    const two = play(golem, steps.slice(0, 2));
    expect(view(two).expr).toEqual(op('sub', op('add', num(2), num(12)), num(1)));
    const done = play(golem, steps);
    expect(done.status).toBe('completed');
    expect(view(done)).toMatchObject({ expr: num(13), steps: 3, mistakes: 0, start: precedence });
  });

  it('keeps the pick after a wrong value, so the child can try again', () => {
    const wrong = play(golem, [
      { type: 'pick', path: ['left', 'right'] },
      { type: 'answer', value: 7 },
    ]);
    expect(view(wrong)).toMatchObject({
      last: 'wrong-value',
      picked: ['left', 'right'],
      mistakes: 1,
    });
  });

  it('does brackets first and drops them once a number is left: (2 + 3) · 4', () => {
    const brackets = definition('dv.golem-orders', {
      expr: op('mul', group(op('add', num(2), num(3))), num(4)),
    });
    const state = play(brackets, [
      { type: 'pick', path: ['left', 'inner'] },
      { type: 'answer', value: 5 },
    ]);
    expect(
      (projectMinigame(brackets, state, MINIGAMES).view as unknown as GolemOrdersBoard).expr,
    ).toEqual(op('mul', num(5), num(4)));
  });

  it('accepts either of two independent multiplications first: 2 · 3 + 4 · 5', () => {
    const both = op('add', op('mul', num(2), num(3)), op('mul', num(4), num(5)));
    expect(readyOperations(both)).toEqual([['left'], ['right']]);
  });

  it('round-trips through JSON and restore, and refuses an expression it never reached', () => {
    const one = play(golem, [
      { type: 'pick', path: ['left', 'right'] },
      { type: 'answer', value: 12 },
    ]);
    expect(restoreMinigame(golem, JSON.parse(JSON.stringify(one)), MINIGAMES)).toEqual(one);
    const progress = one.progress as unknown as { expr: Expr };
    const forged = {
      ...one,
      progress: { ...progress, expr: op('sub', op('add', num(2), num(13)), num(1)) },
    };
    expect(() => restoreMinigame(golem, forged, MINIGAMES)).toThrow(ToolkitError);
  });

  it('rejects answering before picking, and picking something that is not an operation', () => {
    const start = play(golem, []);
    expect(attempt(golem, start, { type: 'answer', value: 12 })).toThrow(ToolkitError);
    expect(attempt(golem, start, { type: 'pick', path: ['right'] })).toThrow(ToolkitError);
  });
});

describe('Golem Orders: the textbook order of the written expression', () => {
  // 60 + 6 + 45 : 5 = 75 as a reader works it out, and the same value as a tree that reads
  // differently (the order generator built such trees: the Golem then refused 60 + 6 after 45 : 5).
  const asRead: Expr = op('add', op('add', num(60), num(6)), op('div', num(45), num(5)));
  const rightNested: Expr = op('add', num(60), op('add', num(6), op('div', num(45), num(5))));
  const board = definition('dv.golem-orders', { expr: asRead });
  const viewOf = (state: MinigameState) =>
    projectMinigame(board, state, MINIGAMES).view as unknown as Omit<GolemOrdersBoard, 'kind'>;

  it('refuses a tree that reads differently from how it would be worked out', () => {
    expect(readsAsComputed(asRead)).toBe(true);
    expect(readsAsComputed(rightNested), '60 + (6 + 45 : 5) written 60 + 6 + 45 : 5').toBe(false);
    expect(readsAsComputed(op('sub', num(8), op('sub', num(3), num(1)))), '8 − (3 − 1)').toBe(
      false,
    );
    expect(readsAsComputed(op('mul', op('add', num(2), num(3)), num(4))), '(2 + 3) · 4').toBe(
      false,
    );
    expect(readsAsComputed(op('sub', num(8), group(op('sub', num(3), num(1)))))).toBe(true);
    expect(() =>
      createMinigame(definition('dv.golem-orders', { expr: rightNested }), 'x', MINIGAMES),
    ).toThrow(ToolkitError);
  });

  it('refuses a restored expression that reads differently, even with the right value', () => {
    const one = play(board, [
      { type: 'pick', path: ['right'] },
      { type: 'answer', value: 9 },
    ]);
    expect(restoreMinigame(board, JSON.parse(JSON.stringify(one)), MINIGAMES)).toEqual(one);
    const progress = one.progress as unknown as { expr: Expr };
    const forged = {
      ...one,
      progress: { ...progress, expr: op('add', num(60), op('add', num(6), num(9))) },
    };
    expect(() => restoreMinigame(board, forged, MINIGAMES)).toThrow(ToolkitError);
  });

  it('works 60 + 6 + 45 : 5 as a textbook does: 45 : 5, then 60 + 6, then 66 + 9', () => {
    expect(readyOperations(asRead)).toEqual([['right']]);
    expect(viewOf(play(board, [{ type: 'pick', path: ['left'] }])).last, '60 + 6 first').toBe(
      'not-first',
    );
    const steps: MinigameMove[] = [
      { type: 'pick', path: ['right'] },
      { type: 'answer', value: 9 },
      { type: 'pick', path: ['left'] },
      { type: 'answer', value: 66 },
      { type: 'pick', path: [] },
      { type: 'answer', value: 75 },
    ];
    expect(viewOf(play(board, steps.slice(0, 2))).expr).toEqual(
      op('add', op('add', num(60), num(6)), num(9)),
    );
    const done = play(board, steps);
    expect(done.status).toBe('completed');
    expect(viewOf(done)).toMatchObject({ expr: num(75), steps: 3, mistakes: 0 });
  });

  it('writes in the brackets a tree needs, and leaves a tree that reads right alone', () => {
    expect(bracketed(rightNested)).toEqual(
      op('add', num(60), group(op('add', num(6), op('div', num(45), num(5))))),
    );
    expect(bracketed(asRead)).toEqual(asRead);
    expect(bracketed(op('mul', op('add', num(2), num(3)), num(4)))).toEqual(
      op('mul', group(op('add', num(2), num(3))), num(4)),
    );
    expect(bracketed(op('sub', num(8), op('sub', num(3), num(1))))).toEqual(
      op('sub', num(8), group(op('sub', num(3), num(1)))),
    );
  });

  it('takes separate brackets in either order, and inner brackets before outer ones', () => {
    // (8 − 6) + (2 · 3): each pair on its own, whatever its operation.
    const pairs = op('add', group(op('sub', num(8), num(6))), group(op('mul', num(2), num(3))));
    expect(readyOperations(pairs)).toEqual([
      ['left', 'inner'],
      ['right', 'inner'],
    ]);
    // (1 + 2 + (3 + 4)) · 2: the inner pair first, then 1 + 2.
    const inner = group(op('add', num(3), num(4)));
    const nested = op('mul', group(op('add', op('add', num(1), num(2)), inner)), num(2));
    expect(readyOperations(nested)).toEqual([['left', 'inner', 'right', 'inner']]);
  });

  it('allows exactly the textbook steps at every point of every expression of up to three operations', () => {
    const operators: Operator[] = ['add', 'sub', 'mul', 'div'];
    const shapes = (n: number): Expr[] => {
      if (n === 0) return [num(0)];
      const out: Expr[] = [];
      for (let left = 0; left < n; left++) {
        for (const l of shapes(left))
          for (const r of shapes(n - 1 - left)) out.push(op('add', l, r));
      }
      return out;
    };
    // Operators in reading order, the k-th operation in brackets when bit k of `mask` is set.
    const label = (shape: Expr, ops: Operator[], mask: number): Expr => {
      let next = 0;
      let leaf = 2;
      const visit = (node: Expr): Expr => {
        if (node.kind !== 'op') return num(leaf++);
        const left = visit(node.left);
        const k = next++;
        const labelled = op(ops[k]!, left, visit(node.right));
        return mask & (1 << k) ? group(labelled) : labelled;
      };
      return visit(shape);
    };
    const paths = (list: readonly ExprPath[]) => list.map((p) => p.join('/') || '·').sort();
    const seen = new Set<string>();
    const explore = (expr: Expr): void => {
      const id = JSON.stringify(expr);
      if (seen.has(id)) return;
      seen.add(id);
      expect(readsAsComputed(expr), writtenText(expr)).toBe(true);
      const steps = textbookSteps(expr);
      expect(paths(readyOperations(expr)), writtenText(expr)).toEqual(
        paths(steps.map((s) => s.path)),
      );
      for (const step of steps) explore(reduceAt(expr, step.path, step.value));
    };
    for (let n = 1; n <= 3; n++) {
      for (const shape of shapes(n)) {
        let sequences: Operator[][] = [[]];
        for (let k = 0; k < n; k++)
          sequences = sequences.flatMap((s) => operators.map((o) => [...s, o]));
        for (const ops of sequences) {
          for (let mask = 0; mask < 1 << n; mask++) explore(bracketed(label(shape, ops, mask)));
        }
      }
    }
    expect(seen.size, 'expressions and their later states checked').toBeGreaterThan(2000);
  });
});
