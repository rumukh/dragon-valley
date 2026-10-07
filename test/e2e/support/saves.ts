/**
 * Keeper backups the rules themselves play to (the trace player of test/traces/support.ts, with
 * its own answer oracle), for states a browser test would take minutes to reach by playing; a test
 * loads one through the grown-ups' area (`loadBackup`), as support/finale.ts does for the finale.
 */
import { PERFECT, Player } from '../../traces/support';
import { expect } from './fixtures';

const MEADOW_LEVELS = [
  'sunny-meadow.1',
  'sunny-meadow.2',
  'sunny-meadow.3',
  'sunny-meadow.4',
  'sunny-meadow.5',
  'sunny-meadow.6',
];

/** The local date `YYYY-MM-DD` of the machine running the tests (and its browsers). */
function localDay(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The player's game as a keeper backup file (`dragon-valley-backup` v1, docs/app.md §4). */
function backupOf(player: Player, profileId: string): string {
  const snapshot = player.host.snapshot();
  return JSON.stringify({
    format: 'dragon-valley-backup',
    version: 1,
    keeper: { name: 'Backup', avatar: 'keeper-2' },
    game: {
      format: 'aegis.save',
      formatVersion: 1,
      gameId: 'dragon-valley',
      profileId,
      contentRevision: snapshot.content.revision,
      schemaVersion: snapshot.stateVersion,
      engine: { id: 'aegis-runtime', snapshotVersion: 1, revision: 'runtime-1' },
      revision: 1,
      state: snapshot,
      resume: null,
    },
    preferences: null,
  });
}

/** A keeper who has played Sunny Meadow to its end, the Bridge Troll won over: the Arena opens. */
export async function meadowWonBackup(): Promise<string> {
  const player = new Player(PERFECT, 'meadow-won');
  try {
    await player.act({ type: 'startSession', day: localDay() });
    await player.choose(null);
    await player.choose('bubbles');
    for (const level of MEADOW_LEVELS) await player.playLevel(level);
    await player.act({ type: 'startLevel', level: 'sunny-meadow.boss' });
    await player.settleStory();
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
    await player.settleStory();
    expect(player.failures, 'the rules took every step').toEqual([]);
    expect(player.view().hub.arena.available, 'the Arena is open after the Bridge Troll').toBe(
      true,
    );
    return backupOf(player, 'meadow-won');
  } finally {
    await player.dispose();
  }
}
