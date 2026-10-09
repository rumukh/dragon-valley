/**
 * Problem generation: every generator of the contract (docs/learning.md).
 *
 * `problemFor(skill, item, sources)` draws a problem that practises `item` through `skill`: the
 * item's numbers, positions and shapes from the `problems` stream and the names and objects of
 * word problems from the `words` stream. Each generator lives in `generators/`; every problem it
 * emits has exactly one correct answer (`expectedAnswer` succeeds) and stays inside the skill's
 * parameters and the 3rd-grade bounds of docs/curriculum.md §4.
 *
 * `choicesFor(problem, count, random)` (distractors.ts) gives the options for choice input.
 */
import type { DeepReadonly } from '@aegis/runtime';
import { GENERATOR_IDS } from '../contract';
import type { GeneratorId, Problem, Skill } from '../contract';
import { div2d1dProblem, mul2d1dProblem, power10Problem, tensProblem } from './generators/beyond';
import { compareProblem } from './generators/compare';
import { divFactProblem, missingFactorProblem, mulFactProblem } from './generators/facts';
import { orderProblem } from './generators/order';
import { remainderProblem } from './generators/remainder';
import { termProblem } from './generators/terms';
import { wordProblem } from './generators/word';
import type { GeneratorSources } from './generators/shared';

export { choicesFor, keypadPossible } from './distractors';
export { NUMBER_RANGE, shuffle } from './generators/shared';
export type { GeneratorSources } from './generators/shared';

/**
 * The grades 1-2 generators are contract-only until G2 implements them (docs/grades-plan.md §7):
 * `problemFor` throws for them and `canGenerate` is false. Every other generator is implemented.
 */
export const PENDING_GENERATORS: readonly GeneratorId[] = [
  'num.count',
  'num.compare',
  'num.place',
  'add.fact',
  'sub.fact',
  'add.missing',
  'addsub.2d',
];
export const IMPLEMENTED_GENERATORS: readonly GeneratorId[] = GENERATOR_IDS.filter(
  (id) => !PENDING_GENERATORS.includes(id),
);

export function canGenerate(skill: DeepReadonly<Skill>): boolean {
  return IMPLEMENTED_GENERATORS.includes(skill.generator);
}

/**
 * The problem that practises `item` through `skill`. Throws when the skill can never produce the
 * item (the caller passed an item outside `skillItems(skill)`, or the content is invalid).
 */
export function problemFor(
  skill: DeepReadonly<Skill>,
  item: string,
  sources: GeneratorSources,
): Problem {
  const { problems } = sources;
  switch (skill.generator) {
    case 'mul.fact':
      return mulFactProblem(item);
    case 'div.fact':
      return divFactProblem(item);
    case 'mul.missing':
      return missingFactorProblem(skill.params, item, problems);
    case 'div.remainder':
      return remainderProblem(skill.params, item, problems);
    case 'mul.power10':
      return power10Problem(skill.params, item, problems);
    case 'mul.tens':
      return tensProblem(skill.params, item, problems);
    case 'mul.2d1d':
      return mul2d1dProblem(skill.params, item, problems);
    case 'div.2d1d':
      return div2d1dProblem(skill.params, item, problems);
    case 'order.ops':
      return orderProblem(skill.params, item, problems);
    case 'compare':
      return compareProblem(skill.params, item, problems);
    case 'word':
      return wordProblem(skill.params, item, sources);
    case 'terms':
      return termProblem(skill.params, item, problems);
    // Contract-only until G2 (docs/grades-plan.md §7): not implemented yet.
    case 'num.count':
    case 'num.compare':
    case 'num.place':
    case 'add.fact':
    case 'sub.fact':
    case 'add.missing':
    case 'addsub.2d':
      throw new Error(`${skill.generator}: not implemented (G2)`);
  }
}
