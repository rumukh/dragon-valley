/**
 * Visual models shown after a miss, before a re-ask, when a fact is taught and on a hint
 * (`src/app/math/model.ts` decides which).
 *
 * In the small tables: an array of dots in rows and columns (multiplication as equal groups), or
 * equal groups with the leftovers set apart (division with remainder). Leftovers differ in shape
 * (ring, not dot), not only in color. A rule fact (n · 0, 1 · n, n : n ...) shows its rule as
 * plates of dots, its fact and a sentence. All of these are drawn in dots that the stylesheet sizes
 * to the slot (`groupsLayout`, models.css).
 *
 * Beyond them, the written strategy, drawn: a place-value chart whose digits move, ten-rods in
 * equal groups, and area models of tens and ones. An expression of several operations is worked
 * out row by row, with the operation that goes first marked. Tens are violet rods and ones are
 * yellow dots, so they differ in shape and labels as well as color.
 *
 * Every picture is `aria-hidden`; the figcaption carries the words. A strategy line ends with
 * the answer only once the child has answered (`solved`). Before that (a hint, a re-ask, a taught
 * fact) it ends with an empty box: the picture shows the way and leaves the last step.
 */
import { BLANK, num, op, OPERATOR_SYMBOLS } from '../../rules/contract';
import type { Expr } from '../../rules/contract';
import type { Translate } from '../i18n/messages';
import { splitLine, withoutAnswer } from '../math/model';
import type { OrderStep, ProblemModel } from '../math/model';
import { isWithin, pathTokens } from '../math/notation';
import type { Notation } from '../math/notation';
import { numberToWords } from '../speech/numbers';
import { speakExpr } from '../speech/verbalizer';
import { h, svg } from './dom';
import { youngModelFigure } from './young-models';

export function arrayModel(rows: number, columns: number, label: string): HTMLElement {
  const grid = h('div', {
    className: 'dv-model__array',
    attributes: { 'aria-hidden': 'true' },
  });
  grid.style.setProperty('--columns', String(Math.max(1, columns)));
  grid.style.setProperty('--rows', String(Math.max(1, rows)));
  for (let index = 0; index < rows * columns; index++) {
    grid.append(h('span', { className: 'dv-model__dot' }));
  }
  return h(
    'figure',
    { className: 'dv-model', testId: 'model', dataset: { kind: 'array' } },
    grid,
    h('figcaption', { text: label }),
  );
}

/** Dots across and down one group: up to five a row, so ten is a 2 × 5 frame and eight 2 × 4. */
export function groupFrame(size: number): { readonly columns: number; readonly rows: number } {
  const rows = Math.max(1, Math.ceil(size / 5));
  return { columns: Math.max(1, Math.ceil(size / rows)), rows };
}

/**
 * How equal groups are laid out. Every length in the picture is a multiple of the dot: a group
 * frame is its dots, their gaps (0.4 of a dot) and its padding (0.6 a side); groups stand 0.8 of
 * a dot apart. So the whole picture is `across` dots wide and `down` dots tall, and the stylesheet
 * sizes the dot to fit the slot's width and the window's height (models.css).
 */
export interface GroupsLayout {
  /** Full groups, and the dots left over (drawn as rings in a frame of their own). */
  readonly groups: number;
  readonly leftover: number;
  /** One group's frame: dots across and down. */
  readonly frame: { readonly columns: number; readonly rows: number };
  /** Groups across and down. */
  readonly columns: number;
  readonly rows: number;
  /** The picture's width and height, in dots. */
  readonly across: number;
  readonly down: number;
}

/** A frame of `dots` dots across (or down), in dots: the dots, their gaps and the padding. */
export const frameSpan = (dots: number): number => 1.4 * dots + 0.8;
/** The gap between two groups, in dots. */
export const GROUP_GAP = 0.8;
/**
 * The pictures the layout plans for, in px (a slot's width less the card's padding, and the 26vh
 * the dots may take). Groups are arranged to give the biggest dots in a typical slot (a 300 px
 * lesson column under a 768 px window), keeping at least `minDot` in the narrowest one (a 246 px
 * column at 200 % text under a 657 px window); the stylesheet then scales the dots to each slot.
 */
