/**
 * The screen registry the shell navigates with, so screens never import one another.
 */
import type { App, Screens } from '../shell/app';
import { editorScreen } from './editor';
import { hubScreen } from './hub';
import { keepersScreen } from './keepers';
import { parentScreen } from './parent';
import { errorScreen, recoveryScreen } from './recovery';
import { roundScreen } from './round';
import { titleScreen } from './title';

export function createScreens(app: App): Screens {
  return {
    title: () => titleScreen(app),
    keepers: () => keepersScreen(app),
    editor: (keeperId) => editorScreen(app, keeperId),
    hub: (keeperId) => hubScreen(app, keeperId),
    round: (keeperId) => roundScreen(app, keeperId),
    parent: (tab, keeperId) => parentScreen(app, tab, keeperId),
    recovery: (problem) => recoveryScreen(app, problem),
    error: (error) => errorScreen(app, error),
  };
}
