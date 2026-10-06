/**
 * Every minigame activity of the v1 content deals valid boards: for each level's minigame
 * activities, boards from several seeds are generated from the activity's own items, skills and
 * options, accepted by their adapters, and projected as typed boards of the activity's kind.
 * Golem Orders needs the order-of-operations generator for its expressions; while a build lacks
 * it, its boards are the only ones allowed to be missing.
 */
import { describe, expect, it } from 'vitest';
import { createPrng } from '@aegis/core';
import { createMinigame } from '@aegis/narrative';
import {
  ACTIVITY_OPTION_DEFAULTS,
  initialProfileState,
  isMinigameKind,
  skillItemIndex,
} from '../../../src/rules/contract';
import type { MinigameActivityKind } from '../../../src/rules/contract';
import { canGenerate } from '../../../src/rules/learning/generate';
import { MINIGAMES, boardView, canMakeBoard, makeBoard } from '../../../src/rules/minigames/boards';
import { loadPack } from '../../traces/support';

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
});
