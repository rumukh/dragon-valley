/**
 * Regression checks for the coordinator's playtest of the deployed Region 1 slice (`5848964`),
 * whose findings S2b (#14) and S3 (#17) fixed before these checks were written:
 *
 * 1. Riddle Scrolls' sign step showed number tiles under "Which sign do we need?" and marked the
 *    right number a miss (Sunny Meadow 6). Now: the sign is asked on sign tiles, and a story
 *    answered right at both steps is praised at both.
 * 2. At 1180 × 820 and 1024 × 768 the hub, the Egg Grid and the results need no page scrolling
 *    (`scrollHeight <= innerHeight`). profiles.spec.ts plays this at 1024 × 768; here Sunny
 *    Meadow 1 is played at 1180 × 820 (the Egg Grid, then Feeding Time), and every screen, a
 *    problem round's too, is measured at both sizes.
 * 3. The hatch celebration shows the new dragon big (at least 200 px each way, inside the
 *    screen) and no word on the screen lies on it.
 * 4. A change of screen never leaves the screen blank for more than 300 ms (support/blank.ts):
 *    a journey through every kind of screen, and the level above (round, results, hatches).
 *
 * They are plain regression checks: one that fails again is a new defect (docs/qa/defects.md).
 */
import { expect, test } from './support/fixtures';
import type { Page, TestInfo } from '@playwright/test';
import {
  answerCorrectly,
  awaitOpenProblem,
  boot,
  createFirstKeeper,
  expectHub,
  expectScreen,
  fillKeeper,
  finishStory,
  leaveHub,
  leaveResults,
  loadBackup,
  meetFirstEgg,
  newFamily,
  playAs,
  playRound,
  quitRound,
  results,
  round,
  startLevel,
} from './support/app';
import type { ScreenName, Via } from './support/app';
import { blankReport, markBlankWatch, resetBlankWatch, watchBlankScreens } from './support/blank';
import type { BlankReport } from './support/blank';
import { readProblem, written } from './support/problem';
import { meadowBackupBefore } from './support/saves';

const TABLETS = [
  { width: 1180, height: 820 },
  { width: 1024, height: 768 },
] as const;
/** The signs of a sign step, written the Czech way (the default notation). */
const CZECH_SIGNS = ['+', '−', '·', ':'];
const BLANK_LIMIT_MS = 300;
/** The processor slowdown for the screen changes on Chromium, as in perf.spec.ts. */
const CPU_SLOWDOWN = 4;
const HATCH_MIN_PX = 200;

/** Run `check` at each tablet size in turn, then return to the first. */
async function atTabletSizes(page: Page, check: (size: string) => Promise<void>): Promise<void> {
  for (const size of TABLETS) {
    await page.setViewportSize(size);
    // Let the new size lay out and paint before measuring.
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    await check(`${size.width} × ${size.height}`);
  }
  await page.setViewportSize(TABLETS[0]);
}

/** Everything is on the screen: the page itself never scrolls (reported, the test goes on). */
async function expectNoPageScroll(page: Page, where: string): Promise<void> {
  const { scroll, height } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight,
    height: window.innerHeight,
  }));
  expect.soft(scroll, `${where} needs page scrolling`).toBeLessThanOrEqual(height);
}

interface HatchLayout {
  readonly width: number;
  readonly height: number;
  readonly inView: boolean;
  /** The words on the screen that lie on the dragon. */
  readonly overlaps: readonly string[];
}

