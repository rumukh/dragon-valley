// @vitest-environment happy-dom
/**
 * Compare Stones (docs/design.md §5.7): a comparison is two stones with the sign's place between
 * them, read in the order the child reads it; once answered, each stone that holds an expression
 * shows its value and the place shows the right sign.
 */
import { describe, expect, it } from 'vitest';
import { BLANK, num, op } from '../../../../src/rules/contract';
import type { Problem } from '../../../../src/rules/contract';
import { problemElement, revealComparison } from '../../../../src/app/screens/problem-view';

const compare: Extract<Problem, { kind: 'compare' }> = {
  kind: 'compare',
  left: op('mul', num(7), num(8)),
  right: num(50),
};

function tokens(line: HTMLElement): string[] {
  return [...line.querySelectorAll('.dv-problem__part > span')].map((span) => span.textContent!);
}

describe('Compare Stones', () => {
  it('carries each side on a stone, with the sign place between them', () => {
    const line = problemElement(compare, 'czech', 'seven times eight, or fifty');
    const stones = [...line.querySelectorAll<HTMLElement>('.dv-stone')];
    expect(stones.map((stone) => stone.dataset['side'])).toEqual(['left', 'right']);
    expect(tokens(line), 'the reading order of the line').toEqual(['7', '·', '8', '?', '50']);
    expect(line.getAttribute('aria-label')).toBe('seven times eight, or fifty');
    expect(line.dataset['kind']).toBe('compare');
    expect(line.querySelector('.dv-stones__sign .dv-problem__blank')?.textContent).toBe('?');
  });

  it('shows the values and the right sign once answered', () => {
    const line = problemElement(compare, 'international', '');
    revealComparison(line, compare, { kind: 'relation', relation: 'gt' }, 'international');
    expect(line.querySelector('[data-testid="stone-value-left"]')?.textContent).toBe('56');
    expect(
      line.querySelector('[data-testid="stone-value-right"]')?.textContent,
      'a plain number needs no value under it',
    ).toBe('');
    const sign = line.querySelector<HTMLElement>('.dv-stones__sign .dv-problem__blank')!;
    expect(sign.textContent).toBe('>');
    expect(sign.dataset['filled']).toBe('true');
    expect(line.dataset['revealed']).toBe('true');
  });

  it('leaves other problems as one line', () => {
    const line = problemElement(
      { kind: 'equation', left: op('mul', num(7), num(8)), right: BLANK },
      'czech',
      '',
    );
    expect(line.querySelector('.dv-stone')).toBeNull();
    expect(tokens(line)).toEqual(['7', '·', '8', '=', '?']);
  });
});
