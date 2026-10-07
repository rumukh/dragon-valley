/**
 * Sunny Meadow from start to finish, the way a child plays it, once by keyboard alone and once by
 * touch alone (plan §2.4, §2.7 and §2.8; the coordinator's PR B list). A new keeper is made and
 * meets the first egg, then every level is played in order from the valley map, ending with the
 * Bridge Troll. Every control is pressed one way: Enter on the focused control, or a tap on a
 * tablet's touch screen (1180 × 820). Answers come from the screen (support/problem.ts), boards
 * are played from what they show (support/activities.ts), and the Egg Grid's nests are built with
 * its steppers from the keyboard, or by tapping a spot.
 *
 * Each level ends with at least two stars (every answer is right), which its marker on the road
 * then shows, and opens the next level; it adds coins to the purse; every egg that hatched is
 * celebrated; and every quest that is done is claimed on the hub for its coins. At the end the
 * Bridge Troll is won over (his meter full), the Lightning Arena opens, Whispering Woods wakes on
 * the map, the daily goal is reached and the Daily Adventure opens the gift; after a reload the
 * claimed quests are still claimed.
 */
import { expect, test } from './support/fixtures';
import type { Locator, Page, TestInfo } from '@playwright/test';
import {
  answerCorrectly,
  awaitOpenProblem,
  boot,
  coinCount,
  expectHub,
  expectScreen,
  round,
  waitReady,
} from './support/app';
import {
  playEggGridByKeyboard,
  playEggGridByTouch,
  playFactFamily,
  playMemoryMatch,
  playNumberTrail,
} from './support/activities';

type Input = 'keyboard' | 'touch';

const NAME = 'Ada';
const REGION = 'sunny-meadow';
const LEVELS = [
  'sunny-meadow.1',
  'sunny-meadow.2',
  'sunny-meadow.3',
  'sunny-meadow.4',
  'sunny-meadow.5',
  'sunny-meadow.6',
  'sunny-meadow.boss',
] as const;

/** Press a control: Enter on it once focused, or a tap. */
async function press(control: Locator, input: Input): Promise<void> {
  if (input === 'touch') {
    await control.tap();
    return;
  }
  await expect(control).toBeVisible();
  await control.focus();
  await control.page().keyboard.press('Enter');
}

/** Title → a new keeper (name and picture) → the prologue, skipped to the egg → the hub. */
async function newKeeper(page: Page, input: Input): Promise<void> {
  await boot(page);
  await press(page.getByTestId('title-play'), input);
  await expectScreen(page, 'editor');
  const name = page.getByTestId('keeper-name');
  if (input === 'touch') {
    await name.tap();
    await name.fill(NAME);
  } else {
    await name.focus();
    await page.keyboard.type(NAME);
  }
  const picture = page.getByTestId('avatar-keeper-3');
  if (input === 'touch') await picture.tap();
  else {
    await picture.locator('input').focus();
    await page.keyboard.press('Space');
  }
  await expect(picture.locator('input'), 'the picture is chosen').toBeChecked();
  await press(page.getByTestId('keeper-save'), input);
  await expect(page.getByTestId('screen-story'), 'the prologue begins').toBeVisible();
  await press(page.getByTestId('story-skip'), input);
  await press(page.getByTestId('story-choice-bubbles'), input);
  await press(page.getByTestId('story-next'), input);
  await expectHub(page, NAME);
}

/** Read a story beat line by line to its end. */
async function throughStory(page: Page, input: Input): Promise<void> {
  for (let line = 0; line < 30 && (await page.getByTestId('screen-story').isVisible()); line++) {
    await press(page.getByTestId('story-next'), input);
    await expect(page.getByTestId('stage')).not.toHaveAttribute('aria-busy', 'true');
  }
  await expect(page.getByTestId('screen-story')).toHaveCount(0);
}

/** The purse once its counter has stopped moving. */
async function settledCoins(page: Page): Promise<number> {
  let value = await coinCount(page);
  await expect
    .poll(
      async () => {
        const last = value;
        value = await coinCount(page);
        return value === last;
      },
      { message: 'the purse has stopped counting', intervals: [300] },
    )
    .toBe(true);
  return value;
}

