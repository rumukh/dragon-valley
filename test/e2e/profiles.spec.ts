/**
 * The first flows of the game on every engine, on the real rules: a new keeper's prologue and
 * first egg, the placement check by keyboard (keypad, a kind miss, results, saved coins after a
 * reload), the grown-ups' gate, and the settings (notation, a rule setting, a rename) with the
 * pause dialog. Every test also proves no console errors, no page errors and no request to
 * another origin.
 *
 * S3 wrote these for its screens; S6 owns test/e2e and the broad suite.
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

/** Make a keeper, skip the prologue and choose the blue egg: the hub is next. */
async function createKeeper(page: Page, name: string, avatar: string): Promise<void> {
  await page.getByTestId('title-play').click();
  await expect(page.getByTestId('screen-editor')).toBeVisible();
  await page.getByTestId('keeper-name').fill(name);
  await page.getByTestId(`avatar-${avatar}`).click();
  await expect(page.getByTestId(`avatar-${avatar}`).locator('input')).toBeChecked();
  await page.getByTestId('keeper-save').click();
  await expect(page.getByTestId('screen-story')).toBeVisible();
  await page.getByTestId('story-skip').click();
  await page.getByTestId('story-choice-bubbles').click();
  await page.getByTestId('story-next').click();
  await expect(page.getByTestId('hub-greeting')).toHaveText(`Hello, ${name}!`);
}

