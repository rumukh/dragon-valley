/**
 * When saving goes wrong. The save status tells the truth ("Saved" only for acknowledged
 * writes), a failed write is retried exactly once, another window's write is never silently
 * overwritten, and an unreadable record is never turned into a new one by itself: a grown-up
 * chooses what happens (docs/app.md §4 "Save status" and "Recovery").
 */
import type { Download, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { expect, test } from './support/fixtures';
import {
  answerCorrectly,
  chooseSetting,
  coinCount,
  closeGrownUps,
  expectCoins,
  expectNextProblem,
  expectSaved,
  expectScreen,
  feedback,
  feedbackAfter,
  giveAnswer,
  keeperCard,
  leaveHub,
  newFamily,
  openGrownUps,
  openKeeper,
  playAs,
  playFromTitle,
  quitRound,
  reload,
  round,
  startPlacement,
  waitReady,
} from './support/app';
import { readAnswer, readTokens, written } from './support/problem';
import {
  corruptRecord,
  FAMILY_KEY,
  gameKey,
  installStorageFaults,
  preferencesKey,
  readHistory,
  setStorageFaults,
} from './support/storage';

const saveStatus = (page: Page) => page.getByTestId('save-status');

async function downloaded(download: Download): Promise<string> {
  return readFile((await download.path())!, 'utf8');
}

/** The purse once the coins have finished flying in (two equal readings in a row). */
async function settledCoins(page: Page): Promise<number> {
  let last = -1;
  await expect
    .poll(
      async () => {
        const now = await coinCount(page);
        const same = now === last;
        last = now;
        return same;
      },
      { intervals: [700], message: 'the purse settles' },
    )
    .toBe(true);
  return last;
}

test.describe('the save status', () => {
  test('a failed save says "Not saved", holds the answer, and Retry stores it once', async ({
    page,
    context,
  }) => {
    await installStorageFaults(context);
    await newFamily(page, { name: 'Ada' });
    await startPlacement(page);
    await answerCorrectly(page, 'keyboard');
    await expectSaved(page);
    const first = await settledCoins(page);

    // The disk fills up: the answer is sent but cannot be stored.
    await setStorageFaults(page, { failWrites: true });
    const held = written(await readTokens(page));
    const answer = await readAnswer(page);
    await giveAnswer(page, answer, 'keyboard');
    await expect(saveStatus(page)).toHaveAttribute('data-state', 'failed');
    await expect(saveStatus(page)).toContainText('Not saved');
    await expect(page.getByTestId('save-retry')).toBeVisible();
    await expect(
      page.getByTestId('announcer-assertive'),
      'screen readers hear about the failed save at once',
    ).toHaveText('Not saved');

    // Play is held: no praise and no coins for an answer that is not stored.
    await expect(feedback(page)).toHaveAttribute('data-kind', 'none');
    expect(written(await readTokens(page))).toBe(held);
    await expectCoins(page, first);
    // Sending it again only says why nothing happens.
    expect(await feedbackAfter(page, () => page.keyboard.press('Enter'))).toBe('info');
    await expect(feedback(page)).toHaveText('Saving stopped. Tap Retry at the top.');

    // Retry while the disk is still full fails again.
    await page.getByTestId('save-retry').click();
    await expect(saveStatus(page)).toHaveAttribute('data-state', 'failed');

    // With room again, Retry stores the held answer: it is praised and the round moves on.
    await setStorageFaults(page, { failWrites: false });
    expect(
      await feedbackAfter(page, () => page.getByTestId('save-retry').click()),
      'the stored answer is praised',
    ).toBe('correct');
    await expectSaved(page);
    await expect
      .poll(async () => written(await readTokens(page)), { message: 'the round moves on' })
      .not.toBe(held);
    await expectNextProblem(page);
    const next = written(await readTokens(page));

    // Stored exactly once: a reload resumes right after the held answer.
    await reload(page);
    await playFromTitle(page);
    await openKeeper(page, 1);
    await expect(round(page)).toBeVisible();
    expect(written(await readTokens(page)), 'the problem after the held answer').toBe(next);
    expect(await coinCount(page), 'the stored answer earned its coins').toBeGreaterThan(first);
  });
  test('"Not saved" is the truth: reloading before Retry keeps only what was saved', async ({
    page,
    context,
  }) => {
    await installStorageFaults(context);
    await newFamily(page, { name: 'Ben' });
    await startPlacement(page);
    await answerCorrectly(page, 'pointer');
    await expectSaved(page);
    const coins = await settledCoins(page);
    const unsaved = written(await readTokens(page));

    await setStorageFaults(page, { failWrites: true });
    await giveAnswer(page, await readAnswer(page), 'pointer');
    await expect(saveStatus(page)).toHaveAttribute('data-state', 'failed');
    await setStorageFaults(page, { failWrites: false });

    await reload(page);
    await playFromTitle(page);
    await openKeeper(page, 1);
    await expect(round(page)).toBeVisible();
    await expectCoins(page, coins, 'only the saved answer counts');
    expect(written(await readTokens(page)), 'the unsaved answer is asked again').toBe(unsaved);
  });

  test('a second window: the older one says "Open in another window" and Reopen loads the newer save', async ({
    page,
    context,
  }) => {
    await newFamily(page, { name: 'Cleo' });
    await startPlacement(page);
    await answerCorrectly(page, 'keyboard');
    await expectSaved(page);

    const other = await context.newPage();
    await other.goto('./');
    await waitReady(other);
    await playFromTitle(other);
    await openKeeper(other, 1);
    await expect(round(other), 'the other window opens the same round').toBeVisible();
    await answerCorrectly(other, 'keyboard');
    await expectSaved(other);
    const newer = { coins: await settledCoins(other), problem: written(await readTokens(other)) };
    await other.close();

    // The first window's next answer would overwrite the other window's progress.
    await giveAnswer(page, await readAnswer(page), 'keyboard');
    await expect(saveStatus(page)).toHaveAttribute('data-state', 'conflict');
    await expect(saveStatus(page)).toContainText('Open in another window');
    await expect(page.getByTestId('save-retry')).toHaveCount(0);
    await page.getByTestId('save-reopen').click();
    await expectSaved(page);
    await expect(round(page)).toBeVisible();
    await expectCoins(page, newer.coins, 'the newer save from the other window');
    expect(written(await readTokens(page)), 'and its next problem').toBe(newer.problem);
  });
});
test.describe('recovery', () => {
  test('a damaged keeper list asks a grown-up; the previous copy brings the keepers back', async ({
    page,
  }) => {
    await newFamily(page, { name: 'Ema' }, { name: 'Filip', avatar: 'keeper-5' });
    const { damaged } = await corruptRecord(page, FAMILY_KEY);

    await reload(page);
    await expectScreen(page, 'recovery');
    const screen = page.getByTestId('screen-recovery');
    await expect(screen).toHaveAttribute('data-kind', 'family');
    await expect(screen).toContainText('The list of keepers on this device could not be opened.');
    await expect(screen).toContainText('Nothing was changed or deleted.');
    await expect(screen).toContainText('Error code: ');
    await expect(page.getByTestId('recovery-back'), 'no keepers to go back to').toHaveCount(0);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('recovery-export').click(),
    ]);
    expect(download.suggestedFilename()).toBe('dragon-valley-family-family-stored.json');
    expect(await downloaded(download), 'the stored bytes, exactly as found').toBe(damaged);

    // Trying again changes nothing while the record is still damaged.
    await page.getByTestId('recovery-retry').click();
    await expect(page.getByTestId('recovery-status')).toHaveText(
      'That did not work, so the saved data was not changed.',
    );

    await page.getByTestId('recovery-previous').click();
    await expectScreen(page, 'title');
    await playFromTitle(page);
    await expect(keeperCard(page, 1)).toHaveAccessibleName('Play as Ema');
    await expect(keeperCard(page, 2)).toHaveAccessibleName('Play as Filip');
    await reload(page);
    await expectScreen(page, 'title');
  });

  test('a damaged keeper list can be erased, but only after a confirmation', async ({ page }) => {
    await newFamily(page, { name: 'Gita' });
    await corruptRecord(page, FAMILY_KEY);
    await reload(page);
    await expectScreen(page, 'recovery');

    await page.getByTestId('recovery-reset').click();
    const confirm = page.getByTestId('confirm-dialog');
    await expect(confirm).toContainText('Erase this saved data?');
    await page.getByTestId('confirm-cancel').click();
    await expect(confirm).toHaveCount(0);
    await expectScreen(page, 'recovery');

    await page.getByTestId('recovery-reset').click();
    await page.getByTestId('confirm-ok').click();
    await expectScreen(page, 'title');
    await page.getByTestId('title-play').click();
    await expectScreen(page, 'editor');
  });

  test("a damaged game save asks a grown-up; the previous copy restores the keeper's progress", async ({
    page,
  }) => {
    await newFamily(page, { name: 'Hana' });
    await startPlacement(page);
    await answerCorrectly(page, 'keyboard');
    await answerCorrectly(page, 'keyboard');
    await expectSaved(page);
    await quitRound(page, 'Hana');
    const coins = await settledCoins(page);
    expect(coins).toBeGreaterThan(0);
    await leaveHub(page);
    const key = await gameKey(page, 'profile-1');
    await corruptRecord(page, key);

    await keeperCard(page, 1).click();
    await expectScreen(page, 'recovery');
    const screen = page.getByTestId('screen-recovery');
    await expect(screen).toHaveAttribute('data-kind', 'game');
    await expect(screen).toContainText("Hana's saved game could not be opened.");
    for (const action of ['export', 'previous', 'import', 'reset', 'retry', 'back']) {
      await expect(page.getByTestId(`recovery-${action}`)).toBeVisible();
    }

    await page.getByTestId('recovery-back').click();
    await expectScreen(page, 'keepers');
    expect((await readHistory(page, key))?.current?.payload, 'leaving changed nothing').toMatch(
      /^\{"format":"aegis\.save","formatVersion":1,"gameId":$/,
    );

    await keeperCard(page, 1).click();
    await expectScreen(page, 'recovery');
    await page.getByTestId('recovery-previous').click();
    await expectScreen(page, 'keepers');
    await playAs(page, 1, 'Hana');
    await expectCoins(page, coins, 'both right answers are back');
  });

  test("damaged settings ask a grown-up; starting them fresh keeps the keeper's game", async ({
    page,
  }) => {
    await newFamily(page, { name: 'Ivo' });
    await startPlacement(page);
    await answerCorrectly(page, 'pointer');
    await expectSaved(page);
    await quitRound(page, 'Ivo');
    const coins = await settledCoins(page);
    await leaveHub(page);
    // Settings are stored once a grown-up changes one.
    await openGrownUps(page, 'settings');
    await chooseSetting(page, 'setting-notation-international');
    await closeGrownUps(page);
    await corruptRecord(page, preferencesKey('profile-1'), '{"not":"settings"}');

    await keeperCard(page, 1).click();
    await expectScreen(page, 'recovery');
    await expect(page.getByTestId('screen-recovery')).toHaveAttribute('data-kind', 'preferences');
    await expect(page.getByTestId('screen-recovery')).toContainText(
      "Ivo's settings could not be opened.",
    );
    await page.getByTestId('recovery-reset').click();
    await page.getByTestId('confirm-ok').click();
    await expectScreen(page, 'keepers');
    await playAs(page, 1, 'Ivo');
    await expectCoins(page, coins, 'the game was not touched');
    await leaveHub(page);
    await openGrownUps(page, 'settings');
    await expect(
      page.getByTestId('setting-notation-czech'),
      'the settings start fresh: Czech signs',
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('storage that will not open offers only "Try opening again", and nothing is lost', async ({
    page,
    context,
  }) => {
    await installStorageFaults(context);
    await newFamily(page, { name: 'Jana' });
    // From the next page load on, IndexedDB refuses to open (as in some private windows).
    await context.addInitScript(() => {
      (window as unknown as { __dvQaStorage: { unavailable: boolean } }).__dvQaStorage.unavailable =
        true;
    });
    await reload(page);
    await expectScreen(page, 'recovery');
    const screen = page.getByTestId('screen-recovery');
    await expect(screen).toContainText(
      'The browser is not letting Dragon Valley use its storage. Private windows often do this.',
    );
    await expect(screen.getByRole('button')).toHaveCount(1);
    await expect(page.getByTestId('recovery-retry')).toHaveText('Try opening again');

    await setStorageFaults(page, { unavailable: false });
    await page.getByTestId('recovery-retry').click();
    await expectScreen(page, 'title');
    await playFromTitle(page);
    await expect(keeperCard(page, 1)).toHaveAccessibleName('Play as Jana');
  });
});
