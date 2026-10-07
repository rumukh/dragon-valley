/**
 * The content pack contract: the shipped sample validates, and each class of authoring mistake
 * is reported with a named diagnostic, the offending record and its field path.
 *
 * Negative cases start from the real sample pack and change one thing, so each test proves the
 * one rule it names (the unchanged pack is shown to pass first).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseContentJson, validateContent, dataHash } from '@aegis/runtime';
import type { RuntimeDiagnostic } from '@aegis/runtime';
import {
  CANONICAL_BOSS_IDS,
  CANONICAL_DRAGON_IDS,
  CANONICAL_REGION_IDS,
  CONTENT_PACK_ID,
  checkArtCatalog,
  collectArtIds,
  collectCatalogKeys,
  contentRegistration,
  curriculumGaps,
  skillItemIndex,
} from '../../../src/rules/contract';
import type { ContentData } from '../../../src/rules/contract';

const root = join(import.meta.dirname, '..', '..', '..');
const packText = readFileSync(join(root, 'content', 'dragon-valley.content.json'), 'utf8');
const catalog: Record<string, string> = JSON.parse(
  readFileSync(join(root, 'content', 'catalogs', 'en.content.json'), 'utf8'),
);

interface Pack {
  id: string;
  revision: string;
  schemaVersion: number;
  data: ContentData;
}
const fresh = (): Pack => JSON.parse(packText);

/**
 * Every content revision merged to main, with the content hash a save made on it pins (the
 * runtime's `dataHash` of the pack; literal values, docs/content.md §1). An archived pack never
 * changes, and a content change needs a revision of its own: `npm run content:bump -- <revision>`
 * archives the deployed pack, then pin the new revision here.
 */
const REVISIONS: Readonly<Record<string, string>> = {
  '1.0.0': 'af91e14b281b7452', // the Region 1 slice, deployed from main 373a5d2
  '1.1.0': 'e2acbc7228348abd', // v1: the nine regions
  '1.2.0': '69494a787c9bab06', // the balance from the learner simulation (docs/balance-report.md)
};

function diagnostics(pack: Pack): readonly RuntimeDiagnostic[] {
  const outcome = validateContent(pack, contentRegistration, 'test.json');
  return outcome.ok ? [] : outcome.error.diagnostics;
}

function expectDiagnostic(pack: Pack, code: string, recordId?: string): void {
  const found = diagnostics(pack);
  expect(
    found.some((d) => d.code === code && (recordId === undefined || d.recordId === recordId)),
    `expected ${code}${recordId ? ` on ${recordId}` : ''}, got ${JSON.stringify(found)}`,
  ).toBe(true);
}

describe('the sample content pack', () => {
  it('validates under the registration and is a pinned revision of the dragon-valley pack', () => {
    const outcome = parseContentJson(packText, contentRegistration, 'dragon-valley.content.json');
    expect(outcome.ok, JSON.stringify(outcome.ok ? null : outcome.error.diagnostics)).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.id).toBe(CONTENT_PACK_ID);
    expect(Object.keys(REVISIONS)).toContain(outcome.value.revision);
    expect(outcome.value.schemaVersion).toBe(1);
  });

  it('is the v1 valley: nine regions, 50 lessons, nine bosses and every dragon', () => {
    const data = fresh().data;
    const byOrder = [...data.regions].sort((a, b) => a.order - b.order);
    expect(byOrder.map((r) => r.id)).toEqual([...CANONICAL_REGION_IDS]);
    expect(data.levels.filter((l) => l.kind === 'lesson')).toHaveLength(50);
    const bossLevels = byOrder.map((r) =>
      data.levels.filter((l) => l.region === r.id && l.kind === 'boss').map((l) => l.boss),
    );
    expect(bossLevels).toEqual(CANONICAL_BOSS_IDS.map((boss) => [boss]));
    expect(data.dragons.map((d) => d.id).sort()).toEqual([...CANONICAL_DRAGON_IDS].sort());
  });

  it('uses only canonical region, dragon and boss IDs', () => {
    const data = fresh().data;
    const regions: readonly string[] = CANONICAL_REGION_IDS;
    const dragons: readonly string[] = CANONICAL_DRAGON_IDS;
    const bosses: readonly string[] = CANONICAL_BOSS_IDS;
    expect(data.regions.filter((r) => !regions.includes(r.id))).toEqual([]);
    expect(data.dragons.filter((d) => !dragons.includes(d.id))).toEqual([]);
    expect(data.bosses.filter((b) => !bosses.includes(b.id))).toEqual([]);
  });

  it('has every catalog key it refers to in the English content catalog', () => {
    const missing = collectCatalogKeys(fresh().data).filter(
      ({ key }) => catalog[key] === undefined,
    );
    expect(missing).toEqual([]);
  });

  it('gives the ×2 skill the 21 facts of the 2 times table in both orders', () => {
    const items = skillItemIndex(fresh().data).get('mul-2') ?? [];
    expect(items).toHaveLength(21);
    expect(items).toContain('mul:2x7');
    expect(items).toContain('mul:7x2');
    expect(items).toContain('mul:2x2');
  });

  it('covers every objective with a lesson and a boss level, and reports a gap', () => {
    expect(curriculumGaps(fresh().data)).toEqual([]);
    // giants-peaks.2 is the only lesson for tens times a one-digit number.
    const pack = fresh();
    const tens = pack.data.levels.find((l) => l.id === 'giants-peaks.2')!;
    tens.objectives = tens.objectives.filter((o) => o !== 'obj.big.tens');
    expect(curriculumGaps(pack.data)).toEqual([{ objective: 'obj.big.tens', missing: ['level'] }]);
  });
});