export const GROUPS_PLAN = {
  typical: { width: 257, height: 200 },
  narrowest: { width: 198, height: 171 },
  minDot: 7,
  /** The dot never grows past 0.7em (16.8 px at 100 % text): bigger plans do not count. */
  maxDot: 16.8,
} as const;

const dotIn = (room: { width: number; height: number }, across: number, down: number): number =>
  Math.min(room.width / across, room.height / down);

type Frame = GroupsLayout['frame'];
type Arrangement = Pick<GroupsLayout, 'frame' | 'columns' | 'rows' | 'across' | 'down'>;

/** `boxes` equal frames in a grid: the columns that give the biggest dots (`GROUPS_PLAN`). */
export function arrangeFrames(boxes: number, frame: Frame): Arrangement {
  // Rank by the dots in a typical slot (up to the largest dot drawn), then by fewer rows, so ten
  // plates stand 5 + 5; an arrangement too small for the narrowest slot ranks last.
  let best: Arrangement | null = null;
  let bestScore = -Infinity;
  for (let columns = 1; columns <= Math.max(1, boxes); columns++) {
    const rows = Math.ceil(Math.max(1, boxes) / columns);
    const across = columns * frameSpan(frame.columns) + (columns - 1) * GROUP_GAP;
    const down = rows * frameSpan(frame.rows) + (rows - 1) * GROUP_GAP;
    const narrowest = dotIn(GROUPS_PLAN.narrowest, across, down);
    const typical = Math.min(GROUPS_PLAN.maxDot, dotIn(GROUPS_PLAN.typical, across, down));
    const score = (narrowest >= GROUPS_PLAN.minDot ? typical : narrowest - 100) - rows * 1e-3;
    if (score > bestScore + 1e-9) {
      best = { frame, columns, rows, across, down };
      bestScore = score;
    }
  }
  return best!;
}

export function groupsLayout(total: number, size: number): GroupsLayout {
  const per = Math.max(1, size);
  const groups = Math.floor(total / per);
  const leftover = total - groups * per;
  const boxes = groups + (leftover > 0 ? 1 : 0);
  return { groups, leftover, ...arrangeFrames(boxes, groupFrame(per)) };
}

const units = (value: number): string => String(Math.round(value * 100) / 100);

/** The grid of frames, its arrangement handed to the stylesheet in dots. */
function framesGrid(layout: Arrangement, className = 'dv-model__groups'): HTMLElement {
  const grid = h('div', { className, attributes: { 'aria-hidden': 'true' } });
  grid.style.setProperty('--columns', String(layout.columns));
  grid.style.setProperty('--frame-columns', String(layout.frame.columns));
  grid.style.setProperty('--frame-rows', String(layout.frame.rows));
  grid.style.setProperty('--across', units(layout.across));
  grid.style.setProperty('--down', units(layout.down));
  return grid;
}

export function groupsModel(total: number, size: number, label: string): HTMLElement {
  const layout = groupsLayout(total, size);
  const groups = framesGrid(layout);
  for (let group = 0; group < layout.groups; group++) {
    const box = h('span', { className: 'dv-model__group' });
    for (let index = 0; index < Math.max(1, size); index++)
      box.append(h('span', { className: 'dv-model__dot' }));
    groups.append(box);
  }
  if (layout.leftover > 0) {
    // The leftovers get a frame the size of a group, so it shows they are not enough for one.
    const rest = h('span', { className: 'dv-model__group dv-model__group--left' });
    for (let index = 0; index < layout.leftover; index++) {
      rest.append(h('span', { className: 'dv-model__dot dv-model__dot--left' }));
    }
    groups.append(rest);
  }
  return h(
    'figure',
    { className: 'dv-model', testId: 'model', dataset: { kind: 'groups' } },
    groups,
    h('figcaption', { text: label }),
  );
}

export interface ModelOptions {
  readonly t: Translate;
  readonly notation: Notation;
  /** The child has answered: a strategy line ends with the answer, not an empty box. */
  readonly solved: boolean;
}

