/**
 * Word problems (`word`): a short story from a content template (`content.wordTemplates`), its
 * numbers drawn from `problems` and its names and objects from `words`. Items are families
 * (`word:times-as-many`); the template is drawn from the skill's templates of that family.
 *
 * A template's `int` variables have small ranges, so all their combinations are enumerated and
 * only those whose `calc` values, model and answer are non-negative integers within the 3rd-grade
 * range of 1000 are kept (a leftover story must also leave something over). One of them is drawn
 * uniformly, so a template never fails while any combination fits, and the numbers in the story
 * always match its model. Names come from name lists, objects from thing lists; two variables on
 * the same list get different words, so "Anna" never talks to "Anna".
 */
import type { DeepReadonly } from '@aegis/runtime';
import { BLANK, evaluate, expectedAnswer, group, num, op, parseItemId } from '../../contract';
import type {
  DivRemProblem,
  EquationProblem,
  Expr,
  Problem,
  TemplateExpr,
  WordParams,
  WordProblem,
  WordTemplate,
} from '../../contract';
import type { GeneratorSources } from './shared';
import { partialValues } from './expressions';
import { NUMBER_RANGE, cannotPractise, span } from './shared';

/** At most this many number combinations per template (a content-authoring limit). */
export const MAX_COMBINATIONS = 20_000;

type Template = DeepReadonly<WordTemplate>;
type Numbers = Record<string, number>;

function toExpr(expr: DeepReadonly<TemplateExpr>, numbers: Numbers): Expr | null {
  switch (expr.kind) {
    case 'num':
      return num(expr.value);
    case 'var': {
      const value = numbers[expr.name];
      return value === undefined ? null : num(value);
    }
    case 'group': {
      const inner = toExpr(expr.inner, numbers);
      return inner && group(inner);
    }
    case 'op': {
      const left = toExpr(expr.left, numbers);
      const right = toExpr(expr.right, numbers);
      return left && right && op(expr.op, left, right);
    }
  }
}

/** The names of the template's `int` variables, sorted. */
function intNames(template: Template): string[] {
  return Object.keys(template.vars)
    .filter((name) => template.vars[name]!.kind === 'int')
    .sort();
}

/**
 * All numeric variables for one choice of the `int` variables, with every `calc` variable worked
 * out, or `null` when a value is not a whole number from 0 to 1000.
 */
function numbersFor(template: Template, ints: Numbers): Numbers | null {
  const numbers: Numbers = { ...ints };
  for (const value of Object.values(numbers)) if (value > NUMBER_RANGE) return null;
  const pending = Object.keys(template.vars)
    .filter((name) => template.vars[name]!.kind === 'calc')
    .sort();
  while (pending.length > 0) {
    const ready = pending.findIndex((name) => {
      const v = template.vars[name]!;
      return v.kind === 'calc' && toExpr(v.expr, numbers) !== null;
    });
    if (ready < 0) return null;
    const [name] = pending.splice(ready, 1);
    const v = template.vars[name!]!;
    const value = v.kind === 'calc' ? evaluate(toExpr(v.expr, numbers)!) : null;
    if (value === null || value > NUMBER_RANGE) return null;
    numbers[name!] = value;
  }
  return numbers;
}

/** The story's arithmetic for these numbers, or `null` when it is not a valid problem. */
function modelFor(template: Template, numbers: Numbers): EquationProblem | DivRemProblem | null {
  const model = template.model;
  let problem: EquationProblem | DivRemProblem;
  if (model.kind === 'value') {
    const expr = toExpr(model.expr, numbers);
    if (expr === null) return null;
    // Every step of a two-step story stays inside the 3rd-grade range too.
    if (partialValues(expr).some((value) => value > NUMBER_RANGE)) return null;
    problem = { kind: 'equation', left: expr, right: BLANK };
  } else {
    const dividend = toExpr(model.dividend, numbers);
    const divisor = toExpr(model.divisor, numbers);
    const d = dividend && evaluate(dividend);
    const s = divisor && evaluate(divisor);
    if (d === null || s === null || s === 0) return null;
    problem = { kind: 'divrem', dividend: d, divisor: s };
  }
  const answer = expectedAnswer(problem);
  if (!answer.ok) return null;
  const value = answer.value;
  if (value.kind === 'number') return value.value <= NUMBER_RANGE ? problem : null;
  // A leftover story always has something left over.
  return value.kind === 'remainder' && value.remainder > 0 ? problem : null;
}

