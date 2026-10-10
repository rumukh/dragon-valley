/**
 * The answer to the problem on screen, worked out from what the child sees: the rendered
 * tokens of `[data-testid="problem"]` (numbers, signs, brackets and answer boxes). This is the
 * independent oracle of docs/testing.md §2.2: it never asks the rules for the expected answer;
 * it parses the written problem in either notation and solves it with its own arithmetic.
 *
 * Supported forms (everything the shell renders today, and the problem kinds of the contract
 * that have a single numeric answer):
 * - an equation with one answer box anywhere, with `+ − · × : ÷` and brackets
 *   (`7 · 8 = ?`, `? · 6 = 42`, `(3 + 4) · 2 = ?`), by the school order of operations;
 * - division with remainder (`23 : 5 = ? r ?`, `23 ÷ 5 = ? R ?`);
 * - a comparison, two sides with a box between them (`3 · 4 ? 2 · 6`): the relation `<` `>` `=`;
 * - a term question, a whole sentence with one number marked (`6 · 7 = 42`): what that number is
 *   called (factor, product, dividend, divisor, quotient, remainder);
 * - a story's sign step (`5 ○ 4 = ?` under a story): the operation the story asks for. Numbers
 *   cannot tell it, so the story is read: its words are matched against the pack's word-problem
 *   templates (`content/`), and the matching template's operation is the answer.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

export type Operator = 'add' | 'sub' | 'mul' | 'div';
export type Notation = 'czech' | 'international';
export type Relation = 'lt' | 'gt' | 'eq';
export type Term = 'factor' | 'product' | 'dividend' | 'divisor' | 'quotient' | 'remainder';

export type Token =
  | { readonly kind: 'number'; readonly value: number; readonly asked: boolean }
  | { readonly kind: 'op'; readonly op: Operator; readonly symbol: string }
  | { readonly kind: 'equals' }
  | { readonly kind: 'remainder'; readonly symbol: string }
  | { readonly kind: 'open' }
  | { readonly kind: 'close' }
  | { readonly kind: 'blank' }
  | { readonly kind: 'slot' };

export type AnswerValue =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'remainder'; readonly quotient: number; readonly remainder: number }
  | { readonly kind: 'relation'; readonly relation: Relation }
  | { readonly kind: 'operation'; readonly operation: Operator }
  | { readonly kind: 'term'; readonly term: Term };

const OPERATORS: Readonly<Record<string, { op: Operator; notation: Notation | null }>> = {
  '+': { op: 'add', notation: null },
  '−': { op: 'sub', notation: null },
  '-': { op: 'sub', notation: null },
  '·': { op: 'mul', notation: 'czech' },
  '×': { op: 'mul', notation: 'international' },
  ':': { op: 'div', notation: 'czech' },
  '÷': { op: 'div', notation: 'international' },
};

export interface RenderedToken {
  readonly className: string;
  readonly text: string;
  /** The filled dots of a counting problem's picture. */
  readonly dots?: number;
}

export function toToken(raw: RenderedToken): Token {
  const text = raw.text.trim();
  if (raw.className.includes('dv-problem__blank')) return { kind: 'blank' };
  // A counting problem's dots: the number is what a child counts (the filled dots), never written.
  if (raw.className.includes('dv-problem__dots')) {
    return { kind: 'number', value: raw.dots ?? 0, asked: false };
  }
  if (raw.className.includes('dv-problem__slot')) return { kind: 'slot' };
  if (raw.className.includes('dv-problem__number')) {
    if (!/^\d+$/.test(text)) throw new Error(`Not a number token: "${text}"`);
    return {
      kind: 'number',
      value: Number(text),
      asked: raw.className.includes('dv-problem__number--asked'),
    };
  }
  if (raw.className.includes('dv-problem__bracket')) {
    if (text === '(') return { kind: 'open' };
    if (text === ')') return { kind: 'close' };
  }
  if (raw.className.includes('dv-problem__sign')) {
    if (text === '=') return { kind: 'equals' };
    if (text === 'r' || text === 'R') return { kind: 'remainder', symbol: text };
    const operator = OPERATORS[text];
    if (operator) return { kind: 'op', op: operator.op, symbol: text };
  }
  throw new Error(`Unknown problem token ${raw.className} "${text}"`);
}

/** The tokens of the problem on screen, in reading order. */
export async function readTokens(page: Page): Promise<Token[]> {
  const raw = await page.getByTestId('problem').evaluate((line) =>
    [...line.querySelectorAll('.dv-problem__part > span')].map((span) => ({
      className: span.className,
      text: span.textContent ?? '',
      dots: span.querySelectorAll('.dv-problem__dot:not(.dv-problem__dot--empty)').length,
    })),
  );
  return raw.map(toToken);
}