/** The figure for any model, in the child's notation. */
export function modelFigure(model: ProblemModel, options: ModelOptions): HTMLElement {
  const { t } = options;
  switch (model.kind) {
    case 'array':
      return arrayModel(
        model.rows,
        model.columns,
        t('model.array', { rows: model.rows, columns: model.columns }),
      );
    case 'groups':
      return groupsModel(model.total, model.size, t('model.groups', { size: model.size }));
    case 'place-shift':
      return placeShiftModel(model, options);
    case 'tens-groups':
      return tensGroupsModel(model, options);
    case 'split-mul':
    case 'split-div':
      return splitModel(model, options);
    case 'order-steps':
      return orderStepsModel(model, options);
    case 'rule':
      return ruleFigure(model, options);
    case 'count':
    case 'ten-frame':
    case 'number-line':
    case 'sticks':
      return youngModelFigure(model, options);
  }
}

// ---- Written lines -----------------------------------------------------------------------------

type LineToken =
  | { readonly kind: 'number' | 'sign' | 'bracket' | 'words'; readonly text: string }
  | { readonly kind: 'blank' };

/** One side of an "=" in a worked line, with its words for a screen reader. */
interface LinePart {
  readonly tokens: readonly LineToken[];
  readonly spoken: string;
}

function exprPart(expr: Expr, notation: Notation): LinePart {
  return {
    tokens:
      expr.kind === 'blank'
        ? [{ kind: 'blank' }]
        : pathTokens(expr, notation).map(({ kind, text }) =>
            // An unknown inside the line (`? · 5 = 0`) is the same empty box as one after it.
            kind === 'number' && text === '?' ? { kind: 'blank' } : { kind, text },
          ),
    spoken: speakExpr(expr),
  };
}

function tokenSpan(token: LineToken): HTMLElement {
  return token.kind === 'blank'
    ? h('span', { className: 'dv-model__blank', text: '?' })
    : h('span', { className: `dv-model__${token.kind}`, text: token.text });
}

/** A piece of a written step: a token, or the marked operation that goes first (kept whole). */
interface Atom {
  readonly node: HTMLElement;
  /** A narrow line may break after it: a + or − outside brackets. */
  readonly breakAfter: boolean;
}

const equalsAtom = (): Atom => ({
  node: h('span', { className: 'dv-model__sign', text: '=' }),
  breakAfter: false,
});

/** Tokens as atoms, tracking brackets so a step breaks only between its added parts. */
function tokenAtoms(tokens: readonly LineToken[], notation: Notation): Atom[] {
  const { add, sub } = OPERATOR_SYMBOLS[notation];
  let depth = 0;
  return tokens.map((token) => {
    if (token.kind === 'bracket') depth += token.text === '(' ? 1 : -1;
    const plusMinus = token.kind === 'sign' && (token.text === add || token.text === sub);
    return { node: tokenSpan(token), breakAfter: depth === 0 && plusMinus };
  });
}

/**
 * Atoms grouped into chunks that stay together: `= 30 · 8 +` and `8 · 8`. A step wraps between
 * chunks first; a chunk wider than the whole line (very large text) wraps inside as a last resort.
 */
function chunked(atoms: readonly Atom[]): HTMLElement[] {
  const out: HTMLElement[] = [];
  let chunk: HTMLElement | null = null;
  for (const atom of atoms) {
    if (!chunk) {
      chunk = h('span', { className: 'dv-model__chunk' });
      out.push(chunk);
    }
    chunk.append(atom.node);
    if (atom.breakAfter) chunk = null;
  }
  return out;
}

/** `a = b = c` written one step per line, as in an exercise book: `38 · 8` / `= 30 · 8 + 8 · 8`. */
function lineElement(parts: readonly LinePart[], notation: Notation): HTMLElement {
  return h(
    'span',
    { className: 'dv-model__line', testId: 'model-line', attributes: { 'aria-hidden': 'true' } },
    ...parts.map((part, index) =>
      h(
        'span',
        { className: 'dv-model__part' },
        ...chunked([...(index > 0 ? [equalsAtom()] : []), ...tokenAtoms(part.tokens, notation)]),
      ),
    ),
  );
}

