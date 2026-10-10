/**
 * Saves made before a content update. The pack a save pins is fetched from the build's history
 * (`content/history/<revision>.json`) when it is not at hand, the save restores exactly as it was
 * saved, and the newest pack is activated at the hub. A pack that cannot be fetched, or is not the
 * pack the save pinned, leaves the save untouched for recovery ("Try opening again" fetches it
 * again). First with the tiny counting game, then with a real save of the deployed Region 1
 * slice on the v1 content (the archived content/history/1.0.0.json and S2b's slice save).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemorySaveStorage } from '@aegis/browser/save';
import { parseContentJson, requireValue } from '@aegis/runtime';
import type { ContentPack, RuntimeSnapshot } from '@aegis/runtime';
import { describe, expect, it, vi } from 'vitest';
import { createHistoryLoader, historyPath } from '../../../src/app/content/history';
import type { Fetcher } from '../../../src/app/content/load';
import { missingContentKeys, parseContentCatalog } from '../../../src/app/content/text';
import { createCommandController } from '../../../src/app/controller/commands';
import { dragonValleyGame } from '../../../src/app/game/definition';
import type { DvPack } from '../../../src/app/game/definition';
import { rebind } from '../../../src/app/persistence/backup';
import {
  ENGINE_ID,
  ENGINE_REVISION,
  ENGINE_SNAPSHOT_VERSION,
  gamePolicy,
  openGameSession,
} from '../../../src/app/persistence/game-session';
import type { GameDefinition } from '../../../src/app/persistence/game-session';
import { RecoveryRequired } from '../../../src/app/persistence/recovery';
import { contentRegistration, GAME_ID, profileSeed } from '../../../src/rules/contract';
import type { CountAction, CountContent, CountState, CountView } from './fixtures';
import { COUNT_GAME, COUNT_V1, COUNT_V2, countAdapter, PROFILE_A, PROFILE_B } from './fixtures';

const noErrors = (error: unknown): void => {
  throw error;
};

type CountGame = GameDefinition<CountState, CountAction, CountView, CountContent>;

/** The counting game on v2, fetching older packs with `loadHistory`. */
const lazy = (
  loadHistory: (revision: string) => Promise<ContentPack<CountContent>>,
): CountGame => ({
  gameId: COUNT_GAME.gameId,
  adapter: countAdapter,
  content: COUNT_V2,
  loadHistory,
});

async function savedOnV1(storage: MemorySaveStorage): Promise<void> {
  const session = await openGameSession(storage, COUNT_GAME, PROFILE_A);
  await createCommandController(session.host, noErrors).capture()({ type: 'tick', turns: 1 });
  await session.close();
}

async function failure(opening: Promise<unknown>): Promise<RecoveryRequired> {
  const error = await opening.then(
    () => null,
    (cause: unknown) => cause,
  );
  expect(error).toBeInstanceOf(RecoveryRequired);
  return error as RecoveryRequired;
}

