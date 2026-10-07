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
