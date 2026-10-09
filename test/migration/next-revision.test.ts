/**
 * The next content release: a save made on the current content continues on the next revision
 * (a fixture that adds an island with one level, under the next minor revision). A new process
 * restores the save with its exact pack, stages the next revision and activates it at a safe
 * boundary: never mid-round, and the adapter carries every bit of progress forward. Old saves keep
 * selecting their own revision, and a revision is never reused for other content.
 * (test/migration/slice-save.test.ts covers the real upgrade the v1 content made, from 1.0.0.)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createRuntimeHost } from '@aegis/runtime';
import type { ContentPack, RuntimeSnapshot } from '@aegis/runtime';
import { dragonValleyAdapter } from '../../src/rules/adapter';
import type { ContentData, Level, Region } from '../../src/rules/contract';
import { PERFECT, Player, loadPack, root } from '../traces/support';

// Whole sessions are replayed here, one commit at a time with the full content pack: give them
// room on a busy machine (Vitest's default is 60 s per test).
vi.setConfig({ testTimeout: 300_000 });

const current = loadPack();
const [major, minor] = current.revision.split('.').map(Number);
const NEXT = `${major}.${minor! + 1}.0`;

const island = JSON.parse(
  readFileSync(join(root, 'test', 'migration', 'fixtures', 'island.json'), 'utf8'),
) as { regions: Region[]; levels: Level[] };

function next(): ContentPack<ContentData> {
  const base = JSON.parse(JSON.stringify(current)) as ContentPack<ContentData>;
  const pack: ContentPack<ContentData> = { ...base, revision: NEXT };
  pack.data.regions.push(...island.regions);
  pack.data.levels.push(...island.levels);
  return pack;
}

const host = (content: ContentPack<ContentData>) =>
  createRuntimeHost({ adapter: dragonValleyAdapter, content, seed: 'migration' });

/** A child's save on the current content: two Sunny Meadow levels played. */
async function saveOnCurrent(): Promise<{ snapshot: RuntimeSnapshot; player: Player }> {
  const player = new Player(PERFECT, 'migration', undefined, current);
  let snapshot: RuntimeSnapshot | null = null;
  player.host.subscribeCommits((commit) => {
    snapshot = commit.snapshot;
  });
  await player.act({ type: 'startSession', day: '2026-10-06' });
  await player.choose(null);
  await player.choose('bubbles');
  await player.playLevel('sunny-meadow.1');
  await player.playLevel('sunny-meadow.2');
  return { snapshot: snapshot!, player };
}

describe('activating the next content revision on a save', () => {
  it('restores the save in a new process, then switches to the next revision at a safe boundary', async () => {
    const { snapshot, player } = await saveOnCurrent();
    expect(snapshot.content.revision).toBe(current.revision);
    const before = player.state();

    const later = host(current);
    expect((await later.restore(snapshot)).ok).toBe(true);
    expect(later.getView(), 'the restored game is the saved game').toEqual(player.view());
    expect(later.stageContent(next()).ok).toBe(true);

    expect((await later.dispatch({ type: 'startLevel', level: 'sunny-meadow.1' })).ok).toBe(true);
    const midRound = await later.activateContent(next(), 'boundary');
    expect(midRound.ok ? 'activated' : midRound.error.code, 'never mid-round').toBe(
      'unsafe-boundary',
    );
    expect(later.getView().hub.regions).toHaveLength(10);

    expect((await later.dispatch({ type: 'endRound', reason: 'quit' })).ok).toBe(true);
    const progress = later.inspect().state;
    let activated: RuntimeSnapshot | null = null;
    later.subscribeCommits((commit) => {
      activated = commit.snapshot;
    });
    expect((await later.activateContent(next(), 'boundary')).ok).toBe(true);
    expect(activated!.content.revision).toBe(NEXT);
    expect(later.inspect().state, 'the adapter carries all progress forward').toEqual(progress);
    expect(progress.levels).toEqual(before.levels);
    expect([progress.coins, progress.dragons, progress.stickers]).toEqual([
      before.coins,
      before.dragons,
      before.stickers,
    ]);

    const regions = later.getView().hub.regions;
    expect(regions.map((r) => r.id)).toContain('pearl-island');
    expect(regions.find((r) => r.id === 'pearl-island')!.levels).toMatchObject([
      { id: 'pearl-island.1', status: 'open' },
    ]);
    expect(regions.find((r) => r.id === 'sunny-meadow')!.levels.map((l) => l.status)).toEqual(
      player
        .view()
        .hub.regions.find((r) => r.id === 'sunny-meadow')!
        .levels.map((l) => l.status),
    );
    expect((await later.dispatch({ type: 'startLevel', level: 'pearl-island.1' })).ok).toBe(true);

    await player.dispose();
    await later.dispose();
  });

  it('keeps old saves on their own revision, and never reuses a revision for new content', async () => {
    const { snapshot, player } = await saveOnCurrent();
    const later = host(next());
    const missing = await later.restore(snapshot);
    expect(missing.ok ? 'restored' : missing.error.code, 'needs its exact pack').toBe(
      'incompatible-save',
    );
    expect(later.stageContent(current).ok).toBe(true);
    expect((await later.restore(snapshot)).ok, 'with its pack installed it restores').toBe(true);
    expect(later.inspect().content.revision).toBe(current.revision);

    const changed = next();
    changed.data.levels.find((l) => l.id === 'pearl-island.1')!.activities[0]!.count = 12;
    const reused = later.stageContent(changed);
    expect(reused.ok ? 'staged' : reused.error.code).toBe('content-revision-reused');
    await player.dispose();
    await later.dispose();
  });
});
