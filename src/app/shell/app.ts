/**
 * The application shell: the persistent chrome around screens (live regions, toasts, dialog
 * host, effects layer, boot status), the shared services, the active keeper's session, and the
 * error boundary that turns any failure into a calm screen instead of console noise.
 *
 * One keeper plays at a time. Opening a keeper loads their preferences and game session,
 * applies their presentation preferences (text size, reduced motion, volumes), binds the
 * visibility pause, and routes live commit events to sounds. Closing undoes all of it.
 */
import { IndexedDbSaveStorage } from '@aegis/browser/indexeddb';
import type { SaveStorage } from '@aegis/browser/save';
import { applyPresentationPreferences, bindVisibilityPause } from '@aegis/browser/ui';
import { createGameAudio } from '../audio/game-audio';
import type { GameAudio } from '../audio/game-audio';
import { eventCueContext as cueContext } from '../audio/sound-map';
import type { AudioMap } from '../audio/sound-map';
import {
  createCommandController,
  CommandRejectedError,
  StaleCommandError,
} from '../controller/commands';
import type { CommandController } from '../controller/commands';
import { createTranslator } from '../i18n/messages';
import { createOfflineInstaller } from '../parent/offline';
import type { OfflineInstaller } from '../parent/offline';
import { profileSeed, SAVE_DATABASE } from '../../rules/contract';
import { findKeeper } from '../persistence/family';
import type { Keeper } from '../persistence/family';
import { openGameSession } from '../persistence/game-session';
import type { GameDefinition, GameSession } from '../persistence/game-session';
import { DEFAULT_PREFERENCES } from '../persistence/preferences';
import type { ChildPreferences } from '../persistence/preferences';
import { RecoveryRequired } from '../persistence/recovery';
import { FamilyStore, PreferencesStore } from '../persistence/stores';
import type { PreviewAction, PreviewContent, PreviewState, PreviewView } from '../preview/adapter';
import { createRouter } from '../router/router';
import type { Router, ScreenEntry } from '../router/router';
import { createReadAloud } from '../speech/read-aloud';
import type { ReadAloud } from '../speech/read-aloud';
import { createAnnouncer } from '../ui/announcer';
import { h } from '../ui/dom';
import { createKeyboard } from '../ui/keyboard';
import type { UiKit } from '../ui/kit';
import { createToaster } from '../ui/toast';

export interface AppEnvironment {
  /** Deployment base path, e.g. `/dragon-valley/`. */
  readonly base: string;
  /** Absolute base URL. */
  readonly baseUrl: string;
  /** The offline revision this build pins. */
  readonly revision: string;
}

export type PreviewSession = GameSession<PreviewState, PreviewAction, PreviewView, PreviewContent>;
export type PreviewGame = GameDefinition<PreviewState, PreviewAction, PreviewView, PreviewContent>;

export interface ActiveKeeper {
  readonly keeper: Keeper;
  readonly game: PreviewSession;
  readonly commands: CommandController<PreviewAction>;
  readonly preferences: PreferencesStore;
}

export type ParentTab = 'keepers' | 'settings' | 'data' | 'offline' | 'about';

export interface Screens {
  title(): ScreenEntry;
  keepers(): ScreenEntry;
  editor(keeperId: string | null): ScreenEntry;
  hub(keeperId: string): ScreenEntry;
  round(keeperId: string): ScreenEntry;
  parent(tab?: ParentTab, keeperId?: string): ScreenEntry;
  recovery(problem: RecoveryRequired): ScreenEntry;
  error(error: unknown): ScreenEntry;
}

