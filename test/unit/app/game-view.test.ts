/**
 * Readings of the real game view for screens (game/view.ts), checked against the real rules:
 * a host runs the first session (prologue, first egg, a level) and the helpers must say what
 * the screens should show at each step.
 */
import { readFileSync } from 'node:fs';
import { parseContentJson, requireValue } from '@aegis/runtime';
import { describe, expect, it } from 'vitest';
import { createGameHost } from '../../../src/rules/adapter';
import { BLANK, contentRegistration, num, op } from '../../../src/rules/contract';
import type { DragonView, GameAction, GameView } from '../../../src/rules/contract';
import {
  adventureFor,
  answerKindOf,
  bossPose,
  featuredDragon,
  findLevel,
  growthOf,
  resultsNext,
  weekdayIndex,
} from '../../../src/app/game/view';

const pack = requireValue(
  parseContentJson(
    readFileSync('content/dragon-valley.content.json', 'utf8'),
    contentRegistration,
    'dragon-valley.content.json',
  ),
);

async function firstSession(): Promise<{
  view: () => GameView;
  act: (action: GameAction) => Promise<void>;
}> {
  const host = createGameHost(pack, 'view-helpers');
  const act = async (action: GameAction): Promise<void> => {
    requireValue(await host.dispatch(action));
  };
  await act({ type: 'startSession', day: '2026-10-06' });
  let story = host.getView().story;
  await act({
    type: 'storyChoice',
    beat: story!.beat,
    node: story!.node,
    revision: story!.revision,
    choice: null,
  });
  story = host.getView().story;
  await act({
    type: 'storyChoice',
    beat: story!.beat,
    node: story!.node,
    revision: story!.revision,
    choice: 'bubbles',
  });
  return { view: () => host.getView(), act };
}

describe('answer kinds', () => {
  it('follow the problem structure and the step', () => {
    const fact = { kind: 'equation', left: op('mul', num(7), num(8)), right: BLANK } as const;
    expect(answerKindOf(fact, 'answer')).toBe('number');
    expect(answerKindOf({ kind: 'divrem', dividend: 23, divisor: 5 }, 'answer')).toBe('remainder');
    expect(answerKindOf({ kind: 'compare', left: num(3), right: num(4) }, 'answer')).toBe(
      'relation',
    );
    const story = {
      kind: 'word',
      template: 'word.x',
      vars: {},
      model: fact,
      operation: 'mul',
    } as const;
    expect(answerKindOf(story, 'operation')).toBe('operation');
    expect(answerKindOf(story, 'answer')).toBe('number');
  });
});

describe('the hub after the first egg', () => {
  it('features the first egg, finds levels and suggests the next step', async () => {
    const { view } = await firstSession();
    const current = view();
    expect(featuredDragon(current)?.id).toBe('bubbles');
    const found = findLevel(current, 'sunny-meadow.1');
    expect(found?.region.id).toBe('sunny-meadow');
    expect(findLevel(current, 'nowhere')).toBeUndefined();
    // A first session asks for the placement check before any level.
    expect(adventureFor(current)).toEqual({ kind: 'placement' });
    expect(weekdayIndex(current.daily!.day)).toBe(1);
    expect(current.daily!.week[1]).toBe(true);
  });

  it('measures growth in facts toward the next stage', async () => {
    const { view } = await firstSession();
    const egg = featuredDragon(view())!;
    const growth = growthOf(egg)!;
    expect(growth.next).toBe('hatchling');
    expect(growth.value).toBe(0);
    expect(growth.max).toBeGreaterThan(0);
    const crowned = { ...egg, next: null } as DragonView;
    expect(growthOf(crowned)).toBeNull();
  });
});

describe('a level run', () => {
  it('resumes a level at its next activity and leads from results to the next activity', async () => {
    const { view, act } = await firstSession();
    await act({ type: 'startLevel', level: 'sunny-meadow.1' });
    // The level-start beat comes first.
    const story = view().story;
    if (story) {
      await act({
        type: 'storyChoice',
        beat: story.beat,
        node: story.node,
        revision: story.revision,
        choice: null,
      });
    }
    expect(view().screen).toBe('round');
    expect(view().round?.activity).toBe('egg-grid');
    // Quitting keeps the run: the adventure resumes the same activity.
    await act({ type: 'endRound', reason: 'quit' });
    expect(adventureFor(view())).toMatchObject({
      kind: 'level',
      level: 'sunny-meadow.1',
      resume: 0,
    });
    expect(resultsNext(view())).toEqual({ kind: 'done' });
  });
});

describe('boss poses', () => {
  it('start, warm up at half the meter and are won when full or finished', () => {
    expect(bossPose(null, false)).toBe('start');
    expect(bossPose({ value: 7, target: 15 }, false)).toBe('start');
    expect(bossPose({ value: 8, target: 15 }, false)).toBe('warming');
    expect(bossPose({ value: 15, target: 15 }, false)).toBe('won');
    expect(bossPose({ value: 3, target: 15 }, true)).toBe('won');
  });
});

describe('weekdays', () => {
  it('count Monday as 0 in every time zone', () => {
    expect(weekdayIndex('2026-10-05')).toBe(0);
    expect(weekdayIndex('2026-10-11')).toBe(6);
    expect(weekdayIndex('2024-02-29')).toBe(3);
  });
});