function spokenLine(parts: readonly LinePart[]): string {
  const words = parts.map((part) => part.spoken).join(' equals ');
  const open = parts.some((part) => part.tokens.some((token) => token.kind === 'blank'));
  return words.charAt(0).toUpperCase() + words.slice(1) + (open ? '?' : '.');
}

/** A worked line as the figure's caption: drawn in the notation, read as words. */
function lineCaption(parts: readonly LinePart[], notation: Notation): Node[] {
  return [
    lineElement(parts, notation),
    h('span', { className: 'dv-visually-hidden', testId: 'model-spoken', text: spokenLine(parts) }),
  ];
}

function strategyFigure(
  kind: ProblemModel['kind'],
  solved: boolean,
  art: Element,
  caption: readonly (Node | string)[],
): HTMLElement {
  return h(
    'figure',
    {
      className: 'dv-model dv-model--strategy',
      testId: 'model',
      dataset: { kind, solved: String(solved) },
    },
    art,
    h('figcaption', { className: 'dv-model__caption' }, ...caption),
  );
}

// ---- SVG pieces --------------------------------------------------------------------------------

const r1 = (value: number): number => Math.round(value * 10) / 10;

function artSvg(width: number, height: number, children: readonly SVGElement[]): SVGSVGElement {
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

function box(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  className: string,
): SVGRectElement {
  return svg('rect', {
    x: r1(x),
    y: r1(y),
    width: r1(width),
    height: r1(height),
    rx: r1(radius),
    class: className,
  });
}

function label(x: number, y: number, text: string, className: string): SVGTextElement {
  const node = svg('text', { x: r1(x), y: r1(y), class: className });
  node.textContent = text;
  return node;
}

function line(x1: number, y1: number, x2: number, y2: number, className: string): SVGLineElement {
  return svg('line', { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), class: className });
}

/** A straight arrow with a solid head, from (x1, y1) to the tip at (x2, y2). */
function arrow(x1: number, y1: number, x2: number, y2: number): SVGGElement {
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  const back = (along: number, side: number): string =>
    `${r1(x2 - ux * along - uy * side)} ${r1(y2 - uy * along + ux * side)}`;
  return svg(
    'g',
    { class: 'dv-model__arrow' },
    line(x1, y1, x2 - ux * 5, y2 - uy * 5, 'dv-model__arrow-line'),
    svg('path', {
      d: `M${r1(x2)} ${r1(y2)}L${back(8, 5)}L${back(8, -5)}Z`,
      class: 'dv-model__arrow-head',
    }),
  );
}

// ---- place-shift: digits move in a place-value chart ---------------------------------------------

/** Column labels, from the ones up; literal keys, so the catalog test sees them used. */
const PLACE_KEYS = [
  'model.place.ones',
  'model.place.tens',
  'model.place.hundreds',
  'model.place.thousands',
] as const;

const SHIFT_KEYS = {
  mul: { 1: 'model.shift.left.one', 2: 'model.shift.left.two' },
  div: { 1: 'model.shift.right.one', 2: 'model.shift.right.two' },
} as const;

/** Digit at `place` (0 = ones) of `value`, or null above its highest digit. */
function digitAt(value: number, place: number): number | null {
  const length = String(value).length;
  return place < length ? Number(String(value)[length - 1 - place]) : null;
}

