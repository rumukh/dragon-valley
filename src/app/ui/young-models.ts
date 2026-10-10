/**
 * Young players' models (grades 1-2): counting dots in ten-frames, a sum or difference in
 * ten-frames, hops on a number line, and numbers to 100 as bundles of ten sticks and ones cubes.
 *
 * Shapes differ, not only colors: the first number is round dots, the second (added) square
 * counters, and the dots taken away are crossed out. Before the child answers (`solved`), the
 * number they find is a "?", never drawn or written; a counting problem never writes its number
 * at all until it is solved (its number is the answer).
 */
import { OPERATOR_SYMBOLS } from '../../rules/contract';
import type { Translate } from '../i18n/messages';
import type { AddSubFact, ProblemModel, StickNumber } from '../math/model';
import type { Notation } from '../math/notation';
import { numberToWords } from '../speech/numbers';
import { h, svg } from './dom';

export type YoungModel = Extract<
  ProblemModel,
  { kind: 'count' | 'ten-frame' | 'number-line' | 'sticks' }
>;

export interface YoungModelOptions {
  readonly t: Translate;
  readonly notation: Notation;
  readonly solved: boolean;
}

const r1 = (value: number): number => Math.round(value * 10) / 10;

function art(width: number, height: number, children: readonly SVGElement[]): SVGSVGElement {
  return svg(
    'svg',
    {
      class: 'dv-model__art',
      viewBox: `0 0 ${r1(width)} ${r1(height)}`,
      'aria-hidden': 'true',
      focusable: 'false',
    },
    ...children,
  );
}

function rect(x: number, y: number, w: number, hgt: number, rx: number, cls: string): SVGElement {
  return svg('rect', { x: r1(x), y: r1(y), width: r1(w), height: r1(hgt), rx: r1(rx), class: cls });
}

function circle(cx: number, cy: number, radius: number, cls: string): SVGElement {
  return svg('circle', { cx: r1(cx), cy: r1(cy), r: r1(radius), class: cls });
}

function seg(x1: number, y1: number, x2: number, y2: number, cls: string): SVGElement {
  return svg('line', { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), class: cls });
}

function text(x: number, y: number, value: string, cls: string): SVGElement {
  const node = svg('text', { x: r1(x), y: r1(y), class: cls });
  node.textContent = value;
  return node;
}

function figure(
  kind: YoungModel['kind'],
  solved: boolean,
  picture: SVGSVGElement,
  caption: readonly (Node | string)[],
): HTMLElement {
  return h(
    'figure',
    {
      className: 'dv-model dv-model--strategy dv-model--young',
      testId: 'model',
      dataset: { kind, solved: String(solved) },
    },
    picture,
    h('figcaption', { className: 'dv-model__caption' }, ...caption),
  );
}

// ---- The written fact under a picture ----------------------------------------------------------

const capital = (words: string): string => words.charAt(0).toUpperCase() + words.slice(1);

/** `3 + 4 = ?` drawn in the notation, and read as words. */
function factCaption(fact: AddSubFact, notation: Notation, solved: boolean): Node[] {
  const sign = OPERATOR_SYMBOLS[notation][fact.op];
  const shown = (part: AddSubFact['unknown'], value: number): string =>
    solved || fact.unknown !== part ? String(value) : '?';
  const spoken = (part: AddSubFact['unknown'], value: number): string =>
    solved || fact.unknown !== part ? numberToWords(value) : 'what';
  const written = `${shown('left', fact.left)} ${sign} ${shown('right', fact.right)} = ${shown('result', fact.result)}`;
  const words = `${spoken('left', fact.left)} ${fact.op === 'add' ? 'plus' : 'minus'} ${spoken('right', fact.right)} equals ${spoken('result', fact.result)}`;
  return [
    h('span', {
      className: 'dv-model__line dv-model__line--young',
      testId: 'model-line',
      text: written,
      attributes: { 'aria-hidden': 'true' },
    }),
    h('span', {
      className: 'dv-visually-hidden',
      testId: 'model-spoken',
      text: capital(words) + (solved ? '.' : '?'),
    }),
  ];
}

// ---- Ten-frames --------------------------------------------------------------------------------

const CELL = 24;
const FRAME_GAP = 10;

type Counter = 'dot' | 'square' | 'crossed' | 'hole' | 'empty';

