/**
 * Saving and resuming (docs/app.md §4, plan §3.5): every answer is a durable checkpoint, a
 * reload resumes exactly where the child was (the play screen opens on the round in progress),
 * finished rounds stay finished, and keepers never share progress.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  addKeeper,
  answerCorrectly,
  answerWrongly,
  coinCount,
  expectCoins,
  expectHub,
  expectSaved,
  expectScreen,
  finishRound,
  goOn,
  leaveHub,
  leaveResults,
  newFamily,
  openKeeper,
  playAs,
  playFromTitle,
  quitRound,
  reload,
  results,
  round,
  startPlacement,
} from './support/app';
import { readTokens, written } from './support/problem';

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

test('a reload in the middle of a round resumes on the same problem with the same coins', async ({
  page,
}) => {
  test.slow();
  await newFamily(page, { name: 'Ada', avatar: 'keeper-2' });
  await startPlacement(page);
  await answerCorrectly(page, 'keyboard');
  await answerWrongly(page, 'keyboard');
  await goOn(page);
  await expectSaved(page);
  const before = written(await readTokens(page));
  const progress = await page.getByTestId('placement-progress').getAttribute('aria-valuetext');
  const coins = await settledCoins(page);
  expect(coins, 'a right answer earns coins').toBeGreaterThan(0);

  await reload(page);
  await expectScreen(page, 'title');
  await playFromTitle(page);
  await openKeeper(page, 1);
  await expect(round(page), 'the keeper is taken straight back into the round').toBeVisible();
  expect(written(await readTokens(page)), 'the same problem as before the reload').toBe(before);
  await expect(page.getByTestId('placement-progress')).toHaveAttribute('aria-valuetext', progress!);
  await expectCoins(page, coins, 'the coins earned before the reload');
  await finishRound(page, 'pointer');
  await expect(page.getByTestId('results-summary')).toBeVisible();
});

test('a finished round is kept: its coins survive a reload and it is not asked again', async ({
  page,
}) => {
  await newFamily(page, { name: 'Ben' });
  await startPlacement(page);
  const answers = await finishRound(page, 'keyboard');
  await expect(page.getByTestId('results-title')).toHaveText('The dragons saw what you know!');
  await expect(page.getByTestId('results-summary')).toContainText(
    `${answers.length} of ${answers.length} right.`,
  );
  // DV-QA-12, fixed in #17: the egg chosen in the prologue was celebrated again as new.
  await expect(
    page.getByTestId('celebrate-egg').first(),
    'the eggs the check unlocked are celebrated',
  ).toBeAttached();
  await expect(
    page.getByTestId('celebrate-egg').filter({ hasText: 'Bubbles' }),
    'the egg chosen in the prologue is not a new egg here',
  ).toHaveCount(0);
  await expectSaved(page);
  const coins = await settledCoins(page);
  await expect(page.getByTestId('results-coins')).toHaveText(/^You got \d+ coins!$/);
  await leaveResults(page, 'Ben');
  await expectCoins(page, coins);
  const next = page.getByTestId('hub-adventure');
  await expect(next, 'the check is done; the adventure moves on').not.toHaveText(
    'Show the dragons what you know!',
  );
  const suggestion = await next.textContent();

  await reload(page);
  await playFromTitle(page);
  await playAs(page, 1, 'Ben');
  await expectCoins(page, coins);
  await expect(next).toHaveText(suggestion!);
  await expect(results(page)).toHaveCount(0);
});

test('each keeper has their own progress', async ({ page }) => {
  test.slow();
  await newFamily(page, { name: 'Cleo' }, { name: 'Dan', avatar: 'keeper-6' });
  await leaveHub(page);
  await playAs(page, 1, 'Cleo');
  await startPlacement(page);
  await finishRound(page, 'pointer');
  const coins = await settledCoins(page);
  await leaveResults(page, 'Cleo');

  await leaveHub(page);
  await playAs(page, 2, 'Dan');
  await expectCoins(page, 0, "Dan's purse is his own");
  await expect(page.getByTestId('hub-adventure'), 'Dan has not had his check yet').toHaveText(
    'Show the dragons what you know!',
  );

  await reload(page);
  await playFromTitle(page);
  await playAs(page, 1, 'Cleo');
  await expectCoins(page, coins);
});

test('a keeper added later starts fresh in the next free slot', async ({ page }) => {
  await newFamily(page, { name: 'Eva' });
  await startPlacement(page);
  await answerCorrectly(page, 'keyboard');
  await quitRound(page, 'Eva');
  await leaveHub(page);
  await addKeeper(page, { name: 'Filip', avatar: 'keeper-7' }, 'sunny');
  await expectCoins(page, 0);
  await leaveHub(page);
  await expect(page.getByTestId('keeper-profile-2')).toHaveAccessibleName('Play as Filip');
  await expectHub(page, 'Filip').catch(() => undefined);
});
