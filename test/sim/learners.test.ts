/**
 * The synthetic learners behave like the children they model: the same seed answers the same
 * way, practice raises recall, time without practice lowers it, spaced successes slow the
 * forgetting, and the perfect and slow learners are as quick or slow as their names say.
 */
import { describe, expect, it } from 'vitest';
import { BLANK, num, op } from '../../src/rules/contract';
import type { ProblemRoundView } from '../../src/rules/contract';
import { LEARNERS, Learner, knowledgeKey } from './learners';

/** A problem round view showing `a · b = ?` with choice or keypad input. */
function showing(a: number, b: number, input: 'choice' | 'keypad' = 'choice'): ProblemRoundView {
  return {
    problem: {
      index: 1,
      item: `mul:${a}x${b}`,
      problem: { kind: 'equation', left: op('mul', num(a), num(b)), right: BLANK },
      input,
      choices: input === 'choice' ? [{ kind: 'number', value: a * b }] : null,
      step: 'answer',
      reask: false,
      hinted: false,
    },
  } as unknown as ProblemRoundView;
}

describe('knowledge keys', () => {
  it('treats 7 · 8 and 8 · 7 as one fact, 56 : 7 as another, and buckets as skills', () => {
    expect(knowledgeKey('mul:7x8')).toBe(knowledgeKey('mul:8x7'));
    expect(knowledgeKey('div:56:7')).not.toBe(knowledgeKey('mul:7x8'));
    expect(knowledgeKey('word:times-fewer')).toBe('word:times-fewer');
  });
});

