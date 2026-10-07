/**
 * Reading time in the content contract (docs/design.md §6.2): a word template may give its
 * story's length in `words`, and the balance a `response.word` reading time. Both are optional,
 * so content without them (1.1.0) stays valid and keeps the plain response limits. A count must
 * be the story's length in the catalog (`storyWordCount`, checked by the content gate through
 * `checkStoryWords`). Negative cases start from the shipped pack and change one thing; content
 * 1.2.0 ships both fields, so "without them" is the shipped pack with both taken out.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateContent } from '@aegis/runtime';
import type { RuntimeDiagnostic } from '@aegis/runtime';
import { checkStoryWords, contentRegistration, storyWordCount } from '../../../src/rules/contract';
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
const TIMING = { perWordMs: 1000, wholeStoryMs: 4000, rereadPercent: 25 };

function diagnostics(pack: Pack): readonly RuntimeDiagnostic[] {
  const outcome = validateContent(pack, contentRegistration, 'test.json');
  return outcome.ok ? [] : outcome.error.diagnostics;
}

/** The pack with every story's word count and the reading time. */
function counted(): Pack {
  const pack = fresh();
  for (const t of pack.data.wordTemplates) t.words = storyWordCount(catalog[t.textKey]!);
  pack.data.balance.response.word = { ...TIMING };
  return pack;
}

/** The pack with neither field: no story's word count, no reading time. */
function bare(): Pack {
  const pack = fresh();
  for (const t of pack.data.wordTemplates) delete t.words;
  delete pack.data.balance.response.word;
  return pack;
}

describe('reading time in the content', () => {
  it('is optional: a pack with neither field is valid', () => {
    const pack = bare();
    expect(pack.data.wordTemplates.some((t) => t.words !== undefined)).toBe(false);
    expect(pack.data.balance.response.word).toBeUndefined();
    expect(diagnostics(pack)).toEqual([]);
  });

  it('is shipped: every story counted, read at 1 s a word (design §6.2, F1b)', () => {
    const pack = fresh();
    expect(
      pack.data.wordTemplates.filter((t) => t.words !== storyWordCount(catalog[t.textKey]!)),
      'every template counts its story',
    ).toEqual([]);
    expect(pack.data.balance.response.word).toEqual(TIMING);
    expect(diagnostics(pack)).toEqual([]);
  });

  it('takes a word count for every story and a reading time in the balance', () => {
    const pack = counted();
    expect(diagnostics(pack)).toEqual([]);
    const outcome = validateContent(pack, contentRegistration, 'test.json');
    if (!outcome.ok) throw new Error('valid');
    const nests = outcome.value.data.wordTemplates.find((t) => t.id === 'word.equal-groups.nests');
    expect(nests?.words).toBe(14);
    expect(outcome.value.data.balance.response.word).toEqual(TIMING);
  });

  it('refuses a count of no words, a reread share over 100 % and unknown timing fields', () => {
    const empty = counted();
    empty.data.wordTemplates[0]!.words = 0;
    expect(diagnostics(empty).length, 'words: 0').toBeGreaterThan(0);
    const reread = counted();
    reread.data.balance.response.word!.rereadPercent = 101;
    expect(diagnostics(reread).length, 'rereadPercent: 101').toBeGreaterThan(0);
    const extra = counted();
    (extra.data.balance.response.word as unknown as Record<string, number>)['perLetterMs'] = 50;
    expect(diagnostics(extra).length, 'perLetterMs').toBeGreaterThan(0);
    const partial = counted();
    delete (partial.data.balance.response.word as Partial<typeof TIMING>).wholeStoryMs;
    expect(diagnostics(partial).length, 'wholeStoryMs missing').toBeGreaterThan(0);
  });

  it("counts a story's words as the child profile does, a placeholder as one word", () => {
    expect(
      storyWordCount(
        '{name} finds {nests} nests. Each nest has {eggs} eggs. How many eggs are there?',
      ),
    ).toBe(14);
    expect(storyWordCount("{name}'s cat has 3 kittens!"), "name's is one word").toBe(5);
    expect(storyWordCount('  Two   spaces,  and a dash - here. '), 'punctuation is no word').toBe(
      6,
    );
  });

  it('checks every count against its story in the catalog', () => {
    expect(checkStoryWords(bare().data, catalog), 'no counts, nothing to check').toEqual([]);
    expect(checkStoryWords(fresh().data, catalog), 'the shipped counts').toEqual([]);
    const pack = counted();
    expect(checkStoryWords(pack.data, catalog)).toEqual([]);
    const nests = pack.data.wordTemplates.find((t) => t.id === 'word.equal-groups.nests')!;
    nests.words = 13;
    expect(checkStoryWords(pack.data, catalog)).toEqual([
      expect.objectContaining({ code: 'story-words', recordId: 'word.equal-groups.nests' }),
    ]);
    expect(checkStoryWords(pack.data, catalog)[0]!.message).toContain('says 13 words');
    expect(checkStoryWords(pack.data, catalog)[0]!.message).toContain('has 14');
  });
});