export interface App {
  readonly env: AppEnvironment;
  readonly kit: UiKit;
  readonly router: Router;
  readonly storage: SaveStorage;
  readonly family: FamilyStore;
  readonly audio: GameAudio;
  readonly speech: ReadAloud;
  readonly offline: OfflineInstaller;
  readonly game: PreviewGame;
  screens: Screens;
  active(): ActiveKeeper | null;
  /** Open a keeper's session (closing any other); throws `RecoveryRequired`. */
  openKeeper(keeperId: string): Promise<ActiveKeeper>;
  closeKeeper(): Promise<void>;
  /** Apply a keeper's presentation preferences, or the defaults with null. */
  applyPresentation(preferences: ChildPreferences | null): void;
  /** Read text aloud with the active keeper's voice, if read-aloud is available and on. */
  speak(text: string): boolean;
  /** Stop reading aloud (and bring the music back up). */
  stopSpeaking(): void;
  reportError(error: unknown): void;
  /** Mark the boot status element (tests and the splash rely on it). */
  setBootState(state: 'loading' | 'ready' | 'failed'): void;
  /** Record the validated content pack's revision on the boot status element. */
  markContent(revision: string): void;
}

export interface AppOptions {
  readonly env: AppEnvironment;
  readonly root: HTMLElement;
  readonly game: PreviewGame;
  readonly audioMap: AudioMap;
  readonly storage?: SaveStorage;
}

