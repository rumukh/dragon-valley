/**
 * Every minigame activity of the v1 content deals valid boards: for each level's minigame
 * activities, boards from several seeds are generated from the activity's own items, skills and
 * options, accepted by their adapters, and projected as typed boards of the activity's kind.
 * Golem Orders needs the order-of-operations generator for its expressions; while a build lacks
 * it, its boards are the only ones allowed to be missing. Activities on skills whose generators G2
 * has not implemented yet (Pebble Brook's counting and +/− skills) are dealt once G2 lands.
 */
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import { createMinigame, projectMinigame, reduceMinigame } from '@aegis/narrative';
import type { MinigameDefinition } from '@aegis/narrative';
import {
  ACTIVITY_OPTION_DEFAULTS,
  initialProfileState,
  isMinigameKind,
  skillItemIndex,
} from '../../../src/rules/contract';
import type { Expr, GolemOrdersBoard, MinigameActivityKind } from '../../../src/rules/contract';
import { canGenerate } from '../../../src/rules/learning/generate';
import { MINIGAMES, boardView, canMakeBoard, makeBoard } from '../../../src/rules/minigames/boards';
import { loadPack, textbookSteps, writtenText } from '../../traces/support';

const data = loadPack().data;
const index = skillItemIndex(data);

const activities = data.levels.flatMap((level) =>
  level.activities
    .map((activity, i) => ({ level: level.id, i, activity }))
    .filter(({ activity }) => isMinigameKind(activity.kind)),
);

describe('the v1 minigame activities', () => {
  it('cover every minigame kind', () => {
    expect(new Set(activities.map((a) => a.activity.kind))).toEqual(
      new Set([
        'memory-match',
        'number-trail',
        'egg-grid',
        'fact-family',
        'sharing-feast',
        'golem-orders',
      ]),
    );
  });

  it('deal valid boards of their kind from their own items', () => {
    for (const { level, i, activity } of activities) {
      const kind = activity.kind as MinigameActivityKind;
      const skills = data.skills.filter((s) => activity.skills.includes(s.id));
      const pool = [...new Set(activity.skills.flatMap((s) => index.get(s) ?? []))].sort();
      const options = { ...ACTIVITY_OPTION_DEFAULTS[kind], ...activity.options };
      const where = `${level} activity ${i} (${kind})`;
      if (!canMakeBoard(kind, pool, skills, options)) {
        expect(kind === 'golem-orders' && !skills.some(canGenerate), where).toBe(true);
        continue;
      }
      for (let seed = 0; seed < 8; seed++) {
        const def = makeBoard({
          activity: kind,
          id: `r1.b${seed + 1}`,
          pool,
          focus: null,
          skills,
          options,
          previous: null,
          state: initialProfileState({ dailyGoal: 30, arena: true }),
          random: createPrng(`${where} ${seed}`),
        });
        const state = createMinigame(def, def.id, MINIGAMES);
        expect(boardView(def, state, null as never).kind, where).toBe(kind);
      }
    }
  });

  it('deal Golem Orders boards a child works out the textbook way, in the bucket asked for', () => {
    const hasBrackets = (expr: Expr): boolean =>
      expr.kind === 'group' ||
      (expr.kind === 'op' && (hasBrackets(expr.left) || hasBrackets(expr.right)));
    let boards = 0;
    for (const { level, i, activity } of activities.filter(
      (a) => a.activity.kind === 'golem-orders',
    )) {
      const skills = data.skills.filter((s) => activity.skills.includes(s.id));
      const options = { ...ACTIVITY_OPTION_DEFAULTS['golem-orders'], ...activity.options };
      for (const item of ['order:no-brackets', 'order:brackets']) {
        if (!canMakeBoard('golem-orders', [item], skills, options)) continue;
        for (let seed = 0; seed < 24; seed++) {
          const where = `${level} activity ${i}, ${item}, seed ${seed}`;
          const def: MinigameDefinition = makeBoard({
            activity: 'golem-orders',
            id: `r1.b${seed + 1}`,
            pool: [item],
            focus: null,
            skills,
            options,
            previous: null,
            state: initialProfileState({ dailyGoal: 30, arena: true }),
            random: createPrng(`${where}`),
          });
          const start = (def.config as unknown as { expr: Expr }).expr;
          expect(hasBrackets(start), `${where}: ${writtenText(start)}`).toBe(
            item === 'order:brackets',
          );
          let state = createMinigame(def, def.id, MINIGAMES);
          const move = (value: unknown) => {
            state = reduceMinigame(
              def,
              state,
              { type: 'move', revision: state.revision, value: value as never },
              MINIGAMES,
            );
            return projectMinigame(def, state, MINIGAMES).view as unknown as GolemOrdersBoard;
          };
          for (let guard = 0; guard < 8 && state.status !== 'completed'; guard++) {
            const now = (projectMinigame(def, state, MINIGAMES).view as unknown as GolemOrdersBoard)
              .expr;
            const step = textbookSteps(now)[0]!;
            expect(
              move({ type: 'pick', path: step.path }).last,
              `${where}: ${writtenText(now)}`,
            ).toBe(null);
            expect(
              move({ type: 'answer', value: step.value }).last,
              `${where}: ${writtenText(now)}`,
            ).toBe('right');
          }
          expect(state.status, where).toBe('completed');
          boards += 1;
        }
      }
    }
    expect(boards, 'Golem boards played (Riddle Ruins 1 and 2)').toBeGreaterThanOrEqual(2 * 24);
  });
});
