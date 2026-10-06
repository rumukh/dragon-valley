/**
 * How problems and answers look and sound: the problem line in the child's notation (each side
 * of "=" kept on one line, the asked-about number of a term question marked), and the words
 * and labels of answer choices.
 */
import type { AnswerValue, Problem } from '../../rules/contract';
import { formatAnswer, problemTokens } from '../math/notation';
import type { Notation } from '../math/notation';
import type { MessageKey, Translate } from '../i18n/messages';
import { speakAnswer } from '../speech/verbalizer';
import { h } from '../ui/dom';

export function problemElement(problem: Problem, notation: Notation, spoken: string): HTMLElement {
  const line = h('p', {
    className: 'dv-problem',
    testId: 'problem',
    attributes: { 'aria-label': spoken },
  });
  const tokens = problemTokens(problem, notation);
  // Each side of "=" stays on one line; a long problem wraps only at the equals sign.
  let part = h('span', { className: 'dv-problem__part' });
  const parts = [part];
  let length = 0;
  for (const token of tokens) {
    if (token.kind === 'sign' && token.text === '=') {
      part = h('span', { className: 'dv-problem__part' });
      parts.push(part);
    }
    length += token.kind === 'blank' ? 2 : token.text.length + 1;
    const highlighted = token.kind === 'number' && token.highlight === true;
    part.append(
      token.kind === 'blank'
        ? h('span', { className: 'dv-problem__blank', text: '?' })
        : h('span', {
            className: highlighted
              ? 'dv-problem__number dv-problem__number--asked'
              : `dv-problem__${token.kind}`,
            text: token.text,
          }),
    );
  }
  line.dataset['size'] = length > 14 ? 's' : length > 10 ? 'm' : 'l';
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