/** The notation the tokens are written in, or null when no sign tells (only + and −). */
export function notationOf(tokens: readonly Token[]): Notation | null {
  for (const token of tokens) {
    if (token.kind === 'remainder') return token.symbol === 'r' ? 'czech' : 'international';
    if (token.kind === 'op') {
      const notation = OPERATORS[token.symbol]?.notation;
      if (notation) return notation;
    }
  }
  return null;
}

/** Evaluate an expression with the answer box standing for `blank`; NaN when not whole. */
export function evaluate(tokens: readonly Token[], blank: number): number {
  let at = 0;
  const sum = (): number => {
    let value = product();
    for (
      let next = tokens[at];
      next?.kind === 'op' && (next.op === 'add' || next.op === 'sub');
      next = tokens[at]
    ) {
      at++;
      const right = product();
      value = next.op === 'add' ? value + right : value - right;
    }
    return value;
  };
  const product = (): number => {
    let value = primary();
    for (
      let next = tokens[at];
      next?.kind === 'op' && (next.op === 'mul' || next.op === 'div');
      next = tokens[at]
    ) {
      at++;
      const right = primary();
      if (next.op === 'mul') value *= right;
      else value = right === 0 || value % right !== 0 ? Number.NaN : value / right;
    }
    return value;
  };
  const primary = (): number => {
    const token = tokens[at++];
    if (token?.kind === 'number') return token.value;
    if (token?.kind === 'blank') return blank;
    if (token?.kind === 'open') {
      const value = sum();
      if (tokens[at++]?.kind !== 'close') throw new Error('An open bracket is never closed.');
      return value;
    }
    throw new Error(`Unexpected ${token?.kind ?? 'end'} in the problem.`);
  };
  const value = sum();
  if (at !== tokens.length) throw new Error('The problem has trailing tokens.');
  return value;
}

/** What the marked number of a term sentence (`left op right = result [r remainder]`) is called. */
function termOf(tokens: readonly Token[], asked: number): Term {
  const op = tokens[1];
  if (op?.kind !== 'op' || (op.op !== 'mul' && op.op !== 'div') || tokens[3]?.kind !== 'equals') {
    throw new Error('A term question reads "a · b = c" or "a : b = c [r d]".');
  }
  const multiply = op.op === 'mul';
  switch (asked) {
    case 0:
      return multiply ? 'factor' : 'dividend';
    case 2:
      return multiply ? 'factor' : 'divisor';
    case 4:
      return multiply ? 'product' : 'quotient';
    case 6:
      return 'remainder';
    default:
      throw new Error(`No term is marked at position ${asked}.`);
  }
}

/** Solve the written problem by its own arithmetic. */
export function solve(tokens: readonly Token[]): AnswerValue {
  if (tokens.some((token) => token.kind === 'slot')) {
    throw new Error('The sign is asked for: only the story tells which one (see readAnswer).');
  }
  const asked = tokens.findIndex((token) => token.kind === 'number' && token.asked);
  if (asked >= 0) return { kind: 'term', term: termOf(tokens, asked) };
  const remainderAt = tokens.findIndex((token) => token.kind === 'remainder');
  if (remainderAt >= 0) {
    const [dividend, op, divisor, equals] = tokens;
    if (
      dividend?.kind !== 'number' ||
      op?.kind !== 'op' ||
      op.op !== 'div' ||
      divisor?.kind !== 'number' ||
      equals?.kind !== 'equals'
    ) {
      throw new Error('A remainder problem reads "dividend ÷ divisor = ? r ?".');
    }
    const remainder = dividend.value % divisor.value;
    return { kind: 'remainder', quotient: (dividend.value - remainder) / divisor.value, remainder };
  }
  const equals = tokens.findIndex((token) => token.kind === 'equals');
  const boxes = tokens.filter((token) => token.kind === 'blank').length;
  if (equals < 0) {
    // A comparison: the box stands between the two sides for the sign.
    const at = tokens.findIndex((token) => token.kind === 'blank');
    if (boxes !== 1) throw new Error('The problem has no equals sign and no single box.');
    const left = evaluate(tokens.slice(0, at), 0);
    const right = evaluate(tokens.slice(at + 1), 0);
    if (Number.isNaN(left) || Number.isNaN(right)) throw new Error('A side is not a whole number.');
    return { kind: 'relation', relation: left < right ? 'lt' : left > right ? 'gt' : 'eq' };
  }
  if (boxes !== 1) {
    throw new Error('The problem has more than one answer box.');
  }
  const left = tokens.slice(0, equals);
  const right = tokens.slice(equals + 1);
  for (let value = 0; value <= 100_000; value++) {
    const a = evaluate(left, value);
    if (!Number.isNaN(a) && a === evaluate(right, value)) return { kind: 'number', value };
  }
  throw new Error('No whole number answers the problem.');
}

