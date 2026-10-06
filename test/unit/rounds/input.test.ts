/**
 * Input modes: comparisons and terms cannot be typed, so they are answered by choice even in a
 * keypad round; numbers keep the activity's input. A copy of the pack opens Riddle Ruins ahead
 * and makes its term round a keypad round.
 */
import { describe, expect, it } from 'vitest';
import type { ContentPack } from '@aegis/runtime';
import type { ContentData } from '../../../src/rules/contract';
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
});
