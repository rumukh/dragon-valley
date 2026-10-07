/**
 * Readings of the real game view for screens (game/view.ts), checked against the real rules:
 * a host runs the first session (prologue, first egg, a level) and the helpers must say what
 * the screens should show at each step.
 */
import { readFileSync } from 'node:fs';
import { parseContentJson, requireValue } from '@aegis/runtime';
import { describe, expect, it } from 'vitest';
import { createGameHost } from '../../../src/rules/adapter';
import { BLANK, contentRegistration, expectedAnswer, num, op } from '../../../src/rules/contract';
import type {
  AnswerValue,
  DragonView,
  GameAction,
  GameView,
  MinigameRoundView,
  ProblemRoundView,
  ProblemView,
} from '../../../src/rules/contract';
import { problemTokens } from '../../../src/app/math/notation';
import {
  adventureFor,
  answerKindOf,
  bossPose,
  curedHeads,
  featuredDragon,
  findLevel,
  gameDay,
  growthOf,
  pictureFirst,
  problemNote,
  resultsNext,
  stepChoices,
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

  it('answer a story’s operation step with the four signs, whatever the view offers', () => {
    const fact = { kind: 'equation', left: op('mul', num(5), num(4)), right: BLANK } as const;
    const story = {
      kind: 'word',
      template: 'word.x',
      vars: {},
      model: fact,
      operation: 'mul',
    } as const;
    const numbers: AnswerValue[] = [20, 16, 25, 9].map((value) => ({ kind: 'number', value }));
    const signs = (choices: AnswerValue[] | null) =>
      choices?.map((choice) => (choice.kind === 'operation' ? choice.operation : choice.kind));
    const at = (patch: Partial<ProblemView>): ProblemView => ({
      index: 1,
      item: 'word:equal-groups',
      problem: story,
      input: 'choice',
      choices: numbers,
      step: 'operation',
      reask: false,
      hinted: false,
      ...patch,
    });
    // The answer step's numbers (what the rules serve today) are not offered for the sign.
    expect(signs(stepChoices(at({})))).toEqual(['add', 'sub', 'mul', 'div']);
    // Nor does the keypad: a sign cannot be typed.
    expect(signs(stepChoices(at({ input: 'keypad', choices: null })))).toEqual([
      'add',
      'sub',
      'mul',
      'div',
    ]);
    // Sign choices from the rules are used as they come.
    const offered: AnswerValue[] = [
      { kind: 'operation', operation: 'div' },
      { kind: 'operation', operation: 'mul' },
    ];
    expect(signs(stepChoices(at({ choices: offered })))).toEqual(['div', 'mul']);
    // The answer step uses the view's choices, or the keypad.
    expect(stepChoices(at({ step: 'answer' }))).toEqual(numbers);
    expect(stepChoices(at({ step: 'answer', input: 'keypad', choices: null }))).toBeNull();
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
    const { view, act } = await firstSession();
    const egg = featuredDragon(view())!;
    const growth = growthOf(egg)!;
    expect(growth.next).toBe('hatchling');
    expect(growth.have).toBe(0);
    // Bubbles (×2) hatches at 30 % of its 21 facts answered right once: 7 facts.
    expect(growth.need).toBe(7);
    const crowned = { ...egg, next: null } as DragonView;
    expect(growthOf(crowned)).toBeNull();
    // One right answer is one fact, counted exactly (a rounded share would still say 0).
    await act({ type: 'startActivity', activity: { kind: 'placement' } });
    const round = view().round as ProblemRoundView;
    const asked = round.problem!;
    await act({
      type: 'placementAnswer',
      value: requireValue(expectedAnswer(asked.problem, asked.step)),
      elapsedMs: 1500,
    });
    const after = growthOf(view().dragons.find((dragon) => dragon.id === egg.id)!)!;
    const twoTimes = /^mul:(2x\d+|\d+x2)$/.test(asked.item);
    expect(after.have).toBe(twoTimes ? 1 : 0);
    expect(after.need).toBe(7);
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

type Act = (action: GameAction) => Promise<void>;

/**
 * Plays whatever the view asks for, always right, until the run or round is closed again: story
 * beats are skipped (or the first open choice taken), problems get their expected answer and Egg
 * Grid boards get their rectangles.
 */
async function playThrough(view: () => GameView, act: Act): Promise<void> {
  for (let step = 0; step < 600; step++) {
    const current = view();
    if (current.screen === 'story') {
      const story = current.story!;
      const choice = story.skippable
        ? null
        : (story.choices.find((option) => option.enabled)?.id ?? null);
      await act({
        type: 'storyChoice',
        beat: story.beat,
        node: story.node,
        revision: story.revision,
        choice,
      });
      continue;
    }
    if (current.screen === 'results') {
      const next = resultsNext(current);
      if (next.kind === 'done') {
        await act({ type: 'endRound', reason: 'done' });
        return;
      }
      await act({ type: 'startActivity', activity: { kind: 'level', index: next.index } });
      continue;
    }
    if (current.screen !== 'round') return;
    const round = current.round!;
    if (round.type === 'problems') {
      const problem = round.problem!;
      const value = requireValue(expectedAnswer(problem.problem, problem.step));
      await act(
        round.activity === 'placement'
          ? { type: 'placementAnswer', value, elapsedMs: 1500 }
          : { type: 'answer', value, elapsedMs: 1500 },
      );
      continue;
    }
    const board = round.current;
    if (board.kind !== 'egg-grid') throw new Error(`No player for ${board.kind} boards.`);
    const rows = Array.from({ length: board.maxSide }, (_, index) => index + 1).find(
      (side) =>
        board.product % side === 0 &&
        board.product / side <= board.maxSide &&
        !board.found.some((found) => found.rows === side),
    )!;
    const set = { type: 'set', rows, columns: board.product / rows };
    await act({ type: 'minigameMove', revision: round.minigame.revision, move: set });
    const after = view().round as MinigameRoundView;
    await act({
      type: 'minigameMove',
      revision: after.minigame.revision,
      move: { type: 'submit' },
    });
  }
  throw new Error('The run did not finish.');
}

describe('a Riddle Scrolls story on the real rules', () => {
  it('asks for the sign with an empty sign slot and sign tiles, then for the number', async () => {
    const { view, act } = await firstSession();
    // A right placement check places levels 2-5; level 1 is played; level 6 opens.
    await act({ type: 'startActivity', activity: { kind: 'placement' } });
    await playThrough(view, act);
    await act({ type: 'startLevel', level: 'sunny-meadow.1' });
    await playThrough(view, act);
    await act({ type: 'startLevel', level: 'sunny-meadow.6' });
    let current = view();
    if (current.screen === 'story') {
      const story = current.story!;
      await act({
        type: 'storyChoice',
        beat: story.beat,
        node: story.node,
        revision: story.revision,
        choice: null,
      });
      current = view();
    }
    const round = current.round as ProblemRoundView;
    expect(round.activity).toBe('riddle-scrolls');
    const asked = round.problem!;
    expect(asked.problem.kind).toBe('word');
    expect(asked.step).toBe('operation');
    expect(answerKindOf(asked.problem, asked.step)).toBe('operation');
    // The sign is left out of the sum, and the tiles are signs, whatever the view carries.
    const tokens = problemTokens(asked.problem, 'czech', asked.step);
    expect(tokens.filter((token) => token.kind === 'slot')).toHaveLength(1);
    expect(tokens.some((token) => token.kind === 'sign' && token.text !== '=')).toBe(false);
    const signs = stepChoices(asked)!;
    expect(signs.map((choice) => choice.kind)).toEqual([
      'operation',
      'operation',
      'operation',
      'operation',
    ]);
    const sign = requireValue(expectedAnswer(asked.problem, 'operation'));
    expect(signs).toContainEqual(sign);

    await act({ type: 'answer', value: sign, elapsedMs: 2000 });
    const next = (view().round as ProblemRoundView).problem!;
    expect(next.index).toBe(asked.index);
    expect(next.step).toBe('answer');
    // Now the sum shows its sign, and the number is chosen or typed.
    expect(
      problemTokens(next.problem, 'czech', next.step).some((token) => token.kind === 'slot'),
    ).toBe(false);
    const numbers = stepChoices(next);
    if (numbers) expect(numbers.every((choice) => choice.kind !== 'operation')).toBe(true);
    else expect(next.input).toBe('keypad');
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

  it('cure the Seven-Headed Dragon head by head: three right answers a head', () => {
    const boss = pack.data.bosses.find((candidate) => candidate.heads === 7)!;
    const meter = (value: number) => ({ value, target: boss.meter });
    expect(boss.meter).toBe(21);
    expect(curedHeads(null, 7)).toBe(0);
    expect(curedHeads(meter(2), 7)).toBe(0);
    expect(curedHeads(meter(3), 7)).toBe(1);
    expect(curedHeads(meter(20), 7)).toBe(6);
    expect(curedHeads(meter(21), 7)).toBe(7);
    expect(curedHeads(meter(25), 7), 'never more heads than it has').toBe(7);
    expect(curedHeads({ value: 4, target: 0 }, 7), 'no meter, no heads').toBe(0);
  });
});

describe('teach, then ask', () => {
  it('teaches a fact missed twice in a row with its picture first, like a re-ask', () => {
    const plain = { reask: false, hinted: false };
    expect(problemNote(plain)).toBeNull();
    expect(pictureFirst(plain)).toBe(false);
    expect(problemNote({ ...plain, reask: true })).toBe('round.reask');
    expect(problemNote({ ...plain, teach: true })).toBe('round.teach');
    expect(problemNote({ reask: true, teach: true }), 'taught says more than again').toBe(
      'round.teach',
    );
    expect(pictureFirst({ ...plain, teach: true })).toBe(true);
    expect(pictureFirst({ ...plain, reask: true })).toBe(true);
    expect(pictureFirst({ ...plain, hinted: true })).toBe(true);
  });
});

describe('the game day', () => {
  it('is today, unless the save is already on a later day', () => {
    expect(gameDay({ day: null }, '2026-10-07')).toBe('2026-10-07');
    expect(gameDay({ day: '2026-10-06' }, '2026-10-07')).toBe('2026-10-07');
    expect(gameDay({ day: '2026-10-20' }, '2026-10-07'), 'a clock that ran ahead').toBe(
      '2026-10-20',
    );
  });
});

describe('the Daily Adventure', () => {
  it('replays one game of a finished level when the day had none', () => {
    const view = {
      hub: { next: { kind: 'minigame', level: 'sunny-meadow.2', activity: 1 } },
      run: null,
    } as unknown as GameView;
    expect(adventureFor(view)).toEqual({ kind: 'minigame', level: 'sunny-meadow.2', activity: 1 });
  });
});

describe('weekdays', () => {
  it('count Monday as 0 in every time zone', () => {
    expect(weekdayIndex('2026-10-05')).toBe(0);
    expect(weekdayIndex('2026-10-11')).toBe(6);
    expect(weekdayIndex('2024-02-29')).toBe(3);
  });
});