describe('an old save on a newer build', () => {
  it('fetches the pack it pins, restores it as saved, then moves it to the newest', async () => {
    const storage = new MemorySaveStorage();
    await savedOnV1(storage);
    const loader = vi.fn(async (revision: string) => {
      if (revision === 'v1') return COUNT_V1;
      throw new Error('Not found');
    });
    const game = lazy(loader);
    const session = await openGameSession(storage, game, PROFILE_A);
    expect(loader).toHaveBeenCalledWith('v1');
    expect(session.host.getView()).toEqual({ count: 1, ticks: 1, content: 'v1' });
    expect(session.content()).toBe(COUNT_V1);
    expect(await session.activateLatestContent()).toBe(true);
    expect(session.content()).toBe(COUNT_V2);
    expect(session.host.getView()).toEqual({ count: 1, ticks: 1, content: 'v2' });
    expect(session.indicator()).toEqual({ kind: 'saved' });
    await session.close();

    loader.mockClear();
    const reopened = await openGameSession(storage, game, PROFILE_A);
    expect(loader, 'the upgraded save pins the newest pack').not.toHaveBeenCalled();
    expect(reopened.host.getView()).toEqual({ count: 1, ticks: 1, content: 'v2' });
    await reopened.close();
  });

  it('asks for recovery while the pack cannot be fetched, and opens once it can', async () => {
    const storage = new MemorySaveStorage();
    await savedOnV1(storage);
    const before = await storage.read(gamePolicy(COUNT_GAME, PROFILE_A.id));
    let online = false;
    const game = lazy(async () => {
      if (!online) throw new TypeError('Failed to fetch');
      return COUNT_V1;
    });
    const problem = await failure(openGameSession(storage, game, PROFILE_A));
    expect(problem.code).toBe('content-unavailable');
    expect(problem.actions.original).toBe(before.current!.payload);
    expect(await storage.read(gamePolicy(COUNT_GAME, PROFILE_A.id))).toEqual(before);

    online = true;
    const session = await openGameSession(storage, game, PROFILE_A);
    expect(session.host.getView()).toEqual({ count: 1, ticks: 1, content: 'v1' });
    await session.close();
  });

  it('refuses a fetched file that is not the pack the save pinned', async () => {
    const storage = new MemorySaveStorage();
    await savedOnV1(storage);
    const renamed = lazy(async () => ({ ...COUNT_V1, revision: 'v0' }));
    expect((await failure(openGameSession(storage, renamed, PROFILE_A))).code).toBe(
      'content-unavailable',
    );
    const otherGame = lazy(async () => ({ ...COUNT_V1, id: 'other' }));
    expect((await failure(openGameSession(storage, otherGame, PROFILE_A))).code).toBe(
      'content-unavailable',
    );
    // Same revision, different content: the runtime refuses to restore the save with it.
    const changed = lazy(async () => ({ ...COUNT_V1, data: { step: 2 } }));
    expect((await failure(openGameSession(storage, changed, PROFILE_A))).code).toBe(
      'incompatible-save',
    );
  });

  it('never asks for a revision that cannot name a shipped file', async () => {
    const storage = new MemorySaveStorage();
    await savedOnV1(storage);
    const policy = gamePolicy(COUNT_GAME, PROFILE_A.id);
    const history = await storage.read(policy);
    const envelope = JSON.parse(history.current!.payload);
    // A stable identifier to the save codec, but no file name: never fetched.
    envelope.contentRevision = 'v1:next';
    envelope.state.content.revision = 'v1:next';
    await storage.compareAndSwap(policy, history.current!.revision, {
      revision: history.current!.revision + 1,
      payload: JSON.stringify({ ...envelope, revision: history.current!.revision + 1 }),
    });
    const loader = vi.fn(async () => COUNT_V1);
    expect((await failure(openGameSession(storage, lazy(loader), PROFILE_A))).code).toBe(
      'incompatible',
    );
    expect(loader).not.toHaveBeenCalled();
  });

  it('loads a backup of an old save into a game on the newest pack', async () => {
    const storage = new MemorySaveStorage();
    await savedOnV1(storage);
    const source = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    const exported = await source.storedText();
    await source.close();

    const target = await openGameSession(
      storage,
      lazy(async () => COUNT_V1),
      PROFILE_B,
    );
    expect(target.content()).toBe(COUNT_V2);
    await target.importEnvelope(rebind(JSON.parse(exported!), PROFILE_B.id));
    expect(target.host.getView()).toEqual({ count: 1, ticks: 1, content: 'v1' });
    expect(target.content()).toBe(COUNT_V1);
    expect(await target.activateLatestContent()).toBe(true);
    expect(target.host.getView().content).toBe('v2');
    await target.close();
  });
});

describe('archived packs', () => {
  it('live at content/history/<revision>.json, and only under a plain revision', () => {
    expect(historyPath('1.0.0')).toBe('content/history/1.0.0.json');
    for (const revision of ['../1.0.0', '1.0.0/..', 'a/b', '', '.hidden', '1..0']) {
      expect(() => historyPath(revision), revision).toThrow(RangeError);
    }
  });
});

