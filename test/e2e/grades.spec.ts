/**
 * The class a keeper is in (docs/grades-plan.md): the new-keeper editor asks "Which class is
 * <name> in?" after the name and the picture, 3rd class chosen until another is, and the
 * grown-ups can change it per keeper behind the gate, or the child can from the class chip on the
 * hub (a yes, then the gate). Every class from 1st to 3rd has its lessons: none is refused.
 *
 * A 1st grader starts in the Lower Valley: the prologue, then Pebble Brook 1, where the brook
 * offers Dot's, Hop's or Nibble's egg. Counting problems show dots and never their number, on
 * screen or read aloud (read-aloud is on by itself in 1st class); answers are three tiles, and the
 * keypad takes two digits.
 *
 * A 2nd grader starts in the Lower Valley too, at Hundred Hills, whose first lesson offers Bead's,
 * Tumble's or Penny's egg. Place-value problems show bundles of ten sticks and single cubes; the
 * keypad takes any number. Bundle Sticks builds and works out sums within 100 with sticks.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  answerCorrectly,
  answerMode,
  awaitOpenProblem,
  boot,
  expectHub,
  expectScreen,
  fillKeeper,
  finishStory,
  leaveHub,
  leaveResults,
  loadBackup,
  newFamily,
  openGrownUps,
  passGate,
  playAs,
  playRound,
  results,
  round,
  startLevel,
  startPlacement,
  throughHatches,
} from './support/app';
import { numberWords, readAnswer, readProblem, written } from './support/problem';
import { continueToNextActivity } from './support/activities';
import { playBundleSticks } from './support/boards';
import { brookBackupBefore, hillsBackupBefore } from './support/saves';
import { installSpeech, spokenTexts, TYPICAL_VOICES } from './support/speech';

/** The Hundred Hills lesson whose second activity is Bundle Sticks. */
const BUNDLE_STICKS_LEVEL = 'hundred-hills.4';

