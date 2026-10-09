/**
 * The read-aloud verbalizer: problems and answers as English words, over the domain contract's
 * problem representation.
 *
 * Speech follows the written structure, so a child hears what they see: `56 : 7 = ?` is
 * "Fifty-six divided by seven equals what?" and `4 r 3` is "four remainder three". Both
 * notations read the same (`·` and `×` are "times", `:` and `÷` "divided by", `r` and `R`
 * "remainder"); only the written symbols differ. Brackets that the writing needs are spoken
 * as "open bracket … close bracket". A word problem's story is catalog text the screen reads
 * first; its arithmetic model is spoken here.
 */
import { needsGroup } from '../../rules/contract';
import type {
  AnswerValue,
  CardFace,
  DivRemProblem,
  EquationProblem,
  Expr,
  Operator,
  Problem,
  ProblemStep,
  Relation,
  Term,
  TermProblem,
} from '../../rules/contract';
import { countedDots } from '../math/picture';
import { numberToWords } from './numbers';

export const OPERATOR_WORDS: Readonly<Record<Operator, string>> = {
  add: 'plus',
  sub: 'minus',
  mul: 'times',
  div: 'divided by',
};

export const RELATION_WORDS: Readonly<Record<Relation, string>> = {
  lt: 'is less than',
  gt: 'is greater than',
  eq: 'equals',
};

export const OPERATION_NAMES: Readonly<Record<Operator, string>> = {
  add: 'adding',
  sub: 'taking away',
  mul: 'multiplying',
  div: 'dividing',
};

export const TERM_WORDS: Readonly<Record<Term, string>> = {
  factor: 'a factor',
  product: 'the product',
  dividend: 'the dividend',
  divisor: 'the divisor',
  quotient: 'the quotient',
  remainder: 'the remainder',
};

const BLANK_WORD = 'what';
/** A counting problem, read aloud without its number. */
export const COUNT_QUESTION = 'How many dots?';
/** Spoken for the empty sign of a story's operation step. */
const SLOT_WORDS = 'which sign';

function bracketed(words: string): string {
  return `open bracket, ${words}, close bracket`;
}

export function speakExpr(expr: Expr): string {
  switch (expr.kind) {
    case 'num':
      return numberToWords(expr.value);
    case 'blank':
      return BLANK_WORD;
    case 'group':
      return bracketed(speakExpr(expr.inner));
    case 'op': {
      const side = (child: Expr, which: 'left' | 'right'): string =>
        needsGroup(expr.op, child, which) ? bracketed(speakExpr(child)) : speakExpr(child);
      return `${side(expr.left, 'left')} ${OPERATOR_WORDS[expr.op]} ${side(expr.right, 'right')}`;
    }
  }
}

function sentence(words: string, end: '.' | '?'): string {
  return words.charAt(0).toUpperCase() + words.slice(1) + end;
}

function termSentence(problem: TermProblem): string {
  const { left, right, result, remainder, op } = problem.sentence;
  return (
    `${numberToWords(left)} ${OPERATOR_WORDS[op]} ${numberToWords(right)} equals ${numberToWords(result)}` +
    (remainder === null ? '' : ` remainder ${numberToWords(remainder)}`)
  );
}

/** The highlighted number in words: "forty-two", or "the first six" when it appears twice. */
function highlightedWords(problem: TermProblem): string {
  const { sentence: parts, highlight } = problem;
  const order = ['left', 'right', 'result', 'remainder'] as const;
  const values = order.map((part) => (part === 'remainder' ? parts.remainder : parts[part]));
  const value = values[order.indexOf(highlight)]!;
  const same = order.filter((_, index) => values[index] === value);
  const words = numberToWords(value);
  if (same.length < 2) return words;
  return `the ${same.indexOf(highlight) === 0 ? 'first' : 'second'} ${words}`;
}

/** "What do we call forty-two?", naming the position when the number appears twice. */
function termQuestion(problem: TermProblem): string {
  return `what do we call ${highlightedWords(problem)}`;
}

