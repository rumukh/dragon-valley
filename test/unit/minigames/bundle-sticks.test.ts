import { createPrng } from '@aegis/core';
import { ToolkitError, createMinigame, projectMinigame, reduceMinigame } from '@aegis/narrative';
import type { MinigameDefinition, MinigameState } from '@aegis/narrative';
import { describe, expect, it } from 'vitest';
import { initialProfileState } from '../../../src/rules/contract';
import type { BundleSticksMove, Skill } from '../../../src/rules/contract';
import { MINIGAMES, boardCredits, makeBoard } from '../../../src/rules/minigames/boards';

const placeSkill: Skill = {
  id: 'place',
  titleKey: 'skill.place',
  generator: 'num.place',
  params: { numbers: [10, 20], asks: ['compose'] },
};

const addSubSkill: Skill = {
  id: 'addsub',
  titleKey: 'skill.addsub',
  generator: 'addsub.2d',
  params: {
    operators: ['add', 'sub'],
    shapes: ['2d1d'],
    twoDigit: [10, 20],
    crossing: 'allowed',
    resultMax: 100,
  },
};

function play(def: MinigameDefinition, moves: BundleSticksMove[]): MinigameState {
  let state = createMinigame(def, def.id, MINIGAMES);
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

const view = (def: MinigameDefinition, state: MinigameState) =>
  projectMinigame(def, state, MINIGAMES).view;

describe('Bundle Sticks boards', () => {
  it('builds a place-value number by bundling ten loose sticks', () => {
    const def = makeBoard({
      activity: 'bundle-sticks',
      id: 'bundle.b1',
      pool: ['place:compose'],
      focus: null,
      skills: [placeSkill],
      options: { task: 'build' },
      previous: null,
      state: initialProfileState({ dailyGoal: 30, arena: true }),
      random: createPrng('bundle-build'),
    });
    expect(def.kind).toBe('dv.place-value');
    const target = (def.config as { target: number }).target;
    const moves: BundleSticksMove[] = [
      ...Array.from({ length: target }, () => ({ type: 'add' as const, what: 'stick' as const })),
    ];
    const unbundled = play(def, [...moves, { type: 'submit' }]);
    expect(unbundled.status).toBe('active');
    const tens = Math.floor(target / 10);
    const ones = target % 10;
    const bundled = play(def, [
      ...moves,
      ...Array.from({ length: tens }, () => ({ type: 'bundle' as const })),
      { type: 'submit' },
    ]);
    expect(bundled.status).toBe('completed');
    expect(view(def, bundled)).toMatchObject({ bundles: tens, loose: ones });
    expect(boardCredits(def, unbundled, bundled, new Set(['place:compose']))).toEqual({
      items: [{ item: 'place:compose', bucket: 'ok' }],
      coins: 1,
    });
  });

  it('supports unbundling for subtraction with borrowing', () => {
    const def = makeBoard({
      activity: 'bundle-sticks',
      id: 'bundle.b2',
      pool: ['sub2d:2d1d-borrow'],
      focus: null,
      skills: [addSubSkill],
      options: { task: 'sub' },
      previous: null,
      state: initialProfileState({ dailyGoal: 30, arena: true }),
      random: createPrng('bundle-sub'),
    });
    const { a, b } = def.config as { a: number; b: number };
    expect(a % 10).toBeLessThan(b % 10);
    const state = play(def, [
      { type: 'unbundle' },
      ...Array.from({ length: b }, () => ({ type: 'remove' as const, what: 'stick' as const })),
      { type: 'submit' },
    ]);
    expect(state.status).toBe('completed');
  });

  it('rejects impossible stick moves', () => {
    const def: MinigameDefinition = {
      schema: 1,
      id: 'bundle-bad',
      revision: '1',
      kind: 'dv.place-value',
      adapterSchema: 1,
      config: { task: 'build', target: 12, a: null, b: null, item: 'place:compose' },
      outputs: [],
    };
    const state = createMinigame(def, def.id, MINIGAMES);
    expect(() =>
      reduceMinigame(
        def,
        state,
        { type: 'move', revision: state.revision, value: { type: 'bundle' } },
        MINIGAMES,
      ),
    ).toThrow(ToolkitError);
  });
});
