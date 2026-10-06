/**
 * The grown-ups' settings for each keeper (docs/app.md §4 "Preferences", §9 "Notation").
 *
 * The notation switch is checked where it matters, on the problems a child actually sees in
 * the placement check (multiplication, division and missing factors): Czech school notation
 * (`6 · 2 = ?`, `14 : 2 = ?`, `5 · ? = 20`) by default, international (`×`, `÷`) when a
 * grown-up chooses it, for that keeper only, with the praise written the same way and the
 * read-aloud words the same in both. (Remainders, `4 r 3` / `4 R 3`, arrive with Region 6; the
 * settings' own sample text covers them until then.)
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  chooseSetting,
  closeGrownUps,
  expectNextProblem,
  feedback,
  feedbackAfter,
  giveAnswer,
  leaveHub,
  leaveResults,
  newFamily,
  openGrownUps,
  playAs,
  playFromTitle,
  reload,
  results,
  setSwitch,
  setVolume,
  settingsFor,
  startPlacement,
} from './support/app';
import { notationOf, readAnswer, readTokens, solve, spokenFor, written } from './support/problem';
import type { AnswerValue, Notation, Token } from './support/problem';

interface Seen {
  readonly problem: string;
  readonly notation: Notation | null;
  readonly operators: string[];
  readonly praise: string;
  readonly expectedPraise: string;
  readonly spoken: string;
  readonly expectedSpoken: string;
}

/** The problem written out with its answer in the answer box: `5 · 4 = 20`. */
function solvedText(tokens: readonly Token[], answer: AnswerValue): string {
  const value = answer.kind === 'number' ? String(answer.value) : '?';
  return written(tokens).replace('?', value);
}

/** Play the placement check to its results and collect what the child saw and would hear. */
async function playAndLook(page: Page): Promise<Seen[]> {
  const seen: Seen[] = [];
  for (let step = 0; step < 30 && !(await results(page).isVisible()); step++) {
    const tokens = await readTokens(page);
    const answer = solve(tokens);
    const kind = await feedbackAfter(page, () => giveAnswer(page, answer, 'keyboard'));
    expect(kind, written(tokens)).toBe('correct');
    seen.push({
      problem: written(tokens),
      notation: notationOf(tokens),
      operators: tokens.flatMap((token) => (token.kind === 'op' ? [token.symbol] : [])),
      praise: (await feedback(page).textContent()) ?? '',
      expectedPraise: `Yes! ${solvedText(tokens, answer)}`,
      spoken: (await page.getByTestId('problem').getAttribute('aria-label')) ?? '',
      expectedSpoken: spokenFor(tokens),
    });
    await expectNextProblem(page);
  }
  await expect(results(page)).toBeVisible();
  return seen;
}

test('the notation switch changes how problems are written, for that keeper only', async ({
  page,
}) => {
  test.slow();
  await newFamily(page, { name: 'Ada' }, { name: 'Ben', avatar: 'keeper-3' });
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  await expect(page.getByTestId('setting-notation-czech')).toHaveText(
    'Czech school: 3 · 4, 12 : 3, 4 r 3',
  );
  await expect(page.getByTestId('setting-notation-international')).toHaveText(
    'International: 3 × 4, 12 ÷ 3, 4 R 3',
  );
  await settingsFor(page, 1);
  await expect(page.getByTestId('setting-notation-czech'), 'Czech is the default').toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await chooseSetting(page, 'setting-notation-international');
  await closeGrownUps(page);

  await playAs(page, 1, 'Ada');
  await startPlacement(page);
  const ada = await playAndLook(page);
  const adaSigns = new Set(ada.flatMap((item) => item.operators));
  expect([...adaSigns].sort(), 'times and divided-by signs, international').toEqual(['×', '÷']);
  expect(new Set(ada.map((item) => item.notation))).toEqual(new Set(['international']));
  expect(ada.map((item) => item.praise)).toEqual(ada.map((item) => item.expectedPraise));
  expect(
    ada.some((item) => /^\? × |× \? = /.test(item.problem)),
    'a missing factor',
  ).toBe(true);
  await leaveResults(page, 'Ada');

  await leaveHub(page);
  await playAs(page, 2, 'Ben');
  await startPlacement(page);
  const ben = await playAndLook(page);
  const benSigns = new Set(ben.flatMap((item) => item.operators));
  expect([...benSigns].sort(), 'Ben keeps the Czech school signs').toEqual([':', '·']);
  expect(new Set(ben.map((item) => item.notation))).toEqual(new Set(['czech']));
  expect(ben.map((item) => item.praise)).toEqual(ben.map((item) => item.expectedPraise));

  for (const item of [...ada, ...ben]) {
    expect(item.spoken, `read-aloud words for ${item.problem}`).toBe(item.expectedSpoken);
  }
});