/** The question as a child reads it: "Seven times eight equals what?" */
export function speakProblem(problem: Problem, step: ProblemStep = 'answer'): string {
  switch (problem.kind) {
    case 'equation':
      // A counting problem never says its number: that number is the answer.
      if (countedDots(problem) !== null) return COUNT_QUESTION;
      return sentence(`${speakExpr(problem.left)} equals ${speakExpr(problem.right)}`, '?');
    case 'divrem':
      return sentence(
        `${numberToWords(problem.dividend)} divided by ${numberToWords(problem.divisor)} equals what, remainder what`,
        '?',
      );
    case 'compare':
      return sentence(
        `which sign goes between ${speakExpr(problem.left)} and ${speakExpr(problem.right)}`,
        '?',
      );
    case 'word':
      return step === 'operation' && problem.operation !== null
        ? speakOperationStep(problem.model)
        : speakProblem(problem.model);
    case 'term':
      return `${sentence(termSentence(problem), '.')} ${sentence(termQuestion(problem), '?')}`;
  }
}

/** A story's model with its sign still to choose: "Five, which sign, four, equals what?" */
function speakOperationStep(model: EquationProblem | DivRemProblem): string {
  if (model.kind === 'divrem') {
    return sentence(
      `${numberToWords(model.dividend)}, ${SLOT_WORDS}, ${numberToWords(model.divisor)}, equals what`,
      '?',
    );
  }
  const side = (expr: Expr): string =>
    expr.kind === 'op'
      ? `${speakExpr(expr.left)}, ${SLOT_WORDS}, ${speakExpr(expr.right)},`
      : speakExpr(expr);
  return sentence(
    model.left.kind === 'op'
      ? `${side(model.left)} equals ${speakExpr(model.right)}`
      : `${speakExpr(model.left)} equals ${side(model.right)}`,
    '?',
  ).replace(/,\?$/, '?');
}

export function speakAnswer(answer: AnswerValue): string {
  switch (answer.kind) {
    case 'number':
      return numberToWords(answer.value);
    case 'remainder':
      return `${numberToWords(answer.quotient)} remainder ${numberToWords(answer.remainder)}`;
    case 'relation':
      return RELATION_WORDS[answer.relation];
    case 'operation':
      return OPERATION_NAMES[answer.operation];
    case 'term':
      return TERM_WORDS[answer.term];
  }
}

/** The finished fact: "Seven times eight equals fifty-six." */
export function speakSolved(problem: Problem, answer: AnswerValue): string {
  switch (problem.kind) {
    case 'equation': {
      if (countedDots(problem) !== null && answer.kind === 'number') {
        return sentence(
          `${numberToWords(answer.value)} ${answer.value === 1 ? 'dot' : 'dots'}`,
          '.',
        );
      }
      let used = false;
      const fill = (expr: Expr): Expr => {
        if (expr.kind === 'blank' && !used && answer.kind === 'number') {
          used = true;
          return { kind: 'num', value: answer.value };
        }
        if (expr.kind === 'op') return { ...expr, left: fill(expr.left), right: fill(expr.right) };
        if (expr.kind === 'group') return { ...expr, inner: fill(expr.inner) };
        return expr;
      };
      return sentence(
        `${speakExpr(fill(problem.left))} equals ${speakExpr(fill(problem.right))}`,
        '.',
      );
    }
    case 'divrem':
      return sentence(
        `${numberToWords(problem.dividend)} divided by ${numberToWords(problem.divisor)} equals ${speakAnswer(answer)}`,
        '.',
      );
    case 'compare':
      return sentence(
        `${speakExpr(problem.left)} ${speakAnswer(answer)} ${speakExpr(problem.right)}`,
        '.',
      );
    case 'word':
      return speakSolved(problem.model, answer);
    case 'term':
      return sentence(
        `${termQuestion(problem).replace('what do we call ', '')} is ${speakAnswer(answer)}`,
        '.',
      );
  }
}

/**
 * A minigame card or stone face ("seven times eight", "fifty-six", a whole sentence). An example
 * sentence names the number its term is about: "thirty divided by six equals five, six marked".
 */
export function speakFace(face: CardFace): string {
  switch (face.kind) {
    case 'expr':
      return speakExpr(face.expr);
    case 'answer':
      return speakAnswer(face.answer);
    case 'sentence': {
      const problem: TermProblem = {
        kind: 'term',
        sentence: face.sentence,
        highlight: face.highlight ?? 'result',
      };
      const said = termSentence(problem);
      return face.highlight === null ? said : `${said}, ${highlightedWords(problem)} marked`;
    }
  }
}
