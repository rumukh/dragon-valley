/**
 * The application shell: the persistent chrome around screens (live regions, toasts, dialog
 * host, effects layer, boot status), the shared services, the active keeper's session, and the
 * error boundary that turns any failure into a calm screen instead of console noise.
 *
 * One keeper plays at a time. Opening a keeper loads their preferences and game session,
 * applies their presentation preferences (text size, reduced motion, volumes), binds the
 * visibility pause, routes live commit events to sounds and keeps them briefly for the screens
 * that celebrate them. Closing undoes all of it.
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
import { createTranslator, hasMessage } from '../i18n/messages';
import { createOfflineInstaller } from '../parent/offline';
import type { OfflineInstaller } from '../parent/offline';
import { profileSeed, SAVE_DATABASE } from '../../rules/contract';
import type { GameAction, GameEvent } from '../../rules/contract';
import type { ContentText } from '../content/text';
import type { DvGame, DvSession } from '../game/definition';
import { createPlayClock } from '../game/timer';
import type { PlayClock } from '../game/timer';
import { findKeeper } from '../persistence/family';
import type { Keeper } from '../persistence/family';
import { openGameSession } from '../persistence/game-session';
import { DEFAULT_PREFERENCES } from '../persistence/preferences';
import type { ChildPreferences } from '../persistence/preferences';
import { RecoveryRequired } from '../persistence/recovery';
import { FamilyStore, PreferencesStore } from '../persistence/stores';
import { createRouter } from '../router/router';
import type { Router, ScreenEntry } from '../router/router';
import { createReadAloud } from '../speech/read-aloud';
import type { ReadAloud } from '../speech/read-aloud';
import { createAnnouncer } from '../ui/announcer';
import { h } from '../ui/dom';
import { createKeyboard } from '../ui/keyboard';
import type { UiKit } from '../ui/kit';
import { createToaster } from '../ui/toast';

/** Live events kept for screens; older ones fall off (they only drive one-shot celebrations). */
const MAX_INBOX = 64;

/**
 * Events whose sounds belong to a celebration screen, which cues them in time with its picture
 * (the hatch fanfare lands when the shell pops), instead of when the answer is committed.
 */
const CELEBRATION_SOUNDS: ReadonlySet<string> = new Set(['dragon.hatched']);

/** The router key of a keeper's play screen. */
export function playKey(keeperId: string): string {
  return `play:${keeperId}`;
}

export interface AppEnvironment {
  /** Deployment base path, e.g. `/dragon-valley/`. */
  readonly base: string;
  /** Absolute base URL. */
  readonly baseUrl: string;
  /** The offline revision this build pins. */
  readonly revision: string;
}

/**
 * Live game events since a screen last took them, oldest first. Events are one-shots: a restore
 * empties the inbox, and screens rebuild from the view.
 */
export interface EventInbox {
  take(types?: readonly string[]): GameEvent[];
}

export interface ActiveKeeper {
  readonly keeper: Keeper;
  readonly game: DvSession;
  readonly commands: CommandController<GameAction>;
  readonly preferences: PreferencesStore;
  readonly events: EventInbox;
  /** Time played in this page (hidden time excluded), for the grown-ups' time limit. */
  readonly clock: PlayClock;
  /** True once the keeper's time limit (if any) is used up. */
  timeIsUp(): boolean;
}

export type ParentTab = 'keepers' | 'settings' | 'data' | 'offline' | 'about';

