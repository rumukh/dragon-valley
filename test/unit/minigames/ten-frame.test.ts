import { describe, expect, it } from 'vitest';
import { ToolkitError, createMinigame, projectMinigame, reduceMinigame } from '@aegis/narrative';
import type { MinigameDefinition, MinigameState } from '@aegis/narrative';
import { MINIGAMES, boardCredits, makeBoard } from '../../../src/rules/minigames/boards';
import { initialProfileState } from '../../../src/rules/contract';
import type { Skill, TenFrameMove } from '../../../src/rules/contract';
import { createPrng } from '@aegis/core';

const addSkill: Skill = {
  id: 'add-cross',
  titleKey: 'skill.add-cross',
  generator: 'add.fact',
  params: { addends: [0, 10], sumMax: 20, crossing: 'allowed' },
};

function play(def: MinigameDefinition, moves: TenFrameMove[]): MinigameState {
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

describe('Ten Frame boards', () => {
  it('models crossing ten for an addition fact and credits it on completion', () => {
    const def = makeBoard({
      activity: 'ten-frame',
      id: 'ten.b1',
      pool: ['add:8+5'],
      focus: null,
      skills: [addSkill],
      options: { task: 'cross' },
      previous: null,
      state: initialProfileState({ dailyGoal: 30, arena: true }),
      random: createPrng('ten-frame'),
    });
    expect(def.kind).toBe('dv.ten-frame');
    expect(def.config).toMatchObject({ task: 'cross', a: 8, b: 5, target: 13 });
    const first = createMinigame(def, def.id, MINIGAMES);
    expect(view(def, first)).toMatchObject({ frames: [8, 0] });
    const state = play(def, [
      { type: 'add', frame: 0, count: 2 },
      { type: 'add', frame: 1, count: 3 },
      { type: 'submit', value: 13 },
    ]);
    expect(state.status).toBe('completed');
    const credit = boardCredits(def, first, state, new Set(['add:8+5']));
    expect(credit).toEqual({ items: [{ item: 'add:8+5', bucket: 'ok' }], coins: 2 });
  });

  it('keeps a wrong show task editable', () => {
    const def: MinigameDefinition = {
      schema: 1,
      id: 'show-7',
      revision: '1',
      kind: 'dv.ten-frame',
      adapterSchema: 1,
      config: { task: 'show', a: 0, b: null, target: 7, item: 'count:6-10' },
      outputs: [],
    };
    const wrong = play(def, [{ type: 'add', frame: 0, count: 6 }, { type: 'submit' }]);
    expect(wrong.status).toBe('active');
    expect(view(def, wrong)).toMatchObject({ last: 'wrong', frames: [6, 0] });
    expect(() =>
      reduceMinigame(
        def,
        wrong,
        { type: 'move', revision: wrong.revision, value: { type: 'add', frame: 2 } },
        MINIGAMES,
      ),
    ).toThrow(ToolkitError);
  });
});
