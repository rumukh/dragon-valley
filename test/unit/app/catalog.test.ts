/**
 * The English catalog (content/catalogs/en.ui.json): child-facing lines stay within the narrative toolkit's child profile
 * (at most ten words per sentence), every placeholder is well formed and every key is used.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHILD_PROFILE, tokenizeWords } from '@aegis/narrative';
import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_KINDS,
  DRAGON_EXPRESSIONS,
  DRAGON_STAGES,
  KEEPER_AVATARS,
  NOTATIONS,
  TERMS,
} from '../../../src/rules/contract';
import { RULE_ERROR_CODES } from '../../../src/app/game/errors';
import { createTranslator, EN_UI as en, placeholders } from '../../../src/app/i18n/messages';
import type { MessageKey } from '../../../src/app/i18n/messages';

/** Keys for grown-ups; longer, plain explanations are fine there. */
const GROWN_UP_PREFIXES = ['parent.', 'recovery.', 'startup.', 'error.code'];

/** Keys built at runtime from a vocabulary, so they never appear literally in the source. */
const DYNAMIC_PREFIXES = [
  'avatar.keeper-',
  'parent.tab.',
  'parent.settings.notation.',
  'editor.problem.',
  'activity.',
  'stage.',
  'grow.',
  'expression.',
  'boss.meter.',
  'boss.pose.',
  'term.',
  'results.grew.',
  'day.',
  ...RULE_ERROR_CODES.map((code) => `error.${code}`),
];

const keys = Object.keys(en) as MessageKey[];

function sentences(text: string): string[] {
  return text
    .replace(/\{[A-Za-z][A-Za-z0-9_]*\}/g, 'X')
    .split(/[.!?…]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'art' ? [] : sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('English catalog', () => {
  it('keeps every child-facing sentence within the child profile', () => {
    const long: string[] = [];
    for (const key of keys) {
      if (GROWN_UP_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
      for (const sentence of sentences(en[key])) {
        if (tokenizeWords(sentence).length > CHILD_PROFILE.maxWordsPerSentence) {
          long.push(`${key}: ${sentence}`);
        }
      }
    }
    expect(long).toEqual([]);
  });

  it('is a flat map of strings', () => {
    const raw = JSON.parse(
      readFileSync(join('content', 'catalogs', 'en.ui.json'), 'utf8'),
    ) as unknown;
    expect(typeof raw).toBe('object');
    for (const value of Object.values(raw as Record<string, unknown>)) {
      expect(typeof value).toBe('string');
    }
  });

  it('has no empty messages and only well-formed placeholders', () => {
    for (const key of keys) {
      const text = en[key];
      expect(text.trim(), key).not.toBe('');
      expect(text.replace(/\{[A-Za-z][A-Za-z0-9_]*\}/g, ''), key).not.toMatch(/[{}]/);
    }
  });

  it('names every keeper picture and both notations', () => {
    for (const avatar of KEEPER_AVATARS) expect(en).toHaveProperty(`avatar.${avatar}`);
    for (const notation of NOTATIONS)
      expect(en).toHaveProperty(`parent.settings.notation.${notation}`);
  });

  it('names every activity, stage, expression, term, boss mood, weekday and rule refusal', () => {
    const expected = [
      ...ACTIVITY_KINDS.map((kind) => `activity.${kind}`),
      ...DRAGON_STAGES.map((stage) => `stage.${stage}`),
      ...DRAGON_STAGES.filter((stage) => stage !== 'egg').flatMap((stage) => [
        `grow.${stage}`,
        `results.grew.${stage}`,
      ]),
      ...DRAGON_EXPRESSIONS.map((expression) => `expression.${expression}`),
      ...TERMS.map((term) => `term.${term}`),
      ...['laughing', 'sleepy', 'happy'].map((mood) => `boss.meter.${mood}`),
      ...['start', 'warming', 'won'].map((pose) => `boss.pose.${pose}`),
      ...['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].flatMap((day) => [
        `day.${day}`,
        `day.short.${day}`,
      ]),
      ...RULE_ERROR_CODES.map((code) => `error.${code}`),
    ];
    for (const key of expected) expect(en, key).toHaveProperty([key]);
  });

  it('fills placeholders and refuses to invent missing values', () => {
    const t = createTranslator();
    expect(t('hub.greeting', { name: 'Ema' })).toBe('Hello, Ema!');
    expect(t('round.progress', { current: 2, total: 4 })).toBe('Problem 2 of 4');
    expect(placeholders(en['round.progress'])).toEqual(['current', 'total']);
    expect(() => t('hub.greeting')).toThrow();
  });

  it('uses every message somewhere in the shell', () => {
    const source = sourceFiles(join('src', 'app'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    const unused = keys.filter(
      (key) =>
        !DYNAMIC_PREFIXES.some((prefix) => key.startsWith(prefix)) && !source.includes(`'${key}'`),
    );
    expect(unused).toEqual([]);
  });
});