test('switching back to Czech signs shows them again', async ({ page }) => {
  await newFamily(page, { name: 'Cleo' });
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  await chooseSetting(page, 'setting-notation-international');
  await chooseSetting(page, 'setting-notation-czech');
  await expect(page.getByTestId('setting-notation-international')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await closeGrownUps(page);
  await playAs(page, 1, 'Cleo');
  await startPlacement(page);
  expect(notationOf(await readTokens(page))).toBe('czech');
  const answer = await readAnswer(page);
  await giveAnswer(page, answer, 'keyboard');
  await expect(feedback(page)).toContainText('·');
});

test('settings are kept per keeper and survive a reload', async ({ page }) => {
  await newFamily(page, { name: 'Dana' }, { name: 'Emil', avatar: 'keeper-6' });
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  await settingsFor(page, 1);
  await chooseSetting(page, 'setting-notation-international');
  await chooseSetting(page, 'setting-text-150');
  await setSwitch(page, 'setting-reduced-motion', true);
  await setSwitch(page, 'setting-read-aloud', false);
  await setSwitch(page, 'setting-auto-read', true);
  await setVolume(page, 'setting-music', 40);
  await setVolume(page, 'setting-effects', 70);

  await reload(page);
  await playFromTitle(page);
  await openGrownUps(page, 'settings');
  await settingsFor(page, 1);
  await expect(page.getByTestId('setting-notation-international')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('setting-text-150')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('setting-reduced-motion')).toBeChecked();
  await expect(page.getByTestId('setting-read-aloud')).not.toBeChecked();
  await expect(page.getByTestId('setting-auto-read')).toBeChecked();
  await expect(page.getByTestId('setting-music')).toHaveValue('40');
  await expect(page.getByTestId('setting-music')).toHaveAttribute('aria-valuetext', '40%');
  await expect(page.getByTestId('setting-effects')).toHaveValue('70');

  await settingsFor(page, 2);
  await expect(
    page.getByTestId('setting-notation-czech'),
    'Emil keeps the defaults',
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('setting-text-100')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('setting-reduced-motion')).not.toBeChecked();
  await expect(page.getByTestId('setting-read-aloud')).toBeChecked();
  await expect(page.getByTestId('setting-music')).toHaveValue('100');
});

test('text size and reduced motion apply while that keeper plays, and not after', async ({
  page,
}) => {
  await newFamily(page, { name: 'Filip' });
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  await chooseSetting(page, 'setting-text-200');
  await setSwitch(page, 'setting-reduced-motion', true);
  await closeGrownUps(page);
  const root = page.locator('html');
  const scale = () => root.evaluate((node) => node.style.getPropertyValue('--aegis-text-scale'));

  expect(await scale(), 'the keepers screen uses the default size').toBe('1');
  await expect(root).toHaveAttribute('data-reduced-motion', 'false');
  await playAs(page, 1, 'Filip');
  expect(await scale()).toBe('2');
  await expect(root).toHaveAttribute('data-reduced-motion', 'true');
  expect(
    await root.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
    '1rem is the 24 px reading size at 200 %',
  ).toBe(48);
  await leaveHub(page);
  expect(await scale()).toBe('1');
  await expect(root).toHaveAttribute('data-reduced-motion', 'false');
});
