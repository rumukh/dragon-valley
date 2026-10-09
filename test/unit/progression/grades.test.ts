/**
 * The grades 1-3 rules (docs/grades-plan.md, docs/design.md §12) on a fixture pack (grade-pack.ts):
 * where each grade starts and what is open to it, what the map suggests, the grade filters of
 * story beats and placement steps, the catch-up egg, grade certificates, the Sun Window and the
 * per-grade balance.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ContentPack } from '@aegis/runtime';
import { dragonValleyAdapter } from '../../../src/rules/adapter';
import { gradeBalance } from '../../../src/rules/contract';
import type { ContentData, Grade } from '../../../src/rules/contract';
import { PERFECT, Player, loadPack } from '../../traces/support';
import { GRADE_STARTS, gradePack } from './grade-pack';

vi.setConfig({ testTimeout: 120_000 });

async function child(
  grade: Grade,
  pack: ContentPack<ContentData> = gradePack(),
  seed = 'grades',
): Promise<Player> {
  const player = new Player(PERFECT, seed, dragonValleyAdapter, pack);
  expect(
    await player.act({ type: 'setSetting', setting: { key: 'grade', value: grade } }),
    player.failures.join(),
  ).toBe(true);
  expect(await player.act({ type: 'startSession', day: '2026-10-06' })).toBe(true);
  return player;
}

const unlocked = (player: Player) =>
  player
    .view()
    .hub.regions.filter((r) => r.unlocked)
    .map((r) => r.id);

describe('the grade setting', () => {
  it('may be set before the first session, so its story already knows the grade', async () => {
    const player = await child(1);
    expect(player.state().settings.grade).toBe(1);
    expect(player.view().story?.beat).toBe('beat.prologue');
    await player.dispose();
  });

  it('is the only setting allowed before a session', async () => {
    const player = new Player(PERFECT, 'grades', dragonValleyAdapter, gradePack());
    expect(
      await player.reject(
        { type: 'setSetting', setting: { key: 'arena', value: false } },
        'no-session',
      ),
    ).toBe(true);
    await player.dispose();
  });
});

describe('regions open per grade', () => {
  it('a 1st grader starts at the 1st grade region; later grades stay locked', async () => {
    const player = await child(1);
    expect(unlocked(player)).toEqual([GRADE_STARTS[1]]);
    await player.dispose();
  });

  it('a 2nd grader has its start open and the 1st grade region as free practice', async () => {
    const player = await child(2);
    expect(unlocked(player)).toEqual([GRADE_STARTS[1], GRADE_STARTS[2]]);
    const meadow = player.view().hub.regions.find((r) => r.id === GRADE_STARTS[1])!;
    expect(meadow.levels[0]!.status, 'its first lesson is playable').toBe('open');
    expect(meadow.levels[1]!.status, 'its lessons still come in order').toBe('locked');
    await player.dispose();
  });

  it('a 3rd grader has every earlier grade open and its start, not the regions after it', async () => {
    const player = await child(3);
    expect(unlocked(player)).toEqual([GRADE_STARTS[1], GRADE_STARTS[2], GRADE_STARTS[3]]);
    await player.dispose();
  });

  it('a grade change only moves the start and the suggestions; progress stays', async () => {
    const player = await child(1);
    await player.settleStory();
    await player.choose('bubbles');
    await player.playLevel('sunny-meadow.1');
    expect(player.state().levels['sunny-meadow.1']?.stars).toBeGreaterThan(0);
    const coins = player.state().coins;
    expect(
      await player.act({ type: 'setSetting', setting: { key: 'grade', value: 2 } }),
      player.failures.join(),
    ).toBe(true);
    expect(unlocked(player)).toEqual([GRADE_STARTS[1], GRADE_STARTS[2]]);
    expect(player.state().levels['sunny-meadow.1']?.stars).toBeGreaterThan(0);
    expect(player.state().coins).toBe(coins);
    expect(player.state().dragons['bubbles']).toBeDefined();
    await player.dispose();
  });
});

describe('the suggested next level', () => {
  it('starts at the grade start region and never suggests an earlier grade', async () => {
    for (const grade of [1, 2, 3] as const) {
      const player = await child(grade);
      await player.settleStory();
      await player.choose('bubbles');
      await player.settleStory();
      const glowing = player
        .view()
        .hub.regions.flatMap((r) => r.levels)
        .filter((l) => l.glowing)
        .map((l) => l.id);
      expect(glowing, `grade ${grade}`).toEqual([`${GRADE_STARTS[grade]}.1`]);
      await player.dispose();
    }
  });

  it('is unchanged for the shipped 3rd-grade pack', async () => {
    const player = await child(3, loadPack());
    expect(unlocked(player)).toEqual(['sunny-meadow']);
    await player.dispose();
  });
});

describe('grade filters', () => {
  it('skip story beats whose trigger names other grades', async () => {
    const pack = gradePack((data) => {
      data.story.beats.find((b) => b.id === 'beat.first-egg')!.trigger.grades = [3];
      data.story.beats.find((b) => b.id === 'beat.meadow-welcome')!.trigger.grades = [2, 3];
    });
    const first = await child(1, pack);
    await first.settleStory();
    expect(first.view().story, 'no first-egg choice for a 1st grader').toBeNull();
    expect(await first.act({ type: 'startLevel', level: 'sunny-meadow.1' })).toBe(true);
    expect(first.view().story, 'no meadow welcome for a 1st grader').toBeNull();
    await first.dispose();

    const third = await child(3, pack);
    await third.settleStory();
    expect(third.view().story?.beat).toBe('beat.first-egg');
    await third.dispose();
  });

  it('run only the grade’s placement ladder: none for grade 1, its own for 2 and 3', async () => {
    const first = await child(1);
    await first.settleStory();
    await first.choose('bubbles');
    expect(first.view().hub.next.kind, 'no placement for a 1st grader').not.toBe('placement');
    expect(
      await first.reject(
        { type: 'startActivity', activity: { kind: 'placement' } },
        'locked-activity',
      ),
      first.failures.join(),
    ).toBe(true);
    await first.dispose();

    const second = await child(2);
    await second.settleStory();
    await second.choose('bubbles');
    expect(second.view().hub.next).toEqual({ kind: 'placement' });
    expect(await second.act({ type: 'startActivity', activity: { kind: 'placement' } })).toBe(true);
    const round = second.view().round;
    expect(round?.type === 'problems' && round.placement?.steps).toBe(2);
    await second.playRound();
    expect(second.data('placement.completed')).toEqual([
      { placed: ['whispering-woods.2', 'whispering-woods.3', 'whispering-woods.4'] },
    ]);
    await second.dispose();

    const third = await child(3);
    await third.settleStory();
    await third.choose('bubbles');
    expect(await third.act({ type: 'startActivity', activity: { kind: 'placement' } })).toBe(true);
    const ladder = third.view().round;
    expect(ladder?.type === 'problems' && ladder.placement?.steps).toBe(4);
    await third.dispose();
  });

  it('refuse a grade change in the middle of the placement check', async () => {
    const player = await child(3);
    await player.settleStory();
    await player.choose('bubbles');
    await player.act({ type: 'startActivity', activity: { kind: 'placement' } });
    expect(
      await player.reject(
        { type: 'setSetting', setting: { key: 'grade', value: 2 } },
        'round-active',
      ),
    ).toBe(true);
    await player.dispose();
  });
});

describe('the catch-up egg', () => {
  it('is the 3rd grade start region’s first story egg for a child who has none of its eggs', async () => {
    const player = await child(3);
    await player.settleStory();
    await player.choose('bubbles');
    expect(await player.act({ type: 'startLevel', level: 'fire-mountain.1' })).toBe(true);
    expect(player.data('egg.received')).toContainEqual({ dragon: 'ember' });
    expect(player.state().dragons['ember']?.stage).toBe('egg');
    await player.dispose();
  });

  it('is not given to a child who already has an egg of that region, nor in the shipped pack', async () => {
    const pack = gradePack((data) => {
      data.levels.find((l) => l.id === 'whispering-woods.1')!.rewards.eggs = ['ember'];
    });
    const player = await child(2, pack);
    await player.settleStory();
    await player.choose('bubbles');
    await player.playLevel('whispering-woods.1');
    expect(player.state().dragons['ember']).toBeDefined();
    await player.act({ type: 'setSetting', setting: { key: 'grade', value: 3 } });
    const before = player.count('egg.received');
    expect(await player.act({ type: 'startLevel', level: 'fire-mountain.1' })).toBe(true);
    expect(player.count('egg.received')).toBe(before);
    await player.dispose();

    const shipped = await child(3, loadPack());
    await shipped.settleStory();
    await shipped.choose('bubbles');
    const eggs = shipped.count('egg.received');
    await shipped.act({ type: 'startLevel', level: 'sunny-meadow.1' });
    expect(shipped.count('egg.received')).toBe(eggs);
    await shipped.dispose();
  });
});

describe('grade certificates', () => {
  it('come with the last boss of an earlier grade, once, and show on the hub', async () => {
    const player = await child(1);
    await player.settleStory();
    await player.choose('bubbles');
    expect(player.view().hub.certificates).toEqual([]);
    await player.act({
      type: 'setSetting',
      setting: { key: 'unlockAhead', value: [GRADE_STARTS[1]] },
    });
    await player.playLevel('sunny-meadow.boss');
    expect(player.data('boss.defeated')).toEqual([{ boss: 'bridge-troll' }]);
    expect(player.data('grade.completed')).toEqual([{ grade: 1 }]);
    expect(player.view().hub.certificates).toEqual([1]);
    await player.playLevel('sunny-meadow.boss');
    expect(player.count('grade.completed'), 'a replay earns no second certificate').toBe(1);
    await player.dispose();
  });

  it('do not exist for the 3rd grade', async () => {
    const pack = gradePack((data) => {
      data.balance.arena.unlockAfter = 'fire-mountain.boss';
    });
    const player = await child(3, pack);
    await player.settleStory();
    await player.choose('bubbles');
    await player.act({
      type: 'setSetting',
      setting: { key: 'unlockAhead', value: ['fire-mountain'] },
    });
    await player.playLevel('fire-mountain.boss');
    expect(player.count('boss.defeated')).toBe(1);
    expect(player.count('grade.completed')).toBe(0);
    await player.dispose();
  });
});

describe('the Sun Window', () => {
  it('shows 121 addition panes and 121 subtraction panes, like the Magic Window', async () => {
    const player = await child(1);
    const sun = player.view().sunWindow;
    expect(sun.size).toBe(11);
    expect(sun.cells).toHaveLength(121);
    expect(sun.subtraction).toHaveLength(121);
    expect(sun.cells[0]).toMatchObject({ item: 'add:0+0', row: 0, column: 0, level: 'dim' });
    expect(sun.cells[13]).toMatchObject({ item: 'add:1+2', row: 1, column: 2 });
    expect(sun.subtraction[13]).toMatchObject({ item: 'sub:3-1', row: 1, column: 2 });
    expect(sun.subtraction[120]).toMatchObject({ item: 'sub:20-10', row: 10, column: 10 });
    expect(sun.counts.dim).toBe(121);
    await player.dispose();
  });
});

describe('the per-grade balance', () => {
  it('overrides response limits and choices for a grade, and nothing for the others', () => {
    const balance = loadPack().data.balance;
    expect(gradeBalance(balance, 3)).toBe(balance);
    const younger = {
      ...balance,
      grades: [{ grade: 1 as const, choice: { fastMs: 9000, okMs: 20000 }, choices: 3 }],
    };
    const first = gradeBalance(younger, 1);
    expect(first.response.choice).toEqual({ fastMs: 9000, okMs: 20000 });
    expect(first.response.keypad).toEqual(balance.response.keypad);
    expect(first.input.choices).toBe(3);
    expect(gradeBalance(younger, 2)).toBe(younger);
  });

  it('is optional in the content and validated when present', () => {
    expect(() => gradePack()).not.toThrow();
    expect(() =>
      gradePack((data) => {
        data.balance.grades = [{ grade: 1, choices: 3 }];
      }),
    ).not.toThrow();
    expect(() =>
      gradePack((data) => {
        data.balance.grades = [
          { grade: 1, choices: 3 },
          { grade: 1, choices: 2 },
        ];
      }),
    ).toThrow();
    expect(() =>
      gradePack((data) => {
        data.balance.grades = [{ grade: 1, choices: 9 }];
      }),
    ).toThrow();
  });

  it('times a younger child’s answers with its own limits', async () => {
    const pack = gradePack((data) => {
      data.balance.grades = [
        {
          grade: 1,
          choice: { fastMs: 60_000, okMs: 120_000 },
          keypad: { fastMs: 60_000, okMs: 120_000, perExtraDigitMs: 0 },
        },
      ];
    });
    const slowStyle = { ...PERFECT, elapsedMs: () => 30_000 };
    const player = new Player(slowStyle, 'grades', dragonValleyAdapter, pack);
    await player.act({ type: 'setSetting', setting: { key: 'grade', value: 1 } });
    await player.act({ type: 'startSession', day: '2026-10-06' });
    await player.settleStory();
    await player.choose('bubbles');
    await player.playLevel('sunny-meadow.1');
    const buckets = player.data('answer.correct').map((d) => (d as { bucket: string }).bucket);
    expect(buckets.length).toBeGreaterThan(0);
    expect(new Set(buckets)).toEqual(new Set(['fast']));
    await player.dispose();
  });
});
