/**
 * Input parity (docs/app.md §8, plan §2.11): the on-screen keypad and the physical keyboard
 * do the same things, choice tiles work by typing, arrows, Enter and Space as well as by
 * tapping, focus starts where an answer goes (so Enter always submits), and a whole round can
 * be played by touch.
 *
 * Remainder mode (`4 r 3`, two fields) arrives with Region 6 content; its keypad logic is
 * covered by test/unit/app/keypad-state.test.ts and test/unit/app/dom/keypad.test.ts until a
 * remainder problem is reachable here.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  answerMode,
  expectHub,
  expectNextProblem,
  feedback,
  feedbackAfter,
  finishRound,
  leaveResults,
  newFamily,
  openKeeper,
  playFromTitle,
  quitRound,
  reload,
  results,
  round,
  startLevel,
  startPlacement,
} from './support/app';
import { readAnswer, readTokens, written } from './support/problem';
import { installSpeech, TYPICAL_VOICES } from './support/speech';

interface Display {
  readonly fields: string[];
  readonly active: number;
  readonly spoken: string;
}

async function display(page: Page): Promise<Display> {
  return page.getByTestId('keypad-display').evaluate((node) => {
    const fields = [...node.querySelectorAll('.dv-answer__field')];
    return {
      fields: fields.map((field) => field.textContent ?? ''),
      active: fields.findIndex((field) => field.getAttribute('aria-pressed') === 'true'),
      spoken: node.querySelector('.dv-visually-hidden')?.textContent ?? '',
    };
  });
}

type Step = `digit:${number}` | 'delete';

/** One editing step, by physical key or by tapping the screen. */
async function press(page: Page, step: Step, via: 'keyboard' | 'pointer'): Promise<void> {
  const [kind, digit] = step.split(':');
  if (via === 'keyboard') await page.keyboard.press(kind === 'digit' ? digit! : 'Backspace');
  else await page.getByTestId(kind === 'digit' ? `keypad-${digit}` : 'keypad-backspace').click();
}

/** Run `steps` and return the display after each; then empty the answer again. */
async function trace(page: Page, steps: Step[], via: 'keyboard' | 'pointer'): Promise<Display[]> {
  const seen: Display[] = [];
  for (const step of steps) {
    await press(page, step, via);
    seen.push(await display(page));
  }
  for (let i = 0; i < 8; i++) await page.keyboard.press('Backspace');
  expect((await display(page)).fields.join(''), 'the answer is empty again').toBe('');
  return seen;
}

test.beforeEach(async ({ page, context }) => {
  // Step-by-step parity checks make many round trips; WebKit needs the time.
  test.setTimeout(120_000);
  await installSpeech(context, TYPICAL_VOICES);
  await newFamily(page, { name: 'Ada' });
});

test('the keypad: tapping and typing edit the answer the same way', async ({ page }) => {
  await startPlacement(page);
  expect(await answerMode(page)).toBe('keypad');
  await expect(page.getByTestId('round-prompt')).toHaveText('Type the answer.');
  const steps: Step[] = [
    'digit:0',
    'digit:7', // a lone 0 is replaced, never "07"
    'digit:1',
    'digit:2',
    'digit:3',
    'digit:4',
    'digit:5',
    'digit:6', // six digits at most
    'delete',
    'delete',
    'delete',
    'delete',
    'delete',
    'delete',
    'delete', // deleting an empty answer does nothing
  ];
  const typed = await trace(page, steps, 'keyboard');
  const tapped = await trace(page, steps, 'pointer');
  expect(tapped, 'the same display after every step').toEqual(typed);
  expect(typed.map((d) => d.fields[0])).toEqual([
    '0',
    '7',
    '71',
    '712',
    '7123',
    '71234',
    '712345',
    '712345',
    '71234',
    '7123',
    '712',
    '71',
    '7',
    '',
    '',
  ]);
  expect(typed[2]?.spoken).toBe('Your answer: 71');
  expect(typed.at(-1)?.spoken).toBe('Your answer: ?');

  // Enter after tapping keys still submits: the keys never take focus.
  const answer = await readAnswer(page);
  for (const digit of String(answer.kind === 'number' ? answer.value : 0)) {
    await page.getByTestId(`keypad-${digit}`).click();
  }
  expect(await feedbackAfter(page, () => page.keyboard.press('Enter'))).toBe('correct');
});