/** Hub → valley map → the region's road (checking the last level's marker) → level card → Play. */
async function openLevel(
  page: Page,
  level: string,
  input: Input,
  previous: { readonly id: string; readonly stars: number } | null,
): Promise<void> {
  await press(page.getByTestId('hub-map'), input);
  await expectScreen(page, 'map');
  await press(page.getByTestId(`map-region-${REGION}`), input);
  await expectScreen(page, 'region');
  if (previous) {
    const done = page.getByTestId(`level-${previous.id}`);
    await expect(done, `${previous.id} is done on the road`).toHaveAttribute(
      'data-status',
      'completed',
    );
    await expect(done, `its marker shows the ${previous.stars} stars it earned`).toHaveAttribute(
      'aria-label',
      new RegExp(`: ${previous.stars} of 3 stars$`),
    );
  }
  const marker = page.getByTestId(`level-${level}`);
  await expect(marker, `${level} is open on the road`).toHaveAttribute('data-status', 'open');
  await press(marker, input);
  await expectScreen(page, 'level');
  await press(page.getByTestId('level-play'), input);
  await expectScreen(page, 'play');
}

/** Play the board on screen to its results, from what it shows. */
async function playBoard(page: Page, input: Input): Promise<string> {
  const kind = (await page.getByTestId('screen-minigame').getAttribute('data-activity')) ?? '';
  switch (kind) {
    case 'egg-grid':
      if (input === 'touch') await playEggGridByTouch(page);
      else await playEggGridByKeyboard(page);
      break;
    case 'memory-match':
      await playMemoryMatch(page, input, 'value');
      break;
    case 'number-trail':
      await playNumberTrail(page, input);
      break;
    case 'fact-family':
      await playFactFamily(page, input);
      break;
    default:
      throw new Error(`Sunny Meadow has no "${kind}" board.`);
  }
  return kind;
}

/** A boss meter's value before an answer, and the step answered (a story's sign, or a number). */
interface MeterReading {
  readonly value: number;
  readonly max: number;
  readonly step: string;
}

/**
 * Answer every problem of the round on screen correctly, a story's sign and then its number,
 * recording a boss meter's value before each answer; ends when the round gives way (to its
 * results, or to a won boss's closing story).
 */
async function playProblems(page: Page, input: Input, meter: MeterReading[]): Promise<string> {
  const activity = (await round(page).getAttribute('data-activity')) ?? '';
  const bossMeter = page.getByTestId('boss-meter');
  for (let turn = 0; turn < 80; turn++) {
    await awaitOpenProblem(page);
    if (!(await round(page).isVisible())) break;
    if (await page.getByTestId('feedback-next').isVisible()) {
      await press(page.getByTestId('feedback-next'), input);
      continue;
    }
    if ((await bossMeter.count()) > 0) {
      meter.push({
        value: Number(await bossMeter.getAttribute('aria-valuenow')),
        max: Number(await bossMeter.getAttribute('aria-valuemax')),
        step: (await page.getByTestId('problem').getAttribute('data-step')) ?? 'answer',
      });
    }
    await answerCorrectly(page, input);
  }
  return activity;
}

/** One egg's hatch celebration ("Bubbles hatched!"), then Hooray! */
async function celebrateHatch(page: Page, input: Input): Promise<string> {
  const celebration = page.getByTestId('hatch-celebration');
  await expect(celebration, 'the new dragon is out of its egg').toHaveAttribute(
    'data-revealed',
    'true',
  );
  const dragon = (await celebration.getAttribute('data-dragon')) ?? '';
  await expect(page.getByTestId('hatch-name'), `${dragon} is named`).toContainText('hatched!');
  await press(page.getByTestId('hatch-continue'), input);
  await expect(
    page.locator(`[data-testid="hatch-celebration"][data-dragon="${dragon}"]`),
    `${dragon}'s celebration gives way`,
  ).toHaveCount(0);
  return dragon;
}

type Showing = 'story' | 'board' | 'round' | 'hatch' | 'results' | 'hub';

/** What a level shows now, once something is showing. */
async function showing(page: Page): Promise<Showing> {
  let now: Showing | null = null;
  await expect
    .poll(
      async () => {
        now = await page.evaluate((): Showing | null => {
          const visible = (id: string): boolean => {
            const element = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
            return element !== null && element.checkVisibility();
          };
          if (visible('hatch-celebration')) return 'hatch';
          if (visible('results-continue')) return 'results';
          if (visible('screen-story')) return 'story';
          if (visible('screen-minigame')) return 'board';
          if (visible('screen-round')) return 'round';
          if (visible('screen-hub')) return 'hub';
          return null;
        });
        return now;
      },
      { message: 'a story, a board, a round, a hatch, the results or the hub', timeout: 30_000 },
    )
    .not.toBeNull();
  return now!;
}