interface WordTemplate {
  readonly id: string;
  readonly textKey: string;
  readonly operation: Operator | null;
}

let storyPatterns: { readonly pattern: RegExp; readonly template: WordTemplate }[] | undefined;

/** Each word-problem template of the pack as a pattern over its English story text. */
function stories(): { readonly pattern: RegExp; readonly template: WordTemplate }[] {
  if (storyPatterns) return storyPatterns;
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'content');
  const pack = JSON.parse(readFileSync(join(root, 'dragon-valley.content.json'), 'utf8')) as {
    data: { wordTemplates: WordTemplate[] };
  };
  const catalog = JSON.parse(
    readFileSync(join(root, 'catalogs', 'en.content.json'), 'utf8'),
  ) as Record<string, string>;
  const words = (text: string): string => text.trim().replace(/\s+/g, ' ');
  storyPatterns = pack.data.wordTemplates.map((template) => {
    const text = catalog[template.textKey];
    if (text === undefined) throw new Error(`No story text for ${template.textKey}.`);
    const source = words(text)
      .split(/(\{[A-Za-z][A-Za-z0-9_]*\})/)
      .map((part) =>
        /^\{.+\}$/.test(part) ? '(.+?)' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      )
      .join('');
    return { pattern: new RegExp(`^${source}$`), template };
  });
  return storyPatterns;
}

/** The operation a story asks for, from the pack's template whose words it matches. */
export function storyOperation(story: string): Operator {
  const text = story.trim().replace(/\s+/g, ' ');
  const found = stories().filter(({ pattern }) => pattern.test(text));
  const operations = [...new Set(found.map(({ template }) => template.operation))];
  if (found.length === 0) throw new Error(`No word-problem template tells this story: "${text}"`);
  if (operations.length !== 1 || !operations[0]) {
    throw new Error(
      `The story matches ${found.map(({ template }) => template.id).join(', ')}, which do not name one operation.`,
    );
  }
  return operations[0];
}

/** The problem on screen: its tokens, its step (a story's sign, then its answer) and story. */
export async function readProblem(
  page: Page,
): Promise<{ tokens: Token[]; step: string; story: string }> {
  const tokens = await readTokens(page);
  const step = (await page.getByTestId('problem').getAttribute('data-step')) ?? 'answer';
  const story = (await page.getByTestId('round-story').textContent()) ?? '';
  return { tokens, step, story };
}

export async function readAnswer(page: Page): Promise<AnswerValue> {
  const { tokens, step, story } = await readProblem(page);
  if (step === 'operation') return { kind: 'operation', operation: storyOperation(story) };
  return solve(tokens);
}

/** The problem as a child would read it aloud from the screen, e.g. `2 · 4 = ?`. */
export function written(tokens: readonly Token[]): string {
  return tokens
    .map((token) => {
      switch (token.kind) {
        case 'number':
          return String(token.value);
        case 'op':
          return token.symbol;
        case 'equals':
          return '=';
        case 'remainder':
          return token.symbol;
        case 'open':
          return '(';
        case 'close':
          return ')';
        case 'blank':
          return '?';
        case 'slot':
          return '○';
      }
    })
    .join(' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')');
}

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** British English number words up to 999, written independently of the game's own. */
export function numberWords(value: number): string {
  if (value < 20) return ONES[value]!;
  if (value < 100) {
    const ones = value % 10;
    return TENS[Math.floor(value / 10)]! + (ones ? `-${ONES[ones]}` : '');
  }
  const rest = value % 100;
  return `${ONES[Math.floor(value / 100)]} hundred${rest ? ` and ${numberWords(rest)}` : ''}`;
}

const SPOKEN_OPERATORS: Readonly<Record<Operator, string>> = {
  add: 'plus',
  sub: 'minus',
  mul: 'times',
  div: 'divided by',
};

/**
 * What read-aloud should say for the problem as written (plan §2.10): the same words in both
 * notations, "what" for the answer box ("Five times what equals twenty?"), "remainder what".
 */
export function spokenFor(tokens: readonly Token[]): string {
  const words = tokens.map((token) => {
    switch (token.kind) {
      case 'number':
        return numberWords(token.value);
      case 'op':
        return SPOKEN_OPERATORS[token.op];
      case 'equals':
        return 'equals';
      case 'remainder':
        return ', remainder';
      case 'blank':
        return 'what';
      case 'open':
        return 'open bracket,';
      case 'close':
        return ', close bracket';
      case 'slot':
        return 'which sign';
    }
  });
  const sentence = words.join(' ').replace(/ ,/g, ',');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}?`;
}
