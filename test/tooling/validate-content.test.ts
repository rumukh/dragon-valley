/**
 * The content gate (scripts/validate-content.mjs) checks a word template's `words` count, its
 * story's reading time, against the story in the catalog. Each test works on a throwaway copy of
 * the content and the contract, with the repository's packages linked in.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateContentTree } from '../../scripts/validate-content.mjs';

const repository = join(import.meta.dirname, '..', '..');
let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'dv-validate-content-'));
  cpSync(join(repository, 'content'), join(root, 'content'), { recursive: true });
  cpSync(join(repository, 'src', 'rules', 'contract'), join(root, 'src', 'rules', 'contract'), {
    recursive: true,
  });
  symlinkSync(join(repository, 'node_modules'), join(root, 'node_modules'), 'junction');
});

afterAll(() => {
  rmSync(join(root, 'node_modules'), { force: true, recursive: false });
  rmSync(root, { recursive: true, force: true });
});

/** Give the template `id` a `words` count and run the gate. */
async function gateWith(id: string, words: number) {
  const file = join(root, 'content', 'dragon-valley.content.json');
  const pack = JSON.parse(
    readFileSync(join(repository, 'content', 'dragon-valley.content.json'), 'utf8'),
  );
  pack.data.wordTemplates.find((t: { id: string }) => t.id === id).words = words;
  writeFileSync(file, `${JSON.stringify(pack, null, 2)}\n`);
  return validateContentTree({ root });
}

describe('the content gate on sentences for grades 1-2', () => {
  /** Give catalog key `key` the text `text` and run the gate on the repository's pack. */
  async function gateWithText(key: string, text: string) {
    const file = join(root, 'content', 'catalogs', 'en.content.json');
    const original = readFileSync(
      join(repository, 'content', 'catalogs', 'en.content.json'),
      'utf8',
    );
    const catalog = JSON.parse(original);
    const strings = catalog.strings ?? catalog;
    strings[key] = text;
    writeFileSync(file, `${JSON.stringify(catalog, null, 2)}\n`);
    writeFileSync(
      join(root, 'content', 'dragon-valley.content.json'),
      readFileSync(join(repository, 'content', 'dragon-valley.content.json'), 'utf8'),
    );
    try {
      return await validateContentTree({ root });
    } finally {
      writeFileSync(file, original);
    }
  }

  it('fails a seven-word sentence in a grade 1 region beat', async () => {
    const result = await gateWithText(
      'story.wisps-dance.1',
      'The little wisps dance and giggle together!',
    );
    expect(result.errors).toEqual([
      'story.wisps-dance.1: "The little wisps dance and giggle together" has 7 words (max 6)',
    ]);
  });

  it('keeps the longer limit for 3rd-grade beats', async () => {
    const result = await gateWithText(
      'story.finale.4',
      'Thank you, Dragon Keeper, the whole valley is warm again.',
    );
    expect(result.errors).toEqual([]);
  });
});

describe('the content gate on story word counts', () => {
  it('passes a count that is the length of the story', async () => {
    // "{name} finds {nests} nests. Each nest has {eggs} eggs. How many eggs are there?"
    const result = await gateWith('word.equal-groups.nests', 14);
    expect(result.errors).toEqual([]);
  });

  it('fails a count that is not, naming the template', async () => {
    const result = await gateWith('word.equal-groups.nests', 12);
    expect(result.errors).toEqual([
      'Word template "word.equal-groups.nests" says 12 words, but "word.equal-groups.nests" has 14.',
    ]);
  });
});
