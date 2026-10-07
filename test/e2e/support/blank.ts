/**
 * Watching for a blank screen between screens. On every animation frame the page checks what the
 * child would see: the stage shows a screen (`.dv-screen`), the screen is not faded out, and at
 * least one word of it is visible in the viewport. A frame that fails is blank; a run of blank
 * frames lasts until the next frame that is not (a long frame inside a run counts in full, as the
 * child stares at it). The router keeps the old screen in view until the new one is ready, and
 * screens settle in partly visible, so a change of screen should show no blank frame at all.
 * A watch samples at the engine's own frame rate, so a run is at least one frame long: headless
 * WebKit on Windows draws a page at rest only a few times a second (Chromium about 60, Firefox
 * about 30), and its runs are that coarse.
 */
import type { Page } from '@playwright/test';

/** A run of blank frames: when it began (page time), how long it lasted, what was going on. */
export interface BlankRun {
  readonly label: string;
  readonly why: 'no screen' | 'faded' | 'no words';
  readonly screen: string;
  readonly startMs: number;
  readonly durationMs: number;
}

export interface BlankReport {
  readonly frames: number;
  /** The longest time between two frames, blank or not (how busy the machine was). */
  readonly longestFrameMs: number;
  readonly runs: readonly BlankRun[];
}

/** A screen fainter than this (its own opacity times its ancestors') counts as faded out. */
const FADED = 0.3;

interface Watch {
  label: string;
  frames: number;
  last: number;
  longestFrame: number;
  open: Omit<BlankRun, 'durationMs'> | null;
  runs: BlankRun[];
}

/** Start watching on every page the context opens (before the game's own scripts run). */
export async function watchBlankScreens(page: Page): Promise<void> {
  await page.addInitScript((faded: number) => {
    const watch: Watch = {
      label: 'start',
      frames: 0,
      last: 0,
      longestFrame: 0,
      open: null,
      runs: [],
    };
    (window as unknown as { __dvQaBlank: Watch }).__dvQaBlank = watch;
    const opacity = (element: Element | null): number => {
      let value = 1;
      for (let node = element; node; node = node.parentElement) {
        value *= Number(getComputedStyle(node).opacity);
      }
      return value;
    };
    const range = document.createRange();
    const blankBecause = (): BlankRun['why'] | null => {
      const stage = document.querySelector('[data-testid="stage"]');
      const screen = stage
        ? [...stage.children].find((child) => child.classList.contains('dv-screen'))
        : undefined;
      if (!screen) return 'no screen';
      if (opacity(screen) < faded) return 'faded';
      const walker = document.createTreeWalker(screen, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || !(node.textContent ?? '').trim()) continue;
        range.selectNodeContents(node);
        const box = range.getBoundingClientRect();
        // A visually hidden text is clipped to a 1 px box.
        if (box.width < 4 || box.height < 4) continue;
        if (box.bottom <= 0 || box.right <= 0 || box.top >= innerHeight || box.left >= innerWidth) {
          continue;
        }
        if (getComputedStyle(parent).visibility !== 'visible') continue;
        if (opacity(parent) < faded) continue;
        return null;
      }
      return 'no words';
    };
    const frame = (time: number): void => {
      if (watch.last > 0) watch.longestFrame = Math.max(watch.longestFrame, time - watch.last);
      watch.last = time;
      watch.frames += 1;
      const why = blankBecause();
      if (why && !watch.open) {
        const screen =
          document.querySelector('[data-testid="boot-status"]')?.getAttribute('data-screen') ?? '';
        watch.open = { label: watch.label, why, screen, startMs: Math.round(time) };
      } else if (!why && watch.open) {
        watch.runs.push({ ...watch.open, durationMs: Math.round(time - watch.open.startMs) });
        watch.open = null;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, FADED);
}

/** Name what happens next (a blank run is reported under the step it began in). */
export async function markBlankWatch(page: Page, label: string): Promise<void> {
  await page.evaluate((next) => {
    (window as unknown as { __dvQaBlank: Watch }).__dvQaBlank.label = next;
  }, label);
}

/** What the watch saw so far; a run still going counts up to now. */
export async function blankReport(page: Page): Promise<BlankReport> {
  return page.evaluate(() => {
    const watch = (window as unknown as { __dvQaBlank: Watch }).__dvQaBlank;
    const now = performance.now();
    const runs = watch.open
      ? [...watch.runs, { ...watch.open, durationMs: Math.round(now - watch.open.startMs) }]
      : [...watch.runs];
    return { frames: watch.frames, longestFrameMs: Math.round(watch.longestFrame), runs };
  });
}

/** The current page's watch forgets what it saw (the boot splash, a step not under test). */
export async function resetBlankWatch(page: Page): Promise<void> {
  await page.evaluate(() => {
    const watch = (window as unknown as { __dvQaBlank: Watch }).__dvQaBlank;
    watch.runs = [];
    watch.open = null;
    watch.frames = 0;
    watch.longestFrame = 0;
    watch.last = 0;
  });
}
