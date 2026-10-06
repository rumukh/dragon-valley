/**
 * One child's game session and the command controller: strict durable checkpoints, retrying
 * the exact failed write (never the action), stale-view guards, pause and continuation,
 * validated restore with recovery, backups and content activation at a boundary.
 */
import { MemorySaveStorage } from '@aegis/browser/save';
import { describe, expect, it, vi } from 'vitest';
import {
  CommandRejectedError,
  createCommandController,
  SAVE_PATIENCE_MS,
  StaleCommandError,
} from '../../../src/app/controller/commands';
import { rebind } from '../../../src/app/persistence/backup';
import { gamePolicy, openGameSession } from '../../../src/app/persistence/game-session';
import { RecoveryRequired } from '../../../src/app/persistence/recovery';
import {
  COUNT_GAME,
  COUNT_GAME_V2,
  FlakyStorage,
  PROFILE_A,
  PROFILE_B,
  SlowStorage,
} from './fixtures';

const noErrors = (error: unknown): void => {
  throw error;
};

describe('game session', () => {
  it('starts a new game with nothing saved, then saves each commit durably', async () => {
    const storage = new MemorySaveStorage();
    const session = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    expect(session.indicator()).toEqual({ kind: 'none' });
    expect(await session.storedText()).toBeUndefined();
    const commands = createCommandController(session.host, noErrors);
    const receipt = await commands.capture()({ type: 'tick', turns: 1 });
    expect(receipt.durable).toBe(true);
    expect(session.indicator()).toEqual({ kind: 'saved' });
    commands.dispose();
    await session.close();

    const reopened = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    expect(reopened.host.getView()).toEqual({ count: 1, ticks: 1, content: 'v1' });
    expect(reopened.host.getStatus().durableRevision).toBe(reopened.host.getStatus().revision);
    expect(reopened.indicator()).toEqual({ kind: 'saved' });
    await reopened.close();
  });

  it('keeps each keeper in its own save', async () => {
    const storage = new MemorySaveStorage();
    const a = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    await createCommandController(a.host, noErrors).capture()({ type: 'tick', turns: 2 });
    await a.close();
    const b = await openGameSession(storage, COUNT_GAME, PROFILE_B);
    expect(b.host.getView().count).toBe(0);
    await b.close();
  });

  it('retries the exact failed write and continues the accepted action without repeating it', async () => {
    const storage = new FlakyStorage();
    const session = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    const commands = createCommandController(session.host, noErrors);
    storage.failures = 1;
    const failed = await commands
      .capture()({ type: 'tick', turns: 2 })
      .catch((error: unknown) => error);
    expect(failed).toBeInstanceOf(CommandRejectedError);
    expect((failed as CommandRejectedError).accepted).toBe(true);
    expect(session.host.getView()).toMatchObject({ count: 1, ticks: 1 });
    expect(session.host.getStatus().pendingAction).not.toBeNull();
    expect(session.indicator()).toEqual({ kind: 'failed', code: 'storage' });

    const blocked = await commands
      .capture()({ type: 'note' })
      .catch((error: unknown) => error);
    expect((blocked as CommandRejectedError).error.code).toBe('checkpoint-blocked');

    await commands.retry();
    expect(session.host.getView()).toMatchObject({ count: 2, ticks: 1 });
    expect(session.host.getStatus().pendingAction).toBeNull();
    expect(session.indicator()).toEqual({ kind: 'saved' });
    commands.dispose();
    await session.close();

    const reopened = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    expect(reopened.host.getView()).toMatchObject({ count: 2, ticks: 1 });
    await reopened.close();
  });

  it('refuses controls captured before a newer view', async () => {
    const session = await openGameSession(new MemorySaveStorage(), COUNT_GAME, PROFILE_A);
    const commands = createCommandController(session.host, noErrors);
    const stale = commands.capture();
    await commands.capture()({ type: 'note' });
    await expect(stale({ type: 'note' })).rejects.toBeInstanceOf(StaleCommandError);
    commands.dispose();
    await expect(commands.capture()({ type: 'note' })).rejects.toBeInstanceOf(StaleCommandError);
    await session.close();
  });

  it('shows a sent action once it is saved, or once taken when the save is slow', async () => {
    const storage = new SlowStorage();
    const session = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    const commands = createCommandController(session.host, noErrors);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      storage.held = true;
      let shown = false;
      const sending = commands
        .captureSend()({ type: 'tick', turns: 1 })
        .then(() => (shown = true));
      // Taken at once, but the slow save holds it back for the patience only.
      await vi.advanceTimersByTimeAsync(SAVE_PATIENCE_MS - 1);
      expect(shown).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await sending;
      expect(shown).toBe(true);
    } finally {
      vi.useRealTimers();
    }
    // Committed and shown, not yet durable: the save indicator says so.
    expect(session.host.getView().count).toBe(1);
    expect(session.host.getStatus().durableRevision).not.toBe(session.host.getStatus().revision);
    expect(session.indicator().kind).toBe('saving');

    // The next action waits for that save instead of being refused as busy.
    let second = false;
    const next = commands
      .captureSend()({ type: 'tick', turns: 1 })
      .then(() => (second = true));
    await Promise.resolve();
    expect(second).toBe(false);
    storage.release();
    await next;
    expect(session.host.getView().count).toBe(2);
    await commands.capture()({ type: 'note' });
    expect(session.indicator()).toEqual({ kind: 'saved' });
    commands.dispose();
    await session.close();
  });

  it('holds a sent action whose save failed at once, and lets Retry store it', async () => {
    const storage = new FlakyStorage();
    const session = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    const commands = createCommandController(session.host, noErrors);
    storage.failures = 1;
    // The game took the action, but nothing is praised for what is not stored.
    const held = await commands
      .captureSend()({ type: 'tick', turns: 1 })
      .catch((error: unknown) => error);
    expect(held).toBeInstanceOf(CommandRejectedError);
    expect((held as CommandRejectedError).accepted).toBe(true);
    expect(session.host.getView().count).toBe(1);
    expect(session.indicator().kind).toBe('failed');
    const blocked = await commands
      .captureSend()({ type: 'note' })
      .catch((error: unknown) => error);
    expect((blocked as CommandRejectedError).error.code).toBe('checkpoint-blocked');
    await commands.retry();
    expect(session.indicator()).toEqual({ kind: 'saved' });
    await commands.captureSend()({ type: 'note' });
    commands.dispose();
    await session.close();
  });

  it('pauses between turns and continues the accepted action on resume', async () => {
    const session = await openGameSession(new MemorySaveStorage(), COUNT_GAME, PROFILE_A);
    const commands = createCommandController(session.host, noErrors);
    let paused = false;
    const unsubscribe = session.host.subscribeCommits(() => {
      if (!paused) {
        paused = true;
        session.host.pause('visibility');
      }
    });
    const receipt = await commands.capture()({ type: 'tick', turns: 3 });
    unsubscribe();
    expect(receipt.pending).toBe(true);
    expect(session.host.getView().count).toBe(1);
    const refused = await commands
      .capture()({ type: 'note' })
      .catch((error: unknown) => error);
    expect((refused as CommandRejectedError).error.code).toBe('paused');
    await commands.resume('visibility');
    expect(session.host.getView()).toMatchObject({ count: 3, ticks: 1 });
    expect(session.host.getStatus().pendingAction).toBeNull();
    commands.dispose();
    await session.close();
  });
});