interface LevelPlayed {
  readonly level: string;
  readonly activities: readonly string[];
  readonly stars: number;
  readonly hatched: readonly string[];
  readonly meter: readonly MeterReading[];
}

/** Play a level from its first screen through each activity to its results, then the hub. */
async function playLevel(page: Page, level: string, input: Input): Promise<LevelPlayed> {
  const activities: string[] = [];
  const hatched: string[] = [];
  const meter: MeterReading[] = [];
  for (let step = 0; step < 40; step++) {
    switch (await showing(page)) {
      case 'story':
        await throughStory(page, input);
        break;
      case 'board':
        activities.push(await playBoard(page, input));
        break;
      case 'round':
        activities.push(await playProblems(page, input, meter));
        break;
      case 'hatch':
        hatched.push(await celebrateHatch(page, input));
        break;
      case 'results': {
        const next = page.getByTestId('results-continue');
        const label = (await next.innerText()).trim();
        if (label.startsWith('Next:')) {
          await press(next, input);
          // The next activity, straight away or from the level card.
          await expect(page.getByTestId('round-results')).toHaveCount(0);
          if (await page.getByTestId('level-play').isVisible()) {
            await press(page.getByTestId('level-play'), input);
          }
          break;
        }
        expect(label, `${level} is finished: back to the valley`).toBe('Back to the valley');
        const stars = Number(await page.getByTestId('stars').getAttribute('data-earned'));
        await press(next, input);
        await expectHub(page, NAME);
        return { level, activities, stars, hatched, meter };
      }
      case 'hub':
        throw new Error(`${level} ended on the hub before its results.`);
    }
  }
  throw new Error(`${level} did not reach its results.`);
}

/** Claim every finished quest on the hub; each pays the coins its button promised. */
async function claimQuests(page: Page, input: Input): Promise<string[]> {
  const claimed: string[] = [];
  for (let quest = 0; quest < 3; quest++) {
    const button = page.locator('[data-testid^="quest-claim-"]').first();
    if ((await button.count()) === 0) break;
    const id = ((await button.getAttribute('data-testid')) ?? '').replace('quest-claim-', '');
    const label = (await button.innerText()).trim();
    const coins = Number(/^Get (\d+) coins?$/.exec(label)?.[1] ?? 0);
    expect(coins, `"${label}" says what the ${id} quest pays`).toBeGreaterThan(0);
    const before = await settledCoins(page);
    await press(button, input);
    const row = page.getByTestId(`quest-${id}`);
    await expect(row, `the ${id} quest is claimed`).toHaveAttribute('data-claimed', 'true');
    await expect(row, 'and says so').toContainText('Done');
    await expect
      .poll(() => coinCount(page), { message: `the ${id} quest paid ${coins} coins` })
      .toBe(before + coins);
    claimed.push(`${id} (+${coins})`);
  }
  return claimed;
}

/** The Daily Adventure, once the goal is reached: (a pending story first, then) the gift. */
async function openGift(page: Page, input: Input): Promise<void> {
  const adventure = page.getByTestId('hub-adventure');
  for (let step = 0; step < 3; step++) {
    const label = (await adventure.innerText()).trim();
    if (label === 'Open your gift!') {
      await press(adventure, input);
      await expect(page.getByTestId('gift-dialog'), 'the gift opens').toBeVisible();
      await press(page.getByTestId('gift-close'), input);
      await expect(page.getByTestId('gift-dialog')).toHaveCount(0);
      await expect(adventure, 'the gift is opened once').not.toHaveText('Open your gift!');
      return;
    }
    expect(label, 'only a story may come before the gift').toBe('Hear the story');
    await press(adventure, input);
    await throughStory(page, input);
    await expectHub(page, NAME);
  }
  throw new Error('The Daily Adventure did not offer the gift.');
}

