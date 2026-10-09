/**
 * The shell's side of grades 1-3: the family record's pending grade, + and − facts as text, the
 * counting problem's dots that never give the answer away, the young players' models, the Sun
 * Window, the map's sheets, and what grade-aware Progress and Print draw from the game view.
 */
import { describe, expect, it } from 'vitest';
import {
  addKeeper,
  EMPTY_FAMILY,
  FAMILY_RECORD,
  FAMILY_SCHEMA_VERSION,
  isFamilyState,
  setPendingGrade,
  updateKeeper,
} from '../../../src/app/persistence/family';
import { factText } from '../../../src/app/math/facts';
import { countedDots, pictureOf } from '../../../src/app/math/picture';
import { DOT_SYMBOL, formatSolved, problemTokens } from '../../../src/app/math/notation';
import { modelFor } from '../../../src/app/math/model';
import { COUNT_QUESTION, speakProblem, speakSolved } from '../../../src/app/speech/verbalizer';
import {
  autoReadsByDefault,
  gradeOf,
  isYoungGrade,
  keypadDigitsFor,
  skillGrades,
} from '../../../src/app/game/grade';
import { countLevels, sunWindowOf } from '../../../src/app/game/sun-window';
import { loadMapSheets, MAP_PATH, sheetOf } from '../../../src/app/game/map';
import type { Fetcher } from '../../../src/app/content/load';
import {
  addTableFacts,
  earnedCertificates,
  finishedGrades,
  gradeLastBoss,
} from '../../../src/app/print/content';
import { BLANK, num, op } from '../../../src/rules/contract';
import type { ContentData, GameView, Problem } from '../../../src/rules/contract';

describe('the family record keeps a pending grade until the save exists', () => {
  it('adds a keeper with a grade and drops it once handed over', () => {
    const added = addKeeper(EMPTY_FAMILY, { name: 'Ema', avatar: 'keeper-1', grade: 1 });
    if (!added.ok) throw new Error(added.problem);
    expect(added.value.keeper.grade).toBe(1);
    expect(isFamilyState(added.value.state)).toBe(true);
    const dropped = setPendingGrade(added.value.state, added.value.keeper.id, null);
    if (!dropped.ok) throw new Error(dropped.problem);
    expect('grade' in dropped.value.keeper).toBe(false);
    expect(isFamilyState(dropped.value.state)).toBe(true);
  });

  it('keeps the grade when the name or avatar changes', () => {
    const added = addKeeper(EMPTY_FAMILY, { name: 'Ema', avatar: 'keeper-1', grade: 2 });
    if (!added.ok) throw new Error(added.problem);
    const renamed = updateKeeper(added.value.state, added.value.keeper.id, {
      name: 'Emička',
      avatar: 'keeper-2',
    });
    if (!renamed.ok) throw new Error(renamed.problem);
    expect(renamed.value.keeper.grade).toBe(2);
  });

  it('refuses a grade that is not 1, 2 or 3', () => {
    expect(addKeeper(EMPTY_FAMILY, { name: 'Ema', avatar: 'keeper-1', grade: 4 as 1 })).toEqual({
      ok: false,
      problem: 'grade',
    });
    const bad = { profiles: [{ id: 'profile-1', name: 'Ema', avatar: 'keeper-1', grade: 0 }] };
    expect(isFamilyState(bad)).toBe(false);
  });

  it('reads a schema 1 family as it was, and a grade only from schema 2 on', () => {
    expect(FAMILY_SCHEMA_VERSION).toBe(2);
    const v1 = { profiles: [{ id: 'profile-1', name: 'Ema', avatar: 'keeper-1' }] };
    expect(FAMILY_RECORD.isValid(v1, 1)).toBe(true);
    const withGrade = { profiles: [{ ...v1.profiles[0], grade: 1 }] };
    expect(FAMILY_RECORD.isValid(withGrade, 1)).toBe(false);
    expect(FAMILY_RECORD.isValid(withGrade, 2)).toBe(true);
    const migration = FAMILY_RECORD.migrations?.find((step) => step.from === 1);
    expect(migration?.to).toBe(2);
    expect(FAMILY_RECORD.isCurrent(migration!.migrate(v1))).toBe(true);
  });
});

describe('+ and − facts as text', () => {
  it('writes additions and subtractions with their answers', () => {
    expect(factText('add:3+4', 'czech')).toMatchObject({ question: '3 + 4', answer: '7' });
    expect(factText('sub:9-4', 'international')).toMatchObject({
      question: '9 \u2212 4',
      answer: '5',
      sentence: '9 \u2212 4 = 5',
    });
  });

  it('cards for adding one number, and the subtractions that undo them', () => {
    const cards = addTableFacts(3, 'czech');
    expect(cards).toHaveLength(22);
    expect(cards[0]).toMatchObject({ question: '3 + 0', answer: '3' });
    expect(cards[10]).toMatchObject({ question: '3 + 10', answer: '13' });
    expect(cards[11]).toMatchObject({ question: '3 \u2212 3', answer: '0' });
    expect(cards[21]).toMatchObject({ question: '13 \u2212 3', answer: '10' });
    expect(() => addTableFacts(11, 'czech')).toThrow(RangeError);
  });
});