describe('content validation reports authoring mistakes', () => {
  it('accepts the unchanged pack (the baseline for every case below)', () => {
    expect(diagnostics(fresh())).toEqual([]);
  });

  it('rejects a level that refers to an unknown skill', () => {
    const pack = fresh();
    pack.data.levels[0]!.activities[0]!.skills = ['no-such-skill'];
    expectDiagnostic(pack, 'missing-reference', 'sunny-meadow.1');
  });

  it('rejects references to an existing record of the wrong kind', () => {
    const eggIsCosmetic = fresh();
    eggIsCosmetic.data.levels[0]!.rewards.eggs = ['scarf-striped'];
    expectDiagnostic(eggIsCosmetic, 'missing-reference', 'sunny-meadow.1');

    const regionIsSkill = fresh();
    regionIsSkill.data.levels[0]!.region = 'mul-2';
    expectDiagnostic(regionIsSkill, 'missing-reference', 'sunny-meadow.1');

    const bossIsLevel = fresh();
    bossIsLevel.data.levels.find((l) => l.kind === 'boss')!.boss = 'sunny-meadow.1';
    expectDiagnostic(bossIsLevel, 'missing-reference', 'sunny-meadow.boss');

    const storyEggIsCosmetic = fresh();
    storyEggIsCosmetic.data.story.rewards[0]!.grant = { kind: 'egg', dragon: 'scarf-striped' };
    expectDiagnostic(storyEggIsCosmetic, 'missing-reference', 'first-egg.bubbles');
  });

  it('rejects duplicate level IDs', () => {
    const pack = fresh();
    pack.data.levels[1]!.id = pack.data.levels[0]!.id;
    expectDiagnostic(pack, 'duplicate-id');
  });

  it('rejects an unlock cycle as unreachable', () => {
    const pack = fresh();
    pack.data.levels[0]!.unlock.after = ['sunny-meadow.2'];
    expectDiagnostic(pack, 'unreachable', 'sunny-meadow.1');
  });

  it('rejects options that do not belong to the activity kind', () => {
    const pack = fresh();
    pack.data.levels[0]!.activities[1]!.options = { pairs: 6 };
    expectDiagnostic(pack, 'invalid-content', 'sunny-meadow.1');
  });

  it('rejects a skill that can never produce a problem', () => {
    const pack = fresh();
    pack.data.skills.push({
      id: 'rem-impossible',
      titleKey: 'skill.mul-2',
      generator: 'div.remainder',
      params: { divisors: [9], quotients: [5, 9], dividendMax: 20, remainder: 'required' },
    });
    expectDiagnostic(pack, 'empty-skill', 'rem-impossible');
  });

  it('rejects a boss level without its boss activity', () => {
    const pack = fresh();
    const boss = pack.data.levels.find((l) => l.kind === 'boss')!;
    boss.activities[boss.activities.length - 1]!.kind = 'feeding';
    expectDiagnostic(pack, 'invalid-content', boss.id);
  });

  it('rejects growth rules out of order', () => {
    const pack = fresh();
    pack.data.balance.growth.reverse();
    expectDiagnostic(pack, 'invalid-content', 'balance');
  });

  it('rejects a story reward that no beat claims', () => {
    const pack = fresh();
    pack.data.story.rewards.push({ reward: 'never-claimed', grant: { kind: 'coins', amount: 5 } });
    expectDiagnostic(pack, 'missing-reference', 'never-claimed');
  });

  describe('word templates', () => {
    /** A pack with a thing list and a template whose `fruit` agrees with `count`. */
    const withForm = (): Pack => {
      const pack = fresh();
      pack.data.wordLists.push({ id: 'test-fruit', kind: 'thing', entries: ['word.name.anna'] });
      pack.data.wordTemplates.push({
        id: 'test.form',
        family: 'equal-groups',
        textKey: 'word.equal-groups.nests',
        vars: {
          count: { kind: 'int', min: 1, max: 5 },
          each: { kind: 'int', min: 2, max: 5 },
          total: {
            kind: 'calc',
            expr: {
              kind: 'op',
              op: 'mul',
              left: { kind: 'var', name: 'count' },
              right: { kind: 'var', name: 'each' },
            },
          },
          fruits: { kind: 'word', list: 'test-fruit' },
          fruit: { kind: 'form', word: 'fruits', count: 'count' },
          name: { kind: 'word', list: 'names' },
        },
        model: { kind: 'value', expr: { kind: 'var', name: 'total' } },
        operation: 'mul',
      });
      return pack;
    };
    const template = (pack: Pack) => pack.data.wordTemplates.find((t) => t.id === 'test.form')!;

    it('accepts a form var that makes a thing agree with a count', () => {
      expect(diagnostics(withForm())).toEqual([]);
    });

    it('rejects a form var over a name list or a missing word var', () => {
      const names = withForm();
      template(names).vars['fruit'] = { kind: 'form', word: 'name', count: 'count' };
      expectDiagnostic(names, 'invalid-content', 'test.form');

      const missing = withForm();
      template(missing).vars['fruit'] = { kind: 'form', word: 'nothing', count: 'count' };
      expectDiagnostic(missing, 'invalid-content', 'test.form');
    });

    it('rejects a form var whose count is not a number', () => {
      const pack = withForm();
      template(pack).vars['fruit'] = { kind: 'form', word: 'fruits', count: 'name' };
      expectDiagnostic(pack, 'invalid-content', 'test.form');
    });

    it('rejects a word var used as a number', () => {
      const pack = withForm();
      template(pack).model = { kind: 'value', expr: { kind: 'var', name: 'name' } };
      expectDiagnostic(pack, 'invalid-content', 'test.form');
    });

    it('rejects calculated vars that depend on each other in a cycle', () => {
      const pack = withForm();
      template(pack).vars['count'] = { kind: 'calc', expr: { kind: 'var', name: 'total' } };
      expectDiagnostic(pack, 'invalid-content', 'test.form');
    });
  });

  it('rejects an unknown field (schemas are strict)', () => {
    const pack = fresh() as unknown as { data: Record<string, unknown> };
    pack.data['extra'] = true;
    expect(validateContent(pack, contentRegistration).ok).toBe(false);
  });

  it('rejects a many-headed boss whose meter does not share evenly between the heads', () => {
    const pack = fresh();
    pack.data.bosses.find((b) => b.id === 'seven-headed')!.meter = 20;
    expectDiagnostic(pack, 'invalid-content', 'seven-headed');
  });

  it('rejects a many-headed boss level with fewer skills than heads', () => {
    const pack = fresh();
    const level = pack.data.levels.find((l) => l.id === 'dragon-castle.boss')!;
    level.activities[0]!.skills = level.activities[0]!.skills.slice(0, 6);
    expectDiagnostic(pack, 'invalid-content', 'dragon-castle.boss');
  });

  it('rejects a second finale boss', () => {
    const pack = fresh();
    pack.data.bosses.find((b) => b.id === 'golem')!.finale = true;
    expectDiagnostic(pack, 'invalid-content', 'bosses');
  });

  it('rejects a mastery sticker for an unknown skill', () => {
    const pack = fresh();
    const sticker = pack.data.stickers.find((s) => s.criteria.kind === 'skill-mastered')!;
    sticker.criteria = { kind: 'skill-mastered', skill: 'no-such-skill', level: 'gold', share: 50 };
    expectDiagnostic(pack, 'missing-reference', sticker.id);
  });

  it('rejects an unknown Memory Match mode or Feeding Time draw', () => {
    const match = fresh();
    const memory = match.data.levels.find((l) => l.id === 'sunny-meadow.2')!.activities[1]!;
    memory.options = { pairs: 6, match: 'colour' };
    expectDiagnostic(match, 'invalid-content', 'sunny-meadow.2');

    const draw = fresh();
    draw.data.levels.find((l) => l.id === 'sunny-meadow.2')!.activities[0]!.options = {
      draw: 'random',
    };
    expectDiagnostic(draw, 'invalid-content', 'sunny-meadow.2');
  });
});