function placeShiftArt(
  model: Extract<ProblemModel, { kind: 'place-shift' }>,
  t: Translate,
  solved: boolean,
): SVGSVGElement {
  const columns = Math.min(
    PLACE_KEYS.length,
    Math.max(3, String(model.from).length, String(model.to).length),
  );
  const CW = 46;
  const HEAD = 22;
  const CELL = 38;
  const top = HEAD + 4;
  const bottom = top + CELL + 30;
  const width = columns * CW;
  const height = bottom + CELL + 2;
  const left = (place: number): number => (columns - 1 - place) * CW;
  const center = (place: number): number => left(place) + CW / 2;
  const parts: SVGElement[] = [box(0, 0, width, HEAD, 7, 'dv-model__head')];
  PLACE_KEYS.slice(0, columns).forEach((key, place) => {
    parts.push(label(center(place), HEAD / 2 + 1, t(key), 'dv-model__place'));
    if (place > 0)
      parts.push(line(left(place) + CW, HEAD, left(place) + CW, height, 'dv-model__rule'));
  });
  const cell = (place: number, y: number, className: string, digit: string | null): void => {
    parts.push(box(left(place) + 5, y, CW - 10, CELL, 8, className));
    if (digit !== null)
      parts.push(label(center(place), y + CELL / 2 + 1, digit, 'dv-model__digit'));
  };
  const step = model.op === 'mul' ? model.places : -model.places;
  for (let place = 0; place < String(model.from).length; place++) {
    // A division's last zeros drop off the chart; every other digit moves.
    const dropped = place - model.places < 0 && model.op === 'div';
    cell(
      place,
      top,
      dropped ? 'dv-model__cell dv-model__cell--dropped' : 'dv-model__cell',
      String(digitAt(model.from, place)),
    );
    if (dropped) {
      parts.push(
        line(left(place) + 11, top + CELL - 7, left(place) + CW - 11, top + 7, 'dv-model__strike'),
      );
    } else {
      parts.push(arrow(center(place), top + CELL + 3, center(place + step), bottom - 3));
    }
  }
  for (let place = 0; place < String(model.to).length; place++) {
    const added = model.op === 'mul' && place < model.places;
    const className = solved
      ? `dv-model__cell${added ? ' dv-model__cell--added' : ''}`
      : 'dv-model__cell dv-model__cell--empty';
    cell(place, bottom, className, solved ? String(digitAt(model.to, place)) : null);
  }
  return artSvg(width, height, parts);
}

function placeShiftModel(
  model: Extract<ProblemModel, { kind: 'place-shift' }>,
  { t, notation, solved }: ModelOptions,
): HTMLElement {
  const rule = t(SHIFT_KEYS[model.op][model.places]);
  const problem = op(model.op, num(model.left), num(model.right));
  return strategyFigure(
    'place-shift',
    solved,
    placeShiftArt(model, t, solved),
    solved
      ? lineCaption([exprPart(problem, notation), exprPart(num(model.to), notation)], notation)
      : [h('span', { className: 'dv-model__rule-text', text: rule })],
  );
}

// ---- tens-groups: ten-rods in equal groups --------------------------------------------------------

const ROD = { width: 10, height: 60, gap: 3, pad: 5 };
/** Widest picture of every group; more rods than this are drawn as one group and "· b". */
const RODS_MAX_WIDTH = 236;

function rodGroup(x: number, y: number, rods: number): SVGElement[] {
  const width = rods * ROD.width + (rods - 1) * ROD.gap + 2 * ROD.pad;
  const out: SVGElement[] = [box(x, y, width, ROD.height + 2 * ROD.pad, 8, 'dv-model__bundle')];
  for (let rod = 0; rod < rods; rod++) {
    const rx = x + ROD.pad + rod * (ROD.width + ROD.gap);
    const ry = y + ROD.pad;
    out.push(box(rx, ry, ROD.width, ROD.height, 2.5, 'dv-model__rod'));
    for (let cube = 1; cube < 10; cube++) {
      const cy = ry + (cube * ROD.height) / 10;
      out.push(line(rx + 1.5, cy, rx + ROD.width - 1.5, cy, 'dv-model__rod-line'));
    }
  }
  return out;
}

function tensGroupsArt(
  model: Extract<ProblemModel, { kind: 'tens-groups' }>,
  notation: Notation,
): SVGSVGElement {
  const groupWidth = model.tens * ROD.width + (model.tens - 1) * ROD.gap + 2 * ROD.pad;
  const groupHeight = ROD.height + 2 * ROD.pad;
  const GAP = 10;
  const every = model.times * groupWidth + (model.times - 1) * GAP;
  if (every <= RODS_MAX_WIDTH) {
    const parts = Array.from({ length: model.times }, (_, group) =>
      rodGroup(group * (groupWidth + GAP), 0, model.tens),
    ).flat();
    return artSvg(every, groupHeight, parts);
  }
  // Too many rods to draw clearly: one group, and how many times it is taken.
  const MARK = 44;
  const digitFirst = model.left === model.times;
  const sign = OPERATOR_SYMBOLS[notation].mul;
  const mark = digitFirst ? `${model.times} ${sign}` : `${sign} ${model.times}`;
  const groupX = digitFirst ? MARK : 0;
  const markX = digitFirst ? MARK / 2 - 2 : groupWidth + MARK / 2 + 2;
  return artSvg(groupWidth + MARK, groupHeight, [
    ...rodGroup(groupX, 0, model.tens),
    label(markX, groupHeight / 2, mark, 'dv-model__mark'),
  ]);
}

