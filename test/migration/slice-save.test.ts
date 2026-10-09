/**
 * A save from the deployed Region 1 slice: main 373a5d2's rules on its pack (content 1.0.0, Sunny
 * Meadow only), made by playing that build with the trace harness (`fixtures/slice-save.json`,
 * the snapshot of its last commit). Its pack ships as `content/history/1.0.0.json`, byte for byte.
 *
 * The current rules restore it the way the shell does (src/app/persistence/game-session.ts): a
 * host on the save's own pack with the current pack staged beside it, then, at the hub, the
 * current pack activated. Exactly as saved, then with every bit of progress carried forward. Its
 * second day began under the slice, before the day's level and minigame counters existed: they
 * count from 0. The v1 content needed a revision of its own: a pack with the same revision and
 * different content can never be installed beside the old one.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { dataHash } from '@aegis/runtime';
import type { ContentPack, RuntimeSnapshot } from '@aegis/runtime';
import { migrateSnapshot } from '../../src/rules/contract';
import type { ContentData } from '../../src/rules/contract';
import { PERFECT, Player, loadPack, root } from '../traces/support';

// Whole sessions are replayed here, one commit at a time with the full content pack: give them
// room on a busy machine (Vitest's default is 60 s per test).
vi.setConfig({ testTimeout: 300_000 });

const slice = loadPack(join('content', 'history', '1.0.0.json'));
const save = migrateSnapshot(
  JSON.parse(
    readFileSync(join(root, 'test', 'migration', 'fixtures', 'slice-save.json'), 'utf8'),
  ) as RuntimeSnapshot,
);
const current = loadPack();

/** A player whose host restored the slice save as the shell does: its own pack, current staged. */
async function restored(): Promise<Player> {
  const player = new Player(PERFECT, 'slice', undefined, slice);
  expect(player.host.stageContent(current).ok, 'the current pack staged beside it').toBe(true);
  const outcome = await player.host.restore(save);
  expect(outcome.ok, outcome.ok ? '' : outcome.error.code).toBe(true);
  player.turn = player.host.inspect().turn;
  return player;
}

describe('a save from the deployed Region 1 slice', () => {
  it('restores under the current rules with its archived pack, exactly as saved', async () => {
    expect(save.content).toMatchObject({
      id: 'dragon-valley',
      revision: '1.0.0',
      hash: 'af91e14b281b7452',
    });
    expect(dataHash(slice), 'content/history/1.0.0.json is the pack it was saved with').toBe(
      'af91e14b281b7452',
    );
    expect(
      slice.data.regions.map((r) => r.id),
      'the slice is Sunny Meadow only',
    ).toEqual(['sunny-meadow']);

    const withoutHistory = new Player(PERFECT, 'slice');
    const refused = await withoutHistory.host.restore(save);
    expect(refused.ok ? 'restored' : refused.error.code, 'the current pack alone').toBe(
      'incompatible-save',
    );
    await withoutHistory.dispose();

    const player = await restored();
    expect(player.host.inspect().content.revision).toBe('1.0.0');
    expect(player.host.hash(), 'the restored game is the saved game').toBe(dataHash(save));
    const state = player.state();
    expect(state.daily, 'its day began before the day counters existed').not.toHaveProperty(
      'levels',
    );
    expect(Object.keys(state.levels).sort()).toEqual([
      'sunny-meadow.1',
      'sunny-meadow.2',
      'sunny-meadow.3',
      'sunny-meadow.4',
    ]);
    expect(player.view().hub.next, 'day two opens with snack time').toEqual({
      kind: 'snack',
      dragon: null,
    });
    await player.dispose();
  });

  it('moves to content 1.3.0 at the hub with every bit of progress, as the shell does', async () => {
    const player = await restored();
    const before = player.state();
    const unbumped: ContentPack<ContentData> = {
      ...(JSON.parse(JSON.stringify(current)) as ContentPack<ContentData>),
      revision: '1.0.0',
    };
    const reused = player.host.stageContent(unbumped);
    expect(reused.ok ? 'staged' : reused.error.code, 'the v1 content under 1.0.0').toBe(
      'content-revision-reused',
    );

    expect(player.view().screen, 'the save is at the hub').toBe('hub');
    expect(player.host.stageContent(current).ok, 'staging it again is harmless').toBe(true);
    const activated = await player.host.activateContent(current, 'boundary');
    expect(activated.ok, activated.ok ? '' : activated.error.code).toBe(true);
    expect(player.host.inspect().content.revision).toBe('1.3.0');
    expect(player.state(), 'progress carried forward unchanged').toEqual(before);
    expect(player.view().hub.regions).toHaveLength(9);

    // Play on the day the slice began: snacks, then a level with a minigame.
    await player.act({ type: 'startActivity', activity: { kind: 'snack', dragon: null } });
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
    expect(player.view().hub.next, 'no level done yet today: the next level').toEqual({
      kind: 'level',
      level: 'sunny-meadow.5',
    });
    await player.playLevel('sunny-meadow.5');
    expect(player.failures).toEqual([]);
    expect(player.data('level.completed')).toContainEqual({
      level: 'sunny-meadow.5',
      stars: expect.any(Number),
      firstTime: true,
    });
    expect(player.state().daily, 'the day counters start from 0').toMatchObject({
      levels: 1,
      minigames: 1,
    });
    await player.dispose();
  });
});
