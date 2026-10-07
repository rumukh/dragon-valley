/**
 * A keeper's stored data as a whole: backup files, loading a backup into a keeper, erasing
 * progress, and removing everything when the keeper is removed. These operate on storage
 * directly, so they work for any keeper, not only the one playing.
 */
import { importSave } from '@aegis/browser/save';
import { profileSeed } from '../../rules/contract';
import type { GameView, Notation } from '../../rules/contract';
import type { DvPack } from '../game/definition';
import { createBackup, readBackup, rebind } from '../persistence/backup';
import type { BackupFile } from '../persistence/backup';
import type { Keeper } from '../persistence/family';
import { gamePolicy, openGameSession } from '../persistence/game-session';
import { dayRecord } from '../persistence/day';
import { DEFAULT_PREFERENCES, preferencesRecord } from '../persistence/preferences';
import { recordPolicy } from '../persistence/records';
import { eraseRecord, RecoveryRequired } from '../persistence/recovery';
import { PreferencesStore } from '../persistence/stores';
import type { App } from '../shell/app';

function policies(app: App, keeperId: string) {
  return {
    game: gamePolicy(app.game, keeperId),
    preferences: recordPolicy(preferencesRecord(keeperId)),
    day: recordPolicy(dayRecord(keeperId)),
  };
}

export interface KeeperGame {
  readonly view: GameView;
  readonly content: DvPack;
  readonly notation: Notation;
}

/**
 * A keeper's game as stored, for the grown-ups' Progress and Print tabs: the playing keeper's
 * live view, or a session opened just to read it (and closed again), so no keeper's screen,
 * sounds or text size come along. Throws `RecoveryRequired` when the save cannot be opened.
 */
export async function readKeeperGame(app: App, keeperId: Keeper['id']): Promise<KeeperGame> {
  const active = app.active();
  if (active?.keeper.id === keeperId) {
    return {
      view: active.game.view(),
      content: active.game.content(),
      notation: active.preferences.current().notation,
    };
  }
  const preferences = new PreferencesStore(app.storage, keeperId);
  const notation = await preferences.open().then(
    (value) => value.notation,
    () => DEFAULT_PREFERENCES.notation,
  );
  const session = await openGameSession(app.storage, app.game, {
    id: keeperId,
    seed: profileSeed(keeperId),
  });
  try {
    return { view: session.view(), content: session.content(), notation };
  } finally {
    await session.close();
  }
}

/** The acknowledged stored records of a keeper, as one backup file. */
export async function exportKeeper(app: App, keeper: Keeper): Promise<string> {
  const { game, preferences } = policies(app, keeper.id);
  const gameRecord = (await app.storage.read(game)).current?.payload;
  const preferencesRecordText = (await app.storage.read(preferences)).current?.payload;
  // Both payloads are re-validated, so a backup never carries a record we could not load.
  if (gameRecord !== undefined) importSave(gameRecord, game);
  if (preferencesRecordText !== undefined) importSave(preferencesRecordText, preferences);
  return createBackup(keeper, gameRecord, preferencesRecordText);
}

export function parseKeeperBackup(text: string): BackupFile {
  return readBackup(text);
}

/**
 * Replace a keeper's game and preferences with a backup's. Each envelope is rebound to this
 * keeper and validated like a fresh load (game rules included) before it is stored.
 */
export async function importKeeper(app: App, keeper: Keeper, backup: BackupFile): Promise<void> {
  if (app.active()?.keeper.id === keeper.id) await app.closeKeeper();
  if (backup.game !== null) {
    await eraseDay(app, policies(app, keeper.id).day);
    const text = rebind(backup.game, keeper.id);
    try {
      const session = await openGameSession(app.storage, app.game, {
        id: keeper.id,
        seed: profileSeed(keeper.id),
      });
      try {
        await session.importEnvelope(text);
      } finally {
        await session.close();
      }
    } catch (error) {
      if (!(error instanceof RecoveryRequired) || !error.actions.available) throw error;
      await error.actions.replace(text);
    }
  }
  if (backup.preferences !== null) {
    const { preferences: policy } = policies(app, keeper.id);
    const candidate = importSave(rebind(backup.preferences, keeper.id), policy);
    const store = new PreferencesStore(app.storage, keeper.id);
    try {
      await store.open();
    } catch (error) {
      if (!(error instanceof RecoveryRequired) || !error.actions.available) throw error;
      await error.actions.replace(rebind(backup.preferences, keeper.id));
      return;
    }
    await store.replace(candidate.state);
  }
}

/** Erase a keeper's game progress (settings stay). */
export async function eraseProgress(app: App, keeperId: string): Promise<void> {
  if (app.active()?.keeper.id === keeperId) await app.closeKeeper();
  const { game, day } = policies(app, keeperId);
  await eraseRecord(app.storage, game);
  await eraseDay(app, day);
}

/** Erase everything stored for a keeper: game, preferences and the diary's day. */
export async function eraseKeeperData(app: App, keeperId: string): Promise<void> {
  if (app.active()?.keeper.id === keeperId) await app.closeKeeper();
  const { game, preferences, day } = policies(app, keeperId);
  await eraseRecord(app.storage, game);
  await eraseRecord(app.storage, preferences);
  await eraseDay(app, day);
}

/**
 * The diary's day describes the game it was taken from: a new or replaced game starts its own.
 * It holds nothing the game save does not, so it is erased even when it cannot be read.
 */
async function eraseDay(app: App, policy: ReturnType<typeof policies>['day']): Promise<void> {
  await eraseRecord(app.storage, policy).catch(() => undefined);
}
