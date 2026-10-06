/**
 * A keeper's stored data as a whole: backup files, loading a backup into a keeper, erasing
 * progress, and removing everything when the keeper is removed. These operate on storage
 * directly, so they work for any keeper, not only the one playing.
 */
import { importSave } from '@aegis/browser/save';
import { profileSeed } from '../../rules/contract';
import { createBackup, readBackup, rebind } from '../persistence/backup';
import type { BackupFile } from '../persistence/backup';
import type { Keeper } from '../persistence/family';
import { gamePolicy, openGameSession } from '../persistence/game-session';
import { preferencesRecord } from '../persistence/preferences';
import { recordPolicy } from '../persistence/records';
import { eraseRecord, RecoveryRequired } from '../persistence/recovery';
import { PreferencesStore } from '../persistence/stores';
import type { App } from '../shell/app';

function policies(app: App, keeperId: string) {
  return {
    game: gamePolicy(app.game, keeperId),
    preferences: recordPolicy(preferencesRecord(keeperId)),
  };
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
  await eraseRecord(app.storage, policies(app, keeperId).game);
}

/** Erase everything stored for a keeper: game and preferences. */
export async function eraseKeeperData(app: App, keeperId: string): Promise<void> {
  if (app.active()?.keeper.id === keeperId) await app.closeKeeper();
  const { game, preferences } = policies(app, keeperId);
  await eraseRecord(app.storage, game);
  await eraseRecord(app.storage, preferences);
}
