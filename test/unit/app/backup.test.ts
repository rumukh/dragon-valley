/**
 * Backup files hold one keeper. Reading one is strict, and envelopes are rebound to the keeper
 * they are loaded into (their contents are then validated like a fresh load).
 */
import { describe, expect, it } from 'vitest';
import {
  BACKUP_MAX_BYTES,
  BackupError,
  createBackup,
  readBackup,
  rebind,
} from '../../../src/app/persistence/backup';

const game = JSON.stringify({ format: 'aegis.save', profileId: 'profile-1', revision: 3 });
const preferences = JSON.stringify({ format: 'aegis.save', profileId: 'profile-1', revision: 1 });

describe('backup files', () => {
  it('round-trip a keeper with their game and preferences', () => {
    const text = createBackup({ name: 'Šárka', avatar: 'keeper-5' }, game, preferences);
    const backup = readBackup(text);
    expect(backup.keeper).toEqual({ name: 'Šárka', avatar: 'keeper-5' });
    expect(backup.game).toEqual(JSON.parse(game));
    expect(backup.preferences).toEqual(JSON.parse(preferences));
  });

  it('allow a keeper who has not saved a game yet', () => {
    const backup = readBackup(
      createBackup({ name: 'Tom', avatar: 'keeper-1' }, undefined, undefined),
    );
    expect(backup.game).toBeNull();
    expect(backup.preferences).toBeNull();
  });

  it('refuse anything that is not a backup of this format', () => {
    const valid = JSON.parse(createBackup({ name: 'Tom', avatar: 'keeper-1' }, game, undefined));
    const cases: [string, BackupError['code']][] = [
      ['not json', 'not-a-backup'],
      ['[]', 'not-a-backup'],
      [JSON.stringify({ ...valid, format: 'other-game' }), 'not-a-backup'],
      [JSON.stringify({ ...valid, version: 2 }), 'unsupported'],
      [JSON.stringify({ ...valid, keeper: { name: 'Tom', avatar: 'dragon' } }), 'not-a-backup'],
      [JSON.stringify({ ...valid, game: [1, 2] }), 'not-a-backup'],
      ['x'.repeat(BACKUP_MAX_BYTES + 1), 'too-large'],
    ];
    for (const [text, code] of cases) {
      const error = (() => {
        try {
          readBackup(text);
        } catch (cause) {
          return cause;
        }
        return undefined;
      })();
      expect(error, text.slice(0, 40)).toBeInstanceOf(BackupError);
      expect((error as BackupError).code).toBe(code);
    }
  });

  it('rebind an envelope to the keeper it is loaded into', () => {
    expect(JSON.parse(rebind(JSON.parse(game), 'profile-4'))).toEqual({
      format: 'aegis.save',
      profileId: 'profile-4',
      revision: 3,
    });
    expect(() => rebind(null, 'profile-4')).toThrow(BackupError);
  });
});
