/**
 * The screen registry the shell navigates with, so screens never import one another.
 */
import type { App, Screens } from '../shell/app';
import { editorScreen } from './editor';
import { keepersScreen } from './keepers';
import { levelScreen, mapScreen, regionScreen } from './map';
import { parentScreen } from './parent';
import { playScreen } from './play';
import { errorScreen, recoveryScreen } from './recovery';
import { titleScreen } from './title';

export function createScreens(app: App): Screens {
  return {
    title: () => titleScreen(app),
    keepers: () => keepersScreen(app),
    editor: (keeperId) => editorScreen(app, keeperId),
    play: (keeperId) => playScreen(app, keeperId),
    map: (keeperId) => mapScreen(app, keeperId),
    region: (keeperId, regionId) => regionScreen(app, keeperId, regionId),
    level: (keeperId, levelId) => levelScreen(app, keeperId, levelId),
    parent: (tab, keeperId) => parentScreen(app, tab, keeperId),
    recovery: (problem) => recoveryScreen(app, problem),
    error: (error) => errorScreen(app, error),
  };
}
