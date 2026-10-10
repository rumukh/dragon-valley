/**
 * Deterministic synthetic learners for the simulation: seeded models of a child answering
 * problems. Each knows every fact to some strength (0-100) that grows with practice, fades with
 * days without it and steadies with spaced successes; it answers right with a chance that rises
 * with its recall (on top of guessing among the options) and answers faster the better it knows
 * the fact.
 *
 * Integer arithmetic only, and randomness only from a seeded PRNG, so a simulation replays
 * exactly (the tests follow the rules' determinism lint).
 */
import { createPrng } from '@aegis/core';
import type { Prng } from '@aegis/core';
import { parseItemId } from '../../src/rules/contract';
import type { ProblemRoundView } from '../../src/rules/contract';

export type LearnerName =
  'perfect' | 'average' | 'struggling' | 'slow' | 'first-grader' | 'second-grader';

/** Thinking time (ms) by how well the fact comes to mind: fluent, steady, unsure. */
export interface Pace {
  fluent: number;
  steady: number;
  unsure: number;
}

export interface LearnerProfile {
  name: LearnerName;
  /** Strength (0-100) of a knowledge key before the first session. */
  prior(key: string): number;
  /** Share of the remaining gap one right answer closes, in percent (a miss closes half as much). */
  gain: number;
  /** Strength lost per day without practice at stability 1, in percent points. */
  forget: number;
  /** Thinking time before answering by choice. */
  choice: Pace;
  /** Thinking time before typing on the keypad; each digit then takes `typingMs`. */
  keypad: Pace;
  typingMs: number;
  /** Never wrong, always quick. */
  perfect: boolean;
  /** Makes one avoidable mistake on every minigame board. */
  clumsy: boolean;
  /** Answers a day: about a 15-minute session. */
  answersPerDay: number;
  /**
   * Reading a story in English (a second language for a Czech child), in milliseconds per word.
   * Used only when a simulation models reading (`SimulateOptions.reading`).
   */
  readingMsPerWord: number;
  /** Plays on the n-th day of the simulation (0-based; day 0 is a Monday). */
  playsOn(dayIndex: number): boolean;
}

/** The times tables of the Czech 2nd grade, reviewed in 3rd grade: 0, 1, 2, 3, 4, 5 and 10. */
export const SECOND_GRADE: ReadonlySet<number> = new Set([0, 1, 2, 3, 4, 5, 10]);

/**
 * The knowledge a problem draws on. A product is one fact in both orders (`7 · 8` and `8 · 7`),
 * a quotient is its own fact (`56 : 7`, harder at first), and every bucket item (remainders, word
 * problems, …) is one skill.
 */
export function knowledgeKey(item: string): string {
  const parsed = parseItemId(item);
  if (parsed?.kind === 'mul') {
    return `x:${Math.min(parsed.a, parsed.b)}x${Math.max(parsed.a, parsed.b)}`;
  }
  if (parsed?.kind === 'div') return `d:${parsed.divisor}x${parsed.quotient}`;
  if (parsed?.kind === 'add')
    return `a:${Math.min(parsed.a, parsed.b)}+${Math.max(parsed.a, parsed.b)}`;
  return item;
}

/** How well a child knows each kind of knowledge on the first day, 0-100. */
export interface Priors {
  /** Products in a 2nd-grade table (`2 · 7` is in the table of 2, so `7 · 2` is review too). */
  review: number;
  /** Quotients whose divisor or quotient is in a 2nd-grade table (`12 : 6` reverses `6 · 2`). */
  reviewDivision: number;
  /** Products and quotients of the new tables only (6-9 by 6-9). */
  fresh: number;
  freshDivision: number;
  /** Word problems: 2nd grade already tells simple stories. */
  words: number;
  /** The other 3rd-grade skills: remainders, big numbers, order, comparison, terms. */
  skills: number;
}

export function priorOf(key: string, p: Priors): number {
  const fact = /^([xd]):(\d+)x(\d+)$/.exec(key);
  if (fact === null) return key.startsWith('word:') ? p.words : p.skills;
  const known = SECOND_GRADE.has(Number(fact[2])) || SECOND_GRADE.has(Number(fact[3]));
  if (fact[1] === 'x') return known ? p.review : p.fresh;
  return known ? p.reviewDivision : p.freshDivision;
}

const weekdays = (day: number) => day % 7 !== 5 && day % 7 !== 6;

/** How well a younger child knows each kind of knowledge on the first day, 0-100. */
export interface GradePriors {
  /** Addition and subtraction facts within 10 (`add:3+4`, `sub:7-3`). */
  withinTen: number;
  /** Facts crossing ten (`add:8+5`, `sub:13-6`). */
  crossing: number;
  /** Counting, comparing and place value (`count:`, `ncompare:`, `place:`). */
  numbers: number;
  /** Two-digit addition and subtraction (`add2d:`, `sub2d:`). */
  twoDigit: number;
  /** Multiplication and everything else (taught later). */
  other: number;
}

