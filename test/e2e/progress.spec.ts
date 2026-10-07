/**
 * The grown-ups' Progress and Print tabs (docs/app.md §14): after a few answers the Progress tab
 * reports them (the Magic Window grids with their counts, the times tables, the hardest facts,
 * the practice days), and the Print tab lays out flashcards on A4 for the preview, the printer
 * and a saved file, coming back to the same tab afterwards.
 */
import { expect, test } from './support/fixtures';
import {
  answerCorrectly,
  answerWrongly,
  expectScreen,
  goOn,
  leaveHub,
  newFamily,
  openGrownUps,
  openTab,
  quitRound,
  startPlacement,
} from './support/app';

test('a few answers show up in the Progress tab, and a times table prints as flashcards', async ({
  page,
}) => {
  await newFamily(page, { name: 'Ada' });
  await startPlacement(page);
  await answerCorrectly(page, 'keyboard');
  await answerWrongly(page, 'keyboard');
  await goOn(page);
  await answerCorrectly(page, 'keyboard');
  await quitRound(page, 'Ada');
  await leaveHub(page);

  await openGrownUps(page, 'progress');
  const progress = page.getByTestId('parent-progress');
  await expect(progress).toBeVisible();
  await expect(page.getByTestId('progress-summary')).toContainText(
    'Ada has practised on 1 day. 3 answers so far.',
  );
  await expect(page.getByTestId('progress-grid-mul')).toHaveAttribute(
    'aria-label',
    /^Multiplication facts: \d+ gold, \d+ silver, \d+ bronze, \d+ still dark\.$/,
  );
  await expect(page.getByTestId('progress-grid-div')).toHaveAttribute('role', 'img');
  await expect(page.getByTestId('progress-tables').locator('li')).toHaveCount(11);
  await expect(page.getByTestId('progress-trend')).toBeVisible();

  await openTab(page, 'print');
  await expect(page.getByTestId('print-no-certificates')).toContainText('Certificates appear here');
  await page.getByTestId('print-table-7').click();
  await expect(page.getByTestId('print-table')).toHaveText('Print the 7 times table');
  await page.evaluate(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => {
      (window as unknown as { printed: number }).printed += 1;
    };
  });
  await page.getByTestId('print-table').click();
  await expectScreen(page, 'print');
  await expect(page.getByTestId('print-count')).toHaveText('2 sheets, printed on both sides.');
  const sheets = page.getByTestId('print-sheet');
  await expect(sheets).toHaveCount(4);
  await expect(sheets.first()).toHaveAttribute('aria-label', 'Sheet 1, front');
  await expect(sheets.first().locator('.dv-sheet__cell').first()).toHaveText('1 · 7');
  await expect(sheets.nth(1)).toHaveAttribute('aria-label', 'Sheet 1, back');
  await expect(sheets.nth(1).locator('.dv-sheet__cell').first().locator('p')).toHaveText([
    '7',
    '1 · 7 = 7',
  ]);

  await page.getByTestId('print-now').click();
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  const download = page.waitForEvent('download');
  await page.getByTestId('print-file').click();
  expect((await download).suggestedFilename()).toBe('ada-table-7.html');

  await page.getByTestId('print-back').click();
  await expectScreen(page, 'parent');
  await expect(page.getByTestId('parent-tab-print'), 'back on the same tab').toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('print-table-7')).toHaveAttribute('aria-pressed', 'true');
});
