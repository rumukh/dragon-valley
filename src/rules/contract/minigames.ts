/**
 * Minigame boards: the typed view and the moves of every minigame activity.
 *
 * A minigame round shows one board at a time. The rules generate each board as an
 * `@aegis/narrative` `MinigameDefinition` (the built-in `matching` and `ordering` kinds, or a
 * custom `dv.*` adapter), keep it with its `MinigameState` in the round, and project it twice:
 * the narrative projection (`MinigameRoundView.minigame.view`) and the same board as a typed
 * `BoardView` (`MinigameRoundView.current`). The shell answers with
 * `minigameMove { revision, move }`: `revision` is the board revision from the view
 * (`MinigameRoundView.minigame.revision`) and `move` is one of the moves below.
 *
 * Boards never punish: a wrong rectangle, a mismatched pair or a wrong order stays on the board
 * as gentle feedback and can be corrected. Faces of hidden cards are never in the view.
 */
import { TERMS } from './kinds';
import type { Term } from './kinds';
import { mulFactId, num, op, parseItemId } from './problems';
import type { AnswerValue, Expr, TermProblem } from './problems';

/**
 * What a card or stone shows, structured so the shell renders it in the parent's notation
 * (notation.ts `formatFace`):
 * - `expr`: an expression without a blank (`7 · 8`, `56 : 7`);
 * - `answer`: an answer value (`56`, `4 r 3`, a term, a relation);
 * - `sentence`: a whole number sentence (`6 · 7 = 42`, `23 : 5 = 4 r 3`), optionally with one
 *   highlighted number (term cards: "which is 42 in 6 · 7 = 42?").
 */
export type CardFace =
  | { kind: 'expr'; expr: Expr }
  | { kind: 'answer'; answer: AnswerValue }
  | {
      kind: 'sentence';
      sentence: TermProblem['sentence'];
      highlight: TermProblem['highlight'] | null;
    };

// ------------------------------------------------------------------------------ card labels

/**
 * Card and stone faces in the narrative projection are `labelKey` strings that encode the face,
 * notation-agnostic (they are valid narrative IDs):
 *
 * | Label                         | Face                                                    |
 * | ----------------------------- | ------------------------------------------------------- |
 * | `fact:mul:7x8`                | the fact `7 · 8` (`fact:` + a small-table item ID)      |
 * | `fact:div:56:7`               | the fact `56 : 7`                                       |
 * | `num:56`                      | the number 56                                           |
 * | `term:product`                | the term "product" (term ↔ example pairs)               |
 * | `rem:4:3`                     | the remainder answer `4 r 3`                            |
 * | `example:mul:6:7:42:-:result` | the sentence `6 · 7 = 42` with 42 highlighted (`-`: no remainder; `none`: no highlight) |
 * | `card:back`                   | a card back: every card's `backLabelKey`                |
 */
export const CARD_BACK_LABEL = 'card:back';

const HIGHLIGHTS = ['left', 'right', 'result', 'remainder', 'none'] as const;

/** The label of a face (throws for a face no board uses, such as a big-number expression). */
export function cardLabel(face: CardFace): string {
  if (face.kind === 'expr') {
    const expr = face.expr;
    if (expr.kind === 'op' && expr.left.kind === 'num' && expr.right.kind === 'num') {
      const [left, right] = [expr.left.value, expr.right.value];
      if (expr.op === 'mul') return `fact:${mulFactId(left, right)}`;
      if (expr.op === 'div' && parseItemId(`div:${left}:${right}`)?.kind === 'div') {
        return `fact:div:${left}:${right}`;
      }
    }
    throw new RangeError('Only small-table facts a · b and a : b are card faces.');
  }
  if (face.kind === 'answer') {
    const answer = face.answer;
    if (answer.kind === 'number') return `num:${answer.value}`;
    if (answer.kind === 'remainder') return `rem:${answer.quotient}:${answer.remainder}`;
    if (answer.kind === 'term') return `term:${answer.term}`;
    throw new RangeError(`An answer of kind ${answer.kind} is not a card face.`);
  }
  const { sentence, highlight } = face;
  return [
    'example',
    sentence.op,
    sentence.left,
    sentence.right,
    sentence.result,
    sentence.remainder === null ? '-' : sentence.remainder,
    highlight ?? 'none',
  ].join(':');
}

