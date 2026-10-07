// @vitest-environment happy-dom
/**
 * The strategy pictures in the DOM (src/app/ui/models.ts): each figure draws its picture for the
 * eyes only and writes its worked line in the child's notation, ending with the answer only
 * after the child has answered. Colors come from the stylesheet (palette tokens), never from
 * the markup.
 */
import { describe, expect, it } from 'vitest';
import { BLANK, group, num, op } from '../../../../src/rules/contract';
import type { Expr, Notation, Problem } from '../../../../src/rules/contract';
import { createTranslator } from '../../../../src/app/i18n/messages';
import { modelFor } from '../../../../src/app/math/model';
import { modelFigure } from '../../../../src/app/ui/models';

const t = createTranslator();
const eq = (left: Expr): Problem => ({ kind: 'equation', left, right: BLANK });
const mul = (a: number, b: number): Problem => eq(op('mul', num(a), num(b)));
const div = (a: number, b: number): Problem => eq(op('div', num(a), num(b)));

function figure(problem: Problem, notation: Notation = 'czech', solved = true): HTMLElement {
  const model = modelFor(problem);
  if (!model) throw new Error('no model');
  const node = modelFigure(model, { t, notation, solved });
  document.body.replaceChildren(node);
  return node;
}

/** The leaf texts of an element, in order, as a written line: `38 · 8 = 30 · 8 + 8 · 8`. */
function written(element: Element | null): string {
  if (!element) return '';
  return [...element.querySelectorAll('*')]
    .filter((node) => node.children.length === 0 && node.textContent)
    .map((node) => node.textContent)
    .join(' ');
}

const line = (node: HTMLElement): string =>
  written(node.querySelector('[data-testid="model-line"]'));
const svgTexts = (node: HTMLElement, className: string): string[] =>
  [...node.querySelectorAll(`svg .${className}`)].map((text) => text.textContent ?? '');

