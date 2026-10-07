/**
 * Teach, then ask (plan §2.3; S2b's #27, S3's #41). A missed fact comes back a few problems
 * later with its picture first ("Let's try this one again. Look first!"). A fact missed twice in
 * a row is taught the next time it comes: its picture first, drawn unsolved, with "Look at the
 * picture first. Then answer!". Either way the picture is there before the answer, so no Show me
 * is offered, and the right answer is praised. A fact with no picture (× 0) must not send the
 * child to look at one (DV-QA-18).
 *
 * The first test misses a fact in the browser; the others open a game the rules played to the
 * moment (support/saves.ts, `missedFactBackup`), stopped mid-round as a reload would find it.
 */
import { expect, test } from './support/fixtures';
import type { Page, TestInfo } from '@playwright/test';
import {
  answerCorrectly,
  answerWrongly,
  awaitOpenProblem,
  goOn,
  keeperWithRegions,
  leaveHub,
  loadBackup,
  newFamily,
  openKeeper,
  round,
  startLevel,
} from './support/app';
import { unlessKnown } from './support/known-issues';
import { readAnswer, readProblem, written } from './support/problem';
import type { Token } from './support/problem';
import { missedFactBackup } from './support/saves';
import type { MissedFactBackup, MissedStop } from './support/saves';

test.use({ reducedMotion: 'reduce' });

const NOTES: Record<MissedStop, string> = {
  reask: "Let's try this one again. Look first!",
  teach: 'Look at the picture first. Then answer!',
};

function picture(page: Page) {
  return page.locator('.dv-round__model .dv-model');
}

/** The numbers a problem shows, smallest first (its answer box holds none). */
function numbersOf(tokens: readonly Token[]): number[] {
  return tokens
    .flatMap((token) => (token.kind === 'number' ? [token.value] : []))
    .sort((a, b) => a - b);
}

/** Everything the picture says in words: its text and its labels. */
async function pictureWords(page: Page): Promise<string> {
  return picture(page).evaluate((figure) =>
    [
      figure.textContent ?? '',
      ...[figure, ...figure.querySelectorAll('[aria-label]')].map(
        (node) => node.getAttribute('aria-label') ?? '',
      ),
    ].join(' '),
  );
}

/** Open keeper 1 on a backup's game, stopped on the missed fact that has come back. */
async function openMissedFact(page: Page, backup: MissedFactBackup): Promise<string> {
  await newFamily(page, { name: 'Ada' });
  await leaveHub(page);
  await loadBackup(page, backup.text, 'Ada');
  await openKeeper(page, 1);
  await expect(round(page), 'the round is open again').toBeVisible();
  await awaitOpenProblem(page);
  const { tokens } = await readProblem(page);
  expect(numbersOf(tokens), 'the round is on the missed fact').toEqual(backup.numbers);
  return written(tokens);
}

/** The picture is there before the answer: no Show me, and the right answer is praised. */
async function expectPictureFirst(page: Page, what: string): Promise<void> {
  await expect(picture(page), `${what}: the picture is shown before the answer`).toBeVisible();
  await expect(page.getByTestId('round-hint'), 'no Show me: the picture is there').toHaveCount(0);
}

test('a missed fact comes back a few problems later, its picture first', async ({ page }) => {
  await keeperWithRegions(page, 'Ada', ['fire-mountain']);
  await startLevel(page, 'fire-mountain', 'fire-mountain.3');
  await expect(round(page), 'Feeding Time is a problem round').toBeVisible();
  // Miss the first fact that has a picture (a × 0 fact has none: DV-QA-18).
  let missed: Token[] | null = null;
  for (let turn = 0; turn < 6 && missed === null; turn++) {
    await awaitOpenProblem(page);
    const { tokens } = await readProblem(page);
    if (numbersOf(tokens).some((value) => value === 0)) {
      await answerCorrectly(page, 'keyboard');
      continue;
    }
    await expect(page.getByTestId('round-note'), 'a new problem has no note').toHaveText('');
    await expect(picture(page), 'nor its picture before Show me').toHaveCount(0);
    await answerWrongly(page, 'keyboard');
    await goOn(page);
    missed = tokens;
  }
  expect(missed, 'a fact with a picture was asked and missed').not.toBeNull();

  const between: string[] = [];
  for (let turn = 0; turn < 6; turn++) {
    await awaitOpenProblem(page);
    if ((await page.getByTestId('round-note').innerText()) === NOTES.reask) break;
    between.push(written((await readProblem(page)).tokens));
    await answerCorrectly(page, 'keyboard');
  }
  await expect(
    page.getByTestId('round-note'),
    `the missed ${written(missed!)} is asked again (after ${between.join(', ') || 'nothing'})`,
  ).toHaveText(NOTES.reask);
  expect(numbersOf((await readProblem(page)).tokens), 'it is the missed fact').toEqual(
    numbersOf(missed!),
  );
  await expectPictureFirst(page, 'asked again');
  await answerCorrectly(page, 'pointer');
});

test('a fact missed twice in a row is taught: its picture first, unsolved, then the question', async ({
  page,
}) => {
  test.slow();
  const fact = await openMissedFact(page, await missedFactBackup('with a picture', 'teach'));
  await expect(page.getByTestId('round-note'), `${fact} is taught first`).toHaveText(NOTES.teach);
  await expectPictureFirst(page, 'taught');
  const answer = await readAnswer(page);
  expect(answer.kind, 'a times-table fact').toBe('number');
  const value = answer.kind === 'number' ? answer.value : NaN;
  expect(
    await pictureWords(page),
    `the picture is drawn unsolved: it does not give away ${value}`,
  ).not.toMatch(new RegExp(`(^|\\D)${value}(\\D|$)`));
  await answerCorrectly(page, 'keyboard');
});

for (const stop of ['reask', 'teach'] as const) {
  test(`a × 0 fact ${stop === 'reask' ? 'asked again' : 'taught'} does not send the child to look at a picture it does not have`, async ({
    page,
  }, testInfo: TestInfo) => {
    test.slow();
    const fact = await openMissedFact(page, await missedFactBackup('times zero', stop));
    const note = page.getByTestId('round-note');
    await expect(note, `${fact} comes back with a note`).not.toHaveText('');
    const said = await note.innerText();
    const shown = (await picture(page).count()) > 0;
    testInfo.annotations.push({
      type: 'DV-QA-18 evidence',
      description: `${fact} ${stop === 'reask' ? 'asked again' : 'taught'}: "${said.replace(/\s+/g, ' ')}"; a picture: ${shown ? 'shown' : 'none'}`,
    });
    await unlessKnown(testInfo, 'DV-QA-18', async () => {
      expect(
        shown || !/\blook\b/i.test(said),
        `"${said}" sends the child to look, so a picture must be shown`,
      ).toBe(true);
    });
    await answerCorrectly(page, 'keyboard');
  });
}