function labelNumber(text: string | undefined): number | null {
  return text !== undefined && /^(0|[1-9][0-9]{0,5})$/.test(text) ? Number(text) : null;
}

/** The face a label encodes, or `null` for a card back or an unknown label. */
export function parseCardLabel(label: string): CardFace | null {
  if (label.startsWith('fact:')) {
    const parsed = parseItemId(label.slice(5));
    if (parsed?.kind === 'mul') {
      return { kind: 'expr', expr: op('mul', num(parsed.a), num(parsed.b)) };
    }
    if (parsed?.kind === 'div') {
      return { kind: 'expr', expr: op('div', num(parsed.dividend), num(parsed.divisor)) };
    }
    return null;
  }
  const parts = label.split(':');
  const [tag] = parts;
  if (tag === 'num' && parts.length === 2) {
    const value = labelNumber(parts[1]);
    return value === null ? null : { kind: 'answer', answer: { kind: 'number', value } };
  }
  if (tag === 'rem' && parts.length === 3) {
    const quotient = labelNumber(parts[1]);
    const remainder = labelNumber(parts[2]);
    if (quotient === null || remainder === null) return null;
    return { kind: 'answer', answer: { kind: 'remainder', quotient, remainder } };
  }
  if (tag === 'term' && parts.length === 2) {
    const term = parts[1] as Term;
    return (TERMS as readonly string[]).includes(term)
      ? { kind: 'answer', answer: { kind: 'term', term } }
      : null;
  }
  if (tag === 'example' && parts.length === 7 && (parts[1] === 'mul' || parts[1] === 'div')) {
    const left = labelNumber(parts[2]);
    const right = labelNumber(parts[3]);
    const result = labelNumber(parts[4]);
    const remainder = parts[5] === '-' ? null : labelNumber(parts[5]);
    const highlight = parts[6] as (typeof HIGHLIGHTS)[number];
    if (left === null || right === null || result === null) return null;
    if (parts[5] !== '-' && remainder === null) return null;
    if (!(HIGHLIGHTS as readonly string[]).includes(highlight)) return null;
    return {
      kind: 'sentence',
      sentence: { op: parts[1], left, right, result, remainder },
      highlight: highlight === 'none' ? null : highlight,
    };
  }
  return null;
}

// ------------------------------------------------------------------------------ Memory Match

/** One card of a Memory Match board, in board order (the grid is filled row by row). */
export interface MemoryMatchCard {
  id: string;
  /** The face, or `null` while the card is face down. */
  face: CardFace | null;
  faceUp: boolean;
  matched: boolean;
}

/**
 * Memory Match (`memory-match`, narrative `matching`): flip two cards; a pair is a fact and its
 * value (`7 · 8` and `56`, `56 : 7` and `8`). A mismatch stays face up until the child taps
 * "Turn back" (`clear`), with no timer. In the narrative projection each card's `labelKey` is
 * its face label (`fact:mul:7x8`, `num:56`) or `card:back`; each card's `face` here is that same
 * face, parsed (`null` while the card is face down).
 */
export interface MemoryMatchBoard {
  kind: 'memory-match';
  cards: MemoryMatchCard[];
  /** Two mismatched cards are face up: only `clear` is possible now. */
  clearAvailable: boolean;
  pairs: number;
  matched: number;
  /** Pairs of cards turned so far (matches and mismatches). */
  attempts: number;
}

export type MemoryMatchMove = { type: 'select'; card: string } | { type: 'clear' };

// ------------------------------------------------------------------------------ Number Trail

/** One position on the trail: a fixed number, or a gap holding the stone `stones[gap]`. */
export interface TrailPosition {
  value: number | null;
  gap: number | null;
}

/**
 * Number Trail (`number-trail`, narrative `ordering`): skip-count along a path. The gaps hold
 * stones in some order; the child moves stones (`place`) until the trail counts up correctly and
 * checks it (`submit`). A wrong order stays editable.
 */