describe('restore and recovery', () => {
  async function savedGame(storage: MemorySaveStorage) {
    const session = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    await createCommandController(session.host, noErrors).capture()({ type: 'tick', turns: 1 });
    await session.close();
    return storage.read(gamePolicy(COUNT_GAME, PROFILE_A.id));
  }

  it('asks for recovery instead of starting over when the save breaks the game rules', async () => {
    const storage = new MemorySaveStorage();
    const history = await savedGame(storage);
    const policy = gamePolicy(COUNT_GAME, PROFILE_A.id);
    const envelope = JSON.parse(history.current!.payload);
    envelope.state.world.resources['aegis.runtime.state'].count = -1;
    const tampered = JSON.stringify(envelope);
    await storage.compareAndSwap(policy, history.current!.revision, {
      revision: history.current!.revision + 1,
      payload: tampered,
    });
    const error = await openGameSession(storage, COUNT_GAME, PROFILE_A).catch((cause) => cause);
    expect(error).toBeInstanceOf(RecoveryRequired);
    expect((error as RecoveryRequired).kind).toBe('game');
    expect((error as RecoveryRequired).actions.original).toBe(tampered);
    await expect((error as RecoveryRequired).actions.replace(tampered)).rejects.toThrow();
    await (error as RecoveryRequired).actions.replace(
      (error as RecoveryRequired).actions.previous!,
    );
    const recovered = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    expect(recovered.host.getView().count).toBe(1);
    await recovered.close();
  });

  it('refuses a save from content this build does not have', async () => {
    const storage = new MemorySaveStorage();
    const history = await savedGame(storage);
    const policy = gamePolicy(COUNT_GAME, PROFILE_A.id);
    const envelope = JSON.parse(history.current!.payload);
    envelope.contentRevision = 'v9';
    await storage.compareAndSwap(policy, history.current!.revision, {
      revision: history.current!.revision + 1,
      payload: JSON.stringify(envelope),
    });
    const error = await openGameSession(storage, COUNT_GAME, PROFILE_A).catch((cause) => cause);
    expect(error).toBeInstanceOf(RecoveryRequired);
    expect((error as RecoveryRequired).code).toBe('incompatible');
  });

  it('restores an old save on its own content and moves it to the newest at a boundary', async () => {
    const storage = new MemorySaveStorage();
    await savedGame(storage);
    const upgraded = await openGameSession(storage, COUNT_GAME_V2, PROFILE_A);
    expect(upgraded.host.getView()).toEqual({ count: 1, ticks: 1, content: 'v1' });
    expect(await upgraded.activateLatestContent()).toBe(true);
    expect(upgraded.host.getView().content).toBe('v2');
    expect(upgraded.indicator()).toEqual({ kind: 'saved' });
    expect(await upgraded.activateLatestContent()).toBe(false);
    await createCommandController(upgraded.host, noErrors).capture()({ type: 'tick', turns: 1 });
    expect(upgraded.host.getView().count).toBe(11);
    await upgraded.close();
    const reopened = await openGameSession(storage, COUNT_GAME_V2, PROFILE_A);
    expect(reopened.host.getView()).toEqual({ count: 11, ticks: 2, content: 'v2' });
    await reopened.close();
  });

  it('moves a saved game to another keeper through a validated backup', async () => {
    const storage = new MemorySaveStorage();
    await savedGame(storage);
    const source = await openGameSession(storage, COUNT_GAME, PROFILE_A);
    const exported = await source.storedText();
    await source.close();
    expect(exported).toBeDefined();

    const target = await openGameSession(storage, COUNT_GAME, PROFILE_B);
    await expect(target.importEnvelope(exported!)).rejects.toThrow();
    await target.importEnvelope(rebind(JSON.parse(exported!), PROFILE_B.id));
    expect(target.host.getView().count).toBe(1);
    expect(target.indicator()).toEqual({ kind: 'saved' });
    await target.close();
    const reopened = await openGameSession(storage, COUNT_GAME, PROFILE_B);
    expect(reopened.host.getView().count).toBe(1);
    await reopened.close();
  });
});
