/**
 * The class a keeper is in (docs/grades-plan.md): the new-keeper editor asks "Which class is
 * <name> in?" after the name and the picture, 3rd class chosen until another is, and the
 * grown-ups can change it per keeper behind the gate. A class this version of the valley has no
 * lessons for yet (2nd class until its regions ship) changes nothing: the keeper plays on as
 * before, and the grown-ups are told so.
 *
 * A 1st grader starts in the Lower Valley: the prologue, then Pebble Brook 1, where the brook
 * offers Dot's, Hop's or Nibble's egg. Counting problems show dots and never their number, on
 * screen or read aloud (read-aloud is on by itself in 1st class); answers are three tiles, and the
 * keypad takes two digits.
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
  loadBackup,
  meetFirstEgg,
  newFamily,
  openGrownUps,
  playAs,
  playRound,
  results,
  round,
  startLevel,
} from './support/app';
import { numberWords, readAnswer } from './support/problem';
import { brookBackupBefore } from './support/saves';
import { installSpeech, spokenTexts, TYPICAL_VOICES } from './support/speech';

test('the editor asks for the class; a class without lessons yet leaves the game as it was', async ({
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

  await meetFirstEgg(page);
  await expectHub(page, 'Ema');
  await expect(page.getByTestId('hub-window'), 'the Magic Window of a 3rd grader').toBeVisible();

  await leaveHub(page);
  await openGrownUps(page, 'settings');
  const field = page.getByTestId('setting-grade');
  await expect(field).toContainText('every earlier region stays open for practice');
  await expect(page.getByTestId('setting-grade-3')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('setting-grade-2').click();
  await expect(page.getByText('no lessons for that class yet')).toBeVisible();
  await expect(page.getByTestId('setting-grade-3')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('setting-grade-1').click();
  await expect(page.getByTestId('setting-grade-1')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('setting-grade-3')).toHaveAttribute('aria-pressed', 'false');
});

/** Next through a story beat until its choices of egg are offered. */
async function untilEggs(page: Page): Promise<void> {
  for (let line = 0; line < 10; line++) {
    if (await page.getByTestId('story-choice-hop').isVisible()) return;
    await page.getByTestId('story-next').click();
    await expect(page.getByTestId('stage')).not.toHaveAttribute('aria-busy', 'true');
  }
  await expect(page.getByTestId('story-choice-hop'), 'the brook offers its eggs').toBeVisible();
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
  await untilEggs(page);
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
