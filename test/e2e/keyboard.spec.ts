/**
 * Keyboard-only play (plan §2.11, WCAG 2.1.1 Keyboard, 2.4.3 Focus Order, 2.4.7 Focus Visible):
 * every control is reachable with Tab in reading order, the focused control always shows a
 * visible ring, each new screen puts focus on its heading or first control, and dialogs keep
 * focus inside until they close, then give it back.
 *
 * Order is checked as two passes from each screen's first focus: Tab forward to the end of the
 * page and Shift+Tab back to its start. Together they cover the screen in every engine, however
 * the engine wraps around through its own controls.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  boot,
  expectScreen,
  holdGate,
  leaveHub,
  newFamily,
  openGrownUps,
  quitRound,
  startPlacement,
} from './support/app';
import { focusStop, ids, tabPass } from './support/a11y';
import type { FocusStop } from './support/a11y';
import { unlessKnown } from './support/known-issues';
import { installSpeech, TYPICAL_VOICES } from './support/speech';

test.beforeEach(async ({ context }) => {
  await installSpeech(context, TYPICAL_VOICES);
});

function expectVisibleFocus(stops: readonly FocusStop[], where: string): void {
  for (const stop of stops.filter((candidate) => !candidate.page)) {
    expect.soft(stop.ring, `${where}: ${stop.id ?? stop.tag} shows a focus ring`).toBe(true);
    expect.soft(stop.onScreen, `${where}: ${stop.id ?? stop.tag} is on screen`).toBe(true);
  }
}

/** The controls before and after the current focus, in reading order. */
async function around(
  page: Page,
  start: string,
): Promise<{ before: (string | null)[]; after: (string | null)[]; stops: FocusStop[] }> {
  const target = page
    .getByTestId(start)
    .or(page.locator(`[data-testid="${start}"] input`))
    .first();
  await target.focus();
  const after = await tabPass(page);
  await target.focus();
  const before = await tabPass(page, true);
  return { before: ids(before).reverse(), after: ids(after), stops: [...before, ...after] };
}

async function focusedId(page: Page): Promise<string | null> {
  return (await focusStop(page)).id;
}

test('a keyboard alone makes a keeper and starts a round, with focus always visible', async ({
  page,
}) => {
  await boot(page);
  await page.keyboard.press('Tab');
  expect(await focusedId(page), 'Play is the first stop on the title').toBe('title-play');
  expectVisibleFocus([await focusStop(page)], 'title');
  await page.keyboard.press('Enter');
  await expectScreen(page, 'editor');
  expect(await focusedId(page), 'the name field takes focus').toBe('keeper-name');
  await page.keyboard.type('Ada');

  const editor = await around(page, 'keeper-name');
  expect(editor.before).toEqual(['back']);
  expect(editor.after, 'then the pictures (one stop) and the big button').toEqual([
    'avatar-keeper-1',
    'keeper-save',
  ]);
  expectVisibleFocus(editor.stops, 'editor');
  await page.getByTestId('back').focus();
  await unlessKnown(test.info(), 'DV-QA-08', async () => {
    await page.keyboard.press('Tab');
    expect(await focusedId(page), 'Tab from Back returns to the name field').toBe('keeper-name');
  });

  // Pictures are a radio group: one Tab stop, arrows choose.
  await page.getByTestId('keeper-name').focus();
  await page.keyboard.press('Tab');
  expect(await focusedId(page)).toBe('avatar-keeper-1');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('avatar-keeper-3').locator('input')).toBeChecked();
  await page.keyboard.press('Tab');
  expect(await focusedId(page)).toBe('keeper-save');
  await page.keyboard.press('Enter');

  // The prologue: Next has focus, Skip follows; the eggs are three stops.
  await expectScreen(page, 'play');
  expect(await focusedId(page), 'Next takes focus').toBe('story-next');
  const story = await around(page, 'story-next');
  expect(story.after).toEqual(['story-skip']);
  expectVisibleFocus(story.stops, 'story');
  await page.getByTestId('story-skip').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('story-choice-bubbles'), 'the first egg takes focus').toBeFocused();
  const eggs = await around(page, 'story-choice-bubbles');
  expect(eggs.after).toEqual(['story-choice-sunny', 'story-choice-goldie']);
  expectVisibleFocus(eggs.stops, 'egg choice');
  await page.getByTestId('story-choice-goldie').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('story-next')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('screen-hub')).toBeVisible();
  await expect(page.getByTestId('hub-greeting'), 'the greeting takes focus').toBeFocused();
  const hub = await around(page, 'hub-greeting');
  expect([...hub.before, 'hub-greeting', ...hub.after]).toEqual([
    'hub-back',
    'hub-greeting',
    'hub-adventure',
    'hub-map',
    'hub-market',
    'hub-den',
    'hub-album',
    'hub-window',
  ]);
  expectVisibleFocus(hub.stops, 'hub');
  await page.getByTestId('hub-adventure').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('screen-round')).toBeVisible();
  expect(await focusedId(page), 'the keypad takes focus, so Enter sends the answer').toBe('keypad');
});

