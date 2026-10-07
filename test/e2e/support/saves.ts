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

/** A new keeper of today who has heard the prologue and chosen Bubbles' egg. */
async function newMeadowPlayer(profileId: string): Promise<Player> {
  const player = new Player(PERFECT, profileId);
  try {
    await player.act({ type: 'startSession', day: localDay() });
    await player.choose(null);
    await player.choose('bubbles');
    return player;
  } catch (error) {
    await player.dispose();
    throw error;
  }
}

/**
 * A keeper who has played Sunny Meadow's lessons in order up to `level`, which is open and not yet
 * played: the level as a child first meets it.
 */
export async function meadowBackupBefore(level: string): Promise<string> {
  const index = MEADOW_LEVELS.indexOf(level);
  if (index < 0) throw new Error(`${level} is not one of Sunny Meadow's lessons.`);
  const profileId = `before-${level.replace(/\W+/g, '-')}`;
  const player = await newMeadowPlayer(profileId);
  try {
    for (const played of MEADOW_LEVELS.slice(0, index)) await player.playLevel(played);
    expect(player.failures, 'the rules took every step').toEqual([]);
    const card = player
      .view()
      .hub.regions.find((region) => region.id === 'sunny-meadow')
      ?.levels.find((candidate) => candidate.id === level);
    expect(card?.status, `${level} is open and not yet played`).toBe('open');
    return backupOf(player, profileId);
  } finally {
    await player.dispose();
  }
}

/** A keeper who has played Sunny Meadow to its end, the Bridge Troll won over: the Arena opens. */
export async function meadowWonBackup(): Promise<string> {
  const player = await newMeadowPlayer('meadow-won');
  try {
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
