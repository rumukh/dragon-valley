/**
 * Performance budgets (docs/qa/performance.md): what a child's device downloads, and how soon the
 * first screen is ready on a slow connection and a slow processor.
 *
 * - Sizes, read from the site this run builds and serves: the app's script and style sheet (as
 *   built and gzipped), and the offline pack, every file "install for offline play" copies (the
 *   resource graph). Audio has its own budget in S5's tests; the rest of the pack is budgeted here.
 * - The first screen: a first visit (no cache) until the title is ready, on fast 4G and on slow 4G,
 *   each with a processor four times slower, timed inside the page; also what it downloaded first.
 *   Chromium only: the throttling is the Chrome DevTools Protocol's. The test server does not
 *   compress, so these are upper bounds: GitHub Pages sends the text gzipped (the script at about a
 *   third of its size).
 *
 * Every measurement is recorded in the job summary ("Performance"), so a budget can be revisited
 * with numbers in hand.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import type { TestInfo } from '@playwright/test';
import { test as base } from '@playwright/test';
import { expect, test } from './support/fixtures';
import { answerCorrectly, newFamily, startPlacement } from './support/app';
import { siteFolder } from './support/site';

const KB = 1_000;
const MB = 1_000_000;

/** Upper bounds, in bytes; today's values are in docs/qa/performance.md. */
const SIZE_BUDGETS = {
  script: { built: 750 * KB, gzipped: 250 * KB },
  style: { built: 100 * KB, gzipped: 20 * KB },
  /** The offline pack without its audio (S5 holds the audio to 8 MB). */
  packWithoutAudio: 2.5 * MB,
  pack: 10.5 * MB,
  /** Bytes a first visit downloads before its first screen is ready, uncompressed. */
  firstScreen: 1.3 * MB,
};

interface Profile {
  readonly name: string;
  readonly latencyMs: number;
  readonly downKbps: number;
  readonly upKbps: number;
  /** The title must be ready within this time, first visit, timed from the navigation. */
  readonly readyMs: number;
  /** Something must be painted within this time. */
  readonly paintMs: number;
}

/** Lighthouse's mobile network profiles, with its four times slower processor. */
const PROFILES: readonly Profile[] = [
  {
    name: 'fast 4G',
    latencyMs: 40,
    downKbps: 9_000,
    upKbps: 9_000,
    readyMs: 4_000,
    paintMs: 1_500,
  },
  {
    name: 'slow 4G',
    latencyMs: 150,
    downKbps: 1_600,
    upKbps: 750,
    readyMs: 10_000,
    paintMs: 3_000,
  },
];
const CPU_SLOWDOWN = 4;
/** Cold visits per profile; the best one is held to the budget (noise only slows a visit down). */
const VISITS = 3;
/** Feedback after an answer, on the same slower processor: the median of these answers. */
const ANSWERS = 7;
const FEEDBACK_BUDGET_MS = 500;
const THROTTLING_ONLY_IN_CHROMIUM =
  'Network and processor throttling use the Chrome DevTools Protocol, which only Chromium has.';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

interface Resource {
  readonly src: string;
  readonly bytes: number;
  readonly kind: string;
}

function built(file: string): Buffer {
  return readFileSync(join(root, siteFolder(), file));
}

function record(testInfo: TestInfo, description: string): void {
  testInfo.annotations.push({ type: 'performance', description });
}

const kb = (bytes: number): string => `${(bytes / KB).toFixed(0)} KB`;

base('the script, the style sheet and the offline pack stay within their budgets', () => {
  const testInfo = base.info();
  for (const [file, budget] of [
    ['app.js', SIZE_BUDGETS.script],
    ['app.css', SIZE_BUDGETS.style],
  ] as const) {
    const bytes = built(file);
    const gzipped = gzipSync(bytes, { level: 9 }).length;
    record(
      testInfo,
      `${file}: ${kb(bytes.length)} built (budget ${kb(budget.built)}), ${kb(gzipped)} gzipped (budget ${kb(budget.gzipped)})`,
    );
    expect(bytes.length, `${file} as built`).toBeLessThanOrEqual(budget.built);
    expect(gzipped, `${file} gzipped`).toBeLessThanOrEqual(budget.gzipped);
  }

  const graph = JSON.parse(built('resource-graph.json').toString('utf8')) as {
    resources: Resource[];
  };
  const total = (resources: readonly Resource[]): number =>
    resources.reduce((sum, resource) => sum + resource.bytes, 0);
  const pack = total(graph.resources);
  const withoutAudio = total(graph.resources.filter((resource) => resource.kind !== 'audio'));
  record(
    testInfo,
    `offline pack: ${graph.resources.length} files, ${kb(pack)} (budget ${kb(SIZE_BUDGETS.pack)}), ${kb(withoutAudio)} without audio (budget ${kb(SIZE_BUDGETS.packWithoutAudio)})`,
  );
  expect(withoutAudio, 'the offline pack without its audio').toBeLessThanOrEqual(
    SIZE_BUDGETS.packWithoutAudio,
  );
  expect(pack, 'the whole offline pack').toBeLessThanOrEqual(SIZE_BUDGETS.pack);
});