/** The answer to a problem as written (×, :, a missing factor), worked out independently. */
function solve(written: string): number {
  const text = written.replace(/\s+/g, '');
  const pairs: [RegExp, (a: number, b: number) => number][] = [
    [/^(\d+)[·×](\d+)=\?$/, (a, b) => a * b],
    [/^(\d+)[:÷](\d+)=\?$/, (a, b) => a / b],
    [/^\?[·×](\d+)=(\d+)$/, (a, b) => b / a],
    [/^(\d+)[·×]\?=(\d+)$/, (a, b) => b / a],
  ];
  for (const [pattern, answer] of pairs) {
    const match = pattern.exec(text);
    if (match) return answer(Number(match[1]), Number(match[2]));
  }
  throw new Error(`No oracle for ${written}`);
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

test('a new keeper hears the prologue, chooses an egg and keeps it after a reload', async ({
  page,
  baseURL,
}) => {
  // A whole flow through the story and the grown-ups' gate: slow on WebKit and on busy machines.
  test.slow();
  const seen = observe(page, baseURL!);
  await boot(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dragon Valley');
  await page.getByTestId('title-play').click();
  await page.getByTestId('keeper-name').fill('Šárka');
  await page.getByTestId('avatar-keeper-3').click();
  await page.getByTestId('keeper-save').click();

  // The prologue, line by line; the egg choice cannot be skipped.
  await expect(page.getByTestId('story-line')).toContainText('Seven-Headed Dragon');
  await page.getByTestId('story-next').click();
  await expect(page.getByTestId('story-line')).toContainText('Magic Window');
  await page.getByTestId('story-skip').click();
  await expect(page.getByTestId('story-line')).toContainText('first egg');
  await expect(page.getByTestId('story-skip')).toHaveCount(0);
  await page.getByTestId('story-choice-sunny').click();
  await expect(page.getByTestId('story-line')).toContainText('Great choice');
  await page.getByTestId('story-next').click();

  await expect(page.getByTestId('hub-greeting')).toHaveText('Hello, Šárka!');
  await expect(page.getByTestId('hub-dragon')).toHaveAttribute('data-dragon', 'sunny');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');

  await page.reload();
  await expect(page.getByTestId('boot-status')).toHaveAttribute('data-state', 'ready');
  await page.getByTestId('title-play').click();
  const card = page.getByTestId('keeper-profile-1');
  await expect(card).toContainText('Šárka');
  await card.click();
  await expect(page.getByTestId('hub-greeting')).toHaveText('Hello, Šárka!');
  await expect(page.getByTestId('hub-dragon')).toHaveAttribute('data-dragon', 'sunny');
  expectClean(seen);
});

test('the placement check plays by keyboard, is kind after a miss and survives a reload', async ({
  page,
  baseURL,
}) => {
  // The check asks 12 to 24 problems with their feedback: a long flow on every engine.
  test.slow();
  const seen = observe(page, baseURL!);
  await boot(page);
  await createKeeper(page, 'Tom', 'keeper-5');
  await expect(page.getByTestId('hub-adventure')).toContainText('Show the dragons');
  await page.getByTestId('hub-adventure').click();
  await expect(page.getByTestId('screen-round')).toHaveAttribute('data-placement', 'true');

  // A miss first: orange "?", the right fact and its picture; the child goes on when ready.
  const problem = page.getByTestId('problem');
  const first = solve(await problem.innerText());
  await page.keyboard.type(String(first + 1));
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-kind', 'miss');
  await expect(page.getByTestId('feedback-fact')).toContainText(`= ${first}`);
  await page.getByTestId('feedback-next').click();

  // Then right answers by keyboard until the check ends.
  for (let step = 0; step < 30; step++) {
    if (await page.getByTestId('screen-results').isVisible()) break;
    if (await page.getByTestId('feedback-next').isVisible()) {
      await page.getByTestId('feedback-next').click();
      continue;
    }
    // The next problem is ready once the feedback is gone (or the check has ended).
    await expect(
      page
        .getByTestId('screen-results')
        .or(page.locator('[data-testid="feedback"][data-kind="none"]')),
    ).toBeAttached({ timeout: 15_000 });
    if (await page.getByTestId('screen-results').isVisible()) break;
    const written = await problem.innerText();
    await page.keyboard.type(String(solve(written)));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('feedback')).not.toHaveAttribute('data-kind', 'none');
  }
  await expect(page.getByTestId('screen-results')).toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
  const coins = await page.getByTestId('coins').getAttribute('data-value');
  expect(Number(coins)).toBeGreaterThan(0);
  await page.getByTestId('results-continue').click();
  await expect(page.getByTestId('screen-hub')).toBeVisible();

  // Every control on the hub meets the child-safe 48 px target.
  for (const button of await page.locator('main button:visible').all()) {
    const box = (await button.boundingBox())!;
    expect(Math.round(box.width), await button.innerText()).toBeGreaterThanOrEqual(48);
    expect(Math.round(box.height), await button.innerText()).toBeGreaterThanOrEqual(48);
  }

  await page.reload();
  await expect(page.getByTestId('boot-status')).toHaveAttribute('data-state', 'ready');
  await page.getByTestId('title-play').click();
  await page.getByTestId('keeper-profile-1').click();
  await expect(page.getByTestId('coins')).toHaveAttribute('data-value', coins!);
  expectClean(seen);
});
test('the grown-ups gate opens only after a full hold and a right answer', async ({
  page,
  baseURL,
}) => {
  // A whole flow through the story and the grown-ups' gate: slow on WebKit and on busy machines.
  test.slow();
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

test('grown-ups switch the math signs, set the daily goal and rename; Escape pauses', async ({
  page,
  baseURL,
}) => {
  // A whole flow through the story and the grown-ups' gate: slow on WebKit and on busy machines.
  test.slow();
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
  // A rule setting goes to the keeper's game as an action.
  await page.getByTestId('setting-goal-20').click();
  await expect(page.getByTestId('setting-goal-20')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('parent-tab-keepers').click();
  await page.getByTestId('parent-edit-profile-1').click();
  await page.getByTestId('keeper-name').fill('Emička');
  await page.getByTestId('keeper-save').click();
  await expect(page.getByTestId('screen-parent')).toBeVisible();
  await expect(page.getByTestId('parent-keepers')).toContainText('Emička');
  await page.getByTestId('parent-close').click();

  await page.getByTestId('keeper-profile-1').click();
  await expect(page.getByTestId('hub-greeting')).toHaveText('Hello, Emička!');
  await expect(page.getByTestId('daily-goal')).toHaveAttribute('aria-valuemax', '20');
  await page.getByTestId('hub-adventure').click();
  await expect(page.getByTestId('problem')).toContainText(/[×÷]/);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('pause-dialog')).toBeVisible();
  await page.getByTestId('pause-resume').click();
  await expect(page.getByTestId('pause-dialog')).toHaveCount(0);
  expectClean(seen);
});
