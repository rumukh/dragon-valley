/**
 * The screen router: mounts one screen at a time into the stage, with an explicit in-memory
 * stack (no browser history), focus moved to the new screen's heading, announcements and
 * speech cleared at every change, and an error boundary.
 *
 * Each screen is built from an entry; Back rebuilds the previous entry from scratch rather
 * than reviving stale DOM. A navigation that is overtaken by a newer one is discarded (and its
 * screen disposed) before it can mount, so double taps cannot interleave screens.
 * Every candidate tree passes `assertChildSafeView` (no outbound links, no embeds) first.
 */
import { assertChildSafeView, replaceProjection } from '@aegis/browser/ui';
import { applyRegion } from '../design/tokens';
import type { UiKit } from '../ui/kit';
import { createScreenStack } from './stack';
import type { ScreenStack } from './stack';

export type Field = 'valley' | 'desk' | 'night';

export interface Screen {
  readonly element: HTMLElement;
  /** Document title part; the router appends the game name. */
  readonly title: string;
  readonly field?: Field;
  /** Region accent for the screen (palette `regions`), or none. */
  readonly region?: string | null;
  /** Music state for the screen (docs/audio.md "Music states"), null for silence. */
  readonly music?: string | null;
  /** The element focused after mounting; defaults to the screen's first heading. */
  focusTarget?(): HTMLElement | null;
  /** Escape on this screen (for example: pause). True when handled. */
  onEscape?(): boolean;
  /** Runs once the screen is in the document. */
  mounted?(): void;
  /** Runs once when the screen leaves: release keys, timers and subscriptions. */
  dispose?(): void;
}

export interface ScreenContext {
  /** Aborted when a newer navigation overtakes this one before it mounts. */
  readonly signal: AbortSignal;
  /** Whether Back will lead somewhere once this screen is shown. */
  readonly canGoBack: boolean;
}

export interface ScreenEntry {
  readonly key: string;
  build(context: ScreenContext): Screen | Promise<Screen>;
}

export interface Router {
  push(entry: ScreenEntry): Promise<void>;
  replace(entry: ScreenEntry): Promise<void>;
  reset(entry: ScreenEntry): Promise<void>;
  back(): Promise<void>;
  /** Rebuild the current screen in place (after a preference change). */
  refresh(): Promise<void>;
  canGoBack(): boolean;
  currentKey(): string | undefined;
  dispose(): void;
}

export interface RouterOptions {
  readonly stage: HTMLElement;
  readonly kit: UiKit;
  readonly appName: string;
  /** Stop speech and one-shot sounds that belong to the leaving screen. */
  onLeave(): void;
  /** A screen is in place (music, navigation sound); `moved` for push and back. */
  onMount?(screen: Screen, moved: boolean): void;
  /** The error boundary: a screen that explains a failure and offers a way on. */
  fallback(error: unknown): ScreenEntry;
}

type Mode = 'push' | 'replace' | 'reset' | 'back' | 'refresh';

export function createRouter(options: RouterOptions): Router {
  const { stage, kit } = options;
  let stack: ScreenStack<ScreenEntry> | undefined;
  let current: Screen | undefined;
  let serial = 0;
  let controller: AbortController | undefined;

  const safely = (work: () => void): void => {
    try {
      work();
    } catch (error) {
      kit.onError(error);
    }
  };

  const mount = (screen: Screen, moved = false): void => {
    const previous = current;
    current = screen;
    if (previous?.dispose) safely(() => previous.dispose!());
    screen.element.classList.add('dv-screen', `dv-field-${screen.field ?? 'valley'}`);
    assertChildSafeView(screen.element, kit.baseUrl);
    replaceProjection(stage, () => screen.element, {
      stopAudio: options.onLeave,
      clearAnnouncements: () => kit.announcer.clear(),
      cancelInput: () => undefined,
      focus: () => {
        const target = screen.focusTarget?.() ?? screen.element.querySelector<HTMLElement>('h1');
        if (target && !target.hasAttribute('tabindex')) target.tabIndex = -1;
        return target ?? undefined;
      },
    });
    applyRegion(screen.element, screen.region ?? null);
    document.title =
      screen.title === options.appName ? options.appName : `${screen.title} · ${options.appName}`;
    screen.element.dataset['entering'] = 'true';
    setTimeout(() => delete screen.element.dataset['entering'], 400);
    stage.removeAttribute('aria-busy');
    if (options.onMount) safely(() => options.onMount!(screen, moved));
    if (screen.mounted) safely(() => screen.mounted!());
  };

  const navigate = async (mode: Mode, entry?: ScreenEntry): Promise<void> => {
    const token = ++serial;
    controller?.abort();
    const ownController = new AbortController();
    controller = ownController;
    const target =
      mode === 'back' ? stack?.previous() : mode === 'refresh' ? stack?.current() : entry;
    if (!target) return;
    const depth = stack?.depth() ?? 0;
    const canGoBack =
      mode === 'push'
        ? depth >= 1
        : mode === 'back'
          ? depth - 1 > 1
          : mode === 'reset'
            ? false
            : depth > 1;
    stage.setAttribute('aria-busy', 'true');
    let screen: Screen;
    try {
      screen = await target.build({ signal: ownController.signal, canGoBack });
    } catch (error) {
      if (token !== serial) return;
      showFallback(error);
      return;
    }
    if (token !== serial) {
      if (screen.dispose) safely(() => screen.dispose!());
      return;
    }
    if (!stack) stack = createScreenStack(target);
    else if (mode === 'push') stack.push(target);
    else if (mode === 'replace') stack.replace(target);
    else if (mode === 'reset') stack.reset(target);
    else if (mode === 'back') stack.back();
    try {
      mount(screen, mode === 'push' || mode === 'back');
    } catch (error) {
      showFallback(error);
    }
  };

  const showFallback = (error: unknown): void => {
    const entry = options.fallback(error);
    try {
      const screen = entry.build({ signal: new AbortController().signal, canGoBack: false });
      if (screen instanceof Promise)
        throw new Error('The fallback screen must build synchronously.');
      if (!stack) stack = createScreenStack(entry);
      else stack.reset(entry);
      mount(screen);
    } catch {
      stage.removeAttribute('aria-busy');
      stage.textContent = kit.t('startup.failed');
    }
  };

  const release = kit.keyboard.push((event) => {
    if (event.key !== 'Escape' || !current?.onEscape) return 'pass';
    return current.onEscape() ? 'handled' : 'pass';
  });

  return {
    push: (entry) => navigate('push', entry),
    replace: (entry) => navigate('replace', entry),
    reset: (entry) => navigate('reset', entry),
    back: () => navigate('back'),
    refresh: () => navigate('refresh'),
    canGoBack: () => (stack?.depth() ?? 0) > 1,
    currentKey: () => stack?.current().key,
    dispose() {
      release();
      controller?.abort();
      if (current?.dispose) safely(() => current!.dispose!());
      current = undefined;
    },
  };
}