describe('every strategy figure', () => {
  const samples: [string, Problem][] = [
    ['place-shift', mul(34, 10)],
    ['tens-groups', mul(30, 3)],
    ['split-mul', mul(38, 8)],
    ['split-div', div(96, 8)],
    ['order-steps', eq(op('sub', op('mul', num(4), num(6)), num(8)))],
  ];

  it('is a figure whose picture is hidden from screen readers and whose caption speaks', () => {
    for (const [kind, problem] of samples) {
      const node = figure(problem);
      expect(node.localName, kind).toBe('figure');
      expect(node.dataset['testid'], kind).toBe('model');
      expect(node.dataset['kind'], kind).toBe(kind);
      expect(node.firstElementChild?.getAttribute('aria-hidden'), kind).toBe('true');
      const caption = node.querySelector('figcaption');
      expect(caption?.textContent?.trim(), kind).not.toBe('');
      for (const hidden of node.querySelectorAll('figcaption [aria-hidden="true"]')) {
        expect(hidden.nextElementSibling?.classList.contains('dv-visually-hidden'), kind).toBe(
          true,
        );
      }
    }
  });

  it('takes its colors from the stylesheet, not the markup', () => {
    for (const [kind, problem] of samples) {
      const node = figure(problem);
      for (const element of node.querySelectorAll('*')) {
        expect(element.hasAttribute('fill'), `${kind} ${element.localName}`).toBe(false);
        expect(element.hasAttribute('stroke'), `${kind} ${element.localName}`).toBe(false);
        expect(element.getAttribute('style') ?? '', kind).not.toMatch(/#|rgb/);
      }
    }
  });

  it('writes only the signs of the chosen notation', () => {
    for (const [kind, problem] of samples) {
      const czech = figure(problem, 'czech').textContent ?? '';
      expect(czech, kind).not.toMatch(/[×÷]/);
      const international = figure(problem, 'international').textContent ?? '';
      expect(international, kind).not.toMatch(/[·:]/);
    }
  });
});

describe('place-shift', () => {
  it('moves 34 one place left into 340 and marks the zero that fills the ones', () => {
    const node = figure(mul(34, 10));
    expect(svgTexts(node, 'dv-model__place')).toEqual(['O', 'T', 'H']);
    expect(svgTexts(node, 'dv-model__digit')).toEqual(['4', '3', '0', '4', '3']);
    expect(node.querySelectorAll('.dv-model__cell--added')).toHaveLength(1);
    expect(node.querySelectorAll('.dv-model__arrow')).toHaveLength(2);
    expect(line(node)).toBe('34 · 10 = 340');
    expect(line(figure(mul(10, 34), 'international'))).toBe('10 × 34 = 340');
  });

  it('shows the way before the answer: empty places and the rule in words', () => {
    const node = figure(mul(7, 100), 'czech', false);
    expect(svgTexts(node, 'dv-model__digit')).toEqual(['7']);
    expect(node.querySelectorAll('.dv-model__cell--empty')).toHaveLength(3);
    expect(node.querySelector('figcaption')?.textContent).toBe(t('model.shift.left.two'));
    expect(node.textContent).not.toContain('700');
  });

  it('drops the zeros a division by 10 or 100 takes off, and writes thousands when needed', () => {
    const node = figure(div(700, 100));
    expect(node.querySelectorAll('.dv-model__cell--dropped')).toHaveLength(2);
    expect(node.querySelectorAll('.dv-model__strike')).toHaveLength(2);
    expect(node.querySelectorAll('.dv-model__arrow')).toHaveLength(1);
    expect(line(node)).toBe('700 : 100 = 7');
    expect(svgTexts(figure(mul(10, 100)), 'dv-model__place')).toEqual(['O', 'T', 'H', 'Th']);
  });
});

describe('tens-groups', () => {
  it('draws every ten-rod in its group and says it in tens', () => {
    const node = figure(mul(30, 3));
    expect(node.querySelectorAll('.dv-model__bundle')).toHaveLength(3);
    expect(node.querySelectorAll('.dv-model__rod')).toHaveLength(9);
    expect(line(node)).toBe('3 tens · 3 = 9 tens = 90');
    expect(line(figure(mul(3, 30), 'international'))).toBe('3 × 3 tens = 9 tens = 90');
    expect(line(figure(mul(30, 3), 'czech', false))).toBe('3 tens · 3 = 9 tens = ?');
  });

  it('draws one group and how many times it is taken when the rods would not fit', () => {
    const node = figure(mul(90, 9));
    expect(node.querySelectorAll('.dv-model__bundle')).toHaveLength(1);
    expect(node.querySelectorAll('.dv-model__rod')).toHaveLength(9);
    expect(svgTexts(node, 'dv-model__mark')).toEqual(['· 9']);
    expect(svgTexts(figure(mul(9, 90), 'international'), 'dv-model__mark')).toEqual(['9 ×']);
  });
});

describe('split-mul and split-div', () => {
  it('draws 38 · 8 as tens and ones blocks, 8 high, with the parts inside', () => {
    const node = figure(mul(38, 8));
    expect(node.querySelectorAll('.dv-model__block--tens')).toHaveLength(1);
    expect(node.querySelectorAll('.dv-model__rod')).toHaveLength(8);
    expect(node.querySelectorAll('.dv-model__rod-end')).toHaveLength(8 * 2);
    expect(node.querySelectorAll('.dv-model__unit')).toHaveLength(64);
    expect(svgTexts(node, 'dv-model__side')).toEqual(['8', '30', '8']);
    expect(svgTexts(node, 'dv-model__area')).toEqual(['240', '64']);
    expect(line(node)).toBe('38 · 8 = 30 · 8 + 8 · 8 = 240 + 64 = 304');
    expect(line(figure(mul(38, 8), 'international'))).toBe(
      '38 × 8 = 30 × 8 + 8 × 8 = 240 + 64 = 304',
    );
  });

  it('leaves the last step before the child answers', () => {
    const node = figure(mul(38, 8), 'czech', false);
    expect(line(node)).toBe('38 · 8 = 30 · 8 + 8 · 8 = 240 + 64 = ?');
    expect(node.querySelector('.dv-model__blank')).not.toBeNull();
    expect(node.textContent).not.toContain('304');
    expect(node.querySelector('[data-testid="model-spoken"]')?.textContent).toMatch(
      /^Thirty-eight times eight equals .* equals what\?$/,
    );
  });

  it('draws 96 : 8 the other way round: the parts of 96, and how many eights each holds', () => {
    const node = figure(div(96, 8));
    expect(svgTexts(node, 'dv-model__side')).toEqual(['8', '10', '2']);
    expect(svgTexts(node, 'dv-model__area')).toEqual(['80', '16']);
    expect(line(node)).toBe('96 : 8 = 80 : 8 + 16 : 8 = 10 + 2 = 12');
    expect(line(figure(div(96, 8), 'international'))).toBe(
      '96 ÷ 8 = 80 ÷ 8 + 16 ÷ 8 = 10 + 2 = 12',
    );
  });

  it('keeps a lone block’s side, the answer itself, for after the answer', () => {
    expect(line(figure(div(80, 8)))).toBe('80 : 8 = 10');
    const before = figure(div(80, 8), 'czech', false);
    expect(svgTexts(before, 'dv-model__side')).toEqual(['8', '?']);
    expect(line(before)).toBe('80 : 8 = ?');
  });
});

describe('order-steps', () => {
  const steps = (node: HTMLElement): string[] =>
    [...node.querySelectorAll('.dv-model__step')].map((row) => written(row));
  const marked = (node: HTMLElement): string[] =>
    [...node.querySelectorAll('[data-testid="model-first"]')].map((mark) => written(mark));

  it('works 4 · 6 − 8 out row by row, marking what goes first', () => {
    const node = figure(eq(op('sub', op('mul', num(4), num(6)), num(8))));
    expect(steps(node)).toEqual(['4 · 6 − 8', '= 24 − 8', '= 16']);
    expect(marked(node)).toEqual(['4 · 6', '24 − 8']);
  });

  it('marks brackets with the operation inside them', () => {
    const node = figure(eq(op('div', group(op('add', num(16), num(8))), num(3))), 'international');
    expect(steps(node)).toEqual(['( 16 + 8 ) ÷ 3', '= 24 ÷ 3', '= 8']);
    expect(marked(node)).toEqual(['( 16 + 8 )', '24 ÷ 3']);
  });

  it('states the rule in the chosen signs and leaves the last row before the answer', () => {
    const czech = figure(eq(op('sub', op('mul', num(4), num(6)), num(8))), 'czech', false);
    expect(steps(czech).at(-1)).toBe('= ?');
    expect(czech.querySelector('[data-testid="model-rule"]')?.textContent).toBe(
      'Brackets first, then · and :, then + and −.',
    );
    const international = figure(eq(op('sub', op('mul', num(4), num(6)), num(8))), 'international');
    expect(international.querySelector('[data-testid="model-rule"]')?.textContent).toBe(
      'Brackets first, then × and ÷, then + and −.',
    );
  });
});

describe('the small-table pictures', () => {
  it('stay arrays and groups with their captions', () => {
    const array = figure(mul(3, 4));
    expect(array.dataset['kind']).toBe('array');
    expect(array.querySelectorAll('.dv-model__dot')).toHaveLength(12);
    expect(array.querySelector('figcaption')?.textContent).toBe('3 rows of 4.');
    const groups = figure(div(12, 3));
    expect(groups.dataset['kind']).toBe('groups');
    expect(groups.querySelector('figcaption')?.textContent).toBe('Groups of 3.');
  });
});