/** Every choice of the `int` variables whose story is a valid problem, in a fixed order. */
export function templateCombinations(template: Template): Numbers[] {
  const names = intNames(template);
  const ranges = names.map((name) => {
    const v = template.vars[name]!;
    return v.kind === 'int' ? span(v.min, v.max) : [];
  });
  const total = ranges.reduce((count, range) => count * range.length, 1);
  if (total > MAX_COMBINATIONS) {
    throw new Error(
      `Word template ${template.id} has ${total} number combinations (max ${MAX_COMBINATIONS}).`,
    );
  }
  const valid: Numbers[] = [];
  const choose = (index: number, chosen: Numbers) => {
    if (index === names.length) {
      const numbers = numbersFor(template, chosen);
      if (numbers !== null && modelFor(template, numbers) !== null) valid.push(chosen);
      return;
    }
    for (const value of ranges[index]!) choose(index + 1, { ...chosen, [names[index]!]: value });
  };
  choose(0, {});
  return valid;
}

/** Names and objects for the story; two variables on one list get different entries. */
function wordsFor(
  template: Template,
  numbers: Numbers,
  sources: GeneratorSources,
): Record<string, string> {
  const words: Record<string, string> = {};
  const entries: Record<string, string> = {};
  const used = new Map<string, string[]>();
  const names = Object.keys(template.vars).sort();
  for (const name of names) {
    const v = template.vars[name]!;
    if (v.kind !== 'word') continue;
    const list = sources.data.wordLists.find((l) => l.id === v.list);
    if (!list || list.entries.length === 0) throw new Error(`Word list ${v.list} is missing.`);
    const taken = used.get(list.id) ?? [];
    const fresh = list.entries.filter((entry) => !taken.includes(entry));
    const entry = sources.words.pick(fresh.length > 0 ? fresh : list.entries);
    used.set(list.id, [...taken, entry]);
    entries[name] = entry;
    words[name] = list.kind === 'thing' ? `${entry}.other` : entry;
  }
  for (const name of names) {
    const v = template.vars[name]!;
    if (v.kind !== 'form') continue;
    const entry = entries[v.word];
    if (entry === undefined) throw new Error(`Form ${name} names no word in ${template.id}.`);
    words[name] = `${entry}.${numbers[v.count] === 1 ? 'one' : 'other'}`;
  }
  return words;
}

/** A word problem from one template. Throws when no combination of its numbers fits. */
export function problemFromTemplate(template: Template, sources: GeneratorSources): WordProblem {
  const combinations = templateCombinations(template);
  if (combinations.length === 0)
    throw new Error(`Word template ${template.id} has no valid numbers.`);
  const numbers = numbersFor(template, sources.problems.pick(combinations))!;
  const model = modelFor(template, numbers)!;
  const words = wordsFor(template, numbers, sources);
  const vars: Record<string, number | string> = {};
  for (const name of Object.keys(template.vars).sort()) vars[name] = numbers[name] ?? words[name]!;
  return { kind: 'word', template: template.textKey, vars, model, operation: template.operation };
}

export function wordProblem(
  params: DeepReadonly<WordParams>,
  item: string,
  sources: GeneratorSources,
): Problem {
  const parsed = parseItemId(item);
  const family = parsed?.kind === 'bucket' && parsed.family === 'word' ? parsed.bucket : null;
  const templates = params.templates
    .map((id) => sources.data.wordTemplates.find((t) => t.id === id))
    .filter((t): t is Template => t !== undefined && t.family === family);
  if (templates.length === 0) throw cannotPractise('word', item);
  return problemFromTemplate(sources.problems.pick(templates), sources);
}