/** The hatched dragon's box, and every visible word of the results screen that touches it. */
async function hatchLayout(page: Page): Promise<HatchLayout> {
  return page.evaluate(() => {
    const art = document.querySelector('[data-testid="hatch-art"] svg');
    const screen = document.querySelector('[data-testid="screen-results"]');
    if (!art || !screen) throw new Error('No hatch picture on the results screen.');
    const box = art.getBoundingClientRect();
    const overlaps: string[] = [];
    const walker = document.createTreeWalker(screen, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim();
      const parent = node.parentElement;
      if (!text || !parent || parent.closest('svg')) continue;
      if (getComputedStyle(parent).visibility !== 'visible') continue;
      range.selectNodeContents(node);
      const touches = [...range.getClientRects()].some(
        (line) =>
          // A visually hidden text is clipped to a 1 px box.
          line.width >= 2 &&
          line.height >= 2 &&
          Math.min(line.right, box.right) - Math.max(line.left, box.left) > 1 &&
          Math.min(line.bottom, box.bottom) - Math.max(line.top, box.top) > 1,
      );
      if (touches) {
        const id = parent.closest('[data-testid]')?.getAttribute('data-testid') ?? parent.localName;
        overlaps.push(`"${text.slice(0, 40)}" (${id})`);
      }
    }
    return {
      width: Math.round(box.width),
      height: Math.round(box.height),
      inView:
        box.top >= -0.5 &&
        box.left >= -0.5 &&
        box.bottom <= innerHeight + 0.5 &&
        box.right <= innerWidth + 0.5,
      overlaps,
    };
  });
}

/** The hatch layout once the name card has finished settling in (it scales up as it appears). */
async function settledHatchLayout(page: Page): Promise<HatchLayout> {
  let last = '';
  let layout: HatchLayout | null = null;
  await expect
    .poll(
      async () => {
        layout = await hatchLayout(page);
        const now = JSON.stringify(layout);
        const settled = now === last;
        last = now;
        return settled;
      },
      { message: 'the hatch celebration settles', intervals: [250] },
    )
    .toBe(true);
  return layout!;
}

/** Build every nest of every Egg Grid board by clicking its far corner, to the results. */
async function playEggGrid(page: Page): Promise<void> {
  const grid = page.getByTestId('egg-grid');
  // Read in one go, without waiting on elements: the results replace the board at the end.
  const board = () =>
    page.evaluate(() => ({
      over: document.querySelector('[data-testid="screen-results"]') !== null,
      goal: document.querySelector('[data-testid="egg-goal"]')?.textContent ?? '',
      found: [...document.querySelectorAll('[data-testid="egg-found"] li')].map((item) =>
        (item.textContent ?? '').replace(/\s/g, ''),
      ),
      maxSide: Math.max(
        0,
        ...[...document.querySelectorAll('[data-testid="egg-grid"] [data-row]')].map((spot) =>
          Number((spot as HTMLElement).dataset['row']),
        ),
      ),
    }));
  for (let move = 0; move < 40; move++) {
    const before = await board();
    if (before.over) break;
    const eggs = Number(/of (\d+) eggs/.exec(before.goal)?.[1]);
    const rows = Array.from({ length: before.maxSide }, (_, index) => index + 1).find(
      (side) =>
        eggs % side === 0 &&
        eggs / side <= before.maxSide &&
        !before.found.includes(`${side}·${eggs / side}`),
    );
    expect(
      rows,
      `a nest of ${eggs} is left to find (found ${before.found.join(', ')})`,
    ).toBeDefined();
    await grid.locator(`[data-row="${rows}"][data-column="${eggs / rows!}"]`).click();
    await page.getByTestId('egg-check').click();
    await expect
      .poll(
        async () => {
          const after = await board();
          return after.over ||
            after.goal !== before.goal ||
            after.found.length > before.found.length
            ? 'moved'
            : 'waiting';
        },
        { message: 'the nest is found, or the next board or the results come', timeout: 20_000 },
      )
      .toBe('moved');
  }
  await expect(results(page), 'the Egg Grid ends on its results').toBeVisible();
}

