/**
 * docs/curriculum.md and the content pack name the same objectives, and for every level that
 * exists in the pack, the document's objective-to-level mapping matches the pack's level
 * objectives in both directions. The two sides are authored separately (prose table and JSON),
 * so agreement is evidence, not a tautology.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ContentData } from '../../../src/rules/contract';

const root = join(import.meta.dirname, '..', '..', '..');
const doc = readFileSync(join(root, 'docs', 'curriculum.md'), 'utf8').replace(/\r\n/g, '\n');
const data: ContentData = JSON.parse(
  readFileSync(join(root, 'content', 'dragon-valley.content.json'), 'utf8'),
).data;

/** Rows of the markdown table under a `## <heading>` section, split into trimmed cells. */
function tableRows(heading: string): string[][] {
  const start = doc.indexOf(`\n## ${heading}`);
  expect(start, `section "${heading}" exists`).toBeGreaterThan(-1);
  const end = doc.indexOf('\n## ', start + 4);
  return doc
    .slice(start, end === -1 ? undefined : end)
    .split('\n')
    .filter((line) => line.startsWith('| `obj.'))
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
}

const codes = (cell: string) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);

describe('docs/curriculum.md and the content pack', () => {
  it('declare the same objective IDs', () => {
    const documented = tableRows('2. Objectives').map((row) => codes(row[0]!)[0]);
    expect(documented.length, 'the objectives table was found').toBeGreaterThan(20);
    expect([...documented].sort()).toEqual(data.objectives.map((o) => o.id).sort());
  });

  it('map every objective in both tables', () => {
    const mapped = tableRows('3. Objectives by level and boss').map((row) => codes(row[0]!)[0]);
    expect([...mapped].sort()).toEqual(data.objectives.map((o) => o.id).sort());
  });

  it('agree, for every level in the pack, on which objectives it teaches', () => {
    const mapping = new Map<string, Set<string>>();
    for (const row of tableRows('3. Objectives by level and boss')) {
      const objective = codes(row[0]!)[0]!;
      for (const level of [...codes(row[1]!), ...codes(row[2]!)]) {
        if (!mapping.has(level)) mapping.set(level, new Set());
        mapping.get(level)!.add(objective);
      }
    }
    for (const level of data.levels) {
      expect([...level.objectives].sort(), level.id).toEqual(
        [...(mapping.get(level.id) ?? [])].sort(),
      );
    }
  });
});
