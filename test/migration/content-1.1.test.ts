/**
 * Content migration: a save made on content 1.0 continues on content 1.1 (a fixture that adds an
 * island with one level). A new process restores the 1.0 save with its exact pack (the archived
 * `content/history/1.0.0.json` once v1 ships, the current pack until then), stages 1.1 and
 * activates it at a safe boundary: never mid-round, and the adapter carries every bit of progress
 * forward. Old saves keep selecting their own revision.
 */
import { existsSync, readFileSync } from 'node:fs';
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

const archived = join('content', 'history', '1.0.0.json');
const v10: ContentPack<ContentData> = existsSync(join(root, archived))
  ? loadPack(archived)
  : loadPack();

const island = JSON.parse(
  readFileSync(join(root, 'test', 'migration', 'fixtures', '1.1.0-island.json'), 'utf8'),
) as { revision: string; regions: Region[]; levels: Level[] };

function v11(): ContentPack<ContentData> {
  const base = JSON.parse(JSON.stringify(v10)) as ContentPack<ContentData>;
  const pack: ContentPack<ContentData> = { ...base, revision: island.revision };
  pack.data.regions.push(...island.regions);
  pack.data.levels.push(...island.levels);
  return pack;
}

const host = (content: ContentPack<ContentData>) =>
  createRuntimeHost({ adapter: dragonValleyAdapter, content, seed: 'migration' });

/** A child's 1.0 save: two Sunny Meadow levels played. */
async function saveOn10(): Promise<{ snapshot: RuntimeSnapshot; player: Player }> {
  const player = new Player(PERFECT, 'migration', undefined, v10);
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

describe('activating content 1.1 on a 1.0 save', () => {
  it('restores the 1.0 save in a new process, then switches to 1.1 at a safe boundary', async () => {
    const { snapshot, player } = await saveOn10();
    expect(snapshot.content.revision).toBe('1.0.0');
    const before = player.state();

    const next = host(v10);
    expect((await next.restore(snapshot)).ok).toBe(true);
    expect(next.getView(), 'the restored game is the saved game').toEqual(player.view());
    expect(next.stageContent(v11()).ok).toBe(true);

    expect((await next.dispatch({ type: 'startLevel', level: 'sunny-meadow.1' })).ok).toBe(true);
    const midRound = await next.activateContent(v11(), 'boundary');
    expect(midRound.ok ? 'activated' : midRound.error.code, 'never mid-round').toBe(
      'unsafe-boundary',
    );
    expect(next.getView().hub.regions).toHaveLength(9);

    expect((await next.dispatch({ type: 'endRound', reason: 'quit' })).ok).toBe(true);
    const progress = next.inspect().state;
    let activated: RuntimeSnapshot | null = null;
    next.subscribeCommits((commit) => {
      activated = commit.snapshot;
    });
    expect((await next.activateContent(v11(), 'boundary')).ok).toBe(true);
    expect(activated!.content.revision).toBe('1.1.0');
    expect(next.inspect().state, 'the adapter carries all progress forward').toEqual(progress);
    expect(progress.levels).toEqual(before.levels);
    expect([progress.coins, progress.dragons, progress.stickers]).toEqual([
      before.coins,
      before.dragons,
      before.stickers,
    ]);

    const regions = next.getView().hub.regions;
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
    expect((await next.dispatch({ type: 'startLevel', level: 'pearl-island.1' })).ok).toBe(true);

    await player.dispose();
    await next.dispose();
  });

  it('keeps old saves on their own revision, and never reuses a revision for new content', async () => {
    const { snapshot, player } = await saveOn10();
    const later = host(v11());
    const missing = await later.restore(snapshot);
    expect(missing.ok ? 'restored' : missing.error.code, 'needs its exact pack').toBe(
      'incompatible-save',
    );
    expect(later.stageContent(v10).ok).toBe(true);
    expect((await later.restore(snapshot)).ok, 'with its pack installed it restores').toBe(true);
    expect(later.inspect().content.revision).toBe('1.0.0');

    const changed = v11();
    changed.data.levels.find((l) => l.id === 'pearl-island.1')!.activities[0]!.count = 12;
    const reused = later.stageContent(changed);
    expect(reused.ok ? 'staged' : reused.error.code).toBe('content-revision-reused');
    await player.dispose();
    await later.dispose();
  });
});
