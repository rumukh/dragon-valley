/**
 * A problem's picture (`EquationProblem.picture`, grades 1-2): `dots` for a counting problem
 * (`num.count`: `? = n` shown as n dots, so `n`, the answer, is never written or read aloud) or
 * `sticks` for place value (`num.place`: `47 = ? · 10 + 7`).
 */
import type { Problem, ProblemPicture } from '../../rules/contract';

export type { ProblemPicture };

/** The picture of an equation (or a word problem's model), or null. */
export function pictureOf(problem: Problem): ProblemPicture | null {
  const equation = problem.kind === 'word' ? problem.model : problem;
  return equation.kind === 'equation' ? (equation.picture ?? null) : null;
}

/** A counting problem: the known number is drawn as dots and never written or spoken. */
export function countedDots(problem: Problem): number | null {
  const picture = pictureOf(problem);
  return picture?.kind === 'dots' ? picture.count : null;
}