/** A younger child's prior for a knowledge key (`knowledgeKey`). */
export function gradePriorOf(key: string, p: GradePriors): number {
  const add = /^a:(\d+)\+(\d+)$/.exec(key);
  if (add) return Number(add[1]) + Number(add[2]) > 10 ? p.crossing : p.withinTen;
  const sub = /^sub:(\d+)-(\d+)$/.exec(key);
  if (sub) return Number(sub[1]) > 10 ? p.crossing : p.withinTen;
  if (/^(count|ncompare|place):/.test(key)) return p.numbers;
  if (/^(add2d|sub2d):/.test(key)) return p.twoDigit;
  return p.other;
}

/**
 * The four children. Their priors model a child starting 3rd grade (docs/curriculum.md §1: the
 * tables of 2-5 and 10 are 2nd-grade review, 6-9 are new); docs/balance-report.md explains the
 * choices. They are fixed before the balance is measured and are never tuned to pass a check.
 */
export const LEARNERS: Readonly<Record<LearnerName, LearnerProfile>> = {
  /** The upper bound: always right, always quick, every day. */
  perfect: {
    name: 'perfect',
    prior: () => 100,
    gain: 100,
    forget: 0,
    choice: { fluent: 1500, steady: 1500, unsure: 1500 },
    keypad: { fluent: 1500, steady: 1500, unsure: 1500 },
    typingMs: 300,
    perfect: true,
    clumsy: false,
    answersPerDay: 45,
    readingMsPerWord: 300,
    playsOn: () => true,
  },
  /** Knows the 2nd-grade tables well, learns a fact in a few exposures, forgets slowly. */
  average: {
    name: 'average',
    prior: (key) =>
      priorOf(key, {
        review: 85,
        reviewDivision: 70,
        fresh: 15,
        freshDivision: 5,
        words: 50,
        skills: 30,
      }),
    gain: 35,
    forget: 4,
    choice: { fluent: 1800, steady: 4200, unsure: 7500 },
    keypad: { fluent: 1800, steady: 4800, unsure: 9000 },
    typingMs: 500,
    perfect: false,
    clumsy: false,
    answersPerDay: 45,
    readingMsPerWord: 600,
    playsOn: weekdays,
  },
  /**
   * Shaky on the 2nd-grade tables, needs many exposures, forgets quickly, is slow and clumsy, and
   * plays four days a week.
   */
  struggling: {
    name: 'struggling',
    prior: (key) =>
      priorOf(key, {
        review: 60,
        reviewDivision: 45,
        fresh: 5,
        freshDivision: 0,
        words: 25,
        skills: 10,
      }),
    gain: 20,
    forget: 6,
    choice: { fluent: 4300, steady: 6700, unsure: 10000 },
    keypad: { fluent: 4300, steady: 7300, unsure: 11500 },
    typingMs: 800,
    perfect: false,
    clumsy: true,
    answersPerDay: 35,
    readingMsPerWord: 900,
    playsOn: (day) => day % 7 !== 2 && weekdays(day),
  },
  /**
   * Knows and learns like the average child but is never quick: answers it knows well take 4-5 s
   * (inside the "ok" band), others longer, and typing is slow. Tests the fluency rules (gold needs
   * quick answers) and the keypad's extra time per digit.
   */
  slow: {
    name: 'slow',
    prior: (key) =>
      priorOf(key, {
        review: 85,
        reviewDivision: 70,
        fresh: 15,
        freshDivision: 5,
        words: 50,
        skills: 30,
      }),
    gain: 35,
    forget: 4,
    choice: { fluent: 4500, steady: 7000, unsure: 9000 },
    keypad: { fluent: 4500, steady: 7500, unsure: 10000 },
    typingMs: 900,
    perfect: false,
    clumsy: false,
    answersPerDay: 35,
    readingMsPerWord: 900,
    playsOn: weekdays,
  },
  /**
   * A child starting 1st grade (docs/curriculum.md §7): counts and compares small numbers, knows
   * a few sums within 10, no crossing ten yet. Does not read yet (a parent reads the stories),
   * so is slow on every answer, and plays four days a week in short sessions.
   */
  'first-grader': {
    name: 'first-grader',
    prior: (key) =>
      gradePriorOf(key, { withinTen: 35, crossing: 5, numbers: 60, twoDigit: 0, other: 0 }),
    gain: 30,
    forget: 5,
    choice: { fluent: 3500, steady: 6500, unsure: 10000 },
    keypad: { fluent: 4000, steady: 7500, unsure: 12000 },
    typingMs: 900,
    perfect: false,
    clumsy: true,
    answersPerDay: 25,
    readingMsPerWord: 1500,
    playsOn: (day) => day % 7 !== 2 && weekdays(day),
  },
  /**
   * A child starting 2nd grade: 1st-grade facts within 10 are review, crossing ten is shaky,
   * numbers to 100 and two-digit sums are new.
   */
  'second-grader': {
    name: 'second-grader',
    prior: (key) =>
      gradePriorOf(key, { withinTen: 85, crossing: 50, numbers: 70, twoDigit: 10, other: 5 }),
    gain: 35,
    forget: 4,
    choice: { fluent: 2500, steady: 5000, unsure: 8500 },
    keypad: { fluent: 2500, steady: 5500, unsure: 10000 },
    typingMs: 700,
    perfect: false,
    clumsy: false,
    answersPerDay: 35,
    readingMsPerWord: 1000,
    playsOn: weekdays,
  },
};

