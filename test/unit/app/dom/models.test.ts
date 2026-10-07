// @vitest-environment happy-dom
/**
 * The pictures behind a problem in the DOM (src/app/ui/models.ts): each figure draws its picture
 * for the eyes only and writes its worked line in the child's notation, ending with the answer
 * only after the child has answered. Colors come from the stylesheet (palette tokens), never from
 * the markup. The pictures to count hand their size to the stylesheet in dots, so it can fit them
 * to the slot (the browser check in scripts/art/models-gallery.mjs measures the result).
 */
import { describe, expect, it } from 'vitest';
import { BLANK, group, num, op } from '../../../../src/rules/contract';
import type { Expr, Notation, Problem } from '../../../../src/rules/contract';
import { createTranslator } from '../../../../src/app/i18n/messages';
import { modelFor } from '../../../../src/app/math/model';
import {
  GROUPS_PLAN,
  arrangeFrames,
  groupFrame,
  groupsLayout,
  modelFigure,
} from '../../../../src/app/ui/models';

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

describe('written steps', () => {
  const parts = (node: HTMLElement, selector: string): string[][] =>
    [...node.querySelectorAll(selector)].map((part) =>
      [...part.children]
        .filter((child) => child.classList.contains('dv-model__chunk'))
        .map((chunk) => written(chunk)),
    );

  it('put one step on each line, and let a long step break only after + or −', () => {
    expect(parts(figure(mul(38, 8)), '.dv-model__part')).toEqual([
      ['38 · 8'],
      ['= 30 · 8 +', '8 · 8'],
      ['= 240 +', '64'],
      ['= 304'],
    ]);
    expect(parts(figure(div(96, 8), 'international'), '.dv-model__part')).toEqual([
      ['96 ÷ 8'],
      ['= 80 ÷ 8 +', '16 ÷ 8'],
      ['= 10 +', '2'],
      ['= 12'],
    ]);
  });

  it('never break inside brackets or the step that goes first', () => {
    const rows = parts(
      figure(eq(op('mul', group(op('add', num(1), num(2))), group(op('add', num(3), num(4)))))),
      '.dv-model__step',
    );
    expect(rows[0]).toEqual(['( 1 + 2 ) · ( 3 + 4 )']);
    const chain = parts(
      figure(eq(op('sub', op('add', num(12), op('mul', num(4), num(6))), num(8)))),
      '.dv-model__step',
    );
    expect(chain[0]).toEqual(['12 +', '4 · 6 −', '8']);
    expect(chain[1]).toEqual(['= 12 + 24 −', '8']);
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

const property = (node: Element | null, name: string): string =>
  (node as HTMLElement | null)?.style.getPropertyValue(name) ?? '';
const frames = (node: HTMLElement): HTMLElement[] => [
  ...node.querySelectorAll<HTMLElement>('.dv-model__group'),
];

describe('pictures to count, scaled to the slot', () => {
  it('give an array its rows and columns, from which the stylesheet sizes the dots', () => {
    const array = figure(mul(10, 10)).querySelector('.dv-model__array');
    expect(property(array, '--rows')).toBe('10');
    expect(property(array, '--columns')).toBe('10');
  });

  it('frame each group with up to five dots a row: ten is 2 × 5, eight 2 × 4', () => {
    expect([1, 3, 5, 6, 7, 8, 9, 10].map((size) => groupFrame(size))).toEqual([
      { columns: 1, rows: 1 },
      { columns: 3, rows: 1 },
      { columns: 5, rows: 1 },
      { columns: 3, rows: 2 },
      { columns: 4, rows: 2 },
      { columns: 4, rows: 2 },
      { columns: 5, rows: 2 },
      { columns: 5, rows: 2 },
    ]);
  });

  it('hand the stylesheet the picture in dots: frames, groups across, width and height', () => {
    const groups = figure({
      kind: 'equation',
      left: op('mul', BLANK, num(10)),
      right: num(100),
    }).querySelector('.dv-model__groups');
    const layout = groupsLayout(100, 10);
    expect(layout).toMatchObject({ groups: 10, leftover: 0, frame: { columns: 5, rows: 2 } });
    expect(property(groups, '--columns')).toBe(String(layout.columns));
    expect(property(groups, '--frame-columns')).toBe('5');
    expect(property(groups, '--frame-rows')).toBe('2');
    // A frame is 1.4 dots a dot plus 0.8 (gaps and padding); groups stand 0.8 apart.
    const across = layout.columns * (1.4 * 5 + 0.8) + (layout.columns - 1) * 0.8;
    const down = layout.rows * (1.4 * 2 + 0.8) + (layout.rows - 1) * 0.8;
    expect(Number(property(groups, '--across'))).toBeCloseTo(across, 2);
    expect(Number(property(groups, '--down'))).toBeCloseTo(down, 2);
    expect(frames(groups as HTMLElement)).toHaveLength(10);
    for (const frame of frames(groups as HTMLElement)) {
      expect(frame.querySelectorAll('.dv-model__dot')).toHaveLength(10);
    }
  });

  it('keep the leftovers apart: rings, not dots, in a dashed frame the size of a group', () => {
    const node = figure({ kind: 'divrem', dividend: 23, divisor: 5 });
    const all = frames(node);
    expect(all).toHaveLength(5);
    const left = all.at(-1)!;
    expect(left.classList.contains('dv-model__group--left')).toBe(true);
    expect(left.querySelectorAll('.dv-model__dot--left')).toHaveLength(3);
    expect(
      all.slice(0, 4).every((frame) => frame.querySelectorAll('.dv-model__dot').length === 5),
    ).toBe(true);
    expect(property(node.querySelector('.dv-model__groups'), '--frame-columns')).toBe('5');
  });

  it('arrange every group the tables can ask for with dots of at least 7 px in the narrowest slot', () => {
    const { narrowest, minDot } = GROUPS_PLAN;
    for (let size = 1; size <= 10; size++) {
      for (let groups = 0; groups <= 10; groups++) {
        for (let leftover = 0; leftover < size; leftover++) {
          const total = groups * size + leftover;
          if (total < 1 || total > 100) continue;
          const layout = groupsLayout(total, size);
          const dot = Math.min(narrowest.width / layout.across, narrowest.height / layout.down);
          expect(dot, `${total} in groups of ${size}`).toBeGreaterThanOrEqual(minDot);
        }
      }
    }
    // Ten plates of the rule pictures stand 5 + 5.
    expect(arrangeFrames(10, groupFrame(1))).toMatchObject({ columns: 5, rows: 2 });
  });
});

describe('rule facts', () => {
  const plates = (node: HTMLElement): HTMLElement[] => [
    ...node.querySelectorAll<HTMLElement>('.dv-model__plate'),
  ];
  const dots = (plate: Element): number => plate.querySelectorAll('.dv-model__dot').length;
  const rule = (node: HTMLElement): string =>
    node.querySelector('[data-testid="model-rule"]')?.textContent ?? '';

  it('draw n · 0 as n empty plates, and 0 · n as no plates at all', () => {
    const times = figure(mul(4, 0));
    expect(times.dataset['kind']).toBe('rule');
    expect(plates(times).map(dots)).toEqual([0, 0, 0, 0]);
    expect(rule(times)).toBe('Any number times 0 is 0.');
    expect(line(times)).toBe('4 · 0 = 0');
    const zero = figure(mul(0, 4));
    expect(zero.querySelectorAll('[data-testid="model-no-plates"]')).toHaveLength(1);
    expect(zero.querySelectorAll('.dv-model__dot')).toHaveLength(0);
    expect(rule(zero)).toBe('No groups means nothing at all.');
  });

  it('draw n · 1 as n plates of one, and 1 · n as one plate of n', () => {
    expect(plates(figure(mul(7, 1))).map(dots)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    const one = figure(mul(1, 7));
    expect(plates(one).map(dots)).toEqual([7]);
    expect(rule(one)).toBe('Times 1 keeps the number the same.');
    expect(property(one.querySelector('.dv-model__groups'), '--frame-columns')).toBe('4');
  });

  it('draw n : 1, 0 : n and n : n', () => {
    const byOne = figure(div(7, 1));
    expect(plates(byOne).map(dots)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(rule(byOne)).toBe('Divided by 1 stays the same.');
    const shared = figure(div(0, 5));
    expect(plates(shared).map(dots)).toEqual([0, 0, 0, 0, 0]);
    expect(rule(shared)).toBe('0 shared out is 0 for everyone.');
    const self = figure(div(9, 9));
    expect(plates(self).map(dots)).toEqual([9]);
    expect(rule(self)).toBe('A number divided by itself is 1.');
  });

  it('keep the answer back until the child has answered, wherever the unknown is', () => {
    const before = figure(mul(4, 0), 'czech', false);
    expect(before.dataset['solved']).toBe('false');
    expect(line(before)).toBe('4 · 0 = ?');
    expect(before.querySelector('[data-testid="model-spoken"]')?.textContent).toBe(
      'Four times zero equals what?',
    );
    const missing = (solved: boolean): string =>
      line(
        figure(
          { kind: 'equation', left: op('mul', BLANK, num(5)), right: num(0) },
          'czech',
          solved,
        ),
      );
    expect(missing(false)).toBe('? · 5 = 0');
    expect(missing(true)).toBe('0 · 5 = 0');
  });

  it('write the fact in the chosen notation', () => {
    expect(line(figure(div(7, 1), 'international'))).toBe('7 ÷ 1 = 7');
    expect(line(figure(mul(1, 7), 'international'))).toBe('1 × 7 = 7');
  });
});