test('Sunny Meadow 6: Riddle Scrolls ask for the sign on sign tiles, and right answers at both steps are praised', async ({
  page,
}, testInfo) => {
  test.slow();
  const backup = await meadowBackupBefore('sunny-meadow.6');
  await newFamily(page, { name: 'Ada' });
  await leaveHub(page);
  await loadBackup(page, backup, 'Ada');
  await playAs(page, 1, 'Ada');
  await startLevel(page, 'sunny-meadow', 'sunny-meadow.6');
  await expect(round(page), 'Riddle Scrolls is a problem round').toBeVisible();

  const asked: { step: string; story: string; written: string }[] = [];
  let via: Via = 'keyboard';
  for (let turn = 0; turn < 40; turn++) {
    await awaitOpenProblem(page);
    if (await results(page).isVisible()) break;
    const problem = await readProblem(page);
    const shown = `${written(problem.tokens)} under "${problem.story.trim()}"`;
    if (problem.step === 'operation') {
      // Each story in turn by pointer and by keyboard, both of its steps the same way.
      via = via === 'keyboard' ? 'pointer' : 'keyboard';
      await expect(
        page.getByTestId('round-prompt'),
        `the sign step asks for a sign (${shown})`,
      ).toHaveText('Which sign do we need?');
      const tiles = await page
        .getByTestId('choices')
        .getByRole('button')
        .evaluateAll((buttons) =>
          buttons.map((button) => ({
            id: button.getAttribute('data-testid') ?? '',
            label: (button.textContent ?? '').trim(),
          })),
        );
      expect(tiles.length, `the sign step offers signs to choose from (${shown})`).toBeGreaterThan(
        1,
      );
      expect(
        tiles.filter((tile) => !/^choice-(add|sub|mul|div)$/.test(tile.id)),
        `only sign tiles under "Which sign do we need?" (${shown})`,
      ).toEqual([]);
      expect(
        tiles.filter((tile) => !CZECH_SIGNS.includes(tile.label)),
        `the sign tiles are written the Czech way (${shown})`,
      ).toEqual([]);
    }
    // The answer is praised ("correct"), never marked a miss.
    await answerCorrectly(page, via);
    asked.push({ step: problem.step, story: problem.story.trim(), written: shown });
  }
  testInfo.annotations.push({
    type: 'problems asked',
    description: asked.map((item) => `[${item.step}] ${item.written}`).join(' | '),
  });
  const signSteps = asked.flatMap((item, index) => (item.step === 'operation' ? [index] : []));
  expect(signSteps.length, 'the stories asked for their sign').toBeGreaterThan(0);
  for (const index of signSteps) {
    expect(
      asked[index + 1]?.step === 'answer' && asked[index + 1]?.story === asked[index]!.story,
      `the sign of "${asked[index]!.story}" was followed by its number`,
    ).toBe(true);
  }
  await expect(results(page), 'the scrolls end on their results').toBeVisible();
});

/**
 * Each egg that hatched has the screen to itself before the results card: measure every one at
 * both tablet sizes, then go on ("Hooray!"). Returns what was measured.
 */
async function measureHatches(page: Page): Promise<string[]> {
  const celebration = page.getByTestId('hatch-celebration');
  const card = page.getByTestId('round-results');
  const hatched: string[] = [];
  for (let egg = 0; egg < 6; egg++) {
    await expect
      .poll(async () => (await celebration.isVisible()) || (await card.isVisible()), {
        message: 'a hatching dragon or the results card',
      })
      .toBe(true);
    if (!(await celebration.isVisible())) break;
    await expect(celebration, 'the new dragon is out of its egg').toHaveAttribute(
      'data-revealed',
      'true',
    );
    const dragon = (await celebration.getAttribute('data-dragon')) ?? 'a dragon';
    await atTabletSizes(page, async (size) => {
      await expectNoPageScroll(page, `${dragon}'s hatch at ${size}`);
      const layout = await settledHatchLayout(page);
      hatched.push(`${dragon} at ${size}: ${layout.width} × ${layout.height} px`);
      expect
        .soft(
          Math.min(layout.width, layout.height),
          `${dragon} is drawn big at ${size} (${layout.width} × ${layout.height} px)`,
        )
        .toBeGreaterThanOrEqual(HATCH_MIN_PX);
      expect.soft(layout.inView, `${dragon} is wholly on the screen at ${size}`).toBe(true);
      expect.soft(layout.overlaps, `no words lie on ${dragon} at ${size}`).toEqual([]);
    });
    await markBlankWatch(page, `after ${dragon}'s hatch`);
    await page.getByTestId('hatch-continue').click();
    // The next egg (or the card) takes over from this dragon.
    await expect(
      page.locator(`[data-testid="hatch-celebration"][data-dragon="${dragon}"]`),
    ).toHaveCount(0);
  }
  await expect(card, 'then the results card').toBeVisible();
  return hatched;
}

