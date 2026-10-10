/**
 * Trace: a 1st grader's whole year (docs/grades-plan.md §1.3, §3, content 1.6.0).
 *
 * A grade-1 child plays Pebble Brook, then Mushroom Hollow and Rainbow Ford in order. Each region
 * opens after the previous boss; Sprout's egg (Mushroom Hollow's welcome) hatches in Mushroom
 * Hollow 1, Tenzi's (at the start of Rainbow Ford 4) hatches in Rainbow Ford 4; the House Goblin
 * and Kašpárek are won over, Kašpárek ends the 1st grade with its certificate, and the next
 * glowing step is Hundred Hills 1.
 */
import { describe, expect, it, vi } from 'vitest';
import { PERFECT, Player } from './support';

vi.setConfig({ testTimeout: 600_000 });

const LEVELS = (region: string, lessons: number): string[] => [
  ...Array.from({ length: lessons }, (_, i) => `${region}.${i + 1}`),
  `${region}.boss`,
];

/** Walk the pending story: pick `want` when offered, otherwise go on (or skip). */
async function walkStory(player: Player, want: string): Promise<void> {
  for (let guard = 0; guard < 20; guard++) {
    const story = player.view().story;
    if (story === null) break;
    const ids = story.choices.map((c) => c.id);
    const choice = ids.includes(want)
      ? want
      : ids.includes('next')
        ? 'next'
        : story.skippable || ids.length === 0
          ? null
          : ids[0]!;
    if (!(await player.choose(choice))) break;
  }
}

/** Play the started level run to its end, closing each finished round. */
async function finishRun(player: Player): Promise<void> {
  for (let guard = 0; guard < 10; guard++) {
    await player.playRound();
    if (player.view().round === null) break;
    await player.act({ type: 'endRound', reason: 'done' });
    const run = player.view().run;
    if (run === null || run.result !== null) break;
    await player.act({ type: 'startActivity', activity: { kind: 'level', index: run.next } });
  }
}

/** Walk the pending story: pick `want` when offered, otherwise go on (or skip). */
function glowing(player: Player): string[] {
  return player
    .view()
    .hub.regions.flatMap((r) => r.levels)
    .filter((l) => l.glowing)
    .map((l) => l.id);
}

function unlocked(player: Player): string[] {
  return player
    .view()
    .hub.regions.filter((r) => r.unlocked)
    .map((r) => r.id);
}

function stage(player: Player, dragon: string): string | undefined {
  return player.view().dragons.find((d) => d.id === dragon)?.stage;
}

describe('a 1st grader through Mushroom Hollow and Rainbow Ford', () => {
  it('hatches Sprout and Tenzi, wins over both bosses and ends the 1st grade', async () => {
    const player = new Player(PERFECT, 'grade-one-year');
    expect(
      await player.act({ type: 'setSetting', setting: { key: 'grade', value: 1 } }),
      player.failures.join(),
    ).toBe(true);
    let day = 6;
    const newDay = async () => {
      expect(
        await player.act({
          type: 'startSession',
          day: `2026-10-${String(day++).padStart(2, '0')}`,
        }),
      ).toBe(true);
      await player.settleStory();
    };
    await newDay();
    expect(await player.act({ type: 'startLevel', level: 'pebble-brook.1' })).toBe(true);
    await walkStory(player, 'dot');
    await finishRun(player);
    await walkStory(player, 'dot');
    for (const level of LEVELS('pebble-brook', 6).slice(1)) await player.playLevel(level);
    expect(player.data('boss.defeated')).toEqual([{ boss: 'will-o-wisps' }]);
    expect(unlocked(player)).toContain('mushroom-hollow');
    expect(unlocked(player)).not.toContain('rainbow-ford');
    expect(glowing(player)).toEqual(['mushroom-hollow.1']);

    await newDay();
    const eggsBefore = player.count('egg.received');
    await player.playLevel('mushroom-hollow.1');
    expect(player.count('egg.received')).toBe(eggsBefore + 1);
    expect(stage(player, 'sprout'), 'Sprout hatches in Mushroom Hollow 1').not.toBe('egg');
    for (const level of LEVELS('mushroom-hollow', 6).slice(1)) await player.playLevel(level);
    expect(player.data('boss.defeated')).toContainEqual({ boss: 'skritek' });
    expect(player.data('grade.completed')).toEqual([]);
    expect(unlocked(player)).toContain('rainbow-ford');
    expect(glowing(player)).toEqual(['rainbow-ford.1']);

    await newDay();
    for (const level of LEVELS('rainbow-ford', 6).slice(0, 3)) await player.playLevel(level);
    expect(stage(player, 'tenzi')).toBeUndefined();
    await player.playLevel('rainbow-ford.4');
    expect(stage(player, 'tenzi'), 'Tenzi hatches in Rainbow Ford 4').not.toBe('egg');
    await newDay();
    for (const level of ['rainbow-ford.5', 'rainbow-ford.6', 'rainbow-ford.boss']) {
      await player.playLevel(level);
    }
    expect(player.data('boss.defeated')).toContainEqual({ boss: 'kasparek' });
    expect(player.data('grade.completed')).toEqual([{ grade: 1 }]);
    expect(player.view().hub.certificates).toEqual([1]);
    expect(unlocked(player)).toContain('hundred-hills');
    expect(glowing(player)).toEqual(['hundred-hills.1']);

    const levels = player.state().levels;
    for (const level of [...LEVELS('mushroom-hollow', 6), ...LEVELS('rainbow-ford', 6)]) {
      expect(levels[level]?.stars ?? 0, level).toBeGreaterThan(0);
    }
    expect(player.failures).toEqual([]);
    await player.dispose();
  });
});