test('a round that opens on a keypad problem takes Enter from the keyboard', async ({ page }) => {
  await startPlacement(page);
  const answer = await readAnswer(page);
  expect(
    await feedbackAfter(page, async () => {
      await page.keyboard.type(String(answer.kind === 'number' ? answer.value : 0));
      await page.keyboard.press('Enter');
    }),
  ).toBe('correct');
  await expectNextProblem(page);
  const resumed = written(await readTokens(page));

  await reload(page);
  await playFromTitle(page);
  await openKeeper(page, 1);
  await expect(round(page)).toBeVisible();
  expect(written(await readTokens(page))).toBe(resumed);
  const next = await readAnswer(page);
  await page.keyboard.type(String(next.kind === 'number' ? next.value : 0));
  expect(await display(page), 'digits reach the keypad').toMatchObject({
    fields: [String(next.kind === 'number' ? next.value : 0)],
  });
  expect(
    await feedbackAfter(page, () => page.keyboard.press('Enter')),
    'Enter submits, whatever has focus when the round opens',
  ).toBe('correct');
});

test('Enter still sends the answer after the child used Read aloud', async ({ page }) => {
  await startPlacement(page);
  await page.getByTestId('read-aloud').click();
  const answer = await readAnswer(page);
  await page.keyboard.type(String(answer.kind === 'number' ? answer.value : 0));
  expect(
    await feedbackAfter(page, () => page.keyboard.press('Enter')),
    'Enter sends the typed answer (Read aloud does not keep the focus)',
  ).toBe('correct');
});

test('choice tiles: digits pick, arrows move, Enter and Space choose', async ({ page }) => {
  test.slow();
  // The check opens the levels a child already knows; level 2 feeds with choice tiles.
  await startPlacement(page);
  await finishRound(page, 'keyboard');
  await leaveResults(page, 'Ada');
  await startLevel(page, 'sunny-meadow', 'sunny-meadow.2');
  await expect(round(page)).toBeVisible();
  expect(await answerMode(page)).toBe('choice');
  const group = page.getByTestId('choices');
  await expect(group).toHaveAccessibleName('Answers');
  await expect(page.getByTestId('round-prompt')).toHaveText('Pick the answer.');
  const tiles = group.getByRole('button');
  const labels = (await tiles.allTextContents()).map((text) => text.trim());
  expect(new Set(labels).size, 'distinct choices').toBe(labels.length);

  // Typing the answer's digits picks its tile; Enter chooses it.
  const right = await readAnswer(page);
  const value = String(right.kind === 'number' ? right.value : '');
  expect(labels).toContain(value);
  await page.keyboard.type(value);
  await expect(page.getByTestId(`choice-${value}`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId(`choice-${value}`)).toBeFocused();
  expect(await feedbackAfter(page, () => page.keyboard.press('Enter'))).toBe('correct');
  await expectNextProblem(page);

  // Arrows move between the tiles and wrap around; Space chooses the focused tile.
  const next = await readAnswer(page);
  const nextValue = String(next.kind === 'number' ? next.value : '');
  const nextLabels = (await tiles.allTextContents()).map((text) => text.trim());
  const last = page.getByTestId(`choice-${nextLabels.at(-1)}`);
  await page.getByTestId(`choice-${nextLabels[0]}`).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(last, 'Left from the first tile wraps to the last').toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId(`choice-${nextLabels[0]}`)).toBeFocused();
  for (let step = 0; step < nextLabels.indexOf(nextValue); step++) {
    await page.keyboard.press('ArrowRight');
  }
  await expect(page.getByTestId(`choice-${nextValue}`)).toBeFocused();
  expect(await feedbackAfter(page, () => page.keyboard.press('Space'))).toBe('correct');
  await expect(feedback(page)).toContainText(`= ${nextValue}`);
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('a whole round is played by tapping the keypad', async ({ page }) => {
    await startPlacement(page);
    for (let step = 0; step < 30 && !(await results(page).isVisible()); step++) {
      const answer = await readAnswer(page);
      const kind = await feedbackAfter(page, async () => {
        for (const digit of String(answer.kind === 'number' ? answer.value : 0)) {
          await page.getByTestId(`keypad-${digit}`).tap();
        }
        await page.getByTestId('keypad-ok').tap();
      });
      expect(kind).toBe('correct');
      await expectNextProblem(page);
    }
    await expect(results(page)).toBeVisible();
    await page.getByTestId('results-continue').tap();
    await expectHub(page, 'Ada');
  });
});

test('the pause dialog: Keep playing returns to the same problem; Back ends the round', async ({
  page,
}) => {
  await startPlacement(page);
  const problem = written(await readTokens(page));
  await page.getByTestId('round-pause').click();
  const dialog = page.getByTestId('pause-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Take a break. Your egg will wait.');
  // While paused, keys do not reach the round underneath.
  await page.keyboard.type('12');
  await page.getByTestId('pause-resume').click();
  await expect(dialog).toHaveCount(0);
  expect(written(await readTokens(page))).toBe(problem);
  expect(await display(page), 'nothing was typed behind the dialog').toMatchObject({
    fields: [''],
  });
  await quitRound(page, 'Ada');
});