test('on a tablet (1180 × 820 and 1024 × 768) the hub, the Egg Grid, a round, each hatch and the results fit the screen; the new dragon is big and clear of the words', async ({
  page,
}, testInfo) => {
  test.slow();
  // The changes of screen of a level (to a round, its results, each hatch, the card) are
  // watched too.
  await watchBlankScreens(page);
  await page.setViewportSize(TABLETS[0]);
  await boot(page);
  await resetBlankWatch(page);
  await markBlankWatch(page, 'a new keeper');
  await createFirstKeeper(page, { name: 'Ema' });
  await atTabletSizes(page, (size) => expectNoPageScroll(page, `the hub at ${size}`));

  await markBlankWatch(page, 'hub → Sunny Meadow 1');
  await startLevel(page, 'sunny-meadow', 'sunny-meadow.1');
  await expect(
    page.getByTestId('egg-grid'),
    'Sunny Meadow 1 begins with the Egg Grid',
  ).toBeVisible();
  await atTabletSizes(page, (size) => expectNoPageScroll(page, `the Egg Grid at ${size}`));
  await markBlankWatch(page, 'the Egg Grid → its results');
  await playEggGrid(page);
  const hatched = await measureHatches(page);
  await atTabletSizes(page, (size) =>
    expectNoPageScroll(page, `the Egg Grid's results at ${size}`),
  );

  // Feeding Time comes next; the rules' own play of this level hatches the first egg at its end.
  await markBlankWatch(page, 'results → Feeding Time');
  await page.getByTestId('results-continue').click();
  await expect(round(page), 'Feeding Time is a problem round').toBeVisible();
  await expect(page.getByTestId('problem')).toBeVisible();
  await atTabletSizes(page, (size) => expectNoPageScroll(page, `Feeding Time at ${size}`));
  await markBlankWatch(page, 'Feeding Time → its results');
  await playRound(page, 'pointer');
  hatched.push(...(await measureHatches(page)));
  testInfo.annotations.push({ type: 'hatches', description: hatched.join('; ') || 'none' });
  expect(hatched.length, 'Sunny Meadow 1 hatched a dragon').toBeGreaterThan(0);
  await expect(page.getByTestId('results-continue')).toBeVisible();
  await atTabletSizes(page, (size) => expectNoPageScroll(page, `the level's results at ${size}`));
  expectNoLongBlank(testInfo, await blankReport(page), 'soft');
});

