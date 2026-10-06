/**
 * The word-problem content: English for 8-year-olds that reads correctly for every number and
 * word the generator can draw. Plurals agree with their counts, pronouns with their names, every
 * sentence keeps to the child profile's 10 words with the longest names and things, and the
 * wording follows the editorial ruling: "N times as many" in both directions, never "N times
 * fewer", side by side with "N more" and "N fewer".
 */
import { describe, expect, it } from 'vitest';
import { CHILD_PROFILE, tokenizeWords } from '@aegis/narrative';
import type { TemplateExpr, WordTemplate } from '../../../src/rules/contract';
import { templateCombinations } from '../../../src/rules/learning/generators/word';
import { wordProblemWords } from '../../../scripts/validate-content.mjs';
import { catalog, data, step } from './oracle';

const textOf = (t: WordTemplate) => catalog[t.textKey]!;
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);

function numberValue(expr: TemplateExpr, vars: Record<string, number>): number | null {
  if (expr.kind === 'num') return expr.value;
  if (expr.kind === 'var') return vars[expr.name] ?? null;
  if (expr.kind === 'group') return numberValue(expr.inner, vars);
  const a = numberValue(expr.left, vars);
  const b = numberValue(expr.right, vars);
  return a === null || b === null ? null : step(expr.op, a, b);
}

/** Every value a numeric variable takes over the template's valid combinations. */
function valuesOf(template: WordTemplate, name: string): Set<number> {
  const values = new Set<number>();
  for (const ints of templateCombinations(template)) {
    const vars: Record<string, number> = { ...ints };
    for (let pass = 0; pass < 4; pass++) {
      for (const [n, v] of Object.entries(template.vars)) {
        if (v.kind === 'calc') {
          const computed = numberValue(v.expr, vars);
          if (computed !== null) vars[n] = computed;
        }
      }
    }
    if (vars[name] !== undefined) values.add(vars[name]!);
  }
  return values;
}

const listOf = (template: WordTemplate, name: string) => {
  const v = template.vars[name];
  const word = v?.kind === 'form' ? template.vars[v.word] : v;
  return word?.kind === 'word' ? data.wordLists.find((l) => l.id === word.list) : undefined;
};

describe('word-problem English', () => {
  it('names every placeholder as a template variable', () => {
    const unknown = data.wordTemplates.flatMap((t) =>
      placeholders(textOf(t))
        .filter((name) => t.vars[name] === undefined)
        .map((name) => `${t.id}: {${name}}`),
    );
    expect(unknown).toEqual([]);
  });

  it('agrees every thing with the number in front of it ("1 apple", "3 apples")', () => {
    const wrong: string[] = [];
    for (const t of data.wordTemplates) {
      for (const [, count, thing] of textOf(t).matchAll(/\{(\w+)\} \{(\w+)\}/g)) {
        const v = t.vars[thing!];
        if (v?.kind === 'form') {
          if (v.count !== count)
            wrong.push(`${t.id}: {${thing}} agrees with ${v.count}, not ${count}`);
        } else if (v?.kind === 'word' && listOf(t, thing!)?.kind === 'thing') {
          // A plain thing is plural, so the number before it can never be 1.
          if (valuesOf(t, count!).has(1))
            wrong.push(`${t.id}: "{${count}} {${thing}}" can read "1 ...s"`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('uses she and he only with girls and boys names', () => {
    const wrong: string[] = [];
    for (const t of data.wordTemplates) {
      const text = textOf(t).toLowerCase();
      const names = placeholders(textOf(t)).filter((name) => listOf(t, name)?.kind === 'name');
      for (const [pronoun, list] of [
        ['she', 'girls'],
        ['he', 'boys'],
      ] as const) {
        if (
          new RegExp(`\\b${pronoun}\\b`).test(text) &&
          names.some((name) => listOf(t, name)?.id !== list)
        ) {
          wrong.push(`${t.id}: "${pronoun}" with a name that is not from ${list}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('keeps every sentence to 10 words with the longest names and things', () => {
    const long: string[] = [];
    for (const t of data.wordTemplates) {
      for (const sentence of textOf(t).split(/[.!?]+/)) {
        const words = wordProblemWords(sentence, t, data.wordLists, catalog, { tokenizeWords });
        if (words > CHILD_PROFILE.maxWordsPerSentence)
          long.push(`${t.id}: "${sentence.trim()}" (${words})`);
      }
    }
    expect(CHILD_PROFILE.maxWordsPerSentence).toBe(10);
    expect(long).toEqual([]);
  });

  it('never says "times fewer"; "that is N times as many as" asks for the smaller number', () => {
    expect(
      data.wordTemplates.filter((t) => /times fewer/i.test(textOf(t))).map((t) => t.id),
    ).toEqual([]);
    for (const t of data.wordTemplates.filter((t) => t.family === 'times-fewer')) {
      expect(textOf(t), t.id).toMatch(/That is \{times\} times as many as/);
      expect(t.operation, t.id).toBe('div');
    }
    // Parents see objectives and skills too: no content string uses the phrase.
    expect(
      Object.entries(catalog)
        .filter(([, text]) => /times fewer/i.test(text))
        .map(([key]) => key),
    ).toEqual([]);
  });

  it('pairs each multiplicative comparison with its additive twin, word for word', () => {
    const pairs: [string, string, string, string][] = [
      ['word.times-as-many.fruit', 'word.more-than.fruit', '{times} times as many', '{more} more'],
      [
        'word.times-fewer.fruit',
        'word.more-than.inverse',
        '{times} times as many as',
        '{more} more than',
      ],
    ];
    for (const [times, more, from, to] of pairs) {
      expect(catalog[times]!.replace(from, to), `${times} vs ${more}`).toBe(catalog[more]);
    }
  });

  it('counts placeholders at their longest: a two-word name makes "{name} waves" three words', () => {
    const template = { vars: { name: { kind: 'word', list: 'long' } } };
    const lists = [{ id: 'long', kind: 'name', entries: ['x.long'] }];
    const words = wordProblemWords(
      '{name} waves',
      template,
      lists,
      { 'x.long': 'Anna Marie' },
      { tokenizeWords },
    );
    expect(words).toBe(3);
    expect(
      wordProblemWords("{name}'s cat", template, lists, { 'x.long': 'Eva' }, { tokenizeWords }),
    ).toBe(2);
  });
});
