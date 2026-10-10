/**
 * Keeper backups the rules themselves play to (the trace player of test/traces/support.ts, with
 * its own answer oracle), for states a browser test would take minutes to reach by playing; a test
 * loads one through the grown-ups' area (`loadBackup`), as support/finale.ts does for the finale.
 */
import { PERFECT, Player } from '../../traces/support';
import type { Style } from '../../traces/support';
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
async function newMeadowPlayer(profileId: string, style: Style = PERFECT): Promise<Player> {
  const player = new Player(style, profileId);
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

const BROOK_LEVELS = [
  'pebble-brook.1',
  'pebble-brook.2',
  'pebble-brook.3',
  'pebble-brook.4',
  'pebble-brook.5',
  'pebble-brook.6',
];

/** Through a story beat: the wanted choice where it is offered, else Next, else skip. */
async function walkStory(player: Player, want: string): Promise<void> {
  for (let guard = 0; guard < 30; guard++) {
    const story = player.view().story;
    if (story === null) return;
    const ids = story.choices.map((choice) => choice.id);
    const choice = ids.includes(want)
      ? want
      : ids.includes('next')
        ? 'next'
        : story.skippable || ids.length === 0
          ? null
          : ids[0]!;
    if (!(await player.choose(choice))) return;
  }
}

/**
 * A 1st grader (docs/grades-plan.md) who chose Hop's egg at the brook and has played Pebble
 * Brook's lessons in order up to `level`, which is open and not yet played.
 */
export async function brookBackupBefore(level: string): Promise<string> {
  const index = BROOK_LEVELS.indexOf(level);
  if (index < 0) throw new Error(`${level} is not one of Pebble Brook's lessons.`);
  const profileId = `brook-before-${level.replace(/\W+/g, '-')}`;
  const player = new Player(PERFECT, profileId);
  try {
    await player.act({ type: 'setSetting', setting: { key: 'grade', value: 1 } });
    await player.act({ type: 'startSession', day: localDay() });
    await walkStory(player, 'hop');
    for (const played of BROOK_LEVELS.slice(0, index)) {
      await player.act({ type: 'startLevel', level: played });
      await walkStory(player, 'hop');
      for (let guard = 0; guard < 10; guard++) {
        await player.playRound();
        if (player.view().round === null) break;
        await player.act({ type: 'endRound', reason: 'done' });
        const run = player.view().run;
        if (run === null || run.result !== null) break;
        await player.act({ type: 'startActivity', activity: { kind: 'level', index: run.next } });
      }
      await walkStory(player, 'hop');
    }
    expect(player.failures, 'the rules took every step').toEqual([]);
    const card = player
      .view()
      .hub.regions.find((region) => region.id === 'pebble-brook')
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

/** Which missed fact a backup is built around: one with a picture, or a × 0 fact (none). */
export type MissedFact = 'with a picture' | 'times zero';
/** Where the game is stopped: the fact asked again after one miss, or taught after two. */
export type MissedStop = 'reask' | 'teach';

/** A keeper's game stopped on a missed fact that has come back. */
export interface MissedFactBackup {
  readonly text: string;
  /** The numbers of the problem it is stopped on, smallest first (to find it on the screen). */
  readonly numbers: readonly number[];
}

/** Every number written in a problem's structure (its blanks hold none). */
function numbersIn(node: unknown): number[] {
  if (node === null || typeof node !== 'object') return [];
  const record = node as Record<string, unknown>;
  if (record['kind'] === 'num' && typeof record['value'] === 'number') return [record['value']];
  return Object.values(record).flatMap(numbersIn);
}

/**
 * One try at a missed-fact game (see `missedFactBackup`) with the rules' random draws seeded by
 * `profileId`: the backup, or null when the fact did not come back in Sunny Meadow.
 */
async function tryMissedFact(
  fact: MissedFact,
  stop: MissedStop,
  profileId: string,
): Promise<MissedFactBackup | null> {
  const wanted = (problem: unknown): boolean => {
    const numbers = numbersIn(problem);
    return fact === 'times zero' ? numbers.includes(0) : numbers.every((n) => n >= 1);
  };
  let target: string | null = null;
  let misses = 0;
  const style: Style = {
    right: (_n, view) => {
      const served = view.problem;
      if (view.activity !== 'feeding' || !served) return true;
      if (target === null && wanted(served.problem)) target = served.item;
      if (served.item !== target || misses >= 2) return true;
      misses += 1;
      return false;
    },
    elapsedMs: () => 1500,
    clumsy: false,
  };
  const player = await newMeadowPlayer(profileId, style);
  try {
    for (const level of MEADOW_LEVELS) {
      expect(await player.act({ type: 'startLevel', level }), `${level} starts`).toBe(true);
      await player.settleStory();
      for (let activity = 0; activity < 5; activity++) {
        for (let turn = 0; turn < 80; turn++) {
          const round = player.view().round;
          if (round === null || round.status !== 'active') break;
          if (round.type !== 'problems') {
            await player.playBoard();
            continue;
          }
          const problem = round.problem;
          const back = problem !== null && problem.item === target;
          if (back && (stop === 'reask' ? problem.reask && misses === 1 : problem.teach === true)) {
            expect(player.failures, 'the rules took every step').toEqual([]);
            const numbers = numbersIn(problem.problem).sort((a, b) => a - b);
            return { text: backupOf(player, profileId), numbers };
          }
          if (!(await player.answer())) break;
        }
        if (player.view().round === null) break;
        await player.act({ type: 'endRound', reason: 'done' });
        const run = player.view().run;
        if (run === null || run.result !== null) {
          await player.settleStory();
          break;
        }
        await player.act({ type: 'startActivity', activity: { kind: 'level', index: run.next } });
      }
    }
    return null;
  } finally {
    await player.dispose();
  }
}

/**
 * A keeper whose game waits on a missed fact that has come back (the rules' "teach, then ask",
 * plan §2.3). In Sunny Meadow's Feeding Times the first fact of the kind asked for is missed, and
 * missed again when it comes back (its re-ask, three problems later). The game is stopped on that
 * re-ask (`reask`), or played on until the fact comes back a third time, taught first (`teach`),
 * mid-round as a reload would find it. Every other answer is right.
 *
 * A fact missed twice is due again the next day, so on the same day it comes back only if a later
 * lesson draws it; the draws follow the seed, so a few seeds are tried in turn.
 */
export async function missedFactBackup(
  fact: MissedFact,
  stop: MissedStop,
): Promise<MissedFactBackup> {
  for (let attempt = 1; attempt <= 12; attempt++) {
    const profileId = `missed-${fact.replace(/\W+/g, '-')}-${stop}-${attempt}`;
    const backup = await tryMissedFact(fact, stop, profileId);
    if (backup) return backup;
  }
  throw new Error(`No ${fact} fact missed twice in Sunny Meadow came back (${stop}) in 12 seeds.`);
}
