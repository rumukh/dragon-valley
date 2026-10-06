/**
 * The skill item index (`skillItemIndex`: every skill's items), cached. The runtime hands each
 * read and transition a fresh clone of the content, so the cache is keyed by what the index
 * depends on (the skills and the word templates' families), not by object identity. The key
 * costs a small fraction of the index, which every command, legality check and view needs.
 */
import { skillItemIndex } from '../contract';
import type { Data } from '../types';

export type Index = ReadonlyMap<string, readonly string[]>;

let cached: { key: string; index: Index } | null = null;

export function itemIndex(data: Data): Index {
  const key = JSON.stringify([data.skills, data.wordTemplates.map((t) => [t.id, t.family])]);
  if (cached === null || cached.key !== key) cached = { key, index: skillItemIndex(data) };
  return cached.index;
}
