/**
 * A save from the deployed Region 1 slice: main 373a5d2's rules on its pack (content 1.0.0, Sunny
 * Meadow only), kept as fixtures (`slice-save.json`, the snapshot of its last commit; and
 * `slice.content.json`, the pack byte for byte; made by playing that build with the trace harness).
 *
 * The v1 rules must restore it with its own pack exactly as saved, and move it to the v1 content
 * at the hub with all progress carried forward. Its second day began under the slice, before the
 * day's level and minigame counters existed: they count from 0. The v1 content needs a revision of
 * its own: a pack with the same revision and different content can never be installed beside it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { dataHash } from '@aegis/runtime';
import type { ContentPack, RuntimeSnapshot } from '@aegis/runtime';
import type { ContentData } from '../../src/rules/contract';
import { PERFECT, Player, loadPack, root } from '../traces/support';

// Whole sessions are replayed here, one commit at a time with the full content pack: give them
// room on a busy machine (Vitest's default is 60 s per test).
vi.setConfig({ testTimeout: 300_000 });

const fixture = (name: string) => join('test', 'migration', 'fixtures', name);
const slice = loadPack(fixture('slice.content.json'));
const save = JSON.parse(
  readFileSync(join(root, fixture('slice-save.json')), 'utf8'),
) as RuntimeSnapshot;
const current = loadPack();
/** The v1 content under a revision of its own, as a content change after a deploy needs. */
const v1: ContentPack<ContentData> = {
  ...(JSON.parse(JSON.stringify(current)) as ContentPack<ContentData>),
  revision: '1.1.0',
};

/** A player whose host restored the slice save (with the slice's pack installed). */
async function restored(): Promise<Player> {
  const player = new Player(PERFECT, 'slice', undefined, slice);
  const outcome = await player.host.restore(save);
  expect(outcome.ok, outcome.ok ? '' : outcome.error.code).toBe(true);
  player.turn = player.host.inspect().turn;
  return player;
}

describe('a save from the deployed Region 1 slice', () => {
  it('restores under the v1 rules with its own pack, exactly as saved', async () => {
    expect(save.content).toMatchObject({ id: 'dragon-valley', revision: '1.0.0' });
    expect(
      slice.data.regions.map((r) => r.id),
      'the slice is Sunny Meadow only',
    ).toEqual(['sunny-meadow']);
    const player = await restored();
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

  it('moves to the v1 content at the hub with every bit of progress, under a new revision', async () => {
    const player = await restored();
    const before = player.state();
    const reused = player.host.stageContent(current);
    expect(reused.ok ? 'staged' : reused.error.code, 'same revision, different content').toBe(
      'content-revision-reused',
    );
    expect(player.host.stageContent(v1).ok).toBe(true);
    const activated = await player.host.activateContent(v1, 'boundary');
    expect(activated.ok, activated.ok ? '' : activated.error.code).toBe(true);
    expect(player.host.inspect().content.revision).toBe('1.1.0');
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
