/**
 * Keyboard-only play (plan §2.11, WCAG 2.1.1 Keyboard, 2.4.3 Focus Order, 2.4.7 Focus Visible):
 * every control is reachable with Tab in reading order, the focused control always shows a
 * visible ring, each new screen puts focus on its heading or first control, and dialogs keep
 * focus inside until they close, then give it back.
 *
 * Order is checked as two passes from each screen's first focus: Tab forward to the end of the
 * page and Shift+Tab back to its start. Together they cover the screen in every engine, however
 * the engine wraps around through its own controls.
 *
 * The keeper editor is also played by keyboard alone end to end: the name (focused on arrival, in
 * the Tab order, focused again after a problem), the eight pictures as one named radio group
 * (arrows and Space choose, the choice reads as checked and is the keeper's picture afterwards),
 * with each focus indicator checked by its pixels (`focusPixels`), since the pictures' radios are
 * hidden under their art and draw their ring on the label.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  boot,
  expectHub,
  expectScreen,
  holdGate,
  leaveHub,
  meetFirstEgg,
  newFamily,
  openGrownUps,
  quitRound,
  startPlacement,
} from './support/app';
import { focusPixels, focusStop, ids, SEEN_PIXELS, tabPass } from './support/a11y';
import type { FocusStop } from './support/a11y';
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
  await page.keyboard.press('Tab');
  expect(await focusedId(page), 'Tab from Back returns to the name field').toBe('keeper-name');

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

/** What a screen reader names each keeper picture, in order (catalog `avatar.keeper-N`). */
const PICTURES = [
  'Curly orange hair and a teal hoodie',
  'Round glasses and a yellow top',
  'A short bob and a star pin',
  'Wavy hair and a striped top',
  'Twists and an orange hoodie',
  'A cosy beanie and freckles',
  'A side swoop and a plaster',
  'A headband and overalls',
];

/** The keeper picture that has focus and the one that is chosen (`keeper-N`), if any. */
async function pictures(page: Page): Promise<{ focused: string | null; chosen: string | null }> {
  return page.evaluate(() => {
    const active = document.activeElement;
    const focused =
      active instanceof HTMLInputElement && active.name === 'dv-avatar' ? active.value : null;
    const chosen =
      document.querySelector<HTMLInputElement>('input[name="dv-avatar"]:checked')?.value ?? null;
    return { focused, chosen };
  });
}

