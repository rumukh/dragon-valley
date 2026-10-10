/**
 * A save on content 1.2.0 moves to a pack with the effort path (docs/design.md §6.5).
 *
 * `fixtures/effort-save.json` is a real save on 1.2.0, made with main 5d98ee3's rules by playing
 * with the trace harness: a steady child (9 s answers, every fifth one wrong) played on
 * 2026-10-06, -08 and -10 and stopped at the hub. It is the snapshot of its last commit. It has no
 * counts: 47 of its 56 facts were answered right but stay dim by the Leitner box.
 *
 * The current rules restore it exactly as saved, with its own pack. The next pack (1.3.0 once it
 * ships; until then 1.2.0 with the effort path) activates at the hub and changes nothing by
 * itself: no count is made up, and every pane and dragon stays as it was. Counting starts with the
 * next right answers, from 0, so two sessions two days apart give a fact still in box 0 or 1 a
 * bronze pane.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { dataHash } from '@aegis/runtime';
import type { ContentPack, RuntimeSnapshot } from '@aegis/runtime';
import { migrateSnapshot } from '../../src/rules/contract';
import type { ContentData, GameView, ProfileState } from '../../src/rules/contract';
import { Player, loadPack, root } from '../traces/support';
import type { Style } from '../traces/support';

// Whole sessions are replayed here with the full content pack: give them room on a busy machine.
vi.setConfig({ testTimeout: 300_000 });

/** Content 1.2.0: archived once a later revision ships, the current pack until then. */
const ARCHIVED = join('content', 'history', '1.2.0.json');
const saved = existsSync(join(root, ARCHIVED)) ? loadPack(ARCHIVED) : loadPack();
const save = migrateSnapshot(
  JSON.parse(
    readFileSync(join(root, 'test', 'migration', 'fixtures', 'effort-save.json'), 'utf8'),
  ) as RuntimeSnapshot,
);

/** The pack the save moves to: the current one once it has the effort path, else 1.2.0 with it. */
function next(): ContentPack<ContentData> {
  const current = loadPack();
  if (current.data.balance.mastery.effort !== undefined) return current;
  const base = JSON.parse(JSON.stringify(saved)) as ContentPack<ContentData>;
  const pack: ContentPack<ContentData> = { ...base, revision: '1.3.0' };
  pack.data.balance.mastery.effort = { bronzeDays: 2, silverDays: 4, gapDays: 2 };
  return pack;
}

/** After the upgrade the child answers every problem right, slowly: no box moves up. */
const STEADY: Style = { right: () => true, elapsedMs: () => 12_000, clumsy: false };

async function restored(): Promise<Player> {
  const player = new Player(STEADY, 'effort-save', undefined, saved);
  expect(player.host.stageContent(next()).ok, 'the next pack staged beside it').toBe(true);
  const outcome = await player.host.restore(save);
  expect(outcome.ok, outcome.ok ? '' : outcome.error.code).toBe(true);
  player.turn = player.host.inspect().turn;
  return player;
}

/** Every pane's level, the window's and the division panel's. */
const panes = (view: GameView) =>
  Object.fromEntries(
    [...view.window.cells, ...view.window.division].map((cell) => [cell.item, cell.level]),
  );

/** Each dragon's stage and mastery shares. */
const dragons = (view: GameView) =>
  Object.fromEntries(view.dragons.map((d) => [d.id, { stage: d.stage, mastery: d.mastery }]));

/** Follow the Daily Adventure on `day`: snack time and the next levels, a few steps. */
async function playDay(player: Player, day: string): Promise<void> {
  expect(await player.act({ type: 'startSession', day })).toBe(true);
  for (let step = 0; step < 3; step++) {
    await player.settleStory();
    const nextUp = player.view().hub.next;
    if (nextUp.kind === 'snack') {
      await player.act({
        type: 'startActivity',
        activity: { kind: 'snack', dragon: nextUp.dragon },
      });
      await player.playRound();
      await player.act({ type: 'endRound', reason: 'done' });
    } else if (nextUp.kind === 'level') await player.playLevel(nextUp.level);
    else break;
  }
  await player.settleStory();
}

describe('a 1.2.0 save moving to the effort path', () => {
  it('restores exactly as saved, with no counts', async () => {
    expect(save.content).toMatchObject({ revision: '1.2.0', hash: '69494a787c9bab06' });
    expect(dataHash(saved), 'the pack it was saved with').toBe('69494a787c9bab06');
    const player = await restored();
    expect(player.host.hash(), 'the restored game is the saved game').toBe(dataHash(save));
    const records = Object.values(player.state().items);
    expect(records).toHaveLength(56);
    expect(
      records.filter((r) => r.rightDays !== undefined || r.lastCountedDay !== undefined),
    ).toEqual([]);
    expect(
      records.filter((r) => r.box <= 1 && r.correct > 0),
      'right, but dim by the box',
    ).toHaveLength(47);
    await player.dispose();
  });

  it('activates the effort path at the hub and changes nothing by itself', async () => {
    const player = await restored();
    const state = structuredClone(player.state()) as ProfileState;
    const view = player.host.getView();
    expect((await player.host.activateContent(next(), 'boundary')).ok).toBe(true);
    expect(player.host.inspect().content.data.balance.mastery.effort).toBeDefined();
    expect(player.state().items, 'no count is made up').toEqual(state.items);
    expect(player.state().dragons).toEqual(state.dragons);
    const after = player.host.getView();
    expect(panes(after), 'every pane as it was').toEqual(panes(view));
    expect(dragons(after), 'every dragon as it was').toEqual(dragons(view));
    await player.dispose();
  });

  it('counts from 0 with the next right answers: two days apart give a bronze pane', async () => {
    const player = await restored();
    expect((await player.host.activateContent(next(), 'boundary')).ok).toBe(true);
    const before = structuredClone(player.state().items);
    await playDay(player, '2026-10-12');
    await playDay(player, '2026-10-14');
    expect(player.failures).toEqual([]);
    const items = player.state().items;
    const counts = Object.values(items).map((r) => r.rightDays ?? 0);
    expect(Math.max(...counts), 'two sessions count two days at most: from 0').toBe(2);
    const view = player.host.getView();
    const level = panes(view);
    const bronze = Object.entries(items).filter(
      ([item, r]) => r.box <= 1 && r.rightDays === 2 && item in level,
    );
    expect(bronze.length, 'facts still in box 0-1, right on both days').toBeGreaterThan(0);
    for (const [item] of bronze) {
      expect(level[item], `${item} is bronze`).toBe('bronze');
      expect(before[item]?.rightDays, `${item} had no count before`).toBeUndefined();
    }
    await player.dispose();
  });
});