function tensGroupsModel(
  model: Extract<ProblemModel, { kind: 'tens-groups' }>,
  { t, notation, solved }: ModelOptions,
): HTMLElement {
  const sign = OPERATOR_SYMBOLS[notation].mul;
  const tens = (count: number): LinePart => ({
    tokens: [{ kind: 'words', text: t('model.tens', { count }) }],
    spoken: t('model.tens', { count: numberToWords(count) }),
  });
  const digitFirst = model.left === model.times;
  const first = tens(model.tens);
  const times: LineToken = { kind: 'number', text: String(model.times) };
  const product: LinePart = {
    tokens: digitFirst
      ? [times, { kind: 'sign', text: sign }, ...first.tokens]
      : [...first.tokens, { kind: 'sign', text: sign }, times],
    spoken: digitFirst
      ? `${numberToWords(model.times)} times ${first.spoken}`
      : `${first.spoken} times ${numberToWords(model.times)}`,
  };
  const answer = solved ? num(model.left * model.right) : BLANK;
  return strategyFigure(
    'tens-groups',
    solved,
    tensGroupsArt(model, notation),
    lineCaption([product, tens(model.tens * model.times), exprPart(answer, notation)], notation),
  );
}

// ---- split-mul and split-div: area models of tens and ones ---------------------------------------

interface Block {
  readonly kind: 'tens' | 'ones';
  /** Its side along the top (30, or a partial quotient), its area (240) and its share of width. */
  readonly top: string;
  readonly area: string;
  readonly share: number;
  /** Rods (tens) or dots (ones) per row. */
  readonly columns: number;
}

const AREA = { side: 28, top: 24, width: 196, height: 66, gap: 5, minWidth: 58 };

function areaArt(blocks: readonly Block[], rows: number, side: string): SVGSVGElement {
  const { width: total, height, gap, minWidth } = AREA;
  const x0 = AREA.side;
  const y0 = AREA.top;
  const widths =
    blocks.length === 1
      ? [total]
      : (() => {
          const room = total - gap;
          const ones = Math.max(
            minWidth,
            (room * blocks[1]!.share) / (blocks[0]!.share + blocks[1]!.share),
          );
          return [room - ones, ones];
        })();
  const parts: SVGElement[] = [
    line(x0 - 9, y0 + 2, x0 - 9, y0 + height - 2, 'dv-model__dimension'),
    label(x0 / 2 - 4, y0 + height / 2, side, 'dv-model__side'),
  ];
  let x = x0;
  blocks.forEach((block, index) => {
    const width = widths[index]!;
    parts.push(box(x, y0, width, height, 7, `dv-model__block dv-model__block--${block.kind}`));
    const cw = width / block.columns;
    const ch = height / rows;
    for (let row = 0; row < rows; row++) {
      const cy = y0 + row * ch;
      if (block.kind === 'tens') {
        // One strip per row, divided into its tens: rods laid end to end, always lying down.
        const strip = Math.min(ch - 2.4, 15);
        const sy = cy + (ch - strip) / 2;
        parts.push(box(x + 3, sy, width - 6, strip, Math.min(3, strip / 3), 'dv-model__rod'));
        for (let column = 1; column < block.columns; column++) {
          parts.push(
            line(x + column * cw, sy + 1, x + column * cw, sy + strip - 1, 'dv-model__rod-end'),
          );
        }
        continue;
      }
      for (let column = 0; column < block.columns; column++) {
        const radius = Math.min(5, Math.max(1.2, Math.min(cw, ch) / 2 - 1.3));
        parts.push(
          svg('circle', {
            cx: r1(x + column * cw + cw / 2),
            cy: r1(cy + ch / 2),
            r: r1(radius),
            class: 'dv-model__unit',
          }),
        );
      }
    }
    parts.push(line(x + 3, y0 - 7, x + width - 3, y0 - 7, 'dv-model__dimension'));
    parts.push(label(x + width / 2, y0 / 2 - 4, block.top, 'dv-model__side'));
    const pill = 12 + block.area.length * 11;
    parts.push(box(x + width / 2 - pill / 2, y0 + height / 2 - 12, pill, 24, 12, 'dv-model__pill'));
    parts.push(label(x + width / 2, y0 + height / 2 + 1, block.area, 'dv-model__area'));
    x += width + gap;
  });
  return artSvg(x0 + total + 2, y0 + height + 2, parts);
}

