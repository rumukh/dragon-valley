/**
 * Small shell modules of the play screens: response time without pauses, the play clock behind
 * the time limit, the picture behind a problem, choice labels in both notations, card faces read
 * aloud, the valley map's layout and the content strings.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseContentJson, requireValue } from '@aegis/runtime';
import {
  BLANK,
  contentRegistration,
  formatFace,
  MAX_ELAPSED_MS,
  num,
  op,
  parseCardLabel,
} from '../../../src/rules/contract';
import { createPlayClock, createResponseTimer } from '../../../src/app/game/timer';
import { modelFor } from '../../../src/app/math/model';
import { levelPositions, parseValleyMap, pointsAlong } from '../../../src/app/game/map';
import {
  createContentText,
  missingContentKeys,
  parseContentCatalog,
} from '../../../src/app/content/text';
import { answerId, answerLabel, answerSpoken } from '../../../src/app/screens/problem-view';
import { matchColumns, matchColumnsWide } from '../../../src/app/screens/minigames';
import { speakFace } from '../../../src/app/speech/verbalizer';
import { createTranslator } from '../../../src/app/i18n/messages';

function clock() {
  let now = 0;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe('response time', () => {
  it('counts only the time the problem was on screen and the game running', () => {
    const time = clock();
    const timer = createResponseTimer(time.now);
    timer.start();
    time.advance(1000);
    timer.pause();
    time.advance(60_000);
    timer.resume();
    time.advance(500);
    expect(timer.elapsed()).toBe(1500);
    timer.start();
    expect(timer.elapsed()).toBe(0);
  });

  it('keeps a pause that began before the problem, and caps very slow answers', () => {
    const time = clock();
    const timer = createResponseTimer(time.now);
    timer.pause();
    timer.start();
    time.advance(5000);
    expect(timer.elapsed()).toBe(0);
    timer.resume();
    time.advance(MAX_ELAPSED_MS * 2);
    expect(timer.elapsed()).toBe(MAX_ELAPSED_MS);
  });

  it('measures play time for the time limit without a cap or hidden time', () => {
    const time = clock();
    const play = createPlayClock(time.now);
    time.advance(20 * 60_000);
    play.pause();
    time.advance(60 * 60_000);
    play.resume();
    time.advance(5 * 60_000);
    expect(play.elapsed()).toBe(25 * 60_000);
  });
});

describe('problem pictures', () => {
  it('draw products as arrays and divisions as groups, with leftovers for remainders', () => {
    expect(modelFor({ kind: 'equation', left: op('mul', num(3), num(4)), right: BLANK })).toEqual({
      kind: 'array',
      rows: 3,
      columns: 4,
    });
    expect(modelFor({ kind: 'equation', left: op('div', num(12), num(3)), right: BLANK })).toEqual({
      kind: 'groups',
      total: 12,
      size: 3,
    });
    expect(modelFor({ kind: 'equation', left: op('mul', BLANK, num(6)), right: num(42) })).toEqual({
      kind: 'groups',
      total: 42,
      size: 6,
    });
    expect(modelFor({ kind: 'divrem', dividend: 23, divisor: 5 })).toEqual({
      kind: 'groups',
      total: 23,
      size: 5,
    });
  });

  it('offer no picture where neither counting nor a strategy picture would help', () => {
    // 0 · 4 is a rule fact with its own picture; 0 · 100 has nothing to count, move or share.
    expect(
      modelFor({ kind: 'equation', left: op('mul', num(0), num(100)), right: BLANK }),
    ).toBeNull();
    // Two two-digit factors are beyond the 3rd grade; round tens like 30 · 4 have their picture.
    expect(
      modelFor({ kind: 'equation', left: op('mul', num(23), num(15)), right: BLANK }),
    ).toBeNull();
    expect(modelFor({ kind: 'compare', left: num(3), right: num(4) })).toBeNull();
  });
});

describe('answer choices', () => {
  const t = createTranslator();
  it('have stable ids, notation-aware labels and spoken words', () => {
    const remainder = { kind: 'remainder', quotient: 4, remainder: 3 } as const;
    expect(answerId(remainder)).toBe('4r3');
    expect(answerLabel(remainder, 'czech', t)).toBe('4 r 3');
    expect(answerLabel(remainder, 'international', t)).toBe('4 R 3');
    expect(answerSpoken(remainder, t)).toBe('four remainder three');
    const divide = { kind: 'operation', operation: 'div' } as const;
    expect(answerLabel(divide, 'czech', t)).toBe(':');
    expect(answerLabel(divide, 'international', t)).toBe('÷');
    expect(answerLabel({ kind: 'term', term: 'product' }, 'czech', t)).toBe('product');
    expect(answerSpoken({ kind: 'relation', relation: 'lt' }, t)).toBe('is less than');
  });
});

describe('minigame cards', () => {
  it('show and read the additive faces of the younger classes (contract §11.1)', () => {
    const add = parseCardLabel('expr:add:3:5');
    const sub = parseCardLabel('expr:sub:8:3');
    expect(add && formatFace(add, 'czech')).toBe('3 + 5');
    expect(sub && formatFace(sub, 'czech')).toBe('8 \u2212 3');
    expect(add && speakFace(add)).toBe('three plus five');
    expect(sub && speakFace(sub)).toBe('eight minus three');
  });

  it('read faces aloud and fill whole rows', () => {
    expect(speakFace({ kind: 'expr', expr: op('mul', num(7), num(8)) })).toBe('seven times eight');
    expect(speakFace({ kind: 'answer', answer: { kind: 'number', value: 56 } })).toBe('fifty-six');
    // An example sentence names the number its term is about (DV-QA-17).
    const sentence = { op: 'div' as const, left: 30, right: 6, result: 5, remainder: null };
    expect(speakFace({ kind: 'sentence', sentence, highlight: 'right' })).toBe(
      'thirty divided by six equals five, six marked',
    );
    expect(
      speakFace({
        kind: 'sentence',
        sentence: { op: 'mul', left: 6, right: 6, result: 36, remainder: null },
        highlight: 'right',
      }),
    ).toBe('six times six equals thirty-six, the second six marked');
    expect(speakFace({ kind: 'sentence', sentence, highlight: null })).toBe(
      'thirty divided by six equals five',
    );
    expect(matchColumns(12)).toBe(4);
    expect(matchColumns(10)).toBe(5);
    expect(matchColumns(6)).toBe(3);
    // On a landscape window: two rows (one row up to four cards).
    expect(matchColumnsWide(12)).toBe(6);
    expect(matchColumnsWide(10)).toBe(5);
    expect(matchColumnsWide(6)).toBe(3);
    expect(matchColumnsWide(4)).toBe(4);
    expect(matchColumnsWide(16)).toBe(8);
  });
});

describe('the valley map', () => {
  const map = parseValleyMap(
    JSON.parse(readFileSync('assets/backgrounds/map-hotspots.json', 'utf8')) as unknown,
  );

  it('reads S4 hotspots and the road of every content region', () => {
    expect(map.logical).toEqual({ width: 1600, height: 1000 });
    expect(map.hotspots.map((spot) => spot.id)).toContain('sunny-meadow');
    expect(map.regions['sunny-meadow']?.nodes).toHaveLength(6);
  });

  it('places as many levels as the content has, spacing extra ones along the road', () => {
    const region = map.regions['sunny-meadow']!;
    expect(levelPositions(region, 6)).toEqual(region.nodes);
    const four = levelPositions(region, 4);
    expect(four).toHaveLength(4);
    expect(four[0]).toEqual(region.path[0]);
    expect(four[3]).toEqual(region.path[region.path.length - 1]);
    expect(
      pointsAlong(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        3,
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it('refuses a broken layout', () => {
    expect(() => parseValleyMap({})).toThrow();
    expect(() => parseValleyMap({ logical: { width: 10, height: 10 }, hotspots: {} })).toThrow();
  });
});

describe('content strings', () => {
  const pack = requireValue(
    parseContentJson(
      readFileSync('content/dragon-valley.content.json', 'utf8'),
      contentRegistration,
      'dragon-valley.content.json',
    ),
  );
  const catalog = parseContentCatalog(
    JSON.parse(readFileSync('content/catalogs/en.content.json', 'utf8')) as unknown,
  );

  it('cover every key the shipped pack uses and fill placeholders', () => {
    expect(missingContentKeys(pack.data, catalog)).toEqual([]);
    const text = createContentText(catalog);
    expect(text('level.sunny-meadow.1')).toBe('Equal Groups');
    expect(text.has('level.sunny-meadow.1')).toBe(true);
    expect(text.has('level.nowhere')).toBe(false);
    expect(() => text('level.nowhere')).toThrow();
  });

  it('refuse a catalog that is not a flat map of words', () => {
    expect(() => parseContentCatalog([])).toThrow();
    expect(() => parseContentCatalog({ a: 1 })).toThrow();
    expect(() => parseContentCatalog({ a: '' })).toThrow();
    expect(missingContentKeys(pack.data, {})).not.toEqual([]);
  });
});
