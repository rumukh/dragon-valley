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
import { parseContentJson, validateContent } from '@aegis/runtime';
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
  it('validates under the registration and is the 1.0.0 dragon-valley pack', () => {
    const outcome = parseContentJson(packText, contentRegistration, 'dragon-valley.content.json');
    expect(outcome.ok, JSON.stringify(outcome.ok ? null : outcome.error.diagnostics)).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.id).toBe(CONTENT_PACK_ID);
    expect(outcome.value.revision).toBe('1.0.0');
    expect(outcome.value.schemaVersion).toBe(1);
  });

  it('is the Region 1 skeleton: Sunny Meadow, six lessons and the Bridge Troll', () => {
    const data = fresh().data;
    expect(data.regions.map((r) => r.id)).toEqual(['sunny-meadow']);
    expect(data.levels.filter((l) => l.kind === 'lesson')).toHaveLength(6);
    expect(data.levels.filter((l) => l.kind === 'boss').map((l) => l.boss)).toEqual([
      'bridge-troll',
    ]);
    expect(data.dragons.map((d) => d.id).sort()).toEqual([
      'bubbles',
      'goldie',
      'mirror',
      'puff',
      'sunny',
    ]);
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

  it('reports the objectives later regions must still cover', () => {
    const gaps = curriculumGaps(fresh().data).map((gap) => gap.objective);
    expect(gaps).toContain('obj.mul.table-6-7');
    expect(gaps).not.toContain('obj.mul.table-2-5-10');
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

  it('rejects an unknown field (schemas are strict)', () => {
    const pack = fresh() as unknown as { data: Record<string, unknown> };
    pack.data['extra'] = true;
    expect(validateContent(pack, contentRegistration).ok).toBe(false);
  });
});

describe('cross-file references', () => {
  it('lists every art ID the pack refers to, and flags the ones missing from a catalog', () => {
    const data = fresh().data;
    const ids = collectArtIds(data).map((ref) => ref.id);
    expect(ids).toContain('background.sunny-meadow');
    expect(ids).toContain('rig.bubbles');
    expect(checkArtCatalog(data, ids)).toEqual([]);
    const withoutRig = ids.filter((id) => id !== 'rig.bubbles');
    expect(checkArtCatalog(data, withoutRig).map((d) => d.recordId)).toEqual(['rig.bubbles']);
  });
});

describe('content history', () => {
  const historyDir = join(root, 'content', 'history');
  const shipped = readdirSync(historyDir).filter((name) => name.endsWith('.json'));

  it('archives exactly the shipped revisions (none before the v1 release)', () => {
    // The release-v1 work copies the shipped pack to content/history/1.0.0.json and updates
    // this list; every later content release adds its revision here (docs/contract.md).
    expect(shipped).toEqual([]);
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