function splitModel(
  model: Extract<ProblemModel, { kind: 'split-mul' | 'split-div' }>,
  { notation, solved }: ModelOptions,
): HTMLElement {
  let art: SVGSVGElement;
  if (model.kind === 'split-mul') {
    const { tens, ones, times } = model;
    art = areaArt(
      [
        {
          kind: 'tens',
          top: String(tens),
          area: String(tens * times),
          share: tens,
          columns: tens / 10,
        },
        { kind: 'ones', top: String(ones), area: String(ones * times), share: ones, columns: ones },
      ],
      times,
      String(times),
    );
  } else {
    const { divisor, head, rest } = model;
    const tens = head / divisor;
    // Without a rest, the one block's side is the answer itself.
    const blocks: Block[] = [
      {
        kind: 'tens',
        top: rest === 0 && !solved ? '?' : String(tens),
        area: String(head),
        share: tens,
        columns: tens / 10,
      },
    ];
    if (rest > 0) {
      const ones = rest / divisor;
      blocks.push({
        kind: 'ones',
        top: String(ones),
        area: String(rest),
        share: ones,
        columns: ones,
      });
    }
    art = areaArt(blocks, divisor, String(divisor));
  }
  const line = splitLine(model);
  return strategyFigure(
    model.kind,
    solved,
    art,
    lineCaption(
      (solved ? line : withoutAnswer(line)).map((part) => exprPart(part, notation)),
      notation,
    ),
  );
}

// ---- order-steps: an expression worked out one operation at a time --------------------------------

/** The step's expression with the operation that goes first (and its brackets) marked. */
function stepAtoms(step: OrderStep, notation: Notation): Atom[] {
  // Inside brackets, the brackets go too once the operation is done: mark them with it.
  const marked = step.path.at(-1) === 'inner' ? step.path.slice(0, -1) : step.path;
  const { add, sub } = OPERATOR_SYMBOLS[notation];
  const out: Atom[] = [];
  let first: HTMLElement | null = null;
  let depth = 0;
  for (const token of pathTokens(step.expr, notation)) {
    if (isWithin(token.path, marked)) {
      // The marked operation stays whole; its brackets are balanced inside it.
      if (!first) {
        first = h('span', { className: 'dv-model__first', testId: 'model-first' });
        out.push({ node: first, breakAfter: false });
      }
      first.append(tokenSpan(token));
      continue;
    }
    first = null;
    if (token.kind === 'bracket') depth += token.text === '(' ? 1 : -1;
    const plusMinus = token.kind === 'sign' && (token.text === add || token.text === sub);
    out.push({ node: tokenSpan(token), breakAfter: depth === 0 && plusMinus });
  }
  return out;
}