test.describe('the keeper editor by keyboard alone', () => {
  // Focus indicators are compared pixel by pixel, so nothing else may move.
  test.use({ reducedMotion: 'reduce' });

  test('the name field takes focus, stays in the Tab order and shows its ring, also after a problem', async ({
    page,
  }) => {
    await boot(page);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expectScreen(page, 'editor');
    const name = page.getByTestId('keeper-name');
    await expect(name, 'the name field takes focus on arrival').toBeFocused();
    await expect(name).toHaveAccessibleName('Your name');
    await page.keyboard.type('Ada');
    await expect(name, 'the keyboard types the name').toHaveValue('Ada');
    expect(
      await focusPixels(page, () => page.keyboard.press('Tab')),
      'the focused name field shows its ring',
    ).toBeGreaterThanOrEqual(SEEN_PIXELS);
    expect((await pictures(page)).focused, 'Tab goes on to the pictures').toBe('keeper-1');
    await page.keyboard.press('Shift+Tab');
    await expect(name, 'Shift+Tab from the pictures returns to the name').toBeFocused();

    // A fresh editor: Save without a picture or a name. Each problem says what to do and the
    // name problem puts focus back into the field, so the name can always be typed.
    await page.getByTestId('back').focus();
    await page.keyboard.press('Enter');
    await expectScreen(page, 'title');
    await page.getByTestId('title-play').focus();
    await page.keyboard.press('Enter');
    await expectScreen(page, 'editor');
    await expect(name).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('keeper-save')).toBeFocused();
    await page.keyboard.press('Enter');
    const problem = page.getByTestId('keeper-problem');
    await expect(problem).toHaveText('Please pick a keeper picture.');
    await expect(problem, 'problems are announced').toHaveAttribute('aria-live', 'polite');
    await expect(page.getByTestId('keeper-save'), 'focus stays on Save').toBeFocused();
    await page.keyboard.press('Shift+Tab');
    const entered = await pictures(page);
    expect(entered, 'Shift+Tab goes back into the pictures').toEqual({
      focused: expect.stringMatching(/^keeper-[1-8]$/),
      chosen: null,
    });
    await page.keyboard.press('Space');
    expect(await pictures(page), 'Space chooses the focused picture').toEqual({
      focused: entered.focused,
      chosen: entered.focused,
    });
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(problem).toHaveText('Please type a name.');
    await expect(name, 'the name problem puts focus back into the name field').toBeFocused();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name, 'the field reads its hint and the problem').toHaveAccessibleDescription(
      'Up to 16 letters. Please type a name.',
    );
    await page.keyboard.type('Bea');
    expect(
      await focusPixels(page, () => page.keyboard.press('Tab')),
      'the name field shows its ring after a problem too (more than the caret)',
    ).toBeGreaterThanOrEqual(SEEN_PIXELS);
    expect((await pictures(page)).focused, 'Tab goes on to the chosen picture').toBe(
      entered.focused,
    );
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await meetFirstEgg(page);
    await expectHub(page, 'Bea');
  });

  test('the pictures are one named radio group: arrows choose, the choice is announced and kept, and focus shows', async ({
    page,
  }) => {
    await boot(page);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expectScreen(page, 'editor');
    await page.keyboard.type('Ada');

    const group = page.getByRole('group', { name: 'Pick your keeper' });
    const picture = (index: number) =>
      group.getByRole('radio', { name: PICTURES[index]!, exact: true });
    await expect(
      group.getByRole('radio'),
      'eight pictures in one group named "Pick your keeper"',
    ).toHaveCount(8);
    for (const [index, description] of PICTURES.entries()) {
      await expect(picture(index), `picture ${index + 1} reads "${description}"`).toHaveAttribute(
        'value',
        `keeper-${index + 1}`,
      );
    }
    await expect(group.getByRole('radio', { checked: true }), 'none is chosen yet').toHaveCount(0);

    await page.keyboard.press('Tab');
    expect(await pictures(page), 'one Tab enters the group at the first picture').toEqual({
      focused: 'keeper-1',
      chosen: null,
    });
    expect(
      await focusPixels(page, () => page.keyboard.press('Shift+Tab')),
      'the picture Tab reached shows its focus ring',
    ).toBeGreaterThanOrEqual(SEEN_PIXELS);
    await page.keyboard.press('Tab');
    expect(await pictures(page), 'Tab comes back to the first picture').toEqual({
      focused: 'keeper-1',
      chosen: null,
    });
    await page.keyboard.press('Space');
    expect(await pictures(page), 'Space chooses it').toEqual({
      focused: 'keeper-1',
      chosen: 'keeper-1',
    });
    const moves = [
      ['ArrowRight', 'keeper-2'],
      ['ArrowRight', 'keeper-3'],
      ['ArrowDown', 'keeper-4'],
      ['ArrowLeft', 'keeper-3'],
      ['ArrowUp', 'keeper-2'],
      ['ArrowDown', 'keeper-3'],
    ] as const;
    for (const [key, expected] of moves) {
      await page.keyboard.press(key);
      expect(await pictures(page), `${key} moves to ${expected} and chooses it`).toEqual({
        focused: expected,
        chosen: expected,
      });
    }
    await expect(picture(2), 'a screen reader hears the choice: it reads as checked').toBeChecked();
    await expect(group.getByRole('radio', { checked: true })).toHaveCount(1);
    const afterArrows = await focusPixels(page, () => page.keyboard.press('Tab'));
    // DV-QA-15, fixed: WebKit matches no :focus-visible after an arrow key; the picker marks it.
    expect(
      afterArrows,
      'the picture an arrow key moved to shows its focus ring',
    ).toBeGreaterThanOrEqual(SEEN_PIXELS);
    await expect(page.getByTestId('keeper-save')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(picture(2), 'Shift+Tab comes back to the chosen picture').toBeFocused();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await meetFirstEgg(page);
    await expectHub(page, 'Ada');
    await expect(
      page.getByTestId('screen-hub').locator('[data-avatar]').first(),
      'the keeper has the picture chosen by keyboard',
    ).toHaveAttribute('data-avatar', 'keeper-3');

    // Changing the keeper later: Tab from the name lands on their picture, read as checked.
    await leaveHub(page);
    await page.getByTestId('keeper-edit-profile-1').focus();
    await page.keyboard.press('Enter');
    await expectScreen(page, 'editor');
    await expect(page.getByTestId('keeper-name')).toBeFocused();
    await expect(page.getByTestId('keeper-name')).toHaveValue('Ada');
    await page.keyboard.press('Tab');
    await expect(picture(2), 'Tab enters the group at the chosen picture').toBeFocused();
    await expect(picture(2)).toBeChecked();
  });
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
    'parent-tab-progress',
    'parent-tab-print',
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
  await expect(restart, 'it stays in the Tab order').not.toHaveAttribute('tabindex', '-1');
  expect((await focusStop(page)).ring, 'and shows its focus ring').toBe(true);
  await page.keyboard.press('Enter');
  await expectScreen(page, 'title');
});
