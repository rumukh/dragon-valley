/**
 * Trace: a 1st grader's first session in Pebble Brook (docs/grades-plan.md §1.3, §3).
 *
 * A grade-1 child skips the prologue, starts Pebble Brook 1, meets the brook, chooses one of
 * the three 1st-grade eggs (Dot, Hop or Nibble) and plays the level. Whichever egg the child
 * chose hatches in that first session. The 3rd-grade egg beat never shows for a 1st grader, and
 * the next glowing level after Pebble Brook 1 stays in the brook.
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

async function firstSession(egg: string) {
  const player = new Player(PERFECT, `pebble-brook-${egg}`);
  expect(
    await player.act({ type: 'setSetting', setting: { key: 'grade', value: 1 } }),
    player.failures.join(),
  ).toBe(true);
  expect(await player.act({ type: 'startSession', day: '2026-10-06' })).toBe(true);
  const opening = await walkStory(player, egg);
  const nextAtStart = player.view().hub.next;
  expect(await player.act({ type: 'startLevel', level: 'pebble-brook.1' })).toBe(true);
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
    stars: player.state().levels['pebble-brook.1']?.stars ?? 0,
    next: player.view().hub.next,
    hatched: player.data('dragon.hatched'),
    failures: [...player.failures],
  };
  await player.dispose();
  return result;
}

describe('a 1st grader in Pebble Brook', () => {
  for (const egg of ['dot', 'hop', 'nibble']) {
    it(`chooses ${egg} at the brook and sees it hatch in the first session`, async () => {
      const s = await firstSession(egg);
      expect(s.failures).toEqual([]);
      expect(s.opening).not.toContain('beat.first-egg');
      expect(s.nextAtStart).toEqual({ kind: 'level', level: 'pebble-brook.1' });
      expect(s.welcome).toEqual(['beat.pebble-brook-welcome']);
      expect(s.owned).toEqual([[egg, 'egg']]);
      expect(s.stars).toBeGreaterThan(0);
      expect(Object.keys(s.dragons)).toEqual([egg]);
      expect(s.dragons[egg]).not.toBe('egg');
      expect(s.hatched.length).toBe(1);
      expect(s.next).toEqual({ kind: 'level', level: 'pebble-brook.2' });
    });
  }
});

describe('Ten Frame in Pebble Brook 5', () => {
  it('deals add-within-10 boards a 1st grader fills and completes with three stars', async () => {
    const player = new Player(PERFECT, 'pebble-brook-ten-frame');
    await player.act({ type: 'setSetting', setting: { key: 'grade', value: 1 } });
    await player.act({ type: 'startSession', day: '2026-10-06' });
    await walkStory(player, 'hop');
    await player.act({ type: 'startLevel', level: 'pebble-brook.1' });
    await walkStory(player, 'hop');
    await finishRun(player);
    await walkStory(player, 'hop');
    for (const level of [2, 3, 4]) await player.playLevel(`pebble-brook.${level}`);
    expect(await player.act({ type: 'startLevel', level: 'pebble-brook.5' })).toBe(true);
    const tasks: string[] = [];
    for (let guard = 0; guard < 10; guard++) {
      const round = player.view().round;
      if (round?.type === 'minigame' && round.current.kind === 'ten-frame') {
        for (let board = 0; board < 5; board++) {
          const now = player.view().round;
          if (now?.type !== 'minigame' || now.status !== 'active') break;
          if (now.current.kind === 'ten-frame') tasks.push(now.current.task);
          await player.playBoard();
        }
      }
      await player.playRound();
      if (player.view().round === null) break;
      await player.act({ type: 'endRound', reason: 'done' });
      const run = player.view().run;
      if (run === null || run.result !== null) break;
      await player.act({ type: 'startActivity', activity: { kind: 'level', index: run.next } });
    }
    expect(player.failures).toEqual([]);
    expect(tasks.length).toBe(2);
    expect(
      tasks.every((task) => task === 'show' || task === 'make-ten'),
      tasks.join(),
    ).toBe(true);
    expect(player.state().levels['pebble-brook.5']?.stars).toBe(3);
    await player.dispose();
  });
});