describe('a save of the deployed Region 1 slice on the v1 content', () => {
  const archived = (revision: string) => join('content', 'history', `${revision}.json`);
  const sliceText = readFileSync(archived('1.0.0'), 'utf8');
  const slice = requireValue(parseContentJson(sliceText, contentRegistration, 'slice'));
  const snapshot = JSON.parse(
    readFileSync(join('test', 'migration', 'fixtures', 'slice-save.json'), 'utf8'),
  ) as RuntimeSnapshot;
  const v1: DvPack = requireValue(
    parseContentJson(
      readFileSync(join('content', 'dragon-valley.content.json'), 'utf8'),
      contentRegistration,
      'current',
    ),
  );

  function site(online: () => boolean): { fetcher: Fetcher; fetched: string[] } {
    const fetched: string[] = [];
    const fetcher: Fetcher = async (url) => {
      fetched.push(url);
      const found = online() && url === 'https://dv.test/game/content/history/1.0.0.json';
      return {
        ok: found,
        status: found ? 200 : online() ? 404 : 0,
        text: async () => (found ? sliceText : 'Not found'),
      };
    };
    return { fetcher, fetched };
  }

  async function storeSliceSave(storage: MemorySaveStorage, profileId: string): Promise<void> {
    const policy = gamePolicy(dragonValleyGame(slice), profileId);
    // A record as the slice build stored it: state version 1, older than the policy's, so it is
    // written as is (exportSave writes current versions only) and migrated on load.
    const payload = JSON.stringify({
      format: 'aegis.save',
      formatVersion: 1,
      gameId: GAME_ID,
      profileId,
      contentRevision: snapshot.content.revision,
      schemaVersion: snapshot.stateVersion,
      engine: {
        id: ENGINE_ID,
        snapshotVersion: ENGINE_SNAPSHOT_VERSION,
        revision: ENGINE_REVISION,
      },
      revision: 1,
      state: snapshot,
      resume: null,
    });
    await storage.compareAndSwap(policy, 0, { revision: 1, payload });
  }

  it('has every content string an archived pack can show, under a revision of its own', () => {
    const catalog = parseContentCatalog(
      JSON.parse(readFileSync(join('content', 'catalogs', 'en.content.json'), 'utf8')),
    );
    expect(slice.revision).toBe(snapshot.content.revision);
    expect(v1.revision, 'the v1 content is not the slice').not.toBe(slice.revision);
    const shipped = readdirSync(join('content', 'history')).filter((name) =>
      name.endsWith('.json'),
    );
    expect(shipped).toContain('1.0.0.json');
    for (const name of shipped) {
      const pack = requireValue(
        parseContentJson(
          readFileSync(join('content', 'history', name), 'utf8'),
          contentRegistration,
          name,
        ),
      );
      expect(missingContentKeys(pack.data, catalog), name).toEqual([]);
    }
  });

  it('restores with the archived slice pack and lands on the v1 valley at the hub', async () => {
    const storage = new MemorySaveStorage();
    await storeSliceSave(storage, 'profile-1');
    const { fetcher, fetched } = site(() => true);
    const game = dragonValleyGame(
      v1,
      [],
      createHistoryLoader('https://dv.test/game/', v1, fetcher),
    );
    const session = await openGameSession(storage, game, {
      id: 'profile-1',
      seed: profileSeed('profile-1'),
    });
    expect(fetched).toEqual(['https://dv.test/game/content/history/1.0.0.json']);
    expect(session.content().revision).toBe('1.0.0');
    expect(session.host.getView().hub.regions.map((region) => region.id)).toEqual(['sunny-meadow']);
    const progress = session.host.inspect().state;
    expect(snapshot.stateVersion, 'the slice saved state version 1').toBe(1);
    expect(progress.settings.grade, 'a save from before grades is a 3rd grader').toBe(3);

    expect(await session.activateLatestContent()).toBe(true);
    expect(session.content()).toBe(v1);
    expect(session.host.getView().hub.regions).toHaveLength(10);
    expect(session.host.inspect().state, 'every bit of progress carried forward').toEqual(progress);
    expect(session.indicator()).toEqual({ kind: 'saved' });
    await session.close();

    const stored = await storage.read(gamePolicy(game, 'profile-1'));
    expect(JSON.parse(stored.current!.payload).contentRevision).toBe(v1.revision);
    const reopened = await openGameSession(storage, game, {
      id: 'profile-1',
      seed: profileSeed('profile-1'),
    });
    expect(fetched, 'the archived pack is fetched once per page').toHaveLength(1);
    expect(reopened.host.getView().hub.regions).toHaveLength(10);
    await reopened.close();
  });

  it('waits for a grown-up while the archived pack is out of reach', async () => {
    const storage = new MemorySaveStorage();
    await storeSliceSave(storage, 'profile-1');
    let online = false;
    const { fetcher, fetched } = site(() => online);
    const game = dragonValleyGame(
      v1,
      [],
      createHistoryLoader('https://dv.test/game/', v1, fetcher),
    );
    const profile = { id: 'profile-1', seed: profileSeed('profile-1') };
    expect((await failure(openGameSession(storage, game, profile))).code).toBe(
      'content-unavailable',
    );
    online = true;
    const session = await openGameSession(storage, game, profile);
    expect(fetched, 'a failed fetch is tried again').toHaveLength(2);
    expect(session.content().revision).toBe('1.0.0');
    await session.close();
  });
});