export function createApp(options: AppOptions): App {
  const { env, root } = options;
  const t = createTranslator();
  const announcer = createAnnouncer();
  const toasts = createToaster(announcer);
  const keyboard = createKeyboard(document);
  const stage = h('div', { className: 'dv-stage', testId: 'stage' });
  const fx = h('div', { className: 'dv-fx-layer', attributes: { 'aria-hidden': 'true' } });
  const dialogs = h('div', { className: 'dv-dialogs' });
  const bootStatus = h('p', {
    className: 'dv-visually-hidden',
    testId: 'boot-status',
    text: t('app.ready'),
    dataset: { state: 'loading' },
  });
  // The static splash stays on stage until the first screen replaces it.
  const splash = root.querySelector('.dv-splash');
  if (splash) stage.append(splash);
  root.replaceChildren(stage, toasts.element, fx, dialogs, announcer.element, bootStatus);

  const audio = createGameAudio({ baseUrl: env.baseUrl, map: options.audioMap });
  const speech = createReadAloud();
  const storage = options.storage ?? new IndexedDbSaveStorage(SAVE_DATABASE);
  const family = new FamilyStore(storage);
  const offline = createOfflineInstaller({ baseUrl: env.baseUrl, revision: env.revision });

  type OpenKeeper = ActiveKeeper & { release(): Promise<void> };
  let active: OpenKeeper | null = null;
  let opening: Promise<OpenKeeper> | null = null;

  const kit: UiKit = {
    t,
    keyboard,
    announcer,
    toasts,
    fx,
    dialogs,
    baseUrl: env.baseUrl,
    cue: (event, context) => audio.cue(event, context),
    onError: (error) => app.reportError(error),
  };

  // Music is lowered while the device reads aloud; the token ignores the end of a replaced line.
  let utterance = 0;
  const stopSpeech = (): void => {
    utterance += 1;
    speech.cancel();
    audio.duck(false);
  };

  const router = createRouter({
    stage,
    kit,
    appName: t('app.title'),
    onLeave() {
      stopSpeech();
      fx.replaceChildren();
    },
    onMount(screen, moved) {
      bootStatus.dataset['screen'] = (router.currentKey() ?? '').split(':')[0] ?? '';
      audio.setMusic(screen.music ?? null);
      if (moved) audio.cue('ui.navigate');
    },
    fallback: (error) => app.screens.error(error),
  });

  const applyPresentation = (preferences: ChildPreferences | null): void => {
    const chosen = preferences ?? DEFAULT_PREFERENCES;
    applyPresentationPreferences(document.documentElement, chosen.presentation);
    audio.setVolumes(chosen.presentation.volumes);
  };

  const closeKeeper = async (): Promise<void> => {
    const closing = active;
    active = null;
    if (!closing) return;
    await closing.release();
    applyPresentation(null);
  };

  const openKeeper = async (keeperId: string): Promise<ActiveKeeper> => {
    if (active?.keeper.id === keeperId) return active;
    if (opening) await opening.catch(() => undefined);
    if (active?.keeper.id === keeperId) return active;
    await closeKeeper();
    const keeper = findKeeper(family.state(), keeperId);
    if (!keeper) throw new Error('That keeper is not on this device.');
    const task = (async (): Promise<OpenKeeper> => {
      const preferences = new PreferencesStore(storage, keeper.id);
      await preferences.open();
      const game = await openGameSession(storage, options.game, {
        id: keeper.id,
        seed: profileSeed(keeper.id),
      });
      const commands = createCommandController(game.host, (error) => app.reportError(error));
      const unbindVisibility = bindVisibilityPause(
        document,
        (reason) => {
          game.host.pause(reason);
          audio.pause();
          stopSpeech();
        },
        (reason) => {
          audio.resume();
          void commands.resume(reason).catch((error) => app.reportError(error));
        },
      );
      const unsubscribeCommits = game.host.subscribeCommits((commit) => {
        for (const event of commit.events) audio.cue(event.type, cueContext(event.data));
      });
      const unsubscribeRestore = game.host.subscribe((_view, reason) => {
        if (reason === 'restore') {
          audio.clear();
          stopSpeech();
        }
      });
      const unsubscribePreferences = preferences.subscribe((value) => applyPresentation(value));
      applyPresentation(preferences.current());
      return {
        keeper,
        game,
        commands,
        preferences,
        async release() {
          unsubscribePreferences();
          unsubscribeRestore();
          unsubscribeCommits();
          unbindVisibility();
          commands.dispose();
          audio.clear();
          stopSpeech();
          await game.close();
        },
      };
    })();
    opening = task;
    try {
      const opened = await task;
      active = opened;
      return opened;
    } finally {
      if (opening === task) opening = null;
    }
  };

  const reportError = (error: unknown): void => {
    if (error instanceof RecoveryRequired) {
      void closeKeeper()
        .catch(() => undefined)
        .then(() => router.reset(app.screens.recovery(error)));
      return;
    }
    if (error instanceof StaleCommandError) {
      toasts.show(t('toast.stale'));
      return;
    }
    if (error instanceof CommandRejectedError) {
      if (error.accepted) return;
      const code = error.error.code;
      audio.cue('ui.blocked');
      if (code === 'paused') toasts.show(t('toast.paused'));
      else if (code !== 'checkpoint-blocked' && code !== 'busy') {
        toasts.show(t('toast.failed'), { tone: 'warning' });
      }
      return;
    }
    void closeKeeper()
      .catch(() => undefined)
      .then(() => router.reset(app.screens.error(error)));
  };

  const app: App = {
    env,
    kit,
    router,
    storage,
    family,
    audio,
    speech,
    offline,
    game: options.game,
    screens: undefined as unknown as Screens,
    active: () => active,
    openKeeper,
    closeKeeper,
    applyPresentation,
    speak(text) {
      const current = active?.preferences.current();
      if (!current?.readAloud || !speech.available()) return false;
      const own = ++utterance;
      const started = speech.speak(text, {
        voice: current.voice,
        volume: current.presentation.volumes.narration,
        onEnd: () => {
          if (own === utterance) audio.duck(false);
        },
      });
      if (started) audio.duck(true);
      return started;
    },
    stopSpeaking: stopSpeech,
    reportError,
    setBootState(state) {
      bootStatus.dataset['state'] = state;
      if (state === 'ready') root.removeAttribute('aria-busy');
    },
    markContent(revision) {
      bootStatus.dataset['contentRevision'] = revision;
    },
  };

  // The first trusted gesture anywhere unlocks audio (the title's Play tap does it explicitly).
  const unlock = (): void => {
    if (audio.status() === 'locked' || audio.status() === 'blocked') audio.unlock();
  };
  root.addEventListener('pointerdown', unlock, { capture: true });
  root.addEventListener('keydown', unlock, { capture: true });

  window.addEventListener('error', (event) => {
    event.preventDefault();
    reportError(event.error ?? new Error('Uncaught page error'));
  });
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    reportError(event.reason);
  });

  return app;
}
