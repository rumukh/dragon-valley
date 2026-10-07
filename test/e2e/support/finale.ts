/**
 * The finale without playing the whole valley in the browser: the rules themselves
 * (test/traces/support.ts, with its own answer oracle) win over the Seven-Headed Dragon in a fresh
 * game with Dragon Castle unlocked ahead, and the save, stopped on the finale beat, becomes a
 * keeper backup file to load through the grown-ups' area (`loadBackup`).
 */
import { PERFECT, Player } from '../../traces/support';
import { expect } from './fixtures';

export const FINALE_BEAT = 'beat.finale';

/** The local date `YYYY-MM-DD` of the machine running the tests (and its browsers). */
function localDay(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A keeper backup whose game waits on the finale beat, the Seven-Headed Dragon just cured. */
export async function finaleBackup(): Promise<string> {
  const player = new Player(PERFECT, 'finale');
  try {
    await player.act({ type: 'startSession', day: localDay() });
    await player.choose(null);
    await player.choose('goldie');
    await player.act({
      type: 'setSetting',
      setting: { key: 'unlockAhead', value: ['dragon-castle'] },
    });
    await player.act({ type: 'startLevel', level: 'dragon-castle.boss' });
    await player.settleStory();
    await player.playRound();
    await player.act({ type: 'endRound', reason: 'done' });
    for (let guard = 0; guard < 10; guard++) {
      const story = player.view().story;
      if (story === null || story.beat === FINALE_BEAT) break;
      await player.choose(null);
    }
    expect(player.failures, 'the rules took every step').toEqual([]);
    expect(player.view().story?.beat, 'the game waits on the finale beat').toBe(FINALE_BEAT);
    const snapshot = player.host.snapshot();
    const game = {
      format: 'aegis.save',
      formatVersion: 1,
      gameId: 'dragon-valley',
      profileId: 'finale',
      contentRevision: snapshot.content.revision,
      schemaVersion: snapshot.stateVersion,
      engine: { id: 'aegis-runtime', snapshotVersion: 1, revision: 'runtime-1' },
      revision: 1,
      state: snapshot,
      resume: null,
    };
    return JSON.stringify({
      format: 'dragon-valley-backup',
      version: 1,
      keeper: { name: 'Finale', avatar: 'keeper-2' },
      game,
      preferences: null,
    });
  } finally {
    await player.dispose();
  }
}
