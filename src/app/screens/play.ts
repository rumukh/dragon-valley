/**
 * The keeper's game screen. It shows whatever the game needs now, straight from the view: a
 * story beat, the active round (a problem round or a minigame board), the results of a finished
 * round, or else the hub. After an action that changes this, screens ask the shell to continue
 * the game, which rebuilds this entry; Back from anything opened on top of it returns here.
 *
 * Building it is the safe boundary where newer content is activated: a save from before an
 * update moves to the newest pack here, before today's session starts, unless a round or a story
 * is still in progress (the rules refuse then, and the next visit tries again). Entering it starts
 * the day's session when the local date has changed (time reaches the rules only as this date).
 */
import { gameDay } from '../game/view';
import type { ScreenEntry } from '../router/router';
import { playKey } from '../shell/app';
import type { ActiveKeeper, App } from '../shell/app';
import { localDay } from './common';
import { hubScreen } from './hub';
import { minigameScreen } from './minigames';
import { problemRoundScreen } from './problems';
import { resultsScreen } from './results';
import { storyScreen } from './story';
import { applyPendingGrade } from '../game/grade';

/** Start (or resume) today's session unless the game is already on today's date. */
export async function startToday(active: ActiveKeeper, today = localDay()): Promise<void> {
  if (active.game.view().day === today) return;
  await active.commands.capture()({ type: 'startSession', day: today });
}

export function playScreen(app: App, keeperId: string): ScreenEntry {
  return {
    key: playKey(keeperId),
    async build() {
      const active = await app.openKeeper(keeperId);
      await active.game.activateLatestContent();
      // The Dragon Diary tells what today brought: note how the day begins.
      const today = localDay();
      await active.day.begin(gameDay(active.game.view(), today), active.game.view());
      await startToday(active, today);
      await applyPendingGrade(app, active);
      const view = active.game.view();
      switch (view.screen) {
        case 'story':
          if (view.story) return storyScreen(app, active);
          break;
        case 'round':
          if (view.round?.type === 'problems') return problemRoundScreen(app, active);
          if (view.round?.type === 'minigame') return minigameScreen(app, active);
          break;
        case 'results':
          if (view.round) return resultsScreen(app, active);
          break;
        case 'hub':
          break;
      }
      await active.game.activateLatestContent();
      return hubScreen(app, active);
    },
  };
}