/** Runs in the page before the game: notes when the first screen is ready and what it took. */
function firstScreenProbe(): void {
  const note = (): void => {
    const status = document.querySelector('[data-testid="boot-status"]');
    if (status?.getAttribute('data-state') !== 'ready' || '__dvQaFirstScreen' in window) return;
    const entries = [
      ...performance.getEntriesByType('navigation'),
      ...performance.getEntriesByType('resource'),
    ] as PerformanceResourceTiming[];
    Object.defineProperty(window, '__dvQaFirstScreen', {
      value: {
        readyMs: performance.now(),
        paintMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1,
        bytes: entries.reduce((sum, entry) => sum + entry.transferSize, 0),
        screen: status.getAttribute('data-screen'),
      },
      configurable: true,
    });
  };
  new MutationObserver(note).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
  });
}

interface FirstScreen {
  readonly readyMs: number;
  readonly paintMs: number;
  readonly bytes: number;
  readonly screen: string | null;
}

for (const profile of PROFILES) {
  test(`a first visit shows the title within ${profile.readyMs / 1_000} s on ${profile.name} with a slower processor`, async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(browserName !== 'chromium', THROTTLING_ONLY_IN_CHROMIUM);
    test.slow();
    await page.addInitScript(firstScreenProbe);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: profile.latencyMs,
      downloadThroughput: (profile.downKbps * 1_000) / 8,
      uploadThroughput: (profile.upKbps * 1_000) / 8,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });

    const visits: FirstScreen[] = [];
    for (let visit = 0; visit < VISITS; visit++) {
      await page.goto('./');
      const handle = await page.waitForFunction(
        () => (window as { __dvQaFirstScreen?: unknown }).__dvQaFirstScreen,
        undefined,
        { timeout: 60_000 },
      );
      visits.push((await handle.jsonValue()) as FirstScreen);
    }
    const best = visits.reduce((a, b) => (b.readyMs < a.readyMs ? b : a));
    record(
      testInfo,
      `first visit on ${profile.name}, processor ×${CPU_SLOWDOWN}: ${best.screen} ready in ${Math.round(best.readyMs)} ms (budget ${profile.readyMs}), first paint ${Math.round(best.paintMs)} ms (budget ${profile.paintMs}), ${kb(best.bytes)} downloaded (budget ${kb(SIZE_BUDGETS.firstScreen)}); visits ${visits.map((v) => Math.round(v.readyMs)).join(', ')} ms`,
    );
    expect(best.screen, 'a first visit opens on the title').toBe('title');
    expect(best.readyMs, `the title is ready within ${profile.readyMs} ms`).toBeLessThanOrEqual(
      profile.readyMs,
    );
    expect(best.paintMs, 'something is painted early').toBeGreaterThan(0);
    expect(best.paintMs, `first paint within ${profile.paintMs} ms`).toBeLessThanOrEqual(
      profile.paintMs,
    );
    expect(best.bytes, 'what a first visit downloads before its first screen').toBeLessThanOrEqual(
      SIZE_BUDGETS.firstScreen,
    );
  });
}

/**
 * Runs in the page before an answer: resolves with the time from the answer's Enter key to the
 * feedback being shown (or -1 if none came within 20 s).
 */
function armFeedbackTimer(): void {
  const node = document.querySelector('[data-testid="feedback"]');
  const scope = window as unknown as { __dvQaFeedbackDelay?: Promise<number> };
  scope.__dvQaFeedbackDelay = new Promise<number>((resolve) => {
    if (!node) {
      resolve(-1);
      return;
    }
    let sent = -1;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Enter' && sent < 0) sent = performance.now();
    };
    const done = (delay: number): void => {
      observer.disconnect();
      window.removeEventListener('keydown', onKey, true);
      clearTimeout(timer);
      resolve(delay);
    };
    const observer = new MutationObserver(() => {
      const kind = node.getAttribute('data-kind');
      if (sent >= 0 && kind && kind !== 'none') done(performance.now() - sent);
    });
    const timer = setTimeout(() => done(-1), 20_000);
    window.addEventListener('keydown', onKey, true);
    observer.observe(node, { attributes: true, attributeFilter: ['data-kind'] });
  });
}

test(`feedback follows an answer within ${FEEDBACK_BUDGET_MS} ms with a slower processor`, async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(browserName !== 'chromium', THROTTLING_ONLY_IN_CHROMIUM);
  test.slow();
  await newFamily(page, { name: 'Ada' });
  await startPlacement(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  const delays: number[] = [];
  for (let answer = 0; answer < ANSWERS; answer++) {
    await page.evaluate(armFeedbackTimer);
    await answerCorrectly(page, 'keyboard');
    delays.push(
      await page.evaluate(
        () => (window as unknown as { __dvQaFeedbackDelay: Promise<number> }).__dvQaFeedbackDelay,
      ),
    );
  }
  expect(Math.min(...delays), 'every answer was timed to its feedback').toBeGreaterThanOrEqual(0);
  const sorted = [...delays].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  record(
    testInfo,
    `feedback after an answer, processor ×${CPU_SLOWDOWN}: median ${Math.round(median)} ms (budget ${FEEDBACK_BUDGET_MS}), slowest ${Math.round(sorted.at(-1)!)} ms; answers ${delays.map(Math.round).join(', ')} ms`,
  );
  expect(median, `feedback within ${FEEDBACK_BUDGET_MS} ms of the answer`).toBeLessThanOrEqual(
    FEEDBACK_BUDGET_MS,
  );
});
