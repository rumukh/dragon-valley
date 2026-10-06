/**
 * First flows of the app shell on every engine: making a keeper, reloading, the warm-up round
 * by keyboard (choice tiles, keypad, remainder mode), the grown-ups' gate and settings.
 * Every test also proves no console errors, no page errors and no request to another origin.
 *
 * S3 wrote these for the phase-1 shell; S6 owns test/e2e from here on.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface Observations {
  consoleErrors: string[];
  pageErrors: string[];
  foreignRequests: string[];
}

function observe(page: Page, baseURL: string): Observations {
  const origin = new URL(baseURL).origin;
  const seen: Observations = { consoleErrors: [], pageErrors: [], foreignRequests: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') seen.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => seen.pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && url.origin !== origin) {
      seen.foreignRequests.push(request.url());
    }
  });
  return seen;
}

function expectClean(seen: Observations): void {
  expect(seen.pageErrors, 'uncaught page errors').toEqual([]);
  expect(seen.consoleErrors, 'console errors').toEqual([]);
  expect(seen.foreignRequests, 'requests to another origin').toEqual([]);
}

async function boot(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.getByTestId('boot-status')).toHaveAttribute('data-state', 'ready');
}

async function createKeeper(page: Page, name: string, avatar: string): Promise<void> {
  await page.getByTestId('title-play').click();
  await expect(page.getByTestId('screen-editor')).toBeVisible();
  await page.getByTestId('keeper-name').fill(name);
  await page.getByTestId(`avatar-${avatar}`).click();
  await expect(page.getByTestId(`avatar-${avatar}`).locator('input')).toBeChecked();
  await page.getByTestId('keeper-save').click();
  await expect(page.getByTestId('hub-greeting')).toHaveText(`Hello, ${name}!`);
}

async function openGrownUps(page: Page, options: { wrongFirst?: boolean } = {}): Promise<void> {
  await page.getByTestId('grownups').click();
  const hold = page.getByTestId('gate-hold');
  await expect(hold).toBeVisible();
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId('gate-question')).toBeVisible({ timeout: 5000 });
  await page.mouse.up();
  const ask = async (): Promise<number> => {
    const question = (await page.getByTestId('gate-question').textContent()) ?? '';
    const [, a, b] = /(\d+) × (\d+)/.exec(question) ?? [];
    expect(a && b, question).toBeTruthy();
    return Number(a) * Number(b);
  };
  if (options.wrongFirst) {
    const first = await page.getByTestId('gate-question').textContent();
    await page.keyboard.type(String((await ask()) + 1));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('gate-note')).toContainText('Not quite');
    await expect(page.getByTestId('gate-question')).not.toHaveText(first ?? '');
    await expect(page.getByTestId('screen-parent')).toHaveCount(0);
  }
  await page.keyboard.type(String(await ask()));
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('screen-parent')).toBeVisible();
}

test('a new family creates a keeper, reaches the hub, and keeps the keeper after a reload', async ({
  page,
  baseURL,
}) => {
  const seen = observe(page, baseURL!);
  await boot(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dragon Valley');
  await createKeeper(page, 'Šárka', 'keeper-3');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
  await expect(page.getByTestId('coins')).toHaveAttribute('data-value', '0');

  await page.reload();
  await expect(page.getByTestId('boot-status')).toHaveAttribute('data-state', 'ready');
  await page.getByTestId('title-play').click();
  await expect(page.getByTestId('screen-keepers')).toBeVisible();
  const card = page.getByTestId('keeper-profile-1');
  await expect(card).toContainText('Šárka');
  await card.click();
  await expect(page.getByTestId('hub-greeting')).toHaveText('Hello, Šárka!');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
  expectClean(seen);
});

test('the warm-up round plays by keyboard, saves every answer and survives a reload', async ({
  page,
  baseURL,
}) => {
  const seen = observe(page, baseURL!);
  await boot(page);
  await createKeeper(page, 'Tom', 'keeper-5');
  await page.getByTestId('hub-practice').click();
  const problem = page.getByTestId('problem');
  await expect(problem).toHaveText('2·4=?');

  // Typed digits pick the matching tile; Enter chooses it.
  await page.keyboard.press('8');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'correct');
  await expect(page.getByTestId('feedback')).toContainText('2 · 4 = 8');
  await expect(problem).toHaveText('5·3=?');

  // A miss is kind: orange "?" feedback, a picture model, and the same problem again.
  await page.keyboard.press('8');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'miss');
  await expect(page.getByTestId('model')).toHaveAttribute('data-kind', 'array');
  await expect(page.getByTestId('choice-8')).toBeDisabled();
  await page.getByTestId('choice-15').click();
  await expect(problem).toHaveText('10·6=?');

  // The keypad takes physical keys and on-screen keys alike.
  await page.keyboard.type('6');
  await page.getByTestId('keypad-0').click();
  await page.keyboard.press('Enter');
  await expect(problem).toHaveText('23:5=?r?');

  // Remainder mode: quotient, then r to move to the remainder.
  await page.keyboard.type('4');
  await page.keyboard.press('r');
  await page.keyboard.type('3');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('round-results')).toBeVisible();
  await expect(page.getByTestId('stars')).toHaveAttribute('data-earned', '2');
  await expect(page.getByTestId('coins')).toHaveAttribute('data-value', '4');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');

  // Every control on the round meets the child-safe 48 px target.
  for (const button of await page.locator('main button:visible').all()) {
    const box = (await button.boundingBox())!;
    expect(Math.round(box.width), await button.innerText()).toBeGreaterThanOrEqual(48);
    expect(Math.round(box.height), await button.innerText()).toBeGreaterThanOrEqual(48);
  }

  await page.reload();
  await expect(page.getByTestId('boot-status')).toHaveAttribute('data-state', 'ready');
  await page.getByTestId('title-play').click();
  await page.getByTestId('keeper-profile-1').click();
  await expect(page.getByTestId('coins')).toHaveAttribute('data-value', '4');
  await expect(page.getByTestId('egg-warmth')).toHaveAttribute('aria-valuenow', '100');
  expectClean(seen);
});

test('the grown-ups gate opens only after a full hold and a right answer', async ({
  page,
  baseURL,
}) => {
  const seen = observe(page, baseURL!);
  await boot(page);
  await createKeeper(page, 'Ema', 'keeper-1');
  await page.getByTestId('hub-back').click();
  await expect(page.getByTestId('screen-keepers')).toBeVisible();

  // Letting go early opens nothing; the question comes only after a full hold.
  await page.getByTestId('grownups').click();
  const hold = page.getByTestId('gate-hold');
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await page.waitForTimeout(2000);
  await expect(page.getByTestId('gate-question')).toHaveCount(0);
  await page.getByTestId('gate-cancel').click();
  await expect(page.getByTestId('parent-gate')).toHaveCount(0);

  // A wrong answer just asks a new question.
  await openGrownUps(page, { wrongFirst: true });
  expectClean(seen);
});

test('grown-ups switch the math signs and rename a keeper, and Escape pauses a round', async ({
  page,
  baseURL,
}) => {
  const seen = observe(page, baseURL!);
  await boot(page);
  await createKeeper(page, 'Ema', 'keeper-1');
  await page.getByTestId('hub-back').click();
  await expect(page.getByTestId('screen-keepers')).toBeVisible();

  await openGrownUps(page);
  await page.getByTestId('parent-tab-settings').click();
  await page.getByTestId('setting-notation-international').click();
  await expect(page.getByTestId('setting-notation-international')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByTestId('parent-tab-keepers').click();
  await page.getByTestId('parent-edit-profile-1').click();
  await page.getByTestId('keeper-name').fill('Emička');
  await page.getByTestId('keeper-save').click();
  await expect(page.getByTestId('screen-parent')).toBeVisible();
  await expect(page.getByTestId('parent-keepers')).toContainText('Emička');
  await page.getByTestId('parent-close').click();

  await page.getByTestId('keeper-profile-1').click();
  await expect(page.getByTestId('hub-greeting')).toHaveText('Hello, Emička!');
  await page.getByTestId('hub-practice').click();
  await expect(page.getByTestId('problem')).toHaveText('2×4=?');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('pause-dialog')).toBeVisible();
  await page.getByTestId('pause-resume').click();
  await expect(page.getByTestId('pause-dialog')).toHaveCount(0);
  expectClean(seen);
});
