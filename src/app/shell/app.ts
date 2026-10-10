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
import {
  applyPresentationPreferences,
  bindVisibilityPause,
  CHILD_SAFE_PRESET,
} from '@aegis/browser/ui';
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
import { createTranslator, EN_UI, hasMessage } from '../i18n/messages';
import { createOfflineInstaller } from '../parent/offline';
import type { OfflineInstaller } from '../parent/offline';
import { profileSeed, SAVE_DATABASE } from '../../rules/contract';
import type { GameAction, Grade, GameEvent } from '../../rules/contract';
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
import { DayStore } from '../persistence/day';
import { FamilyStore, PreferencesStore } from '../persistence/stores';
import { createRouter } from '../router/router';
import type { Router, ScreenEntry } from '../router/router';
import type { PrintRequest } from '../screens/print';
import { speechAliases } from '../speech/aliases';
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
  /** How the keeper's day began, for the Dragon Diary. */
  readonly day: DayStore;
  readonly events: EventInbox;
  /** Time played in this page (hidden time excluded), for the grown-ups' time limit. */
  readonly clock: PlayClock;
  /** True once the keeper's time limit (if any) is used up. */
  timeIsUp(): boolean;
}

export type ParentTab =
  'keepers' | 'progress' | 'print' | 'settings' | 'data' | 'offline' | 'about';

export interface Screens {
  title(): ScreenEntry;
  keepers(): ScreenEntry;
  editor(keeperId: string | null): ScreenEntry;
  /** The game: whatever the view requires now (story, round, results), else the hub. */
  play(keeperId: string): ScreenEntry;
  map(keeperId: string, sheet?: string): ScreenEntry;
  region(keeperId: string, regionId: string): ScreenEntry;
  level(keeperId: string, levelId: string): ScreenEntry;
  market(keeperId: string): ScreenEntry;
  den(keeperId: string): ScreenEntry;
  album(keeperId: string): ScreenEntry;
  window(keeperId: string): ScreenEntry;
  sunWindow(keeperId: string): ScreenEntry;
  gradeDone(keeperId: string, grade: Grade): ScreenEntry;
  parent(tab?: ParentTab, keeperId?: string): ScreenEntry;
  /** Goodbye, with the Dragon Diary of the keeper's day. */
  goodbye(keeperId: string): ScreenEntry;
  /** The print preview of a printable from the grown-ups' area. */
  print(request: PrintRequest): ScreenEntry;
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
  // A signal for tools (its attributes), not for people: kept out of the accessibility tree.
  const bootStatus = h('p', {
    className: 'dv-visually-hidden',
    testId: 'boot-status',
    text: t('app.ready'),
    dataset: { state: 'loading' },
    attributes: { 'aria-hidden': 'true' },
  });
  // The static splash stays on stage until the first screen replaces it.
  const splash = root.querySelector('.dv-splash');
  if (splash) stage.append(splash);
  root.replaceChildren(stage, toasts.element, fx, dialogs, announcer.element, bootStatus);

