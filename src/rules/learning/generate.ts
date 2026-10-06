/**
 * Problem generation for small-table facts (walking skeleton).
 *
 * Implemented generators: `mul.fact`, `div.fact` and `mul.missing`. The other generators of the
 * contract (remainders, beyond-the-tables, order of operations, comparison, word problems and
 * terms) are S2's problem-generators work; a round never draws from a skill whose generator is
 * not implemented here.
 *
 * Distractors are plausible error patterns (neighbouring products, a + b instead of a · b,
 * reversed digits, quotient ± 1), unique, non-negative and never the answer, in seeded order.
 */
import { requireValue } from '@aegis/runtime';
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import {
  BLANK,
  MAX_PROBLEM_NUMBER,
  OPERATORS,
  RELATIONS,
  TERMS,
  expectedAnswer,
  num,
  op,
  parseItemId,
  sameAnswer,
} from '../contract';
import type { AnswerValue, GeneratorId, Problem, Skill } from '../contract';

export const IMPLEMENTED_GENERATORS: readonly GeneratorId[] = [
  'mul.fact',
  'div.fact',
  'mul.missing',
];

export function canGenerate(skill: DeepReadonly<Skill>): boolean {
  return IMPLEMENTED_GENERATORS.includes(skill.generator);
}

/** Fisher-Yates shuffle with a seeded stream. */
export function shuffle<T>(items: readonly T[], random: RandomStream): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random.int(0, i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** The problem that practises `item` through `skill`. */
export function problemFor(
  skill: DeepReadonly<Skill>,
  item: string,
  random: RandomStream,
): Problem {
  const parsed = parseItemId(item);
  if (skill.generator === 'mul.fact' && parsed?.kind === 'mul') {
    return { kind: 'equation', left: op('mul', num(parsed.a), num(parsed.b)), right: BLANK };
  }
  if (skill.generator === 'div.fact' && parsed?.kind === 'div') {
    return {
      kind: 'equation',
      left: op('div', num(parsed.dividend), num(parsed.divisor)),
      right: BLANK,
    };
  }
  if (skill.generator === 'mul.missing' && parsed?.kind === 'div') {
    const position = skill.params.position;
    const first = position === 'first' || (position === 'both' && random.bool());
    const known = num(parsed.divisor);
    return {
      kind: 'equation',
      left: first ? op('mul', BLANK, known) : op('mul', known, BLANK),
      right: num(parsed.dividend),
    };
  }
  throw new Error(`Generator ${skill.generator} cannot practise ${item}.`);
}

function reversedDigits(value: number): number | null {
  const text = String(value);
  if (text.length < 2) return null;
  const reversed = Number([...text].reverse().join(''));
  return reversed === value ? null : reversed;
}

/** Candidate wrong numbers for a numeric answer, most plausible first. */
function numberCandidates(problem: Problem, answer: number): number[] {
  const candidates: number[] = [];
  if (problem.kind === 'equation' && problem.left.kind === 'op') {
    const { op: operator, left, right } = problem.left;
    if (operator === 'mul' && left.kind === 'num' && right.kind === 'num') {
      const [a, b] = [left.value, right.value];
      candidates.push(a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, a + b);
      const reversed = reversedDigits(answer);
      if (reversed !== null) candidates.push(reversed);
    }
  }
  candidates.push(answer + 1, answer - 1, answer + 2, answer - 2, answer + 10, answer - 10);
  return candidates;
}

/**
 * `count` options including the correct one, in seeded order. Numeric distractors follow error
 * patterns; relations, operations and terms offer the whole (small) vocabulary.
 */
export function choicesFor(problem: Problem, count: number, random: RandomStream): AnswerValue[] {
  const expected = requireValue(expectedAnswer(problem));
  let options: AnswerValue[];
  if (expected.kind === 'number') {
    const wrong = [...new Set(numberCandidates(problem, expected.value))].filter(
      (value) =>
        Number.isSafeInteger(value) &&
        value >= 0 &&
        value <= MAX_PROBLEM_NUMBER &&
        value !== expected.value,
    );
    const picked = shuffle(wrong.slice(0, 6), random).slice(0, count - 1);
    for (let extra = 3; picked.length < count - 1; extra++) {
      if (!picked.includes(expected.value + extra)) picked.push(expected.value + extra);
    }
    options = [expected, ...picked.map((value): AnswerValue => ({ kind: 'number', value }))];
  } else if (expected.kind === 'relation') {
    options = RELATIONS.map((relation): AnswerValue => ({ kind: 'relation', relation }));
  } else if (expected.kind === 'operation') {
    options = OPERATORS.map((operation): AnswerValue => ({ kind: 'operation', operation }));
  } else if (expected.kind === 'term') {
    options = [
      expected,
      ...TERMS.filter((t) => t !== expected.term).map((term): AnswerValue => ({
        kind: 'term',
        term,
      })),
    ].slice(0, count);
  } else {
    const { quotient, remainder } = expected;
    options = [
      expected,
      { kind: 'remainder', quotient: quotient + 1, remainder },
      { kind: 'remainder', quotient, remainder: remainder + 1 },
      { kind: 'remainder', quotient: Math.max(0, quotient - 1), remainder },
    ];
  }
  const unique = options.filter(
    (option, index) => options.findIndex((o) => sameAnswer(o, option)) === index,
  );
  return shuffle(unique, random);
}
