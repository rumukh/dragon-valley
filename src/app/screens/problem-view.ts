/**
 * How problems and answers look and sound: the problem line in the child's notation (each side
 * of "=" kept on one line, the asked-about number of a term question marked, a comparison as two
 * stones), and the words and labels of answer choices.
 */
import { evaluate, formatFace } from '../../rules/contract';
import type { AnswerValue, CardFace, Problem, ProblemStep } from '../../rules/contract';
import { formatAnswer, problemTokens } from '../math/notation';
import type { Notation, Token } from '../math/notation';
import type { MessageKey, Translate } from '../i18n/messages';
import { speakAnswer } from '../speech/verbalizer';
import { h } from '../ui/dom';

type CompareProblem = Extract<Problem, { kind: 'compare' }>;

/**
 * A counting problem's dots in ten-frames (five a row), never their number: the number is the
 * answer. The problem line's label reads the question ("How many dots?").
 */
function dotsElement(count: number): HTMLElement {
  const frames = Math.max(1, Math.ceil(count / 10));
  return h(
    'span',
    {
      className: 'dv-problem__dots',
      testId: 'problem-dots',
      attributes: { 'aria-hidden': 'true' },
    },
    ...Array.from({ length: frames }, (_, frame) =>
      h(
        'span',
        { className: 'dv-problem__frame' },
        ...Array.from({ length: 10 }, (_, cell) =>
          h('span', {
            className:
              frame * 10 + cell < count
                ? 'dv-problem__dot'
                : 'dv-problem__dot dv-problem__dot--empty',
          }),
        ),
      ),
    ),
  );
}

function tokenElement(token: Token): HTMLElement {
  if (token.kind === 'blank') return h('span', { className: 'dv-problem__blank', text: '?' });
  if (token.kind === 'slot') {
    return h('span', { className: 'dv-problem__slot', testId: 'problem-slot' });
  }
  if (token.kind === 'dots') return dotsElement(token.count);
  const highlighted = token.kind === 'number' && token.highlight === true;
  return h('span', {
    className: highlighted
      ? 'dv-problem__number dv-problem__number--asked'
      : `dv-problem__${token.kind}`,
    text: token.text,
  });
}

/**
 * A minigame card's face. An example sentence marks the number its term names, as a term
 * question marks its asked number: by a marker and an underline, not colour alone (DV-QA-17).
 */
export function faceElement(face: CardFace, notation: Notation): HTMLElement {
  if (face.kind !== 'sentence') {
    return h('span', { className: 'dv-card-tile__face', text: formatFace(face, notation) });
  }
  const tokens = problemTokens(
    { kind: 'term', sentence: face.sentence, highlight: face.highlight ?? 'result' },
    notation,
  ).map((token): Token =>
    face.highlight === null && token.kind === 'number'
      ? { kind: 'number', text: token.text }
      : token,
  );
  return h(
    'span',
    { className: 'dv-card-tile__face dv-card-tile__face--sentence' },
    ...tokens.map(tokenElement),
  );
}

/** Long problems get a smaller size, so they fit a phone. */
function sizeOf(tokens: readonly Token[]): 's' | 'm' | 'l' {
  let length = 0;
  for (const token of tokens) {
    length +=
      token.kind === 'blank' || token.kind === 'slot'
        ? 2
        : token.kind === 'dots'
          ? 6
          : token.text.length + 1;
  }
  return length > 14 ? 's' : length > 10 ? 'm' : 'l';
}

/**
 * A comparison as two stones (Compare Stones, docs/design.md §5.7): each stone carries one side
 * and the sign's place sits between them. Once answered, `revealComparison` writes each stone's
 * value under it and the right sign in its place, so the child sees why: `7 · 8` is 56.
 */
function compareElement(problem: CompareProblem, notation: Notation, spoken: string): HTMLElement {
  const tokens = problemTokens(problem, notation);
  const at = tokens.findIndex((token) => token.kind === 'blank');
  const stone = (side: 'left' | 'right', list: readonly Token[]): HTMLElement =>
    h(
      'span',
      { className: 'dv-stone', dataset: { side } },
      h('span', { className: 'dv-problem__part' }, ...list.map(tokenElement)),
      h('span', { className: 'dv-stone__value', testId: `stone-value-${side}` }),
    );
  const line = h(
    'p',
    {
      className: 'dv-problem dv-stones',
      testId: 'problem',
      dataset: { step: 'answer', kind: 'compare' },
      attributes: { 'aria-label': spoken },
    },
    stone('left', tokens.slice(0, at)),
    h('span', { className: 'dv-problem__part dv-stones__sign' }, tokenElement(tokens[at]!)),
    stone('right', tokens.slice(at + 1)),
  );
  line.dataset['size'] = sizeOf(tokens);
  return line;
}

/**
 * After a comparison is answered: each stone shows its value (a plain number needs none) and the
 * sign's place shows the right sign.
 */
export function revealComparison(
  line: HTMLElement,
  problem: CompareProblem,
  answer: AnswerValue,
  notation: Notation,
): void {
  for (const side of ['left', 'right'] as const) {
    const expr = problem[side];
    const value = expr.kind === 'num' ? null : evaluate(expr);
    const slot = line.querySelector(`.dv-stone[data-side="${side}"] .dv-stone__value`);
    if (slot && value !== null) slot.textContent = String(value);
  }
  const blank = line.querySelector<HTMLElement>('.dv-stones__sign .dv-problem__blank');
  if (blank && answer.kind === 'relation') {
    blank.textContent = formatAnswer(answer, notation);
    blank.dataset['filled'] = 'true';
  }
  line.dataset['revealed'] = 'true';
}

export function problemElement(
  problem: Problem,
  notation: Notation,
  spoken: string,
  step: ProblemStep = 'answer',
): HTMLElement {
  if (problem.kind === 'compare') return compareElement(problem, notation, spoken);
  const line = h('p', {
    className: 'dv-problem',
    testId: 'problem',
    dataset: { step },
    attributes: { 'aria-label': spoken },
  });
  const tokens = problemTokens(problem, notation, step);
  // Each side of "=" stays on one line; a long problem wraps only at the equals sign.
  let part = h('span', { className: 'dv-problem__part' });
  const parts = [part];
  for (const token of tokens) {
    if (token.kind === 'sign' && token.text === '=') {
      part = h('span', { className: 'dv-problem__part' });
      parts.push(part);
    }
    part.append(tokenElement(token));
  }
  line.dataset['size'] = sizeOf(tokens);
  line.append(...parts);
  return line;
}

/** A stable tile id for an answer choice. */
export function answerId(answer: AnswerValue): string {
  switch (answer.kind) {
    case 'number':
      return String(answer.value);
    case 'remainder':
      return `${answer.quotient}r${answer.remainder}`;
    case 'relation':
      return answer.relation;
    case 'operation':
      return answer.operation;
    case 'term':
      return answer.term;
  }
}

/** What a choice tile shows: the number or sign in the child's notation, or a term's name. */
export function answerLabel(answer: AnswerValue, notation: Notation, t: Translate): string {
  return answer.kind === 'term'
    ? t(`term.${answer.term}` as MessageKey)
    : formatAnswer(answer, notation);
}

/** What a screen reader says for a choice (signs are read as words). */
export function answerSpoken(answer: AnswerValue, t: Translate): string {
  return answer.kind === 'term' ? t(`term.${answer.term}` as MessageKey) : speakAnswer(answer);
}
