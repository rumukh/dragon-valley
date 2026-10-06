/**
 * The grown-ups' gate (docs/app.md §6): press and hold the lock for two seconds, then answer a
 * two-digit × two-digit multiplication. Letting go early empties the lock; a wrong answer just
 * asks a new question (no lockout, no penalty); Escape or "Back to the game" closes it.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  expectScreen,
  gateProduct,
  holdGate,
  leaveHub,
  newFamily,
  typeGateAnswer,
} from './support/app';

async function openGate(page: Page): Promise<void> {
  await page.getByTestId('grownups').click();
  await expect(page.getByTestId('parent-gate')).toBeVisible();
}

function factors(question: string): [number, number] {
  const match = /^What is (\d+) × (\d+)\?$/.exec(question.trim());
  expect(match, `"${question}" is a multiplication question`).not.toBeNull();
  return [Number(match![1]), Number(match![2])];
}

test.beforeEach(async ({ page }) => {
  await newFamily(page, { name: 'Ema' });
  await leaveHub(page);
});

test('every question is two-digit × two-digit, and a wrong answer asks a new one', async ({
  page,
}) => {
  await openGate(page);
  await holdGate(page, 'pointer');
  const question = page.getByTestId('gate-question');
  const asked: string[] = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    const text = (await question.textContent()) ?? '';
    const [a, b] = factors(text);
    for (const factor of [a, b]) {
      expect(factor, `${text}: two digits`).toBeGreaterThanOrEqual(11);
      expect(factor, `${text}: two digits`).toBeLessThanOrEqual(99);
      expect(factor % 10, `${text}: not a multiple of ten`).not.toBe(0);
      expect(factor % 11, `${text}: not a repeated digit`).not.toBe(0);
    }
    expect(a, `${text}: two different factors`).not.toBe(b);
    if (asked.length) expect(text, 'never the previous question').not.toBe(asked.at(-1));
    asked.push(text);
    await typeGateAnswer(page, a * b + 1);
    await expect(page.getByTestId('gate-note')).toHaveText('Not quite. Here is a new one.');
    await expect(question).not.toHaveText(text);
    await expect(page.getByTestId('screen-parent'), 'a wrong answer never opens').toHaveCount(0);
  }
  // No lockout: the right answer still opens the area.
  await typeGateAnswer(page, await gateProduct(page));
  await expectScreen(page, 'parent');
});

test('keyboard users hold the lock with Space and answer on the keyboard', async ({ page }) => {
  await openGate(page);
  await holdGate(page, 'keyboard');
  await typeGateAnswer(page, await gateProduct(page));
  await expectScreen(page, 'parent');
});

test('letting go early opens nothing; the lock empties again', async ({ page }) => {
  await openGate(page);
  const hold = page.getByTestId('gate-hold');
  await expect(hold).toBeFocused();
  await page.keyboard.down('Space');
  await expect(hold).toHaveAttribute('data-state', 'holding');
  await page.waitForTimeout(800);
  await page.keyboard.up('Space');
  await expect(hold).toHaveAttribute('data-state', 'idle');
  await page.waitForTimeout(1600);
  await expect(page.getByTestId('gate-question')).toHaveCount(0);
});

test('Escape and "Back to the game" close the gate and give focus back', async ({ page }) => {
  const door = page.getByTestId('grownups');
  await door.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('parent-gate')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('parent-gate')).toHaveCount(0);
  await expect(door, 'focus returns to the Grown-ups button').toBeFocused();

  await page.keyboard.press('Enter');
  await holdGate(page, 'keyboard');
  await page.getByTestId('gate-cancel').click();
  await expect(page.getByTestId('parent-gate')).toHaveCount(0);
  await expect(door).toBeFocused();
  await expectScreen(page, 'keepers');
});