export interface Screens {
  title(): ScreenEntry;
  keepers(): ScreenEntry;
  editor(keeperId: string | null): ScreenEntry;
  /** The game: whatever the view requires now (story, round, results), else the hub. */
  play(keeperId: string): ScreenEntry;
  map(keeperId: string): ScreenEntry;
  region(keeperId: string, regionId: string): ScreenEntry;
  level(keeperId: string, levelId: string): ScreenEntry;
  market(keeperId: string): ScreenEntry;
  den(keeperId: string): ScreenEntry;
  album(keeperId: string): ScreenEntry;
  window(keeperId: string): ScreenEntry;
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
  /** The game definition and its content strings, set once at boot by `useContent`. */
  readonly game: DvGame;
  readonly text: ContentText;
  useContent(game: DvGame, text: ContentText): void;
  screens: Screens;
  active(): ActiveKeeper | null;
  /** Open a keeper's session (closing any other); throws `RecoveryRequired`. */
  openKeeper(keeperId: string): Promise<ActiveKeeper>;
  closeKeeper(): Promise<void>;
  /** Show what the game needs next: back to the keeper's play screen, rebuilt from the view. */
  continueGame(keeperId: string): Promise<void>;
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

  let content: { readonly game: DvGame; readonly text: ContentText } | null = null;
  const requireContent = (): { readonly game: DvGame; readonly text: ContentText } => {
    if (!content) throw new Error('The game content is not loaded.');
    return content;
  };

  type OpenKeeper = ActiveKeeper & { release(): Promise<void> };
  const clocks = new Map<string, PlayClock>();
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
      const game = await openGameSession(storage, requireContent().game, {
        id: keeper.id,
        seed: profileSeed(keeper.id),
      });
      const commands = createCommandController(game.host, (error) => app.reportError(error));
      // One clock per keeper and page, so closing and reopening a keeper keeps counting.
      const clock = clocks.get(keeper.id) ?? createPlayClock();
      clocks.set(keeper.id, clock);
      clock.resume();
      const unbindVisibility = bindVisibilityPause(
        document,
        (reason) => {
          game.host.pause(reason);
          clock.pause();
          audio.pause();
          stopSpeech();
        },
        (reason) => {
          audio.resume();
          clock.resume();
          void commands.resume(reason).catch((error) => app.reportError(error));
        },
      );
      const inbox: GameEvent[] = [];
      const events: EventInbox = {
        take(types) {
          const wanted = (event: GameEvent): boolean => !types || types.includes(event.type);
          const taken = inbox.filter(wanted);
          for (let index = inbox.length - 1; index >= 0; index--) {
            if (wanted(inbox[index]!)) inbox.splice(index, 1);
          }
          return taken;
        },
      };
      const unsubscribeCommits = game.host.subscribeCommits((commit) => {
        for (const event of commit.events) {
          if (!CELEBRATION_SOUNDS.has(event.type)) audio.cue(event.type, cueContext(event.data));
          inbox.push(event as unknown as GameEvent);
          if (inbox.length > MAX_INBOX) inbox.shift();
        }
      });
      const unsubscribeRestore = game.host.subscribe((_view, reason) => {
        if (reason !== 'restore') return;
        audio.clear();
        stopSpeech();
        inbox.length = 0;
        // The play screen shows what the restored game needs, never what it showed before.
        if (router.currentKey() === playKey(keeper.id)) void router.refresh();
      });
      const unsubscribePreferences = preferences.subscribe((value) => applyPresentation(value));
      applyPresentation(preferences.current());
      return {
        keeper,
        game,
        commands,
        preferences,
        events,
        clock,
        timeIsUp() {
          const limit = preferences.current().timeLimit;
          return limit !== null && clock.elapsed() >= limit * 60_000;
        },
        async release() {
          clock.pause();
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
        // Rule rejections have child-friendly lines by code; diagnostics never reach the screen.
        const key = `error.${code}`;
        toasts.show(hasMessage(key) ? t(key) : t('toast.failed'), { tone: 'warning' });
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
    get game() {
      return requireContent().game;
    },
    get text() {
      return requireContent().text;
    },
    useContent(game, text) {
      content = { game, text };
    },
    screens: undefined as unknown as Screens,
    active: () => active,
    openKeeper,
    closeKeeper,
    async continueGame(keeperId) {
      if (!(await router.backTo(playKey(keeperId)))) await router.push(app.screens.play(keeperId));
    },
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