describe('learners', () => {
  it('answers the same way from the same seed', () => {
    const run = (seed: string) => {
      const child = new Learner(LEARNERS.average, seed);
      return Array.from({ length: 40 }, (_, i) => child.respond(showing(i % 10, 7, 'keypad')));
    };
    expect(run('same')).toEqual(run('same'));
    expect(run('same')).not.toEqual(run('other'));
  });

  it('recalls a fact better after practice and worse after days without it', () => {
    const child = new Learner(LEARNERS.average, 'practice');
    child.day = 100;
    const before = child.recall('x:7x8');
    for (let i = 0; i < 6; i++) child.respond(showing(7, 8));
    const practised = child.recall('x:7x8');
    expect(practised, `recall ${before} -> ${practised} after practice`).toBeGreaterThan(before);
    child.day = 110;
    expect(child.recall('x:7x8'), 'ten days later').toBeLessThan(practised);
  });

  it('forgets more slowly after spaced successes', () => {
    const sure = { ...LEARNERS.average, prior: () => 100, gain: 100 };
    const spacedOut = new Learner(sure, 'spaced');
    for (let day = 100; day <= 103; day++) {
      spacedOut.day = day;
      spacedOut.respond(showing(6, 7));
    }
    const once = new Learner(sure, 'once');
    once.day = 103;
    once.respond(showing(6, 7));
    spacedOut.day = 140;
    once.day = 140;
    expect(spacedOut.recall('x:6x7'), 'four spaced days').toBeGreaterThan(once.recall('x:6x7'));
  });

  it('forgets faster again after a miss', () => {
    const steady = new Learner(LEARNERS.average, 'steady');
    const missed = new Learner(LEARNERS.average, 'missed');
    for (const child of [steady, missed]) {
      for (let day = 100; day <= 104; day++) {
        child.day = day;
        child.practise('x:6x7', true);
      }
    }
    missed.practise('x:6x7', false);
    steady.practise('x:6x7', true);
    steady.day = 124;
    missed.day = 124;
    expect(missed.recall('x:6x7'), 'a miss halves how long the fact lasts').toBeLessThan(
      steady.recall('x:6x7') - 5,
    );
  });

  it('keeps knowledge from earlier grades longer than a fact learned today', () => {
    const child = new Learner(LEARNERS.average, 'consolidated');
    child.day = 100;
    const review = child.recall('x:2x7');
    const fresh = new Learner({ ...LEARNERS.average, prior: () => 0 }, 'fresh');
    fresh.day = 100;
    for (let i = 0; i < 12 && fresh.recall('x:2x7') < review; i++) fresh.respond(showing(2, 7));
    const learned = fresh.recall('x:2x7');
    child.day = 120;
    fresh.day = 120;
    expect(review - child.recall('x:2x7'), 'a 2nd-grade fact fades a little').toBeLessThan(
      learned - fresh.recall('x:2x7'),
    );
  });

  it('is quick when perfect and never quick when slow, even on facts it knows well', () => {
    const perfect = new Learner(LEARNERS.perfect, 'quick');
    const slow = new Learner(LEARNERS.slow, 'slow');
    for (let i = 0; i < 40; i++) {
      expect(perfect.respond(showing(i % 11, 3))).toEqual({ right: true, elapsedMs: 1500 });
      // The quick limits of the default balance: choice 2.5 s, keypad 3.5 s + 0.7 s per digit.
      expect(slow.respond(showing(i % 11, 3)).elapsedMs).toBeGreaterThan(2500);
      expect(slow.respond(showing(i % 11, 3, 'keypad'), 2).elapsedMs).toBeGreaterThan(4200);
    }
    // Practised facts come to mind, so the slow child answers them within the "ok" limits.
    const known = new Learner({ ...LEARNERS.slow, prior: () => 100 }, 'known');
    expect(known.respond(showing(7, 8)).elapsedMs).toBeLessThanOrEqual(6000);
    expect(known.respond(showing(7, 8, 'keypad'), 2).elapsedMs).toBeLessThanOrEqual(8700);
  });

  it('types each digit on the keypad', () => {
    const child = new Learner({ ...LEARNERS.average, prior: () => 100 }, 'typing');
    const one = child.respond(showing(2, 3, 'keypad'), 1).elapsedMs;
    const three = child.respond(showing(2, 3, 'keypad'), 3).elapsedMs;
    expect(three - one).toBe(2 * LEARNERS.average.typingMs);
    expect(child.elapsedMs).toBe(one + three);
  });

  it('reads a story only when reading is modelled: all of it before the first step', () => {
    /** A 20-word story about `3 · 4`, at its operation step or its answer (with or without one). */
    const story = (step: 'operation' | 'answer', operation: 'mul' | null): ProblemRoundView =>
      ({
        problem: {
          index: 1,
          item: 'word:times',
          problem: {
            kind: 'word',
            template: 'word.times.fruit',
            vars: {},
            model: { kind: 'equation', left: op('mul', num(3), num(4)), right: BLANK },
            operation,
          },
          input: 'choice',
          choices: [{ kind: 'number', value: 12 }],
          step,
          reask: false,
          hinted: false,
        },
      }) as unknown as ProblemRoundView;
    const profile = LEARNERS.average;
    const read = profile.readingMsPerWord * 20;
    const extra = (view: ProblemRoundView) => {
      const reader = new Learner(profile, 'story', true);
      const plain = new Learner(profile, 'story');
      return reader.respond(view, 2, 20).elapsedMs - plain.respond(view, 2, 20).elapsedMs;
    };
    expect(extra(story('operation', 'mul')), 'the whole story before the operation').toBe(read);
    expect(extra(story('answer', 'mul')), 'a quarter of it to find the numbers').toBe(read / 4);
    expect(extra(story('answer', null)), 'a story answered whole: read and two steps').toBe(
      read + profile.choice.steady,
    );
    expect(extra(showing(3, 4)), 'no story, nothing to read').toBe(0);
    const perfect = new Learner(LEARNERS.perfect, 'story', true);
    expect(perfect.respond(story('answer', null), 2, 20).elapsedMs).toBe(
      1500 + LEARNERS.perfect.readingMsPerWord * 20 + 1500,
    );
  });
});
