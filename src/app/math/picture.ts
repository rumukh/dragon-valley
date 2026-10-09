/**
 * A problem's picture (G2's contract addition for grades 1-2): `EquationProblem.picture` is
 * `{ kind: 'dots', count }` for a counting problem (`num.count`: `? = n` shown as n dots, so `n`,
 * the answer, is never written or read aloud) or `{ kind: 'sticks', tens, ones }` for place value
 * (`num.place`: `40 + 7 = ?`, `47 = ? · 10 + 7`, `47 = 4 · 10 + ?`).
 *
 * This reads the field defensively, so the shell builds against the contract before and after the
 * field lands in `src/rules/contract/problems.ts`.
 */
import type { Problem } from '../../rules/contract';

export type ProblemPicture =
  | { readonly kind: 'dots'; readonly count: number }
  | { readonly kind: 'sticks'; readonly tens: number; readonly ones: number };

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** The picture of an equation (or a word problem's model), or null. */
export function pictureOf(problem: Problem): ProblemPicture | null {
  const equation = problem.kind === 'word' ? problem.model : problem;
  if (equation.kind !== 'equation') return null;
  const picture = (equation as { readonly picture?: unknown }).picture;
  if (typeof picture !== 'object' || picture === null) return null;
  const raw = picture as Record<string, unknown>;
  if (raw['kind'] === 'dots' && isCount(raw['count'])) {
    return { kind: 'dots', count: raw['count'] };
  }
  if (raw['kind'] === 'sticks' && isCount(raw['tens']) && isCount(raw['ones'])) {
    return { kind: 'sticks', tens: raw['tens'], ones: raw['ones'] };
  }
  return null;
}

/** A counting problem: the known number is drawn as dots and never written or spoken. */
export function countedDots(problem: Problem): number | null {
  const picture = pictureOf(problem);
  return picture?.kind === 'dots' ? picture.count : null;
}