describe('a counting problem never gives its answer away', () => {
  const counting = {
    kind: 'equation',
    left: BLANK,
    right: num(7),
    picture: { kind: 'dots', count: 7 },
  } as unknown as Problem;

  it('reads the picture defensively', () => {
    expect(pictureOf(counting)).toEqual({ kind: 'dots', count: 7 });
    expect(countedDots(counting)).toBe(7);
    const plain: Problem = { kind: 'equation', left: op('add', num(3), num(4)), right: BLANK };
    expect(pictureOf(plain)).toBeNull();
    const broken = { ...plain, picture: { kind: 'dots', count: -1 } } as unknown as Problem;
    expect(pictureOf(broken)).toBeNull();
  });

  it('draws dots where the number would be, in both notations', () => {
    for (const notation of ['czech', 'international'] as const) {
      const tokens = problemTokens(counting, notation);
      expect(tokens.some((token) => token.kind === 'dots' && token.count === 7)).toBe(true);
      const shown = tokens.map((token) => ('text' in token ? token.text : '')).join(' ');
      expect(shown).not.toMatch(/7|seven/i);
    }
    expect(DOT_SYMBOL).not.toMatch(/\d/);
  });

  it('asks "How many dots?" and never says the number before it is found', () => {
    expect(speakProblem(counting)).toBe(COUNT_QUESTION);
    expect(speakProblem(counting)).not.toMatch(/7|seven/i);
    expect(speakSolved(counting, 7)).toBe('Seven dots.');
    expect(formatSolved(counting, 7)).toBe('7');
  });

  it('shows the dots as the counting model', () => {
    expect(modelFor(counting)).toEqual({ kind: 'count', count: 7 });
  });
});

describe('young players see + and − as pictures', () => {
  const add = (a: number, b: number): Problem => ({
    kind: 'equation',
    left: op('add', num(a), num(b)),
    right: BLANK,
  });

  it('leaves a 3rd grader without new pictures', () => {
    expect(modelFor(add(3, 4))).toBeNull();
  });

  it('draws small facts on ten-frames, a one-digit step on the number line, tens as sticks', () => {
    expect(modelFor(add(3, 4), true)).toMatchObject({
      kind: 'ten-frame',
      op: 'add',
      left: 3,
      right: 4,
      result: 7,
    });
    expect(modelFor(add(23, 4), true)).toMatchObject({ kind: 'number-line', result: 27 });
    expect(modelFor(add(23, 14), true)).toMatchObject({ kind: 'sticks' });
    const takeAway: Problem = {
      kind: 'equation',
      left: op('sub', num(9), num(4)),
      right: BLANK,
    };
    expect(modelFor(takeAway, true)).toMatchObject({ kind: 'ten-frame', op: 'sub', result: 5 });
  });
});

const view = (settings: Partial<GameView['settings']>, extra: object = {}): GameView =>
  ({ settings, ...extra }) as unknown as GameView;

describe('grade helpers', () => {
  it('reads a save from before grades as 3rd grade', () => {
    expect(gradeOf(view({}))).toBe(3);
    expect(gradeOf(view({ grade: 1 }))).toBe(1);
  });

  it('gives 1st graders a two-digit keypad and read-aloud', () => {
    expect(isYoungGrade(1) && isYoungGrade(2) && !isYoungGrade(3)).toBe(true);
    expect(keypadDigitsFor(1, 6)).toBe(2);
    expect(keypadDigitsFor(2, 6)).toBe(6);
    expect(keypadDigitsFor(3, 6)).toBe(6);
    expect(autoReadsByDefault(1)).toBe(true);
    expect(autoReadsByDefault(3)).toBe(false);
  });
});

describe('the Sun Window', () => {
  it('is all dim until the rules serve it', () => {
    const sun = sunWindowOf(view({}));
    expect(sun.cells).toHaveLength(121);
    expect(sun.subtraction).toHaveLength(121);
    expect(sun.counts).toEqual({ dim: 242, bronze: 0, silver: 0, gold: 0 });
    expect(sun.cells.find((cell) => cell.item === 'add:3+4')).toMatchObject({ row: 3, column: 4 });
    expect(sun.subtraction.find((cell) => cell.item === 'sub:9-4')).toMatchObject({
      row: 4,
      column: 5,
    });
  });

  it('shows the served panes', () => {
    const cells = [{ item: 'add:1+1', row: 1, column: 1, level: 'gold', needsPolish: false }];
    const subtraction = [
      { item: 'sub:2-1', row: 1, column: 1, level: 'bronze', needsPolish: true },
    ];
    const sun = sunWindowOf(view({}, { sunWindow: { cells, subtraction } }));
    expect(sun.cells).toEqual(cells);
    expect(sun.counts).toEqual({ ...countLevels([]), gold: 1, bronze: 1 });
  });
});