function orderStepsModel(
  model: Extract<ProblemModel, { kind: 'order-steps' }>,
  { t, notation, solved }: ModelOptions,
): HTMLElement {
  const rows = model.steps.map((step, index) =>
    h(
      'li',
      { className: 'dv-model__step' },
      ...chunked([...(index > 0 ? [equalsAtom()] : []), ...stepAtoms(step, notation)]),
    ),
  );
  rows.push(
    h(
      'li',
      { className: 'dv-model__step dv-model__step--result' },
      ...chunked([
        equalsAtom(),
        {
          node: solved
            ? h('span', { className: 'dv-model__number', text: String(model.result) })
            : h('span', { className: 'dv-model__blank', text: '?' }),
          breakAfter: false,
        },
      ]),
    ),
  );
  const symbols = OPERATOR_SYMBOLS[notation];
  const spoken = [
    ...model.steps.map((step) => exprPart(step.expr, notation)),
    exprPart(solved ? num(model.result) : BLANK, notation),
  ];
  // The rule's signs are drawn as signs, so "then · and :," does not read as punctuation.
  const MARK = '\ue000';
  const rule = t('model.order', {
    mul: `${MARK}mul${MARK}`,
    div: `${MARK}div${MARK}`,
    add: `${MARK}add${MARK}`,
    sub: `${MARK}sub${MARK}`,
  })
    .split(MARK)
    .map((piece, index) =>
      index % 2 === 1
        ? h('span', { className: 'dv-model__sign', text: symbols[piece as keyof typeof symbols] })
        : piece,
    );
  return strategyFigure(
    'order-steps',
    solved,
    h('ol', { className: 'dv-model__steps', attributes: { 'aria-hidden': 'true' } }, ...rows),
    [
      h('span', { className: 'dv-model__rule-text', testId: 'model-rule' }, ...rule),
      h('span', {
        className: 'dv-visually-hidden',
        testId: 'model-spoken',
        text: spokenLine(spoken),
      }),
    ],
  );
}

// ---- rule: the rule facts as plates ------------------------------------------------------------

/** One sentence per rule; literal keys, so the catalog test sees them used. */
const RULE_KEYS = {
  'times-zero': 'model.rule.times-zero',
  'zero-times': 'model.rule.zero-times',
  'times-one': 'model.rule.times-one',
  'one-times': 'model.rule.times-one',
  'divide-one': 'model.rule.divide-one',
  'zero-shared': 'model.rule.zero-shared',
  'divide-self': 'model.rule.divide-self',
} as const;

type RuleModel = Extract<ProblemModel, { kind: 'rule' }>;

/**
 * The plates a rule fact is drawn with, and the dots on each: n · 0 and 0 : n are n empty plates,
 * n · 1 and n : 1 are n plates of one, 1 · n and n : n one plate of n. 0 · n has no plates at all.
 */
export function rulePlates(model: RuleModel): { readonly plates: number; readonly dots: number } {
  const { left, right } = model;
  switch (model.rule) {
    case 'times-zero':
      return { plates: left, dots: 0 };
    case 'zero-times':
      return { plates: 0, dots: right };
    case 'times-one':
    case 'divide-one':
      return { plates: left, dots: 1 };
    case 'one-times':
      return { plates: 1, dots: right };
    case 'zero-shared':
      return { plates: right, dots: 0 };
    case 'divide-self':
      return { plates: 1, dots: left };
  }
}

function ruleFigure(model: RuleModel, { t, notation, solved }: ModelOptions): HTMLElement {
  const { plates, dots } = rulePlates(model);
  const grid = framesGrid(
    arrangeFrames(Math.max(1, plates), groupFrame(Math.max(1, dots))),
    'dv-model__groups dv-model__groups--rule',
  );
  if (plates === 0) {
    // No plates at all: an empty tray where a plate of n would stand.
    grid.append(
      h('span', {
        className: 'dv-model__group dv-model__plate dv-model__plate--none',
        testId: 'model-no-plates',
      }),
    );
  }
  for (let plate = 0; plate < plates; plate++) {
    const node = h('span', { className: 'dv-model__group dv-model__plate' });
    for (let dot = 0; dot < dots; dot++) node.append(h('span', { className: 'dv-model__dot' }));
    grid.append(node);
  }
  const shown = (part: RuleModel['unknown'], value: number): Expr =>
    solved || model.unknown !== part ? num(value) : BLANK;
  const fact = [
    exprPart(op(model.op, shown('left', model.left), shown('right', model.right)), notation),
    exprPart(shown('result', model.result), notation),
  ];
  return strategyFigure('rule', solved, grid, [
    ...lineCaption(fact, notation),
    h('span', {
      className: 'dv-model__rule-text',
      testId: 'model-rule',
      text: t(RULE_KEYS[model.rule]),
    }),
  ]);
}