  const audio = createGameAudio({ baseUrl: env.baseUrl, map: options.audioMap });
  const speech = createReadAloud(undefined, speechAliases(EN_UI));
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
      // Called just before the next screen is inserted: at a new text size the stage is already
      // transparent, with its style flushed, when that screen's first frame is drawn (DV-QA-13).
      if (rescaled !== null) hideStage();
    },
    onMount(screen, moved) {
      bootStatus.dataset['screen'] = (router.currentKey() ?? '').split(':')[0] ?? '';
      audio.setMusic(screen.music ?? null);
      if (moved) audio.cue('ui.navigate');
      if (rescaled !== null) revealAtScale(screen.element, rescaled);
      rescaled = null;
    },
    fallback: (error) => app.screens.error(error),
  });

  /** A text size the next screen must be drawn at before anyone sees it (DV-QA-13). */
  let rescaled: number | null = null;
  let revealing = 0;
  /**
   * WebKit can apply the `data-restyling` rule a frame late, the very frame a new screen is drawn
   * at the old size, so the stage is also made transparent inline and its style read back at once.
   * A stage nothing reveals within a moment is shown again whatever happens.
   */
  const hideStage = (): void => {
    const own = ++revealing;
    stage.dataset['restyling'] = 'true';
    stage.style.opacity = '0';
    void getComputedStyle(stage).opacity;
    setTimeout(() => {
      if (own === revealing) showStage();
    }, 600);
  };
  const showStage = (): void => {
    delete stage.dataset['restyling'];
    stage.style.removeProperty('opacity');
  };
  /**
   * After a change of text size the next screen stays transparent until it is styled at the new
   * size: an engine can draw a newly mounted screen against the root's old size for a few frames
   * (WebKit, sometimes Chromium), so a 200 % reader would see small text flash. The stage is
   * transparent, not hidden, so focus and screen readers are not disturbed; at most 400 ms. A
   * screen already at its size when it is mounted is shown at once.
   */
  const revealAtScale = (element: HTMLElement, scale: number): void => {
    const own = ++revealing;
    const expected = CHILD_SAFE_PRESET.readingPixels * scale;
    const started = performance.now();
    const ready = (): boolean =>
      Math.abs(parseFloat(getComputedStyle(element).fontSize) - expected) < 0.5;
    if (ready()) {
      showStage();
      return;
    }
    stage.dataset['restyling'] = 'true';
    stage.style.opacity = '0';
    const check = (): void => {
      if (own !== revealing) return;
      if (!element.isConnected || ready() || performance.now() - started > 400) {
        showStage();
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  };

  const applyPresentation = (preferences: ChildPreferences | null): void => {
    const chosen = preferences ?? DEFAULT_PREFERENCES;
    const root = document.documentElement;
    // The page starts at the default size, so opening a keeper at that size changes nothing.
    const drawn = root.dataset['textScale'] ?? String(DEFAULT_PREFERENCES.presentation.textScale);
    if (drawn !== String(chosen.presentation.textScale)) {
      rescaled = chosen.presentation.textScale;
    }
    applyPresentationPreferences(root, chosen.presentation);
    // The SDK sets only the --aegis-text-scale property, and an engine can keep the root's old
    // font size for a while after that (DV-QA-13: WebKit, and once Chromium). The root's own
    // font size, set here directly, is restyled at once, so the next screen's very first frame
    // is already at the keeper's size; the attribute names the scale for styles and tests.
    root.dataset['textScale'] = String(chosen.presentation.textScale);
    root.style.fontSize = `${CHILD_SAFE_PRESET.readingPixels * chosen.presentation.textScale}px`;
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
      const day = new DayStore(storage, keeper.id);
      await day.open();
      const game = await openGameSession(storage, requireContent().game, {
        id: keeper.id,
        seed: profileSeed(keeper.id),
      });
      const commands = createCommandController(
        game.host,
        (error) => app.reportError(error),
        (listener) => game.subscribe((change) => listener(change.reason)),
      );
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
      // Everything the shell does with a commit hangs off the session's one host listener.
      const unsubscribeChanges = game.subscribe((change) => {
        if (change.reason === 'restore') {
          audio.clear();
          stopSpeech();
          inbox.length = 0;
          // The play screen shows what the restored game needs, never what it showed before.
          if (router.currentKey() === playKey(keeper.id)) void router.refresh();
          return;
        }
        // A new round starts a new results story: what came before it (the first egg chosen in
        // the story, an earlier round's sticker) is not celebrated again at this round's end.
        if (change.events.some((event) => event.type === 'round.started')) inbox.length = 0;
        for (const event of change.events) {
          if (!CELEBRATION_SOUNDS.has(event.type)) audio.cue(event.type, cueContext(event.data));
          inbox.push(event as unknown as GameEvent);
          if (inbox.length > MAX_INBOX) inbox.shift();
        }
      });
      const unsubscribePreferences = preferences.subscribe((value) => applyPresentation(value));
      applyPresentation(preferences.current());
      return {
        keeper,
        game,
        commands,
        preferences,
        day,
        events,
        clock,
        timeIsUp() {
          const limit = preferences.current().timeLimit;
          return limit !== null && clock.elapsed() >= limit * 60_000;
        },
        async release() {
          clock.pause();
          unsubscribePreferences();
          unsubscribeChanges();
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