describe('cross-file references', () => {
  it('lists every art ID the pack refers to, and flags the ones missing from a catalog', () => {
    const data = fresh().data;
    const ids = collectArtIds(data).map((ref) => ref.id);
    expect(ids).toContain('sunny-meadow');
    expect(ids).toContain('bubbles');
    expect(ids, 'story scenes are background IDs').toContain('castle-hall');
    expect(checkArtCatalog(data, ids)).toEqual([]);
    const withoutRig = ids.filter((id) => id !== 'bubbles');
    expect(checkArtCatalog(data, withoutRig).map((d) => d.recordId)).toEqual(['bubbles']);
  });
});

describe('content history', () => {
  const historyDir = join(root, 'content', 'history');
  const shipped = readdirSync(historyDir).filter((name) => name.endsWith('.json'));
  const archived = (name: string): Pack => JSON.parse(readFileSync(join(historyDir, name), 'utf8'));
  const order = (revision: string): number[] => revision.split('.').map(Number);
  const older = (a: string, b: string): boolean => {
    const [x, y] = [order(a), order(b)];
    const at = x.findIndex((part, i) => part !== y[i]);
    return at >= 0 && x[at]! < y[at]!;
  };

  it('archives every revision merged to main before the current one', () => {
    const current = fresh().revision;
    expect([...shipped].sort()).toEqual(
      Object.keys(REVISIONS)
        .filter((revision) => revision !== current)
        .map((revision) => `${revision}.json`)
        .sort(),
    );
    for (const name of shipped) {
      expect(older(archived(name).revision, current), `${name} is older than ${current}`).toBe(
        true,
      );
    }
  });

  it('pins the current pack to its revision: changed content needs a new revision', () => {
    const current = fresh();
    const hash = dataHash(current);
    expect(
      hash,
      `the content of revision ${current.revision} is new (hash ${hash}): run ` +
        '`npm run content:bump -- <next revision>` and pin the new revision and its hash in ' +
        'REVISIONS (docs/content.md §1)',
    ).toBe(REVISIONS[current.revision]);
  });

  it('never changes an archived pack: saves made on it pin its hash', () => {
    for (const name of shipped) {
      const pack = archived(name);
      expect(dataHash(pack), name).toBe(REVISIONS[pack.revision]);
    }
  });

  it('keeps every catalog key an archived pack uses: a restored old save still shows them', () => {
    for (const name of shipped) {
      const lost = collectCatalogKeys(archived(name).data).filter(({ key }) => !(key in catalog));
      expect(lost, name).toEqual([]);
    }
  });

  it('keeps every shipped pack valid under the current schema, named by its revision', () => {
    for (const name of shipped) {
      const outcome = parseContentJson(
        readFileSync(join(historyDir, name), 'utf8'),
        contentRegistration,
        name,
      );
      expect(outcome.ok, name).toBe(true);
      if (outcome.ok) expect(`${outcome.value.revision}.json`).toBe(name);
    }
  });

  it('never reuses a shipped revision for different content', () => {
    const current = fresh();
    for (const name of shipped.filter((n) => n === `${current.revision}.json`)) {
      expect(JSON.parse(readFileSync(join(historyDir, name), 'utf8'))).toEqual(current);
    }
  });
});