describe('the map sheets', () => {
  const sheet = (id: string) => ({
    width: 100,
    height: 100,
    regions: { [id]: { x: 10, y: 10, path: [{ x: 10, y: 10 }] } },
    hotspots: [],
  });

  it('fetches only the valley sheet while every region is on it', async () => {
    const asked: string[] = [];
    const fetcher: Fetcher = async (url) => {
      asked.push(url);
      return new Response(JSON.stringify(sheet('sunny-meadow')));
    };
    const sheets = await loadMapSheets('https://dv.test/only-valley/', ['sunny-meadow'], fetcher);
    expect(sheets.map((s) => s.background)).toEqual(['valley-map']);
    expect(asked).toEqual([`https://dv.test/only-valley/${MAP_PATH}`]);
  });

  it('adds the Lower Valley before the valley, or leaves it off while it is missing', async () => {
    const fetcher: Fetcher = async (url) =>
      url.includes('lower-valley')
        ? new Response(JSON.stringify(sheet('pebble-brook')))
        : new Response(JSON.stringify(sheet('sunny-meadow')));
    const sheets = await loadMapSheets(
      'https://dv.test/both/',
      ['pebble-brook', 'sunny-meadow'],
      fetcher,
    );
    expect(sheets.map((s) => s.background)).toEqual(['lower-valley-map', 'valley-map']);
    expect(sheetOf(sheets, 'pebble-brook')?.background).toBe('lower-valley-map');

    const missing: Fetcher = async (url) =>
      url.includes('lower-valley')
        ? new Response('', { status: 404 })
        : new Response(JSON.stringify(sheet('sunny-meadow')));
    const valleyOnly = await loadMapSheets(
      'https://dv.test/missing/',
      ['pebble-brook', 'sunny-meadow'],
      missing,
    );
    expect(valleyOnly.map((s) => s.background)).toEqual(['valley-map']);
  });
});

describe('grades in Progress and Print', () => {
  const data = {
    regions: [
      { id: 'pebble-brook', order: 1, grade: 1, boss: 'will-o-wisps' },
      { id: 'counting-hill', order: 2, grade: 2, boss: 'hill-giant' },
      { id: 'sunny-meadow', order: 3, boss: 'bridge-troll' },
    ],
    levels: [
      { region: 'pebble-brook', activities: [{ skills: ['count-10', 'add-5'] }] },
      { region: 'counting-hill', activities: [{ skills: ['add-20', 'add-5'] }] },
      { region: 'sunny-meadow', activities: [{ skills: ['mul-2'] }] },
    ],
    bosses: [{ id: 'will-o-wisps' }, { id: 'hill-giant' }, { id: 'bridge-troll' }],
  } as unknown as ContentData;

  const region = (id: string, order: number, boss: string, defeated: boolean) => ({
    id,
    order,
    boss: { id: boss, defeated },
  });

  it('puts each skill in the lowest grade that teaches it', () => {
    const grades = skillGrades(data);
    expect(grades.get('count-10')).toBe(1);
    expect(grades.get('add-5')).toBe(1);
    expect(grades.get('add-20')).toBe(2);
    expect(grades.get('mul-2')).toBe(3);
  });

  it('finishes a grade when all of its bosses are won over, with a certificate after it', () => {
    const played = {
      dragons: [],
      hub: {
        regions: [
          region('pebble-brook', 1, 'will-o-wisps', true),
          region('counting-hill', 2, 'hill-giant', false),
          region('sunny-meadow', 3, 'bridge-troll', false),
        ],
      },
    } as unknown as GameView;
    expect(finishedGrades(played, data)).toEqual([1]);
    expect(gradeLastBoss(data, 1)).toBe('will-o-wisps');
    expect(earnedCertificates(played, data).map((c) => c.id)).toEqual([
      'certificate:region:pebble-brook',
      'certificate:grade:1',
    ]);
  });

  it('finishes no grade a pack does not have', () => {
    const thirdOnly = { ...data, regions: [data.regions[2]] } as unknown as ContentData;
    const played = {
      dragons: [],
      hub: { regions: [region('sunny-meadow', 3, 'bridge-troll', true)] },
    } as unknown as GameView;
    expect(finishedGrades(played, thirdOnly)).toEqual([]);
  });
});