test('the keypad is reachable key by key in phone order', async ({ page }) => {
  await newFamily(page, { name: 'Ben' });
  await startPlacement(page);
  const keypad = await around(page, 'keypad');
  expect(keypad.after).toEqual([
    'keypad-field-0',
    'keypad-1',
    'keypad-2',
    'keypad-3',
    'keypad-4',
    'keypad-5',
    'keypad-6',
    'keypad-7',
    'keypad-8',
    'keypad-9',
    'keypad-backspace',
    'keypad-0',
    'keypad-ok',
  ]);
  expect(keypad.before, 'before the answer: pause, then read aloud and the picture').toEqual(
    expect.arrayContaining(['round-pause', 'read-aloud']),
  );
  expectVisibleFocus(keypad.stops, 'keypad');
});
test('the keepers screen and the grown-ups area are in reading order', async ({ page }) => {
  await newFamily(page, { name: 'Cleo' });
  await leaveHub(page);
  const heading = page.getByRole('heading', { level: 1, name: 'Who is playing?' });
  await expect(heading).toBeFocused();
  await heading.focus();
  const keepers = await tabPass(page);
  expect(ids(keepers)).toEqual([
    'grownups',
    'keeper-profile-1',
    'keeper-edit-profile-1',
    'keeper-add',
  ]);
  expectVisibleFocus(keepers, 'keepers');

  await openGrownUps(page);
  const parentHeading = page.getByRole('heading', { level: 1, name: 'Grown-ups' });
  await expect(parentHeading).toBeFocused();
  const forward = await tabPass(page);
  await parentHeading.focus();
  const backward = await tabPass(page, true);
  expect(ids(backward)).toEqual(['parent-close']);
  expect(ids(forward), 'from the heading: the tabs, then the panel').toEqual([
    'parent-tab-keepers',
    'parent-tab-settings',
    'parent-tab-data',
    'parent-tab-offline',
    'parent-tab-about',
    'parent-edit-profile-1',
    'parent-remove-profile-1',
    'parent-add',
  ]);
  expectVisibleFocus([...forward, ...backward], "grown-ups' area");
});

test('dialogs keep focus inside while open and give it back when closed', async ({ page }) => {
  await newFamily(page, { name: 'Dan' });
  await startPlacement(page);
  const answerArea = page.getByTestId('keypad');
  await expect(answerArea).toBeFocused();

  // Pause: focus moves into the dialog and stays there.
  await page.keyboard.press('Escape');
  const pause = page.getByTestId('pause-dialog');
  await expect(pause).toBeVisible();
  const first = await focusStop(page);
  expect(first.inDialog, 'focus moved into the pause dialog').toBe(true);
  const forward = await tabPass(page);
  await page.getByTestId(first.id ?? 'pause-quit').focus();
  const backward = await tabPass(page, true);
  const reached = [first, ...forward, ...backward];
  expect(
    reached.filter((stop) => !stop.inDialog).map((stop) => stop.id),
    'Tab never reaches the round behind the dialog',
  ).toEqual([]);
  // Firefox also stops on the dialog itself (it can scroll); that is inside the dialog too.
  const controls = (stops: readonly FocusStop[], dialog: string): Set<string | null> =>
    new Set(ids(stops).filter((id) => id !== dialog));
  expect(controls(reached, 'pause-dialog')).toEqual(new Set(['pause-quit', 'pause-resume']));
  expectVisibleFocus([...forward, ...backward], 'pause dialog');
  await page.keyboard.press('Escape');
  await expect(pause).toHaveCount(0);
  await expect(answerArea, 'focus is back where it was').toBeFocused();

  // The gate: only the lock and "Back to the game".
  await quitRound(page, 'Dan');
  await leaveHub(page);
  const door = page.getByTestId('grownups');
  await door.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('gate-hold')).toBeFocused();
  const gateStart = await focusStop(page);
  const inGate = [...(await tabPass(page)), ...(await tabPass(page, true))];
  expect(inGate.filter((stop) => !stop.inDialog)).toEqual([]);
  expect(controls([gateStart, ...inGate], 'parent-gate')).toEqual(
    new Set(['gate-hold', 'gate-cancel']),
  );
  await page.getByTestId('gate-hold').focus();
  await holdGate(page, 'keyboard');
  expect((await focusStop(page)).inDialog).toBe(true);
  await page.keyboard.press('Escape');
  await expect(door).toBeFocused();

  // A confirmation starts on the safe choice.
  await openGrownUps(page);
  const remove = page.getByTestId('parent-remove-profile-1');
  await remove.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('confirm-cancel'), 'Cancel is focused first').toBeFocused();
  const confirmStart = await focusStop(page);
  const inConfirm = [...(await tabPass(page)), ...(await tabPass(page, true))];
  expect(inConfirm.filter((stop) => !stop.inDialog)).toEqual([]);
  expect(controls([confirmStart, ...inConfirm], 'confirm-dialog')).toEqual(
    new Set(['confirm-cancel', 'confirm-ok']),
  );
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('confirm-dialog')).toHaveCount(0);
  await expect(remove).toBeFocused();
  await expect(page.getByTestId('parent-keepers')).toContainText('Dan');
});

test('the error screen offers its one button to the keyboard', async ({ page }) => {
  await page.route('**/content/dragon-valley.content.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"broken"}' }),
  );
  await boot(page);
  await expectScreen(page, 'error');
  const restart = page.getByTestId('error-restart');
  await expect(restart, 'the way out takes focus').toBeFocused();
  await unlessKnown(test.info(), 'DV-QA-08', async () => {
    await expect(restart, 'it stays in the Tab order').not.toHaveAttribute('tabindex', '-1', {
      timeout: 1000,
    });
    // tabindex="-1" also hides the focus ring ([tabindex='-1']:focus in base.css).
    expect((await focusStop(page)).ring, 'and shows its focus ring').toBe(true);
  });
  await page.keyboard.press('Enter');
  await expectScreen(page, 'title');
});
