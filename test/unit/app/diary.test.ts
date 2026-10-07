/**
 * The Dragon Diary on the real rules: a keeper's day begins with a baseline (the facts that
 * shine and how far each dragon grew), and the diary is the difference with the view at goodbye,
 * plus the stickers earned that day. The day record that keeps the baseline is a plain, strictly
 * checked record apart from the game save.
 */
import { MemorySaveStorage } from '@aegis/browser/save';
import { describe, expect, it, vi } from 'vitest';
import { diaryOf, isEmptyDiary } from '../../../src/app/game/diary';
import { dayBaseline, DayStore, isDayRecord } from '../../../src/app/persistence/day';
import { PERFECT, Player } from '../../traces/support';

vi.setConfig({ testTimeout: 300_000 });

async function firstDay(): Promise<Player> {
  const player = new Player(PERFECT, 'diary');
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('bubbles');
  return player;
}

describe('the Dragon Diary', () => {
  it('tells what a day brought: facts that began to shine, dragons that grew, stickers', async () => {
    const player = await firstDay();
    const baseline = dayBaseline('2026-10-06', player.view());
    expect(isEmptyDiary(diaryOf(player.view(), baseline)), 'nothing yet').toBe(true);

    await player.playLevel('sunny-meadow.1');
    await player.playLevel('sunny-meadow.2');
    const view = player.view();
    const diary = diaryOf(view, baseline);
    const shining = [...view.window.cells, ...view.window.division].filter(
      (cell) => cell.level !== 'dim',
    );
    expect(diary.facts).toEqual(shining.map((cell) => cell.item));
    expect(diary.facts.length, 'facts begin to shine on the first day').toBeGreaterThan(0);
    expect(diary.dragons, 'the first egg hatched today').toContainEqual({
      id: 'bubbles',
      stage: expect.not.stringMatching(/^egg$/),
    });
    const earned = view.album.pages
      .flatMap((page) => page.stickers)
      .filter((sticker) => sticker.earned)
      .map((sticker) => sticker.id);
    expect(diary.stickers).toEqual(earned);
    expect(earned.length).toBeGreaterThan(0);

    // The next day starts from where the last one ended: yesterday is not told again.
    await player.act({ type: 'startSession', day: '2026-10-07' });
    const tomorrow = dayBaseline('2026-10-07', player.view());
    expect(isEmptyDiary(diaryOf(player.view(), tomorrow))).toBe(true);
    expect(diaryOf(player.view(), baseline), 'a baseline from another day tells nothing').toEqual({
      facts: [],
      dragons: [],
      stickers: [],
    });
    await player.dispose();
  });

  it('does not count an egg that only arrived as grown', async () => {
    const player = await firstDay();
    const baseline = { ...dayBaseline('2026-10-06', player.view()), stages: {} };
    const diary = diaryOf(player.view(), baseline);
    expect(player.view().dragons.find((dragon) => dragon.id === 'bubbles')?.stage).toBe('egg');
    expect(diary.dragons).toEqual([]);
    await player.dispose();
  });
});

describe('the day record', () => {
  const record = { day: '2026-10-06', lit: ['mul:2x3', 'div:6:2'], stages: { bubbles: 'egg' } };

  it('accepts exactly a day, its shining facts and dragon stages', () => {
    expect(isDayRecord(record)).toBe(true);
    expect(isDayRecord({ ...record, extra: 1 })).toBe(false);
    expect(isDayRecord({ ...record, day: '6.10.2026' })).toBe(false);
    expect(isDayRecord({ ...record, lit: ['mul:2x3', 'mul:2x3'] })).toBe(false);
    expect(isDayRecord({ ...record, lit: ['<b>'] })).toBe(false);
    expect(isDayRecord({ ...record, stages: { bubbles: 'giant' } })).toBe(false);
  });

  it('keeps one baseline per day and survives a new page', async () => {
    const storage = new MemorySaveStorage();
    const player = await firstDay();
    const store = new DayStore(storage, 'profile-1');
    expect(await store.open()).toBeUndefined();
    await store.begin('2026-10-06', player.view());
    const first = store.current();
    expect(first?.day).toBe('2026-10-06');
    await player.playLevel('sunny-meadow.1');
    await store.begin('2026-10-06', player.view());
    expect(store.current(), 'the day keeps its first baseline').toBe(first);

    const again = new DayStore(storage, 'profile-1');
    expect(await again.open()).toEqual(first);
    await again.begin('2026-10-07', player.view());
    expect(again.current()?.day).toBe('2026-10-07');
    await player.dispose();
  });

  it('replaces a record it cannot read instead of asking a grown-up', async () => {
    const storage = new MemorySaveStorage();
    const store = new DayStore(storage, 'profile-1');
    await store.open();
    const player = await firstDay();
    await store.begin('2026-10-06', player.view());
    const key = { gameId: 'dragon-valley-day', profileId: 'profile-1' };
    const history = await storage.read(key);
    await storage.compareAndSwap(key, history.current!.revision, {
      revision: history.current!.revision + 1,
      payload: '{ not json',
    });
    const broken = new DayStore(storage, 'profile-1');
    expect(await broken.open()).toBeUndefined();
    expect((await storage.read(key)).current, 'the unreadable record is gone').toBeUndefined();
    await broken.begin('2026-10-06', player.view());
    expect(broken.current()?.day).toBe('2026-10-06');
    await player.dispose();
  });
});
