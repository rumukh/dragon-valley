/**
 * Input modes: comparisons and terms cannot be typed, so they are answered by choice even in a
 * keypad round; numbers keep the activity's input. A copy of the pack opens Riddle Ruins ahead
 * and makes its term round a keypad round. While recent success is low, re-asks and reviews are
 * asked by choice; a fact missed twice in a row is taught (its picture model shown) before it is
 * asked again.
 */
import { describe, expect, it } from 'vitest';
import type { ContentPack } from '@aegis/runtime';
import { isRuleFact } from '../../../src/rules/learning/selection';
import type { ContentData, ProblemView } from '../../../src/rules/contract';
import { PERFECT, Player, loadPack } from '../../traces/support';

describe('input modes', () => {
  it('answers terms by choice in a keypad round, and numbers on the keypad', async () => {
    const pack: ContentPack<ContentData> = JSON.parse(JSON.stringify(loadPack()));
    const level = pack.data.levels.find((l) => l.id === 'riddle-ruins.4')!;
    level.activities[0]!.input = 'keypad';
    level.activities[0]!.skills = ['terms-all', 'div-2'];
    level.activities[0]!.count = 15;
    const player = new Player(PERFECT, 'input', undefined, pack);
    await player.act({ type: 'startSession', day: '2026-10-06' });
    await player.choose(null);
    await player.choose('sunny');
    await player.act({
      type: 'setSetting',
      setting: { key: 'unlockAhead', value: ['riddle-ruins'] },
    });
    await player.act({ type: 'startLevel', level: 'riddle-ruins.4' });
    await player.settleStory();
    const seen = { term: 0, number: 0 };
    for (let n = 0; n < 15; n++) {
      const round = player.view().round;
      if (round?.type !== 'problems' || !round.problem) break;
      const { problem, input, choices } = round.problem;
      if (problem.kind === 'term') {
        expect([input, choices?.length], `${round.problem.item} is chosen`).toEqual(['choice', 4]);
        seen.term += 1;
      } else {
        expect(input, `${round.problem.item} is typed`).toBe('keypad');
        seen.number += 1;
      }
      await player.answer();
    }
    expect(seen.term, 'terms were asked').toBeGreaterThan(0);
    expect(seen.number, 'divisions were asked').toBeGreaterThan(0);
    await player.dispose();
  });

  it('asks re-asks by choice in a keypad round while recent success is low', async () => {
    const pack: ContentPack<ContentData> = JSON.parse(JSON.stringify(loadPack()));
    const feeding = pack.data.levels.find((l) => l.id === 'sunny-meadow.1')!.activities[1]!;
    feeding.input = 'keypad';
    feeding.count = 12;
    const right = (n: number) => n % 2 === 0;
    const player = new Player(
      { right, elapsedMs: () => 4000, clumsy: false },
      'input-low',
      undefined,
      pack,
    );
    const asked: ProblemView[] = [];
    player.host.subscribeCommits(({ view }) => {
      const problem = view.round?.type === 'problems' ? view.round.problem : null;
      if (problem && asked.at(-1)?.index !== problem.index) asked.push(problem);
    });
    await player.act({ type: 'startSession', day: '2026-10-06' });
    await player.choose(null);
    await player.choose('bubbles');
    await player.playLevel('sunny-meadow.1');
    // The Feeding Time is the day's first problem round: problem i follows i - 1 answers.
    const low = (p: ProblemView) => {
      const before = p.index - 1;
      let correct = 0;
      for (let n = 1; n <= before; n++) if (right(n)) correct += 1;
      return before >= 5 && correct * 100 < 70 * before;
    };
    const lowReasks = asked.filter((p) => p.reask && low(p));
    expect(lowReasks.length, 'misses were re-asked while success was low').toBeGreaterThan(0);
    for (const p of asked) {
      expect(p.input, `problem ${p.index} (${p.reask ? 're-ask' : 'new'})`).toBe(
        p.reask && low(p) ? 'choice' : 'keypad',
      );
    }
    await player.dispose();
  });

  it('teaches a fact missed twice in a row before asking it again', async () => {
    // The first fact served that is not a rule fact (those are served at most once per round).
    let hard: string | null = null;
    const player = new Player(
      {
        right: (_n, view) => {
          const item = view.problem!.item;
          if (hard === null && !isRuleFact(item)) hard = item;
          return item !== hard;
        },
        elapsedMs: () => 1500,
        clumsy: false,
      },
      'teach',
    );
    const asked: ProblemView[] = [];
    player.host.subscribeCommits(({ view }) => {
      const round = view.round?.type === 'problems' ? view.round : null;
      const problem = round?.problem ?? null;
      const last = asked.at(-1);
      if (problem && (last?.index !== problem.index || last.item !== problem.item)) {
        asked.push(problem);
      }
    });
    await player.act({ type: 'startSession', day: '2026-10-06' });
    await player.choose(null);
    await player.choose('bubbles');
    await player.playLevel('sunny-meadow.1');
    for (let replay = 0; replay < 8; replay++) {
      if (asked.filter((p) => p.item === hard).length >= 3) break;
      await player.act({ type: 'startLevel', level: 'sunny-meadow.1', activity: 1 });
      await player.playRound();
      await player.act({ type: 'endRound', reason: 'done' });
    }
    // Every serving of the hard fact is missed: the k-th comes after k misses in a row.
    const servings = asked.filter((p) => p.item === hard);
    expect(servings.length, `${hard} came back`).toBeGreaterThanOrEqual(3);
    expect(servings.map((p) => p.teach === true)).toEqual(servings.map((_, k) => k >= 2));
    expect(asked.filter((p) => p.item !== hard).every((p) => p.teach === undefined)).toBe(true);
    expect(player.failures).toEqual([]);
    await player.dispose();
  });
});