test('a change of screen never leaves the screen blank for more than 300 ms', async ({
  page,
  browserName,
}, testInfo) => {
  test.slow();
  await watchBlankScreens(page);
  await boot(page);
  if (browserName === 'chromium') {
    // A tablet's processor (perf.spec.ts uses the same factor): screens that faded in from
    // nothing while their pictures were prepared (the playtest finding) showed 130-570 ms of
    // blank screen here, under 90 ms without the slowdown.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  }
  await resetBlankWatch(page);
  const to = (screen: ScreenName) => () => expectScreen(page, screen);
  const hub = () => expectHub(page, 'Ema');
  const steps: [string, () => Promise<void>, () => Promise<void>][] = [
    ['title → keeper editor', () => page.getByTestId('title-play').click(), to('editor')],
    [
      'keeper editor → prologue',
      async () => {
        await fillKeeper(page, { name: 'Ema' });
        await page.getByTestId('keeper-save').click();
      },
      () => expect(page.getByTestId('screen-story')).toBeVisible(),
    ],
    ['prologue → hub', () => meetFirstEgg(page), hub],
    ...(['market', 'den', 'album', 'window'] as const).flatMap(
      (place): [string, () => Promise<void>, () => Promise<void>][] => [
        [`hub → ${place}`, () => page.getByTestId(`hub-${place}`).click(), to(place)],
        [`${place} → hub`, () => page.getByTestId('collection-back').click(), hub],
      ],
    ),
    [
      'hub → placement check',
      () => page.getByTestId('hub-adventure').click(),
      () => expect(round(page)).toHaveAttribute('data-placement', 'true'),
    ],
    [
      'placement check → hub',
      async () => {
        await answerCorrectly(page, 'keyboard');
        await quitRound(page, 'Ema');
      },
      hub,
    ],
    ['hub → valley map', () => page.getByTestId('hub-map').click(), to('map')],
    [
      'valley map → Sunny Meadow',
      () => page.getByTestId('map-region-sunny-meadow').click(),
      to('region'),
    ],
    [
      'Sunny Meadow → level card',
      () => page.getByTestId('level-sunny-meadow.1').click(),
      to('level'),
    ],
    ['level card → Sunny Meadow', () => page.getByTestId('level-back').click(), to('region')],
    ['Sunny Meadow → valley map', () => page.getByTestId('region-back').click(), to('map')],
    [
      'valley map → Sunny Meadow again',
      () => page.getByTestId('map-region-sunny-meadow').click(),
      to('region'),
    ],
    [
      'Sunny Meadow → level card again',
      () => page.getByTestId('level-sunny-meadow.1').click(),
      to('level'),
    ],
    [
      'level card → its story',
      () => page.getByTestId('level-play').click(),
      () => expect(page.getByTestId('screen-story')).toBeVisible(),
    ],
    [
      'story → Egg Grid',
      () => finishStory(page),
      () => expect(page.getByTestId('egg-grid')).toBeVisible(),
    ],
    [
      'Egg Grid → quit',
      () => page.getByTestId('minigame-quit').click(),
      async () => {
        await expectScreen(page, 'play');
        if (await results(page).isVisible()) await leaveResults(page, 'Ema');
        await hub();
      },
    ],
    ['hub → who is playing', () => leaveHub(page), to('keepers')],
  ];
  for (const [label, act, arrived] of steps) {
    await markBlankWatch(page, label);
    await act();
    await arrived();
    // The new screen has settled in (it is marked while it does).
    await expect(page.locator('.dv-screen[data-entering]')).toHaveCount(0);
  }
  const report = await blankReport(page);
  expect(report.frames, 'the watch saw every change of screen').toBeGreaterThan(steps.length);
  expectNoLongBlank(testInfo, report, 'hard');
});

/**
 * No blank run longer than the limit (reported with every run and the longest frame, so a slow
 * machine shows as such). `soft` lets the test's own checks go on.
 */
function expectNoLongBlank(testInfo: TestInfo, report: BlankReport, mode: 'hard' | 'soft'): void {
  const runs = report.runs.map(
    (run) => `${run.label}: ${run.durationMs} ms (${run.why} on ${run.screen || 'no screen'})`,
  );
  testInfo.annotations.push({
    type: 'blank screens',
    description: `${report.frames} frames, the longest ${report.longestFrameMs} ms; blank: ${runs.join('; ') || 'never'}`,
  });
  const long = report.runs.filter((run) => run.durationMs > BLANK_LIMIT_MS);
  const message = `no change of screen leaves the screen blank for more than ${BLANK_LIMIT_MS} ms`;
  if (mode === 'soft') expect.soft(long, message).toEqual([]);
  else expect(long, message).toEqual([]);
}