export interface NumberTrailBoard {
  kind: 'number-trail';
  /** The step of the trail (the times table); every value is a multiple of it. */
  step: number;
  path: TrailPosition[];
  /** The stones in gap order: `stones[i]` sits in gap `i`. */
  stones: { id: string; value: number }[];
  /** True after a check that was not right yet, until the next move (a right trail completes
   * the board). */
  submitted: boolean;
  attempts: number;
}

/** Move stone `item` to gap position `index` (the other stones shift), or check the trail. */
export type NumberTrailMove = { type: 'place'; item: string; index: number } | { type: 'submit' };

// ------------------------------------------------------------------------------ Egg Grid

/**
 * Strategy picture drawn over an Egg Grid (rows are the groups): `five-plus` splits after row 5
 * (6 = 5 + 1 groups, 7 = 5 + 2), `ten-minus` shows ten rows with the extra ones crossed out
 * (9 = 10 − 1 groups), `double` splits the rows in half (4 and 8: double the double).
 */
export const EGG_GRID_SPLITS = ['none', 'five-plus', 'ten-minus', 'double'] as const;
export type EggGridSplit = (typeof EGG_GRID_SPLITS)[number];

/**
 * Egg Grid (`egg-grid`, custom `dv.egg-grid`): build rows × columns of eggs for a product and
 * find the rectangles that make it (`3 × 4`, `4 × 3`, `2 × 6`, …), which shows factor pairs and
 * commutativity. The board is complete once `find` rectangles are found (the rules set `find` to
 * every rectangle with both sides up to `maxSide`). The narrative projection (`minigame.view`) is
 * this object without `kind`.
 */
export interface EggGridBoard {
  kind: 'egg-grid';
  product: number;
  maxSide: number;
  split: EggGridSplit;
  /** Rectangles to find; the board is complete when `found` has this many. */
  find: number;
  /** The grid being built (1 × 1 at the start). */
  rows: number;
  columns: number;
  /** Rectangles found, in the order found. */
  found: { rows: number; columns: number }[];
  /** The last submit: a new rectangle, one found before, or not the product. */
  last: 'found' | 'again' | 'wrong' | null;
}

export type EggGridMove = { type: 'set'; rows: number; columns: number } | { type: 'submit' };

// ------------------------------------------------------------------------------ Fact Family Nest

/** One equation of a Fact Family Nest: `_ · _ = _` or `_ : _ = _`. */
export interface FactFamilyEquation {
  op: 'mul' | 'div';
  /** Left operand, right operand, result. */
  slots: (number | null)[];
  /** The last check of this equation, or `null` if it changed since (or was never checked). */
  correct: boolean | null;
}

/**
 * Fact Family Nest (`fact-family`, custom `dv.fact-family`): three numbers sit in a nest (for
 * example 6, 7 and 42); the child completes two multiplications and two divisions with them
 * (`6 · 7 = 42`, `7 · 6 = 42`, `42 : 6 = 7`, `42 : 7 = 6`). An equation repeating another one
 * is not correct. The narrative projection (`minigame.view`) is this object without `kind`.
 */
export interface FactFamilyBoard {
  kind: 'fact-family';
  /** The three numbers in the nest, smallest first. */
  numbers: number[];
  equations: FactFamilyEquation[];
  /** True after a check that was not all right yet, until the next move (four right equations
   * complete the board). */
  submitted: boolean;
  attempts: number;
}

/** Put a nest number into a slot (`value: null` empties it), or check the four equations. */
export type FactFamilyMove =
  { type: 'fill'; equation: number; slot: number; value: number | null } | { type: 'submit' };

// ------------------------------------------------------------------------------ unions

/** The typed board of a minigame round; `kind` is the activity kind. */
export type BoardView = MemoryMatchBoard | NumberTrailBoard | EggGridBoard | FactFamilyBoard;

/** A move for `minigameMove.move`. */
export type MinigameMove = MemoryMatchMove | NumberTrailMove | EggGridMove | FactFamilyMove;
