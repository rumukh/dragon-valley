/**
 * The grades 1-3 contract (docs/grades-plan.md, docs/contract.md): the grade setting, the state
 * migration that reads every older save as a 3rd grader, the addition and subtraction item IDs,
 * the new generators' item universes, and the content fields that say where each grade starts.
 * Content cases start from the real pack and change one thing, like content.test.ts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { requireValue, validateContent } from '@aegis/runtime';
import type { RuntimeDiagnostic, RuntimeSnapshot } from '@aegis/runtime';
import {
  DEFAULT_GRADE,
  GENERATOR_IDS,
  GRADES,
  RUNTIME_STATE_RESOURCE,
  SKILL_PARAM_SCHEMAS,
  STATE_VERSION,
  addFactId,
  allAddFactIds,
  allSubFactIds,
  commutedId,
  contentRegistration,
  gameActionSchema,
  gradeStart,
  initialProfileState,
  isItemId,
  migrateProfileState,
  migrateSnapshot,
  parseItemId,
  profileStateSchema,
  regionGrade,
  skillItems,
  subFactId,
} from '../../../src/rules/contract';
import type { ContentData, ProfileState, Skill } from '../../../src/rules/contract';
import { PERFECT, Player } from '../../traces/support';

const root = join(import.meta.dirname, '..', '..', '..');
const packText = readFileSync(join(root, 'content', 'dragon-valley.content.json'), 'utf8');
interface Pack {
  id: string;
  revision: string;
  schemaVersion: number;
  data: ContentData;
}
const fresh = (): Pack => JSON.parse(packText);

function diagnostics(pack: Pack): readonly RuntimeDiagnostic[] {
  const outcome = validateContent(pack, contentRegistration, 'test.json');
  return outcome.ok ? [] : outcome.error.diagnostics;
}

function expectDiagnostic(pack: Pack, code: string, recordId: string): void {
  const found = diagnostics(pack);
  expect(
    found.some((d) => d.code === code && d.recordId === recordId),
    `expected ${code} on ${recordId}, got ${JSON.stringify(found)}`,
  ).toBe(true);
}

const noFamilies = () => null;
const items = (skill: Omit<Skill, 'id' | 'titleKey'>): string[] =>
  skillItems({ id: 'test', titleKey: 'skill.test', ...skill } as Skill, noFamilies);

describe('the grade setting', () => {
  it('is 1, 2 or 3, and 3 for a new profile unless told otherwise', () => {
    expect(GRADES).toEqual([1, 2, 3]);
    expect(DEFAULT_GRADE).toBe(3);
    expect(initialProfileState({ dailyGoal: 30, arena: true }).settings.grade).toBe(3);
    expect(initialProfileState({ dailyGoal: 30, arena: true, grade: 1 }).settings.grade).toBe(1);
  });

  it('is part of the state schema', () => {
    const state = initialProfileState({ dailyGoal: 30, arena: true, grade: 2 });
    expect(profileStateSchema.parse(state).ok).toBe(true);
    for (const grade of [0, 4, 2.5, '2', undefined]) {
      const bad = { ...state, settings: { ...state.settings, grade } };
      expect(profileStateSchema.parse(bad).ok, String(grade)).toBe(false);
    }
  });

  it('is changed by setSetting { key: grade } with a grade the schema knows', () => {
    for (const value of GRADES) {
      const action = { type: 'setSetting', setting: { key: 'grade', value } };
      expect(gameActionSchema.parse(action).ok, String(value)).toBe(true);
    }
    for (const value of [0, 4, '3', null]) {
      const action = { type: 'setSetting', setting: { key: 'grade', value } };
      expect(gameActionSchema.parse(action).ok, String(value)).toBe(false);
    }
  });

  it('is refused for a grade the content does not serve, and applied otherwise', async () => {
    const player = new Player(PERFECT, 'grades');
    expect(await player.act({ type: 'startSession', day: '2026-10-06' })).toBe(true);
    expect(
      await player.reject(
        { type: 'setSetting', setting: { key: 'grade', value: 1 } },
        'invalid-setting',
      ),
      player.failures.join(),
    ).toBe(true);
    expect(player.state().settings.grade).toBe(3);
    expect(
      await player.act({ type: 'setSetting', setting: { key: 'grade', value: 3 } }),
      player.failures.join(),
    ).toBe(true);
    expect(player.state().settings.grade).toBe(3);
    await player.dispose();
  });
});

describe('the state migration', () => {
  const current = initialProfileState({ dailyGoal: 30, arena: true });
  const { grade: _grade, ...v1Settings } = current.settings;
  const v1 = { ...current, settings: v1Settings };

  it('is at version 2, the first with grades', () => {
    expect(STATE_VERSION).toBe(2);
  });

  it('reads a version 1 state as a 3rd grader and changes nothing else', () => {
    const before = structuredClone(v1);
    const migrated = migrateProfileState(v1, 1) as ProfileState;
    expect(v1, 'the input is not mutated').toEqual(before);
    expect(migrated.settings.grade).toBe(3);
    expect(migrated).toEqual({ ...v1, settings: { ...v1.settings, grade: 3 } });
    expect(profileStateSchema.parse(migrated).ok).toBe(true);
    expect(profileStateSchema.parse(v1).ok, 'a version 1 state is not current').toBe(false);
  });

  it('leaves a current state alone and refuses versions it does not know', () => {
    expect(migrateProfileState(current, STATE_VERSION)).toBe(current);
    for (const version of [0, 3, 1.5]) {
      expect(() => migrateProfileState(v1, version), String(version)).toThrow(RangeError);
    }
    expect(() => migrateProfileState({ settings: null }, 1)).toThrow(TypeError);
  });

  it('upgrades a version 1 snapshot: its state resource and stateVersion only', async () => {
    const player = new Player(PERFECT, 'grades');
    const snapshot = player.host.snapshot();
    await player.dispose();
    const old = {
      ...snapshot,
      stateVersion: 1,
      world: {
        ...snapshot.world,
        resources: { ...snapshot.world.resources, [RUNTIME_STATE_RESOURCE]: v1 },
      },
    } as RuntimeSnapshot;
    const before = structuredClone(old);
    const migrated = migrateSnapshot(old);
    expect(old, 'the input is not mutated').toEqual(before);
    expect(migrated.stateVersion).toBe(STATE_VERSION);
    expect(migrated.content).toEqual(old.content);
    expect(migrated.revision).toBe(old.revision);
    expect(migrated.turn).toBe(old.turn);
    const state = migrated.world.resources[RUNTIME_STATE_RESOURCE] as ProfileState;
    expect(state.settings.grade).toBe(3);
    expect(migrateSnapshot(migrated), 'a current snapshot is returned as is').toBe(migrated);

    const restored = new Player(PERFECT, 'grades');
    const outcome = await restored.host.restore(migrated);
    expect(outcome.ok, outcome.ok ? '' : JSON.stringify(outcome.error)).toBe(true);
    expect(restored.state().settings.grade).toBe(3);
    await restored.dispose();
  });
});

describe('addition and subtraction item IDs', () => {
  it('name a basic fact with operands 0-10: add:A+B and sub:M-S', () => {
    expect(addFactId(8, 5)).toBe('add:8+5');
    expect(subFactId(13, 5)).toBe('sub:13-5');
    expect(parseItemId('add:8+5')).toEqual({ kind: 'add', a: 8, b: 5, sum: 13 });
    expect(parseItemId('sub:13-5')).toEqual({
      kind: 'sub',
      minuend: 13,
      subtrahend: 5,
      difference: 8,
    });
    expect(parseItemId('add:10+10')).toEqual({ kind: 'add', a: 10, b: 10, sum: 20 });
    expect(commutedId('add:8+5')).toBe('add:5+8');
    expect(commutedId('sub:13-5')).toBeNull();
  });

  it('reject operands out of range and non-canonical spellings', () => {
    for (const id of [
      'add:11+1',
      'add:08+5',
      'add:-1+5',
      'sub:21-10',
      'sub:13-2',
      'sub:5-6',
      'sub:05-1',
      'sub:13-11',
    ]) {
      expect(isItemId(id), id).toBe(false);
    }
    expect(() => addFactId(11, 0)).toThrow(RangeError);
    expect(() => subFactId(21, 10)).toThrow(RangeError);
  });

  it('cover 121 addition facts and 121 subtraction facts', () => {
    expect(allAddFactIds()).toHaveLength(121);
    expect(allSubFactIds()).toHaveLength(121);
    expect(new Set([...allAddFactIds(), ...allSubFactIds()]).size).toBe(242);
    for (const id of [...allAddFactIds(), ...allSubFactIds()]) expect(isItemId(id), id).toBe(true);
  });

  it('leave the bucket and multiplication formats alone', () => {
    expect(parseItemId('count:0-5')).toEqual({ kind: 'bucket', family: 'count', bucket: '0-5' });
    expect(parseItemId('add2d:2d1d-carry')).toEqual({
      kind: 'bucket',
      family: 'add2d',
      bucket: '2d1d-carry',
    });
    expect(parseItemId('mul:7x8')).toMatchObject({ kind: 'mul', product: 56 });
  });
});

describe('the grades 1-2 generators', () => {
  it('are registered with a parameter schema each', () => {
    for (const id of [
      'num.count',
      'num.compare',
      'num.place',
      'add.fact',
      'sub.fact',
      'add.missing',
      'addsub.2d',
    ] as const) {
      expect(GENERATOR_IDS, id).toContain(id);
      expect(SKILL_PARAM_SCHEMAS[id], id).toBeDefined();
    }
  });

  it('give number skills their bucket items', () => {
    expect(items({ generator: 'num.count', params: { numbers: [0, 10] } })).toEqual([
      'count:0-5',
      'count:6-10',
    ]);
    expect(
      items({ generator: 'num.compare', params: { numbers: [0, 20], equalShare: 10 } }),
    ).toEqual(['ncompare:0-20']);
    expect(
      items({ generator: 'num.place', params: { numbers: [10, 99], asks: ['tens', 'compose'] } }),
    ).toEqual(['place:compose', 'place:tens']);
  });

  it('give fact skills their facts, with or without crossing ten', () => {
    const within = items({
      generator: 'add.fact',
      params: { addends: [0, 10], sumMax: 10, crossing: 'forbidden' },
    });
    expect(within).toHaveLength(66);
    expect(within).toContain('add:7+3');
    const crossing = items({
      generator: 'add.fact',
      params: { addends: [2, 9], sumMax: 20, crossing: 'required' },
    });
    expect(crossing).toContain('add:8+5');
    expect(crossing).not.toContain('add:7+3');
    expect(
      items({
        generator: 'sub.fact',
        params: {
          subtrahends: [0, 10],
          differences: [0, 10],
          minuendMax: 20,
          crossing: 'required',
        },
      }),
    ).toContain('sub:13-6');
    expect(
      items({
        generator: 'add.missing',
        params: { known: [3, 3], missing: [0, 2], sumMax: 10, position: 'both' },
      }),
    ).toEqual(['sub:3-3', 'sub:4-3', 'sub:5-3']);
  });

  it('give two-digit skills a bucket per operator, shape and carry', () => {
    expect(
      items({
        generator: 'addsub.2d',
        params: {
          operators: ['add', 'sub'],
          shapes: ['2d1d'],
          twoDigit: [10, 99],
          crossing: 'allowed',
          resultMax: 100,
        },
      }),
    ).toEqual([
      'add2d:2d1d-carry',
      'add2d:2d1d-nocarry',
      'sub2d:2d1d-borrow',
      'sub2d:2d1d-noborrow',
    ]);
  });
});

describe('grades in the content pack', () => {
  const regionsByOrder = (pack: Pack) => [...pack.data.regions].sort((a, b) => a.order - b.order);

  it('are optional: the 1.3.0 pack serves grade 3 only, from its first region', () => {
    const pack = fresh();
    expect(pack.data.grades).toBeUndefined();
    expect(diagnostics(pack)).toEqual([]);
    const first = regionsByOrder(pack)[0]!;
    expect(regionGrade(first)).toBe(3);
    expect(gradeStart(pack.data, 3)).toBe(first.id);
    expect(gradeStart(pack.data, 1)).toBeNull();
    expect(gradeStart(pack.data, 2)).toBeNull();
  });

  it('accept a start per grade, each in a region of its grade', () => {
    const pack = fresh();
    const [first, second] = regionsByOrder(pack);
    first!.grade = 1;
    second!.grade = 3;
    pack.data.grades = [
      { grade: 1, start: first!.id },
      { grade: 3, start: second!.id },
    ];
    pack.data.story.beats[0]!.trigger.grades = [1];
    pack.data.placement.steps[0]!.grades = [3];
    expect(diagnostics(pack)).toEqual([]);
    expect(gradeStart(requireValue(contentRegistration.schema.parse(pack.data)), 1)).toBe(
      first!.id,
    );
  });

  it('reject a start in a missing region or in a region of another grade', () => {
    const missing = fresh();
    missing.data.grades = [{ grade: 3, start: 'no-such-region' }];
    expectDiagnostic(missing, 'missing-reference', 'grade-3');

    const other = fresh();
    other.data.grades = [{ grade: 2, start: regionsByOrder(other)[0]!.id }];
    expectDiagnostic(other, 'invalid-content', 'grade-2');
  });

  it('reject the same grade twice', () => {
    const pack = fresh();
    const first = regionsByOrder(pack)[0]!.id;
    pack.data.grades = [
      { grade: 3, start: first },
      { grade: 3, start: first },
    ];
    expect(diagnostics(pack).length).toBeGreaterThan(0);
  });

  it('reject region grades that fall along the map', () => {
    const pack = fresh();
    const [first, second] = regionsByOrder(pack);
    second!.grade = 2;
    pack.data.grades = [
      { grade: 2, start: second!.id },
      { grade: 3, start: first!.id },
    ];
    expectDiagnostic(pack, 'invalid-content', second!.id);
  });

  it('reject a region of another grade in a pack without grades', () => {
    const pack = fresh();
    const first = regionsByOrder(pack)[0]!;
    first.grade = 2;
    expectDiagnostic(pack, 'invalid-content', first.id);
  });

  it('reject beat and placement filters naming a grade the pack does not serve', () => {
    const beat = fresh();
    const target = beat.data.story.beats[0]!;
    target.trigger.grades = [1];
    expectDiagnostic(beat, 'missing-reference', target.id);

    const step = fresh();
    step.data.placement.steps[0]!.grades = [2];
    expectDiagnostic(step, 'missing-reference', 'step-0');
  });
});