async function playSunnyMeadow(page: Page, input: Input, testInfo: TestInfo): Promise<void> {
  await newKeeper(page, input);
  const played: LevelPlayed[] = [];
  const claimed: string[] = [];
  let previous: { id: string; stars: number } | null = null;
  for (const level of LEVELS) {
    const before = await settledCoins(page);
    await openLevel(page, level, input, previous);
    const result = await playLevel(page, level, input);
    played.push(result);
    expect(
      result.stars,
      `${level}: every answer right earns at least two stars`,
    ).toBeGreaterThanOrEqual(2);
    await expect
      .poll(() => coinCount(page), { message: `${level} added coins to the purse` })
      .toBeGreaterThan(before);
    claimed.push(...(await claimQuests(page, input)));
    previous = { id: level, stars: result.stars };
  }
  testInfo.annotations.push({
    type: 'journey',
    description: played
      .map(
        (level) =>
          `${level.level}: ${level.activities.join(' + ')}, ${level.stars} stars${level.hatched.length ? `, hatched ${level.hatched.join(', ')}` : ''}`,
      )
      .join('; '),
  });
  testInfo.annotations.push({ type: 'quests claimed', description: claimed.join(', ') || 'none' });

  // Every egg the keeper had hatched along the way, each with its celebration.
  const hatched = played.flatMap((level) => level.hatched);
  expect(hatched, 'Bubbles, the first egg, hatched in Sunny Meadow 1').toContain('bubbles');
  expect(played[0]!.hatched, 'in the very first level (plan §2.8)').toContain('bubbles');

  // The Bridge Troll: one more on his meter for each right answer, until it is full. A story's
  // sign is a step on the way to its answer, so the meter waits for the number (he mixes in
  // Sunny Meadow 6's stories for review).
  const troll = played.at(-1)!;
  expect(troll.activities, 'the boss level is the Bridge Troll').toEqual(['boss']);
  expect(troll.meter.length, 'the troll asked problems').toBeGreaterThan(0);
  const max = troll.meter[0]!.max;
  // Before each answer, the meter counts the numbers answered so far.
  const expected = troll.meter.map(
    (_, index) =>
      troll.meter.slice(0, index).filter((reading) => reading.step !== 'operation').length,
  );
  expect(
    troll.meter.map((reading) => reading.value),
    'each right answer filled his meter by one; a sign step left it as it was',
  ).toEqual(expected);
  expect(
    troll.meter.filter((reading) => reading.step !== 'operation').length,
    `he was won over when the meter was full (${max})`,
  ).toBe(max);
  testInfo.annotations.push({
    type: 'Bridge Troll',
    description: troll.meter
      .map(
        (reading) =>
          `${reading.value}/${reading.max}${reading.step === 'operation' ? ' (sign)' : ''}`,
      )
      .join(', '),
  });

  // Region done: the Arena opens, the next region wakes.
  await expect(page.getByTestId('hub-arena'), 'the Lightning Arena opens').toBeVisible();
  await press(page.getByTestId('hub-map'), input);
  await expectScreen(page, 'map');
  await expect(
    page.getByTestId('map-region-whispering-woods'),
    'Whispering Woods wakes on the map',
  ).toBeVisible();
  await press(page.getByTestId('map-back'), input);
  await expectHub(page, NAME);

  // The day: the goal reached long ago, so the Daily Adventure opens the gift.
  const goal = page.getByTestId('daily-goal');
  await expect(goal, 'the daily goal is reached').toHaveAttribute(
    'aria-valuenow',
    (await goal.getAttribute('aria-valuemax')) ?? '',
  );
  await openGift(page, input);

  // Quests: at least one claimed along the way, and still claimed after a reload.
  expect(claimed.length, 'quests were finished and claimed').toBeGreaterThan(0);
  await page.reload();
  await waitReady(page);
  await press(page.getByTestId('title-play'), input);
  await expectScreen(page, 'keepers');
  await press(page.getByTestId('keeper-profile-1'), input);
  await expectHub(page, NAME);
  for (const quest of claimed) {
    const id = quest.replace(/ \(.*$/, '');
    await expect(page.getByTestId(`quest-${id}`), `${id} is still claimed`).toHaveAttribute(
      'data-claimed',
      'true',
    );
  }
}

test.use({ reducedMotion: 'reduce' });

/**
 * A whole region is a long test: on CI about 1.5 min in Chromium and Firefox and up to 3.5 min in
 * WebKit; WebKit on Windows, which barely animates a page at rest, took up to 12 min by touch on a
 * busy machine (docs/testing.md §5). The budgets keep twice that and more.
 */
function journeyBudget(browserName: string): number {
  return browserName === 'webkit' ? 1_500_000 : 600_000;
}

test('Sunny Meadow from a new keeper to the Bridge Troll, by keyboard alone', async ({
  page,
  browserName,
}, testInfo) => {
  test.setTimeout(journeyBudget(browserName));
  await playSunnyMeadow(page, 'keyboard', testInfo);
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true, viewport: { width: 1180, height: 820 } });

  test('Sunny Meadow from a new keeper to the Bridge Troll, by touch alone', async ({
    page,
    browserName,
  }, testInfo) => {
    test.setTimeout(journeyBudget(browserName));
    await playSunnyMeadow(page, 'touch', testInfo);
  });
});