/** Frames of ten (2 × 5) holding `counters` in order; enough frames for all of them. */
function tenFrames(counters: readonly Counter[]): SVGSVGElement {
  const frames = Math.max(1, Math.ceil(counters.length / 10));
  const width = 5 * CELL;
  const height = frames * 2 * CELL + (frames - 1) * FRAME_GAP;
  const parts: SVGElement[] = [];
  for (let frame = 0; frame < frames; frame++) {
    const top = frame * (2 * CELL + FRAME_GAP);
    parts.push(rect(0, top, width, 2 * CELL, 4, 'dv-model__frame'));
    for (let cell = 0; cell < 10; cell++) {
      const x = (cell % 5) * CELL;
      const y = top + Math.floor(cell / 5) * CELL;
      parts.push(rect(x, y, CELL, CELL, 0, 'dv-model__frame-cell'));
      const counter = counters[frame * 10 + cell] ?? 'empty';
      const cx = x + CELL / 2;
      const cy = y + CELL / 2;
      if (counter === 'dot') parts.push(circle(cx, cy, 8, 'dv-model__counter'));
      if (counter === 'square') {
        parts.push(
          rect(cx - 7.5, cy - 7.5, 15, 15, 2, 'dv-model__counter dv-model__counter--added'),
        );
      }
      if (counter === 'hole') parts.push(circle(cx, cy, 8, 'dv-model__counter--hole'));
      if (counter === 'crossed') {
        parts.push(circle(cx, cy, 8, 'dv-model__counter dv-model__counter--gone'));
        parts.push(seg(cx - 8, cy - 8, cx + 8, cy + 8, 'dv-model__cross'));
        parts.push(seg(cx - 8, cy + 8, cx + 8, cy - 8, 'dv-model__cross'));
      }
    }
  }
  return art(width, height, parts);
}

const repeat = (counter: Counter, times: number): Counter[] =>
  Array.from({ length: Math.max(0, times) }, () => counter);

/**
 * The counters of a fact. Adding: the first number in dots, then the second in squares (an
 * unknown second number is dashed holes up to the sum, filled once solved). Taking away: the
 * first number in dots, the second crossed out (an unknown second number: the dots that stay
 * are dots, the rest dashed holes until solved).
 */
export function factCounters(fact: AddSubFact, solved: boolean): Counter[] {
  if (fact.op === 'add') {
    const second = !solved && fact.unknown === 'right' ? 'hole' : 'square';
    const first = !solved && fact.unknown === 'left' ? 'hole' : 'dot';
    return [...repeat(first, fact.left), ...repeat(second, fact.right)];
  }
  const kept = repeat('dot', fact.result);
  const gone = !solved && fact.unknown !== 'result' ? 'hole' : 'crossed';
  return [...kept, ...repeat(gone, fact.right)];
}

function countModel(count: number, { t, solved }: YoungModelOptions): HTMLElement {
  return figure('count', solved, tenFrames(repeat('dot', count)), [
    h('span', {
      className: 'dv-model__rule-text',
      text: solved ? t('model.countSolved', { count }) : t('model.count'),
    }),
  ]);
}

function tenFrameModel(
  model: Extract<YoungModel, { kind: 'ten-frame' }>,
  { notation, solved }: YoungModelOptions,
): HTMLElement {
  return figure(
    'ten-frame',
    solved,
    tenFrames(factCounters(model, solved)),
    factCaption(model, notation, solved),
  );
}

// ---- Number line -------------------------------------------------------------------------------

const UNIT = 22;
const PAD = 16;

function numberLineModel(
  model: Extract<YoungModel, { kind: 'number-line' }>,
  { notation, solved }: YoungModelOptions,
): HTMLElement {
  const lo = Math.min(model.left, model.result);
  const hi = Math.max(model.left, model.result);
  const width = (hi - lo) * UNIT + 2 * PAD;
  const axis = 54;
  const at = (value: number): number => PAD + (value - lo) * UNIT;
  const parts: SVGElement[] = [seg(0, axis, width, axis, 'dv-model__axis')];
  for (let value = lo; value <= hi; value++) {
    parts.push(seg(at(value), axis - 5, at(value), axis + 5, 'dv-model__tick'));
  }
  const hidden = (part: AddSubFact['unknown']): boolean => !solved && model.unknown === part;
  parts.push(
    text(at(model.left), axis + 22, hidden('left') ? '?' : String(model.left), 'dv-model__digit'),
    text(
      at(model.result),
      axis + 22,
      hidden('result') ? '?' : String(model.result),
      'dv-model__digit',
    ),
  );
  // One hop per unit, so a child can count them; the step's size is written above.
  const direction = model.result >= model.left ? 1 : -1;
  for (let hop = 0; hop < Math.abs(model.result - model.left); hop++) {
    const from = at(model.left + hop * direction);
    const to = at(model.left + (hop + 1) * direction);
    const mid = (from + to) / 2;
    parts.push(
      svg('path', {
        d: `M${r1(from)} ${axis - 3}Q${r1(mid)} ${axis - 26} ${r1(to)} ${axis - 3}`,
        class: 'dv-model__hop',
      }),
    );
  }
  parts.push(
    text(
      (at(model.left) + at(model.result)) / 2,
      12,
      hidden('right') ? '?' : `${OPERATOR_SYMBOLS[notation][model.op]}${model.right}`,
      'dv-model__mark',
    ),
  );
  return figure(
    'number-line',
    solved,
    art(width, axis + 30, parts),
    factCaption(model, notation, solved),
  );
}