test('the editor asks for the class; every class is accepted, in the editor and behind the gate', async ({
  page,
}) => {
  await boot(page);
  await page.getByTestId('title-play').click();
  await expectScreen(page, 'editor');
  await fillKeeper(page, { name: 'Ema' });
  await expect(page.getByTestId('keeper-grade')).toContainText('Which class is Ema in?');
  await expect(
    page.getByTestId('grade-3').locator('input'),
    '3rd class until changed',
  ).toBeChecked();
  await page.getByTestId('grade-2').click();
  await expect(page.getByTestId('grade-2').locator('input')).toBeChecked();
  await page.getByTestId('keeper-save').click();

  // A 2nd grader's egg waits at Hundred Hills: the prologue, then the Sun Window.
  await expect(page.getByTestId('screen-story'), 'the prologue begins').toBeVisible();
  await page.getByTestId('story-skip').click();
  await expectHub(page, 'Ema');
  await expect(page.getByTestId('hub-sun-window'), 'the Sun Window of a 2nd grader').toBeVisible();
  await expect(
    page.getByTestId('hub-adventure'),
    'the 2nd-grade placement check is offered',
  ).toHaveText('Show the dragons what you know!');

  await leaveHub(page);
  await openGrownUps(page, 'settings');
  const field = page.getByTestId('setting-grade');
  await expect(field).toContainText('every earlier region stays open for practice');
  await expect(page.getByTestId('setting-grade-2')).toHaveAttribute('aria-pressed', 'true');
  for (const grade of [3, 1, 2]) {
    await page.getByTestId(`setting-grade-${grade}`).click();
    await expect(page.getByTestId(`setting-grade-${grade}`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    for (const other of [1, 2, 3].filter((candidate) => candidate !== grade)) {
      await expect(page.getByTestId(`setting-grade-${other}`)).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
  }
  await expect(page.getByTestId('toast').filter({ hasText: 'no lessons' })).toHaveCount(0);
});

test('the class chip on the hub switches the class after a yes and the grown-ups gate', async ({
  page,
}) => {
  await boot(page);
  await page.getByTestId('title-play').click();
  await fillKeeper(page, { name: 'Lea' });
  await page.getByTestId('grade-1').click();
  await page.getByTestId('keeper-save').click();
  await page.getByTestId('story-skip').click();
  await expectHub(page, 'Lea');

  const chip = page.getByTestId('hub-class');
  await expect(chip).toHaveText(/1st class/);
  await expect(chip).toHaveAttribute('aria-label', '1st class. Change class');
  await expect(page.getByTestId('hub-sun-window')).toBeVisible();

  // The picker marks the class Lea is in; No keeps it.
  await chip.click();
  const picker = page.getByTestId('class-picker');
  await expect(picker).toBeVisible();
  await expect(picker.getByRole('heading')).toHaveText('Which class are you in?');
  await expect(page.getByTestId('class-pick-1')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('class-pick-1')).toBeFocused();
  await page.getByTestId('class-pick-3').click();
  await expect(picker.getByRole('heading')).toHaveText('Switch to 3rd class?');
  await page.getByTestId('class-confirm-no').click();
  await expect(picker).toHaveCount(0);
  await expect(chip).toHaveText(/1st class/);
  await expect(chip, 'focus comes back to the chip').toBeFocused();

  // Escape on the gate changes nothing either.
  await chip.click();
  await page.getByTestId('class-pick-3').click();
  await page.getByTestId('class-confirm-yes').click();
  await expect(page.getByTestId('parent-gate')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('parent-gate')).toHaveCount(0);
  await expect(chip).toHaveText(/1st class/);

  // Yes and the gate: now in 3rd class, with the Magic Window.
  await chip.click();
  await page.getByTestId('class-pick-3').click();
  await page.getByTestId('class-confirm-yes').click();
  await passGate(page);
  await expect(
    page.getByTestId('toast').filter({ hasText: 'Now you are in 3rd class!' }),
  ).toBeVisible();
  await expectHub(page, 'Lea');
  await expect(chip).toHaveText(/3rd class/);
  await expect(page.getByTestId('hub-window')).toBeVisible();
  await expect(page.getByTestId('hub-sun-window')).toHaveCount(0);

  // With the keyboard, back to 2nd class: the Sun Window again.
  await chip.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('class-pick-3')).toBeFocused();
  await page.getByTestId('class-pick-2').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('class-confirm-yes')).toBeVisible();
  await page.getByTestId('class-confirm-yes').focus();
  await page.keyboard.press('Enter');
  await passGate(page, 'keyboard');
  await expect(chip).toHaveText(/2nd class/);
  await expect(page.getByTestId('hub-sun-window')).toBeVisible();

  // The grown-ups' area shows the same class.
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  await expect(page.getByTestId('setting-grade-2')).toHaveAttribute('aria-pressed', 'true');
});

/** Next through a story beat until its choices of egg are offered (`egg` among them). */
async function untilEggs(page: Page, egg: string): Promise<void> {
  const hop = page.getByTestId(`story-choice-${egg}`);
  const next = page.getByTestId('story-next').and(page.locator(':enabled'));
  for (let line = 0; line < 10; line++) {
    // Wait for the line to settle: either the eggs are offered or Next can be pressed.
    await expect(hop.or(next).first()).toBeVisible();
    if (await hop.isVisible()) return;
    await next.click();
    await expect(page.getByTestId('stage')).not.toHaveAttribute('aria-busy', 'true');
  }
  await expect(hop, 'the eggs are offered').toBeVisible();
}

test('a 1st grader meets the brook, chooses an egg and counts dots on three tiles', async ({
  page,
  context,
}) => {
  test.slow();
  await installSpeech(context, TYPICAL_VOICES);
  await boot(page);
  await page.getByTestId('title-play').click();
  await expectScreen(page, 'editor');
  await fillKeeper(page, { name: 'Lea' });
  await page.getByTestId('grade-1').click();
  await expect(page.getByTestId('grade-1').locator('input')).toBeChecked();
  await page.getByTestId('keeper-save').click();

  // The prologue, and no 3rd-grade egg after it: a 1st grader's egg waits at the brook.
  await expect(page.getByTestId('screen-story'), 'the prologue begins').toBeVisible();
  await page.getByTestId('story-skip').click();
  await expectHub(page, 'Lea');
  await expect(
    page.getByTestId('hub-sun-window'),
    'the Sun Window of a young keeper',
  ).toBeVisible();

  // The Lower Valley sheet comes first, with Pebble Brook awake on it.
  await page.getByTestId('hub-map').click();
  await expectScreen(page, 'map');
  await expect(page.getByTestId('screen-map')).toHaveAttribute('data-sheet', 'lower-valley-map');
  await expect(page.getByTestId('map-sheet-lower-valley-map')).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(page.getByTestId('map-region-pebble-brook')).toContainText('Pebble Brook');
  await page.getByTestId('map-back').click();
  await expectHub(page, 'Lea');

  // Pebble Brook 1: the brook's welcome offers three 1st-grade eggs.
  await page.getByTestId('hub-map').click();
  await page.getByTestId('map-region-pebble-brook').click();
  await expectScreen(page, 'region');
  await page.getByTestId('level-pebble-brook.1').click();
  await expectScreen(page, 'level');
  await page.getByTestId('level-play').click();
  await expectScreen(page, 'play');
  await untilEggs(page, 'hop');
  for (const egg of ['dot', 'hop', 'nibble']) {
    await expect(page.getByTestId(`story-choice-${egg}`)).toBeVisible();
  }
  await expect(page.getByTestId('story-choice-bubbles')).toHaveCount(0);
  await page.getByTestId('story-choice-hop').click();
  await finishStory(page);
  await expect(round(page), 'the lesson begins').toBeVisible();

  // A counting problem: dots, never their number, on screen or read aloud.
  await awaitOpenProblem(page);
  await expect(page.getByTestId('problem-dots'), 'a counting problem shows dots').toBeVisible();
  const answer = await readAnswer(page);
  if (answer.kind !== 'number') throw new Error('A counting problem asks for a number.');
  const count = answer.value;
  const problem = page.getByTestId('problem');
  const digits = new RegExp(`\\b${count}\\b`);
  expect(await problem.textContent(), 'the problem does not write the count').not.toMatch(digits);
  expect(
    (await problem.getAttribute('aria-label')) ?? '',
    'the problem does not name the count',
  ).not.toMatch(digits);
  await expect
    .poll(async () => (await spokenTexts(page)).at(-1), { message: 'read aloud by itself' })
    .toBe('How many dots?');
  const spoken = (await spokenTexts(page)).length;
  await page.getByTestId('read-aloud').click();
  await expect
    .poll(async () => (await spokenTexts(page)).length, { message: 'read aloud again on a tap' })
    .toBeGreaterThan(spoken);
  const again = (await spokenTexts(page)).at(-1) ?? '';
  expect(again, 'the count is never read aloud').toBe('How many dots?');
  expect(again.toLowerCase()).not.toContain(numberWords(count));

  expect(await answerMode(page)).toBe('choice');
  await expect(page.getByTestId('choices').locator('[data-testid^="choice-"]')).toHaveCount(3);
  await answerCorrectly(page, 'pointer');

  // The rest of the lesson: counting, then adding and taking away within five, on three tiles.
  await playRound(page, 'pointer');
  await expect(results(page)).toBeVisible();
});

test('a 1st grader types at most two digits on the keypad', async ({ page }) => {
  test.slow();
  const backup = await brookBackupBefore('pebble-brook.5');
  await newFamily(page, { name: 'Lea' });
  await leaveHub(page);
  await loadBackup(page, backup, 'Lea');
  await playAs(page, 1, 'Lea');
  await startLevel(page, 'pebble-brook', 'pebble-brook.5');
  await expect(round(page)).toBeVisible();
  await awaitOpenProblem(page);
  expect(await answerMode(page), 'Pebble Brook 5 is answered on the keypad').toBe('keypad');
  for (const digit of [1, 2, 3]) await page.getByTestId(`keypad-${digit}`).click();
  await expect(page.getByTestId('keypad-display')).toContainText('12');
  await expect(page.getByTestId('keypad-display')).not.toContainText('123');
  await page.getByTestId('keypad-backspace').click();
  await page.getByTestId('keypad-backspace').click();
  await answerCorrectly(page, 'pointer');
});

test('a 2nd grader meets Hundred Hills, chooses an egg and reads tens and ones from sticks', async ({
  page,
}) => {
  test.slow();
  await boot(page);
  await page.getByTestId('title-play').click();
  await expectScreen(page, 'editor');
  await fillKeeper(page, { name: 'Ota' });
  await page.getByTestId('grade-2').click();
  await expect(page.getByTestId('grade-2').locator('input')).toBeChecked();
  await page.getByTestId('keeper-save').click();

  await expect(page.getByTestId('screen-story'), 'the prologue begins').toBeVisible();
  await page.getByTestId('story-skip').click();
  await expectHub(page, 'Ota');
  await expect(page.getByTestId('hub-sun-window'), 'the Sun Window of a 2nd grader').toBeVisible();
  await expect(
    page.getByTestId('hub-adventure'),
    'the 2nd-grade placement check is offered',
  ).toHaveText('Show the dragons what you know!');

  // The Lower Valley sheet comes first, with Hundred Hills awake on it.
  await page.getByTestId('hub-map').click();
  await expectScreen(page, 'map');
  await expect(page.getByTestId('screen-map')).toHaveAttribute('data-sheet', 'lower-valley-map');
  await expect(page.getByTestId('map-region-hundred-hills')).toContainText('Hundred Hills');
  await page.getByTestId('map-region-hundred-hills').click();
  await expectScreen(page, 'region');
  await page.getByTestId('level-hundred-hills.1').click();
  await expectScreen(page, 'level');
  await page.getByTestId('level-play').click();
  await expectScreen(page, 'play');

  // Hundred Hills 1 offers three 2nd-grade eggs, and neither the brook's nor the meadow's.
  await untilEggs(page, 'bead');
  for (const egg of ['bead', 'tumble', 'penny']) {
    await expect(page.getByTestId(`story-choice-${egg}`)).toBeVisible();
  }
  for (const egg of ['hop', 'bubbles']) {
    await expect(page.getByTestId(`story-choice-${egg}`)).toHaveCount(0);
  }
  await page.getByTestId('story-choice-bead').click();
  await finishStory(page);
  await expect(round(page), 'the lesson begins').toBeVisible();

  // Every place-value problem shows its sticks and cubes with it, on tiles or the keypad.
  let placeValue = 0;
  let typedThree = false;
  for (let step = 0; step < 80; step++) {
    await awaitOpenProblem(page);
    if (await results(page).isVisible()) break;
    if (await page.getByTestId('screen-story').isVisible()) {
      await finishStory(page);
      continue;
    }
    if (await page.getByTestId('feedback-next').isVisible()) {
      await page.getByTestId('feedback-next').click();
      continue;
    }
    const { tokens } = await readProblem(page);
    if (/· 10 \+|\? · 10|tens/.test(written(tokens))) {
      placeValue++;
      const model = page.getByTestId('model');
      await expect(model, `the sticks of ${written(tokens)}`).toHaveAttribute(
        'data-kind',
        'sticks',
      );
      await expect(model.locator('.dv-model__cube').first()).toBeAttached();
    }
    if (!typedThree && (await answerMode(page)) === 'keypad') {
      // No two-digit limit in 2nd class.
      for (const digit of [1, 2, 3]) await page.getByTestId(`keypad-${digit}`).click();
      await expect(page.getByTestId('keypad-display')).toContainText('123');
      for (let press = 0; press < 3; press++) await page.getByTestId('keypad-backspace').click();
      typedThree = true;
    }
    if ((await answerMode(page)) === 'choice') {
      await expect(page.getByTestId('choices').locator('[data-testid^="choice-"]')).toHaveCount(3);
    }
    await answerCorrectly(page, 'pointer');
  }
  await expect(results(page), 'the lesson ends on its results').toBeVisible();
  expect(placeValue, 'Hundred Hills 1 asks about tens and ones').toBeGreaterThan(0);
});

test('a 2nd grader who knows tens and ones passes the placement check: Hundred Hills 3 and 4 are placed', async ({
  page,
}) => {
  test.slow();
  await boot(page);
  await page.getByTestId('title-play').click();
  await fillKeeper(page, { name: 'Ota' });
  await page.getByTestId('grade-2').click();
  await page.getByTestId('keeper-save').click();
  await page.getByTestId('story-skip').click();
  await expectHub(page, 'Ota');
  await startPlacement(page);
  let answered = 0;
  for (; answered < 30 && (await round(page).isVisible()); answered++) {
    await answerCorrectly(page, 'keyboard');
  }
  expect(answered, 'both steps were asked').toBeGreaterThan(2);
  await expect(results(page)).toBeVisible();
  await throughHatches(page);
  await expect(page.getByTestId('results-title')).toHaveText('The dragons saw what you know!');
  await leaveResults(page, 'Ota');
  await page.getByTestId('hub-map').click();
  await expect(page.getByTestId('screen-map')).toHaveAttribute('data-sheet', 'lower-valley-map');
  await page.getByTestId('map-region-hundred-hills').click();
  await expectScreen(page, 'region');
  for (const level of ['hundred-hills.3', 'hundred-hills.4']) {
    await expect(page.getByTestId(`level-${level}`), `placed: ${level}`).toHaveAttribute(
      'data-status',
      'completed',
    );
  }
  const road = {
    'hundred-hills.1': 'open',
    'hundred-hills.2': 'locked',
    'hundred-hills.5': 'open',
  };
  for (const [level, status] of Object.entries(road)) {
    await expect(page.getByTestId('level-' + level), level).toHaveAttribute('data-status', status);
  }
});

test('a 2nd grader builds and works out sums with Bundle Sticks', async ({ page }) => {
  test.slow();
  const backup = await hillsBackupBefore(BUNDLE_STICKS_LEVEL);
  await newFamily(page, { name: 'Ota' });
  await leaveHub(page);
  await loadBackup(page, backup, 'Ota');
  await playAs(page, 1, 'Ota');
  await startLevel(page, 'hundred-hills', BUNDLE_STICKS_LEVEL);
  for (let activity = 0; activity < 4; activity++) {
    await expect(round(page).or(page.getByTestId('screen-minigame'))).toBeVisible();
    if (await page.getByTestId('screen-minigame').isVisible()) break;
    await playRound(page, 'pointer');
    await continueToNextActivity(page);
  }
  await expect(page.getByTestId('sticks'), 'Bundle Sticks is on the table').toBeVisible();
  await playBundleSticks(page, 'keyboard');
});
