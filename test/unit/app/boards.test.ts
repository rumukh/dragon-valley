/**
 * The v1 boards as the shell draws them: Sharing Feast's fruit, division and messages; Golem
 * Orders' gears (each sign is the operation it starts), the marked part of the line and the
 * chain of steps.
 */
import { describe, expect, it } from 'vitest';
import { group, num, op } from '../../../src/rules/contract';
import type { Expr } from '../../../src/rules/contract';
import {
  exprAt,
  formatSolved,
  isWithin,
  pathTokens,
  samePath,
} from '../../../src/app/math/notation';
import {
  DEAL_MS,
  dealBeats,
  feastMessage,
  feastProblem,
  fruitPile,
  TENS_FROM,
} from '../../../src/app/screens/boards/feast';
import { chainText, gearId, golemMessage } from '../../../src/app/screens/boards/golem';
import { createTranslator, placeholders } from '../../../src/app/i18n/messages';

describe('Sharing Feast', () => {
  it('draws small feasts as loose fruit and big ones as bags of ten', () => {
    expect(fruitPile(7, 12)).toEqual({ tens: 0, ones: 7 });
    expect(fruitPile(19, TENS_FROM - 1)).toEqual({ tens: 0, ones: 19 });
    expect(fruitPile(48, 48)).toEqual({ tens: 4, ones: 8 });
    expect(fruitPile(8, 96)).toEqual({ tens: 0, ones: 8 });
    expect(fruitPile(0, 96)).toEqual({ tens: 0, ones: 0 });
  });

  it('asks the division the baskets show, with "r" for leftovers in Czech notation', () => {
    const fair = feastProblem({ total: 12, baskets: 3, remainder: false });
    expect(formatSolved(fair, { kind: 'number', value: 4 })).toBe('12 : 3 = 4');
    const left = feastProblem({ total: 13, baskets: 3, remainder: true });
    expect(formatSolved(left, { kind: 'remainder', quotient: 4, remainder: 1 })).toBe(
      '13 : 3 = 4 r 1',
    );
    expect(
      formatSolved(left, { kind: 'remainder', quotient: 4, remainder: 1 }, 'international'),
    ).toBe('13 ÷ 3 = 4 R 1');
  });

  it('says kindly what the last check found', () => {
    const t = createTranslator();
    expect(t(feastMessage({ last: null, remainder: false }))).toMatch(/Tap a basket/);
    expect(t(feastMessage({ last: 'uneven', remainder: false }))).toMatch(/Not fair yet/);
    expect(t(feastMessage({ last: 'more', remainder: true }))).toMatch(/one more/);
    expect(feastMessage({ last: 'count', remainder: false })).toBe('feast.count');
    expect(feastMessage({ last: 'count', remainder: true })).toBe('feast.countLeft');
  });

  it('deals a right early answer out to the fair share, a beat at a time, within 1.2 s', () => {
    // 23 : 5 answered with one basket started and one overfull: every beat moves each basket
    // one closer, from the bowl or back to it.
    expect(dealBeats([1, 0, 6, 0, 0], 4)).toEqual([
      [2, 1, 5, 1, 1],
      [3, 2, 4, 2, 2],
      [4, 3, 4, 3, 3],
      [4, 4, 4, 4, 4],
    ]);
    expect(dealBeats([4, 4, 4], 4), 'already shared out: no deal').toEqual([]);
    // The biggest feast: nothing dealt, nine each; every beat is short enough for 1.2 s.
    const beats = dealBeats(
      Array.from({ length: 10 }, () => 0),
      9,
    );
    expect(beats).toHaveLength(9);
    expect(Math.min(160, DEAL_MS / beats.length) * beats.length).toBeLessThanOrEqual(DEAL_MS);
  });
});

describe('Golem Orders', () => {
  // 60 + 6 · (2 + 3): the multiplication's right side is in brackets.
  const expr: Expr = op('add', num(60), op('mul', num(6), group(op('add', num(2), num(3)))));

  it('gives every sign the path of its operation, in reading order', () => {
    const tokens = pathTokens(expr);
    expect(tokens.map((token) => token.text).join(' ')).toBe('60 + 6 · ( 2 + 3 )');
    expect(tokens.filter((token) => token.kind === 'sign').map((token) => token.path)).toEqual([
      [],
      ['right'],
      ['right', 'right', 'inner'],
    ]);
    expect(pathTokens(expr, 'international').map((token) => token.text)).toContain('×');
    expect(gearId([])).toBe('golem-sign-root');
    expect(gearId(['right', 'right', 'inner'])).toBe('golem-sign-right-right-inner');
  });

  it('writes the brackets precedence needs even without a bracket node', () => {
    const implicit = op('mul', op('add', num(2), num(3)), num(4));
    expect(
      pathTokens(implicit)
        .map((token) => token.text)
        .join(' '),
    ).toBe('( 2 + 3 ) · 4');
    const left = pathTokens(implicit).filter((token) => token.kind === 'bracket');
    expect(left.map((token) => token.path)).toEqual([['left'], ['left']]);
  });

  it('marks the picked operation and finds it again', () => {
    const picked = ['right', 'right', 'inner'] as const;
    const marked = pathTokens(expr)
      .filter((token) => isWithin(token.path, [...picked]))
      .map((token) => token.text);
    expect(marked).toEqual(['2', '+', '3']);
    expect(exprAt(expr, [...picked])).toEqual(op('add', num(2), num(3)));
    expect(exprAt(expr, ['left', 'inner'])).toBeNull();
    expect(samePath(['right'], ['right'])).toBe(true);
    expect(samePath(['right'], ['right', 'left'])).toBe(false);
    expect(isWithin(['right', 'left'], [])).toBe(true);
  });

  it('chooses its message from the last move', () => {
    expect(golemMessage({ last: null, picked: null })).toBe('golem.how');
    expect(golemMessage({ last: null, picked: ['left'] })).toBe('golem.value');
    expect(golemMessage({ last: 'right', picked: null })).toBe('golem.right');
    expect(golemMessage({ last: 'not-first', picked: null })).toBe('golem.notFirst');
    expect(golemMessage({ last: 'wrong-value', picked: [] })).toBe('golem.wrong');
    const t = createTranslator();
    expect(t('golem.notFirst', { mul: '·', div: ':', plus: '+', minus: '−' })).toBe(
      'Not yet! First brackets, then · and :, then + and −.',
    );
    expect(placeholders(t('golem.solved', { chain: 'x' }))).toEqual([]);
  });

  it('keeps each step of the chain on one line', () => {
    const chain = chainText(['8 + 2 · 3', '8 + 6', '14']);
    expect(chain.replace(/\u00a0/g, ' ')).toBe('8 + 2 · 3 = 8 + 6 = 14');
    expect(chain.split(' ')).toEqual([
      '8\u00a0+\u00a02\u00a0·\u00a03',
      '=',
      '8\u00a0+\u00a06',
      '=',
      '14',
    ]);
  });
});