// ---- Tens sticks and ones cubes ----------------------------------------------------------------

const STICK = { width: 4, height: 54 };
const BUNDLE_WIDTH = 10 * STICK.width + 2;
const ROW = STICK.height + 14;
/** Ones are cubes in columns of five (a five is seen at a glance), bottom up. */
const CUBE = 10;
const CUBE_STEP = CUBE + 1;
const CUBE_COLUMN = 5;

function stickRow(x: number, y: number, number: StickNumber): { parts: SVGElement[]; end: number } {
  const parts: SVGElement[] = [];
  let left = x;
  for (let bundle = 0; bundle < number.tens; bundle++) {
    parts.push(rect(left, y, BUNDLE_WIDTH, STICK.height, 3, 'dv-model__bundle-sticks'));
    for (let stick = 1; stick < 10; stick++) {
      const sx = left + 1 + stick * STICK.width;
      parts.push(seg(sx, y + 2, sx, y + STICK.height - 2, 'dv-model__stick-line'));
    }
    parts.push(rect(left - 2, y + STICK.height / 2 - 4, BUNDLE_WIDTH + 4, 8, 3, 'dv-model__tie'));
    left += BUNDLE_WIDTH + 8;
  }
  const bottom = y + STICK.height;
  for (let cube = 0; cube < number.ones; cube++) {
    const column = Math.floor(cube / CUBE_COLUMN);
    const cx = left + column * CUBE_STEP;
    const cy = bottom - ((cube % CUBE_COLUMN) + 1) * CUBE_STEP + 1;
    parts.push(rect(cx, cy, CUBE, CUBE, 1.5, 'dv-model__cube'));
  }
  if (number.ones > 0) left += Math.ceil(number.ones / CUBE_COLUMN) * CUBE_STEP + 4;
  return { parts, end: left };
}

function sticksModel(
  model: Extract<YoungModel, { kind: 'sticks' }>,
  { t, notation, solved }: YoungModelOptions,
): HTMLElement {
  const fact = model.fact;
  const SIGN = fact ? 30 : 0;
  const parts: SVGElement[] = [];
  let width = SIGN + 40;
  model.numbers.forEach((number, row) => {
    const y = row * ROW + 4;
    const hidden = fact !== null && !solved && fact.unknown === (row === 0 ? 'left' : 'right');
    if (row > 0 && fact) {
      parts.push(
        text(SIGN / 2, y + STICK.height / 2, OPERATOR_SYMBOLS[notation][fact.op], 'dv-model__mark'),
      );
    }
    if (hidden) {
      parts.push(rect(SIGN, y, 40, STICK.height, 6, 'dv-model__cell dv-model__cell--empty'));
      parts.push(text(SIGN + 20, y + STICK.height / 2, '?', 'dv-model__digit'));
      return;
    }
    const drawn = stickRow(SIGN + 2, y, number);
    parts.push(...drawn.parts);
    width = Math.max(width, drawn.end + 2);
  });
  const height = model.numbers.length * ROW;
  const [only] = model.numbers;
  const caption: Node[] = fact
    ? factCaption(fact, notation, solved)
    : [
        h('span', {
          className: 'dv-model__rule-text',
          text:
            solved && only
              ? t('model.sticksSolved', { tens: only.tens, ones: only.ones })
              : t('model.sticks'),
        }),
      ];
  return figure('sticks', solved, art(width, height, parts), caption);
}

/** The figure for a young players' model. */
export function youngModelFigure(model: YoungModel, options: YoungModelOptions): HTMLElement {
  switch (model.kind) {
    case 'count':
      return countModel(model.count, options);
    case 'ten-frame':
      return tenFrameModel(model, options);
    case 'number-line':
      return numberLineModel(model, options);
    case 'sticks':
      return sticksModel(model, options);
  }
}
