/**
 * Trace: a 2nd grader's first session in Hundred Hills (docs/grades-plan.md §1.3, §3).
 *
 * A grade-2 child skips the prologue and starts Hundred Hills 1, where the welcome beat offers
 * the three 2nd-grade eggs (Bead, Tumble, Penny). Whichever egg the child chose hatches in that
 * first session, the 3rd- and 1st-grade egg beats never show, and the next glowing step stays in
 * the hills. A child who takes the short grade-2 placement check instead passes Hundred Hills 3
 * and 4 but never the egg level, Hundred Hills 2.
 */
import { describe, expect, it, vi } from 'vitest';
import { PERFECT, Player } from './support';

vi.setConfig({ testTimeout: 300_000 });

/** Walk the pending story: pick `want` when offered, otherwise go on (or skip). */
async function walkStory(player: Player, want: string): Promise<string[]> {
  const beats: string[] = [];
  for (let guard = 0; guard < 20; guard++) {
    const story = player.view().story;
    if (story === null) break;
    if (!beats.includes(story.beat)) beats.push(story.beat);
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
  return beats;
}

/** Play the started run to its end, closing each finished round. */
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

async function secondGrader(name: string): Promise<{ player: Player; opening: string[] }> {
  const player = new Player(PERFECT, name);
  expect(
    await player.act({ type: 'setSetting', setting: { key: 'grade', value: 2 } }),
    player.failures.join(),
  ).toBe(true);
  expect(await player.act({ type: 'startSession', day: '2026-10-06' })).toBe(true);
  return { player, opening: await walkStory(player, '') };
}

async function firstSession(egg: string) {
  const { player, opening } = await secondGrader(`hundred-hills-${egg}`);
  const nextAtStart = player.view().hub.next;
  expect(await player.act({ type: 'startLevel', level: 'hundred-hills.1' })).toBe(true);
  const welcome = await walkStory(player, egg);
  const owned = player.view().dragons.map((d) => [d.id, d.stage]);
  await finishRun(player);
  await walkStory(player, egg);
  const result = {
    opening,
    nextAtStart,
    welcome,
    owned,
    dragons: Object.fromEntries(player.view().dragons.map((d) => [d.id, d.stage])),
    stars: player.state().levels['hundred-hills.1']?.stars ?? 0,
    hatched: player.data('dragon.hatched'),
    failures: [...player.failures],
  };
  await player.dispose();
  return result;
}

describe('a 2nd grader in Hundred Hills', () => {
  for (const egg of ['bead', 'tumble', 'penny']) {
    it(`chooses ${egg} on the hill and sees it hatch in the first session`, async () => {
      const s = await firstSession(egg);
      expect(s.failures).toEqual([]);
      expect(s.opening).not.toContain('beat.first-egg');
      expect(s.opening).not.toContain('beat.pebble-brook-welcome');
      expect(s.nextAtStart).toEqual({ kind: 'placement' });
      expect(s.welcome).toEqual(['beat.hundred-hills-welcome']);
      expect(s.owned).toEqual([[egg, 'egg']]);
      expect(s.stars).toBeGreaterThan(0);
      expect(Object.keys(s.dragons)).toEqual([egg]);
      expect(s.dragons[egg]).not.toBe('egg');
      expect(s.hatched.length).toBe(1);
    });
  }

  it('places a child who knows numbers to 100 past Hundred Hills 3 and 4, never the egg level', async () => {
    const { player } = await secondGrader('hundred-hills-placement');
    expect(await player.act({ type: 'startActivity', activity: { kind: 'placement' } })).toBe(
      true,
    );
    await player.playRound();
    if (player.view().round !== null) await player.act({ type: 'endRound', reason: 'done' });
    await walkStory(player, '');
    const levels = player.state().levels;
    expect(player.failures).toEqual([]);
    expect(Object.keys(levels).sort()).toEqual(['hundred-hills.3', 'hundred-hills.4']);
    expect(player.view().dragons).toEqual([]);
    expect(player.view().hub.next).toEqual({ kind: 'level', level: 'hundred-hills.1' });
    await player.dispose();
  });
});
