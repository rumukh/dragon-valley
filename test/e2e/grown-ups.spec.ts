/**
 * The grown-ups' remaining controls (plan §2.12, docs/app.md §14), each with what it changes for
 * the child: starting a keeper over (confirmed, settings kept), asking the browser to keep the saved
 * progress (only when a grown-up taps), running the placement check again, and the Lightning Arena
 * switch.
 */
import type { BrowserContext } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  changeOnPanel,
  chooseSetting,
  closeGrownUps,
  coinCount,
  expectHub,
  finishRound,
  leaveHub,
  leaveResults,
  loadBackup,
  meetFirstEgg,
  newFamily,
  openGrownUps,
  openKeeper,
  openTab,
  playAs,
  startPlacement,
} from './support/app';
import { readTokens, written } from './support/problem';
import { meadowWonBackup } from './support/saves';

test.use({ reducedMotion: 'reduce' });

test('starting a keeper over needs a confirmation, erases their dragons and progress, and keeps their settings', async ({
  page,
}) => {
  test.slow();
  await newFamily(page, { name: 'Ada' });
  await startPlacement(page);
  await finishRound(page, 'keyboard');
  await leaveResults(page, 'Ada');
  await expect
    .poll(() => coinCount(page), { message: 'the check earned coins' })
    .toBeGreaterThan(0);
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  await chooseSetting(page, 'setting-notation-international');

  await openTab(page, 'data');
  const reset = page.getByTestId('progress-reset-profile-1');
  await expect(reset).toContainText('Start Ada over');
  await reset.click();
  await page.getByTestId('confirm-cancel').click();
  await closeGrownUps(page);
  await playAs(page, 1, 'Ada');
  await expect
    .poll(() => coinCount(page), { message: 'Cancel kept the progress' })
    .toBeGreaterThan(0);

  await leaveHub(page);
  await openGrownUps(page, 'data');
  await page.getByTestId('progress-reset-profile-1').click();
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('toast').last()).toHaveText("Ada's progress was erased.");
  await closeGrownUps(page);
  await openKeeper(page, 1);
  // A fresh game: the prologue and the first egg again, no coins.
  await meetFirstEgg(page);
  await expectHub(page, 'Ada');
  await expect.poll(() => coinCount(page), { message: 'the coins are gone' }).toBe(0);
  // The settings stayed: the new placement check is written the international way.
  await startPlacement(page);
  expect(written(await readTokens(page)), 'the keeper keeps international signs').toMatch(/[×÷]/);
});

/**
 * Stands in for the browser's storage manager: how it answers, and how often it was asked. It
 * replaces the prototype's methods: WebKit hands out a new `navigator.storage` object after the
 * page loads, so a stand-in set on the first one would be lost.
 */
async function stubPersistence(context: BrowserContext, grant: boolean): Promise<void> {
  await context.addInitScript((granted) => {
    let kept = false;
    const asked = { count: 0 };
    Object.defineProperty(window, '__dvQaPersist', { value: asked, configurable: true });
    Object.defineProperty(StorageManager.prototype, 'persisted', {
      configurable: true,
      value: async () => kept,
    });
    Object.defineProperty(StorageManager.prototype, 'persist', {
      configurable: true,
      value: async () => {
        asked.count++;
        kept = granted;
        return granted;
      },
    });
  }, grant);
}

for (const grant of [true, false]) {
  test(`the grown-ups ask the browser to keep progress, and it ${grant ? 'agrees' : 'declines'}`, async ({
    page,
    context,
  }) => {
    await stubPersistence(context, grant);
    const asked = (): Promise<number> =>
      page.evaluate(
        () => (window as unknown as { __dvQaPersist: { count: number } }).__dvQaPersist.count,
      );
    await newFamily(page, { name: 'Ada' });
    await leaveHub(page);
    await openGrownUps(page, 'data');
    const status = page.getByTestId('storage-status');
    await expect(status).toHaveAttribute('data-persisted', 'false');
    await expect(status).toHaveText(
      'The browser may clear saved progress if the device runs low on space. Backups keep it safe.',
    );
    expect(await asked(), 'nothing is asked until a grown-up taps').toBe(0);

    await page.getByTestId('storage-persist').click();
    await expect.poll(asked, { message: 'the tap asks the browser once' }).toBe(1);
    if (grant) {
      await expect(status).toHaveAttribute('data-persisted', 'true');
      await expect(status).toHaveText('The browser has promised to keep saved progress.');
      await expect(page.getByTestId('storage-persist'), 'nothing left to ask').toHaveCount(0);
    } else {
      await expect(status).toHaveAttribute('data-persisted', 'false');
      await expect(
        page.getByTestId('storage-persist'),
        'the grown-ups can ask again',
      ).toBeVisible();
    }
  });
}

test('the grown-ups can run the placement check again: it starts the next time the keeper plays', async ({
  page,
}) => {
  test.slow();
  await newFamily(page, { name: 'Ada' });
  await startPlacement(page);
  await finishRound(page, 'keyboard');
  await leaveResults(page, 'Ada');
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  const again = page.getByTestId('setting-placement');
  await expect(again, "the keeper's game settings are shown").toBeVisible();
  await again.click();
  await expect(page.getByTestId('toast').last()).toHaveText(
    'The placement check starts the next time Ada plays.',
  );
  await closeGrownUps(page);
  await openKeeper(page, 1);
  await expect(
    page.getByTestId('placement-progress'),
    'the placement check is waiting',
  ).toBeVisible();
});

test('the Lightning Arena opens after the Bridge Troll, and the grown-ups can switch it off and on', async ({
  page,
}) => {
  test.slow();
  const backup = await meadowWonBackup();
  await newFamily(page, { name: 'Ada' });
  await leaveHub(page);
  await loadBackup(page, backup, 'Ada');
  await playAs(page, 1, 'Ada');
  await expect(page.getByTestId('hub-arena'), 'the Arena is open').toBeVisible();
  for (const on of [false, true]) {
    await leaveHub(page);
    await openGrownUps(page, 'settings');
    const toggle = page.getByTestId('setting-arena');
    await expect(toggle).toBeChecked({ checked: !on });
    await changeOnPanel(page, () => toggle.click());
    await expect(page.getByTestId('toast').last()).toHaveText('Game setting saved.');
    await expect(page.getByTestId('setting-arena')).toBeChecked({ checked: on });
    await closeGrownUps(page);
    await playAs(page, 1, 'Ada');
    await expect(page.getByTestId('hub-arena'), `the Arena is ${on ? 'on' : 'off'}`).toHaveCount(
      on ? 1 : 0,
    );
  }
});
