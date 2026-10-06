/**
 * One child's backup file: the keeper's name and avatar, the game save envelope and the
 * preferences envelope, exactly as stored. Envelopes are bound to a profile ID, so loading a
 * backup into another keeper (or onto another device) rebinds them to that keeper's ID; the
 * stored state itself is then validated as strictly as a normal load.
 */
import { parseBoundedJson } from '@aegis/browser/save';
import { KEEPER_AVATARS } from '../../rules/contract/ids';
import type { KeeperAvatar } from '../../rules/contract/ids';

export const BACKUP_FORMAT = 'dragon-valley-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_MAX_BYTES = 4 * 1024 * 1024;

export interface BackupFile {
  readonly format: typeof BACKUP_FORMAT;
  readonly version: typeof BACKUP_VERSION;
  readonly keeper: { readonly name: string; readonly avatar: KeeperAvatar };
  /** The game save envelope as stored, or null when the keeper has no saved game yet. */
  readonly game: unknown;
  /** The preferences envelope as stored, or null. */
  readonly preferences: unknown;
}

export class BackupError extends Error {
  constructor(readonly code: 'not-a-backup' | 'too-large' | 'unsupported') {
    super(`Backup rejected: ${code}`);
    this.name = 'BackupError';
  }
}

export function createBackup(
  keeper: { name: string; avatar: KeeperAvatar },
  gamePayload: string | undefined,
  preferencesPayload: string | undefined,
): string {
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    keeper: { name: keeper.name, avatar: keeper.avatar },
    game: gamePayload === undefined ? null : JSON.parse(gamePayload),
    preferences: preferencesPayload === undefined ? null : JSON.parse(preferencesPayload),
  };
  return JSON.stringify(file, null, 2) + '\n';
}

export function readBackup(text: string): BackupFile {
  if (new TextEncoder().encode(text).byteLength > BACKUP_MAX_BYTES) {
    throw new BackupError('too-large');
  }
  let value: unknown;
  try {
    value = parseBoundedJson(text, BACKUP_MAX_BYTES);
  } catch {
    throw new BackupError('not-a-backup');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BackupError('not-a-backup');
  }
  const record = value as Record<string, unknown>;
  if (record['format'] !== BACKUP_FORMAT) throw new BackupError('not-a-backup');
  if (record['version'] !== BACKUP_VERSION) throw new BackupError('unsupported');
  const keeper = record['keeper'];
  if (
    typeof keeper !== 'object' ||
    keeper === null ||
    typeof (keeper as Record<string, unknown>)['name'] !== 'string' ||
    !(KEEPER_AVATARS as readonly unknown[]).includes((keeper as Record<string, unknown>)['avatar'])
  ) {
    throw new BackupError('not-a-backup');
  }
  const game = record['game'] ?? null;
  const preferences = record['preferences'] ?? null;
  for (const envelope of [game, preferences]) {
    if (envelope !== null && (typeof envelope !== 'object' || Array.isArray(envelope))) {
      throw new BackupError('not-a-backup');
    }
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    keeper: keeper as BackupFile['keeper'],
    game,
    preferences,
  };
}

/** The envelope as JSON text, bound to `profileId`; validation happens on import. */
export function rebind(envelope: unknown, profileId: string): string {
  if (typeof envelope !== 'object' || envelope === null || Array.isArray(envelope)) {
    throw new BackupError('not-a-backup');
  }
  return JSON.stringify({ ...(envelope as Record<string, unknown>), profileId });
}
