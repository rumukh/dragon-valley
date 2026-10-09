/**
 * The screen registry the shell navigates with, so screens never import one another.
 */
import type { App, Screens } from '../shell/app';
import { albumScreen, denScreen, marketScreen, windowScreen } from './collections';
import { editorScreen } from './editor';
import { goodbyeScreen } from './goodbye';
import { keepersScreen } from './keepers';
import { levelScreen, mapScreen, regionScreen } from './map';
import { parentScreen } from './parent';
import { playScreen } from './play';
import { printScreen } from './print';
import { errorScreen, recoveryScreen } from './recovery';
import { gradeDoneScreen } from './grade-done';
import { sunWindowScreen } from './sun-window';
import { titleScreen } from './title';

export function createScreens(app: App): Screens {
  return {
    title: () => titleScreen(app),
    keepers: () => keepersScreen(app),
    editor: (keeperId) => editorScreen(app, keeperId),
    play: (keeperId) => playScreen(app, keeperId),
    map: (keeperId, sheet) => mapScreen(app, keeperId, sheet),
    region: (keeperId, regionId) => regionScreen(app, keeperId, regionId),
    level: (keeperId, levelId) => levelScreen(app, keeperId, levelId),
    market: (keeperId) => marketScreen(app, keeperId),
    den: (keeperId) => denScreen(app, keeperId),
    album: (keeperId) => albumScreen(app, keeperId),
    window: (keeperId) => windowScreen(app, keeperId),
    sunWindow: (keeperId) => sunWindowScreen(app, keeperId),
    gradeDone: (keeperId, grade) => gradeDoneScreen(app, keeperId, grade),
    parent: (tab, keeperId) => parentScreen(app, tab, keeperId),
    goodbye: (keeperId) => goodbyeScreen(app, keeperId),
    print: (request) => printScreen(app, request),
    recovery: (problem) => recoveryScreen(app, problem),
    error: (error) => errorScreen(app, error),
  };
}