interface Memory {
  strength: number;
  /** Divides the daily forgetting: grows with every spaced success, halves with a miss. */
  stability: number;
  last: number;
}

/** One simulated child. `day` is the simulation's day number (days since 1970-01-01). */
export class Learner {
  private readonly memory = new Map<string, Memory>();
  private readonly random: Prng;
  day = 0;
  /** Total answering time so far, in milliseconds. */
  elapsedMs = 0;

  constructor(
    readonly profile: LearnerProfile,
    seed: string,
    /** Model reading a story's text (off by default, so earlier runs stay comparable). */
    readonly reading = false,
  ) {
    this.random = createPrng(`learner:${profile.name}:${seed}`);
  }

  private remember(key: string): Memory {
    let memory = this.memory.get(key);
    if (!memory) {
      // Knowledge from earlier grades is consolidated: the better known, the slower it fades.
      const strength = this.profile.prior(key);
      memory = { strength, stability: 1 + (strength - (strength % 10)) / 10, last: this.day };
      this.memory.set(key, memory);
    }
    return memory;
  }

  /** How well the fact comes to mind today, 0-100. */
  recall(key: string): number {
    const memory = this.remember(key);
    const days = Math.max(0, this.day - memory.last);
    return Math.max(
      0,
      memory.strength - Math.floor((this.profile.forget * days) / memory.stability),
    );
  }

  /**
   * Answer the problem on screen: right or wrong, and how long it takes. `answerDigits` is the
   * length of the answer the child types on the keypad; `storyWords` the length of a word
   * problem's story.
   */
  respond(
    view: ProblemRoundView,
    answerDigits = 2,
    storyWords = 0,
  ): { right: boolean; elapsedMs: number } {
    const problem = view.problem!;
    const keypad = problem.input === 'keypad' && problem.step === 'answer';
    if (this.profile.perfect) {
      const elapsedMs =
        (keypad ? 1500 + answerDigits * this.profile.typingMs : 1500) +
        this.readingMs(view, storyWords, 1500);
      this.elapsedMs += elapsedMs;
      return { right: true, elapsedMs };
    }
    const key = knowledgeKey(problem.item);
    const recall = this.recall(key);
    const options = problem.step === 'operation' ? 4 : (problem.choices?.length ?? 0);
    const guess = options > 0 ? Math.floor(100 / options) : 2;
    const chance = guess + Math.floor(((100 - guess) * recall) / 100);
    const right = this.random.int(0, 100) < chance;
    this.practise(key, right);
    const pace = keypad ? this.profile.keypad : this.profile.choice;
    const think = recall >= 85 ? pace.fluent : recall >= 55 ? pace.steady : pace.unsure;
    const elapsedMs =
      think +
      (keypad ? answerDigits * this.profile.typingMs : 0) +
      this.readingMs(view, storyWords, pace.steady);
    this.elapsedMs += elapsedMs;
    return { right, elapsedMs };
  }

  /**
   * Time spent reading a story when the simulation models reading: the whole story before the
   * operation step (or before the answer of a story without one, which also takes a second step
   * of thinking, `secondStepMs`), and a quarter of it to find the numbers again before the answer
   * that follows an operation step.
   */
  private readingMs(view: ProblemRoundView, storyWords: number, secondStepMs: number): number {
    const problem = view.problem!;
    if (!this.reading || problem.problem.kind !== 'word') return 0;
    const story = storyWords * this.profile.readingMsPerWord;
    if (problem.step === 'operation') return story;
    if (problem.problem.operation === null) return story + secondStepMs;
    return Math.floor(story / 4);
  }

  /** One practice of key, right or wrong (a wrong answer still shows the right one). */
  practise(key: string, right: boolean): void {
    const memory = this.remember(key);
    const current = this.recall(key);
    const spaced = this.day > memory.last;
    const gain = right ? this.profile.gain : Math.floor(this.profile.gain / 2);
    memory.strength = Math.min(100, current + Math.floor((gain * (100 - current)) / 100));
    if (right && spaced) memory.stability += 1;
    else if (!right)
      memory.stability = Math.max(1, (memory.stability - (memory.stability % 2)) / 2);
    memory.last = this.day;
  }
}
