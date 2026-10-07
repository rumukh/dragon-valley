/**
 * Driving the game the way a child or a grown-up does: through what is on screen, with test
 * IDs as handles. Nothing here reads the game's private state; answers are computed from the
 * rendered problem (support/problem.ts).
 */
import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';
import { readAnswer, readProblem, written } from './problem';
import type { AnswerValue, Token } from './problem';

/** The router's screens (`data-screen` on the boot status, docs/app.md §2). */
export const SCREENS = [
  'title',
  'keepers',
  'editor',
  'play',
  'map',
  'region',
  'level',
  'market',
  'den',
  'album',
  'window',
  'parent',
  'print',
  'goodbye',
  'recovery',
  'error',
] as const;
export type ScreenName = (typeof SCREENS)[number];

/** The three first eggs the prologue offers. */
export type Egg = 'bubbles' | 'sunny' | 'goldie';
export const AVATARS = [
  'keeper-1',
  'keeper-2',
  'keeper-3',
  'keeper-4',
  'keeper-5',
  'keeper-6',
  'keeper-7',
  'keeper-8',
] as const;
export type Avatar = (typeof AVATARS)[number];

export type ParentTab =
  'keepers' | 'progress' | 'print' | 'settings' | 'data' | 'offline' | 'about';
export type Via = 'keyboard' | 'pointer';

export interface KeeperSpec {
  readonly name: string;
  readonly avatar?: Avatar;
}

// ---- Boot and screens ---------------------------------------------------------------------

export function bootStatus(page: Page): Locator {
  return page.getByTestId('boot-status');
}

/** The shell is ready: the first screen is mounted and painted (docs/app.md §2). */
export async function waitReady(page: Page): Promise<void> {
  await expect(bootStatus(page), 'the shell reports ready').toHaveAttribute('data-state', 'ready', {
    timeout: 20_000,
  });
}

export async function boot(page: Page): Promise<void> {
  await page.goto('./');
  await waitReady(page);
}

export async function reload(page: Page): Promise<void> {
  await page.reload();
  await waitReady(page);
}

/** The router finished mounting `screen` (no navigation in flight). */
export async function expectScreen(page: Page, screen: ScreenName): Promise<void> {
  await expect(bootStatus(page), `the ${screen} screen is showing`).toHaveAttribute(
    'data-screen',
    screen,
  );
  await expect(page.getByTestId('stage')).not.toHaveAttribute('aria-busy', 'true');
}

export async function currentScreen(page: Page): Promise<string | null> {
  return bootStatus(page).getAttribute('data-screen');
}

// ---- Keepers ------------------------------------------------------------------------------

export function keeperCard(page: Page, slot: number): Locator {
  return page.getByTestId(`keeper-profile-${slot}`);
}

/** On the keeper editor: type the name and pick the picture. */
export async function fillKeeper(page: Page, keeper: KeeperSpec): Promise<void> {
  await page.getByTestId('keeper-name').fill(keeper.name);
  const avatar = page.getByTestId(`avatar-${keeper.avatar ?? 'keeper-1'}`);
  await avatar.click();
  await expect(avatar.locator('input')).toBeChecked();
}

/** The keeper's hub: the play screen showing the valley home (docs/app.md §14). */
export async function expectHub(page: Page, name: string): Promise<void> {
  await expectScreen(page, 'play');
  await expect(page.getByTestId('screen-hub'), `${name}'s hub is showing`).toBeVisible();
  await expect(page.getByTestId('hub-greeting')).toHaveText(`Hello, ${name}!`);
}

/** A new keeper's prologue: skip it, choose the first egg, and go on to the hub. */
export async function meetFirstEgg(page: Page, egg: Egg = 'bubbles'): Promise<void> {
  await expect(page.getByTestId('screen-story'), 'the prologue begins').toBeVisible();
  await page.getByTestId('story-skip').click();
  await page.getByTestId(`story-choice-${egg}`).click();
  await page.getByTestId('story-next').click();
}

/** A new family: Play on the title goes straight to the editor; the new keeper lands on the hub. */
export async function createFirstKeeper(page: Page, keeper: KeeperSpec, egg?: Egg): Promise<void> {
  await page.getByTestId('title-play').click();
  await expectScreen(page, 'editor');
  await fillKeeper(page, keeper);
  await page.getByTestId('keeper-save').click();
  await meetFirstEgg(page, egg);
  await expectHub(page, keeper.name);
}

/** From "Who is playing?": the New keeper card, the editor, then the new keeper's hub. */
export async function addKeeper(page: Page, keeper: KeeperSpec, egg?: Egg): Promise<void> {
  await page.getByTestId('keeper-add').click();
  await expectScreen(page, 'editor');
  await fillKeeper(page, keeper);
  await page.getByTestId('keeper-save').click();
  await meetFirstEgg(page, egg);
  await expectHub(page, keeper.name);
}
/**
 * From the hub, back to "Who is playing?". After a day that brought something (a fact that began
 * to shine, a dragon that grew, a sticker), leaving goes through goodbye and the Dragon Diary.
 */
export async function leaveHub(page: Page): Promise<void> {
  await page.getByTestId('hub-back').click();
  await expect(
    page.getByTestId('screen-keepers').or(page.getByTestId('screen-goodbye')),
  ).toBeVisible();
  if (await page.getByTestId('screen-goodbye').isVisible()) {
    await page.getByTestId('goodbye-done').click();
  }
  await expectScreen(page, 'keepers');
}

/** From the title of a family that has keepers, to "Who is playing?". */
export async function playFromTitle(page: Page): Promise<void> {
  await page.getByTestId('title-play').click();
  await expectScreen(page, 'keepers');
}

export async function playAs(page: Page, slot: number, name: string): Promise<void> {
  await keeperCard(page, slot).click();
  await expectHub(page, name);
}

/** Choose a keeper and arrive wherever their game is: a story, a round, results or the hub. */
export async function openKeeper(page: Page, slot: number): Promise<void> {
  await keeperCard(page, slot).click();
  await expectScreen(page, 'play');
}

/** Listen to a story beat to its end (Next on every line; choices are the test's to make). */
export async function finishStory(page: Page): Promise<void> {
  for (let line = 0; line < 30 && (await page.getByTestId('screen-story').isVisible()); line++) {
    await page.getByTestId('story-next').click();
    await expect(page.getByTestId('stage')).not.toHaveAttribute('aria-busy', 'true');
  }
  await expect(page.getByTestId('screen-story')).toHaveCount(0);
}

/**
 * From the hub, through the valley map and the region road to a level card, then Play: the
 * level's first activity starts (after its story beat, if it has one).
 */
export async function startLevel(page: Page, region: string, level: string): Promise<void> {
  await page.getByTestId('hub-map').click();
  await expectScreen(page, 'map');
  const place = page.getByTestId(`map-region-${region}`);
  await expect(place, `${region} is awake on the valley map`).toBeVisible();
  await place.click();
  await expectScreen(page, 'region');
  const marker = page.getByTestId(`level-${level}`);
  await expect(marker, `${level} is on the region's road`).toBeVisible();
  await marker.click();
  await expectScreen(page, 'level');
  await page.getByTestId('level-play').click();
  await expectScreen(page, 'play');
  if (await page.getByTestId('screen-story').isVisible()) await finishStory(page);
}
/** Boot a new family and make keepers one after another; ends on the last keeper's hub. */
export async function newFamily(page: Page, ...keepers: KeeperSpec[]): Promise<void> {
  await boot(page);
  const [first, ...others] = keepers;
  if (!first) return;
  await createFirstKeeper(page, first);
  for (const keeper of others) {
    await leaveHub(page);
    await addKeeper(page, keeper);
  }
}

// ---- The grown-ups' gate and area ---------------------------------------------------------

/** Hold the lock until the question appears (two seconds; docs/app.md §6). */
export async function holdGate(page: Page, via: Via = 'pointer'): Promise<void> {
  const hold = page.getByTestId('gate-hold');
  await expect(hold).toBeVisible();
  if (via === 'pointer') {
    const box = (await hold.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(page.getByTestId('gate-question')).toBeVisible({ timeout: 6000 });
    await page.mouse.up();
  } else {
    await expect(hold, 'the lock has focus when the gate opens').toBeFocused();
    await page.keyboard.down('Space');
    await expect(page.getByTestId('gate-question')).toBeVisible({ timeout: 6000 });
    await page.keyboard.up('Space');
  }
}

/** The product the gate asks for, computed from the question on screen. */
export async function gateProduct(page: Page): Promise<number> {
  const question = (await page.getByTestId('gate-question').textContent()) ?? '';
  const match = /^What is (\d{2}) × (\d{2})\?$/.exec(question.trim());
  expect(match, `a two-digit by two-digit question: "${question}"`).not.toBeNull();
  return Number(match![1]) * Number(match![2]);
}

export async function typeGateAnswer(page: Page, value: number): Promise<void> {
  await page.keyboard.type(String(value));
  await page.keyboard.press('Enter');
}

export async function passGate(page: Page, via: Via = 'pointer'): Promise<void> {
  await holdGate(page, via);
  await typeGateAnswer(page, await gateProduct(page));
  await expect(page.getByTestId('parent-gate')).toHaveCount(0);
}

/** From "Who is playing?", through the gate into the grown-ups' area. */
export async function openGrownUps(page: Page, tab?: ParentTab): Promise<void> {
  await page.getByTestId('grownups').click();
  await passGate(page);
  await expectScreen(page, 'parent');
  if (tab) await openTab(page, tab);
}

export async function openTab(page: Page, tab: ParentTab): Promise<void> {
  const button = page.getByTestId(`parent-tab-${tab}`);
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

export async function closeGrownUps(page: Page): Promise<void> {
  await page.getByTestId('parent-close').click();
  await expectScreen(page, 'keepers');
}

/** A setting change shows "Settings saved." once it is durably stored. */
export async function expectSettingsSaved(page: Page): Promise<void> {
  await expect(page.getByTestId('toast').last()).toHaveText('Settings saved.');
}

/**
 * Change something on the grown-ups' panel and wait until the panel has been rebuilt from what
 * was stored (it is rebuilt after every save, successful or not).
 */
export async function changeOnPanel(page: Page, act: () => Promise<void>): Promise<void> {
  const panel = page.getByTestId('parent-panel');
  await panel.evaluate((node) => node.firstElementChild?.setAttribute('data-qa-stale', ''));
  await act();
  await expect(panel.locator(':scope > [data-qa-stale]'), 'the panel was rebuilt').toHaveCount(0);
}

export async function chooseSetting(page: Page, testId: string): Promise<void> {
  await changeOnPanel(page, () => page.getByTestId(testId).click());
  await expect(page.getByTestId(testId)).toHaveAttribute('aria-pressed', 'true');
  await expectSettingsSaved(page);
}

export async function setSwitch(page: Page, testId: string, on: boolean): Promise<void> {
  if ((await page.getByTestId(testId).isChecked()) !== on) {
    await changeOnPanel(page, () => page.getByTestId(testId).click());
    await expectSettingsSaved(page);
  }
  await expect(page.getByTestId(testId)).toBeChecked({ checked: on });
}

/**
 * The grown-ups open regions early ("Game settings for …", Settings tab): every level of an open
 * region can be played, its boss included. Only locked regions have a switch, so the section is
 * waited for (it is built once the keeper's game is open) before a missing switch counts as open.
 */
export async function openRegionsEarly(page: Page, regions: readonly string[]): Promise<void> {
  const rules = page.getByTestId('parent-rules');
  await expect(rules, "the keeper's game settings are shown").toBeVisible();
  await expect(
    rules.getByText(/These settings appear after/),
    'the keeper has played, so their game settings can be changed',
  ).toHaveCount(0);
  for (const region of regions) {
    const toggle = page.getByTestId(`setting-unlock-${region}`);
    if ((await toggle.count()) === 0 || (await toggle.isChecked())) continue;
    await changeOnPanel(page, () => toggle.click());
    await expect(page.getByTestId('toast').last()).toHaveText('Game setting saved.');
    // An open region leaves the list of locked ones; if its switch is still there, it is on.
    if ((await toggle.count()) > 0) {
      await expect(toggle, `${region} is open early`).toBeChecked();
    }
  }
}

/** A new family whose one keeper has heard the prologue and has `regions` open early. */
export async function keeperWithRegions(
  page: Page,
  name: string,
  regions: readonly string[],
): Promise<void> {
  await newFamily(page, { name });
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  await openRegionsEarly(page, regions);
  await closeGrownUps(page);
  await playAs(page, 1, name);
}

export async function setVolume(page: Page, testId: string, percent: number): Promise<void> {
  await changeOnPanel(page, () => page.getByTestId(testId).fill(String(percent)));
  await expectSettingsSaved(page);
  await expect(page.getByTestId(testId)).toHaveValue(String(percent));
}

/**
 * A game rule: open a region ahead of the child's progress (its levels and boss open too). Game
 * rules are saved in the keeper's game, with "Game setting saved."
 */
export async function unlockAhead(page: Page, region: string): Promise<void> {
  const testId = `setting-unlock-${region}`;
  await changeOnPanel(page, () => page.getByTestId(testId).click());
  await expect(page.getByTestId('toast').last()).toHaveText('Game setting saved.');
  await expect(page.getByTestId(testId)).toBeChecked();
}

/** Load a backup file into keeper 1 through the grown-ups' area; ends on "Who is playing?". */
export async function loadBackup(page: Page, text: string, name: string): Promise<void> {
  await openGrownUps(page, 'data');
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('backup-import-profile-1').click();
  await (
    await chooser
  ).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('toast').last()).toHaveText(`Backup loaded for ${name}.`);
  await closeGrownUps(page);
}

/** With two or more keepers, the settings tab asks whose settings to show. */
export async function settingsFor(page: Page, slot: number): Promise<void> {
  const choice = page.getByTestId(`parent-keeper-profile-${slot}`);
  if ((await choice.getAttribute('aria-pressed')) === 'true') return;
  await changeOnPanel(page, () => choice.click());
  await expect(page.getByTestId(`parent-keeper-profile-${slot}`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
}

// ---- Rounds -------------------------------------------------------------------------------

export function round(page: Page): Locator {
  return page.getByTestId('screen-round');
}

export function results(page: Page): Locator {
  return page.getByTestId('screen-results');
}

/**
 * A new keeper's first Daily Adventure: the placement check ("Show the dragons what you know!",
 * plan §2.4), a problem round of up to 24 keypad problems that skips ahead through what the
 * child already knows (multiplication, division and missing factors in Region 1).
 */
export async function startPlacement(page: Page): Promise<void> {
  const adventure = page.getByTestId('hub-adventure');
  await expect(adventure).toHaveText('Show the dragons what you know!');
  await adventure.click();
  await expectScreen(page, 'play');
  await expect(round(page)).toHaveAttribute('data-placement', 'true');
  await expect(page.getByTestId('problem')).toBeVisible();
}

export type AnswerMode = 'choice' | 'keypad' | 'remainder';

export async function answerMode(page: Page): Promise<AnswerMode> {
  if (await page.getByTestId('choices').isVisible()) return 'choice';
  if (await page.getByTestId('keypad-field-1').isVisible()) return 'remainder';
  await expect(page.getByTestId('keypad')).toBeVisible();
  return 'keypad';
}

/** The choice tile id the shell gives an answer (`choice-<id>`): the number, `4r3`, or the name. */
export function choiceId(answer: AnswerValue): string {
  switch (answer.kind) {
    case 'number':
      return String(answer.value);
    case 'remainder':
      return `${answer.quotient}r${answer.remainder}`;
    case 'relation':
      return answer.relation;
    case 'operation':
      return answer.operation;
    case 'term':
      return answer.term;
  }
}

/** Enter `answer` the way a child would: typed on the keyboard, or tapped on screen. */
export async function giveAnswer(page: Page, answer: AnswerValue, via: Via): Promise<void> {
  const mode = await answerMode(page);
  if (mode === 'choice') {
    const tile = page.getByTestId(`choice-${choiceId(answer)}`);
    if (via === 'pointer') await tile.click();
    else if (answer.kind === 'number') {
      // Number tiles pick by their digits.
      await page.keyboard.type(String(answer.value));
      await page.keyboard.press('Enter');
    } else {
      await tile.focus();
      await page.keyboard.press('Enter');
    }
    return;
  }
  if (answer.kind !== 'number' && answer.kind !== 'remainder') {
    throw new Error(`A ${answer.kind} is chosen on tiles, but this problem has the keypad.`);
  }
  if (via === 'keyboard') {
    if (answer.kind === 'number') await page.keyboard.type(String(answer.value));
    else {
      await page.keyboard.type(String(answer.quotient));
      await page.keyboard.press('r');
      await page.keyboard.type(String(answer.remainder));
    }
    await page.keyboard.press('Enter');
    return;
  }
  const tap = async (digits: string): Promise<void> => {
    for (const digit of digits) await page.getByTestId(`keypad-${digit}`).click();
  };
  if (answer.kind === 'number') await tap(String(answer.value));
  else {
    await tap(String(answer.quotient));
    await page.getByTestId('keypad-field-1').click();
    await tap(String(answer.remainder));
  }
  await page.getByTestId('keypad-ok').click();
}

/** A plausible wrong answer for the problem on screen (another tile, or one more). */
export async function wrongAnswerFor(page: Page, right: AnswerValue): Promise<AnswerValue> {
  if ((await answerMode(page)) === 'choice') {
    for (const tile of await page.getByTestId('choices').getByRole('button').all()) {
      const id = (await tile.getAttribute('data-testid'))?.replace(/^choice-/, '');
      if (!id || id === choiceId(right) || !(await tile.isEnabled())) continue;
      switch (right.kind) {
        case 'number':
          return { kind: 'number', value: Number(id) };
        case 'remainder': {
          const [quotient = 0, remainder = 0] = id.split('r').map(Number);
          return { kind: 'remainder', quotient, remainder };
        }
        case 'relation':
          return { kind: 'relation', relation: id as typeof right.relation };
        case 'operation':
          return { kind: 'operation', operation: id as typeof right.operation };
        case 'term':
          return { kind: 'term', term: id as typeof right.term };
      }
    }
    throw new Error('No wrong tile left to choose.');
  }
  if (right.kind !== 'number' && right.kind !== 'remainder') {
    throw new Error(`A ${right.kind} is chosen on tiles, but this problem has the keypad.`);
  }
  return right.kind === 'remainder'
    ? { ...right, quotient: right.quotient + 1 }
    : { kind: 'number', value: (right.kind === 'number' ? right.value : 0) + 1 };
}

export function feedback(page: Page): Locator {
  return page.getByTestId('feedback');
}

/**
 * The feedback kind (`correct`, `miss`, `info`) the round shows after `act`. Observed in the
 * page, so a short-lived "Yes!" (half a second with reduced motion) is never missed.
 */
export async function feedbackAfter(
  page: Page,
  act: () => Promise<void>,
  timeoutMs = 20_000,
): Promise<string> {
  await page.evaluate((timeout) => {
    const node = document.querySelector('[data-testid="feedback"]');
    const scope = window as unknown as { __dvQaFeedback?: Promise<string> };
    scope.__dvQaFeedback = new Promise<string>((resolve) => {
      if (!node) {
        resolve('no feedback region');
        return;
      }
      const timer = setTimeout(() => resolve(`no feedback within ${timeout} ms`), timeout);
      const observer = new MutationObserver(() => {
        const kind = node.getAttribute('data-kind');
        if (kind && kind !== 'none') {
          clearTimeout(timer);
          observer.disconnect();
          resolve(kind);
        }
      });
      observer.observe(node, { attributes: true, attributeFilter: ['data-kind'] });
    });
  }, timeoutMs);
  await act();
  return page.evaluate(
    () => (window as unknown as { __dvQaFeedback: Promise<string> }).__dvQaFeedback,
  );
}

/** The round shows its next problem (feedback cleared) or has ended with a story or the results. */
export async function expectNextProblem(page: Page): Promise<void> {
  await expect(
    results(page)
      .or(page.getByTestId('screen-story'))
      .or(page.locator('[data-testid="feedback"][data-kind="none"]')),
    'the next problem, a story or the results',
  ).toBeAttached({ timeout: 20_000 });
}

/**
 * Wait out a "Yes!" still on screen: its problem is answered and the next one is on its way (the
 * coins fly, then the round pauses). Reading the screen before then would read the old problem.
 */
async function awaitOpenProblem(page: Page): Promise<void> {
  await expect(
    results(page)
      .or(page.getByTestId('screen-story'))
      .or(page.locator('[data-testid="feedback"]:not([data-kind="correct"])')),
    'no "Yes!" is still waiting to move on',
  ).toBeAttached({ timeout: 20_000 });
}

/** Answer the problem on screen correctly and wait for the next problem or the results. */
export async function answerCorrectly(page: Page, via: Via): Promise<AnswerValue> {
  await awaitOpenProblem(page);
  const answer = await readAnswer(page);
  const kind = await feedbackAfter(page, () => giveAnswer(page, answer, via));
  expect(kind, `the right answer ${JSON.stringify(answer)} is praised`).toBe('correct');
  await expectNextProblem(page);
  return answer;
}

/**
 * Answer the problem on screen wrongly: the kind "Almost!" feedback shows the right fact and
 * its picture until the child goes on (`goOn`).
 */
export async function answerWrongly(page: Page, via: Via): Promise<AnswerValue> {
  await awaitOpenProblem(page);
  const right = await readAnswer(page);
  const wrong = await wrongAnswerFor(page, right);
  const kind = await feedbackAfter(page, () => giveAnswer(page, wrong, via));
  expect(kind, `the wrong answer ${JSON.stringify(wrong)} gets kind help`).toBe('miss');
  await expect(page.getByTestId('feedback-next'), 'the child goes on when ready').toBeVisible();
  return wrong;
}

/** After a miss: "Got it!" and on to the next problem (or the results). */
export async function goOn(page: Page): Promise<void> {
  await page.getByTestId('feedback-next').click();
  await expectNextProblem(page);
}

/** Answer every remaining problem correctly; ends on the results. Returns the answers given. */
export async function finishRound(page: Page, via: Via): Promise<AnswerValue[]> {
  const given: AnswerValue[] = [];
  for (let step = 0; step < 40 && !(await results(page).isVisible()); step++) {
    if (await page.getByTestId('feedback-next').isVisible()) {
      await goOn(page);
      continue;
    }
    given.push(await answerCorrectly(page, via));
  }
  await expect(results(page)).toBeVisible();
  return given;
}

/** A problem as it was asked and answered: its written form, its step, its story. */
export interface Played {
  readonly written: string;
  readonly tokens: readonly Token[];
  readonly step: string;
  readonly story: string;
  readonly answer: AnswerValue;
  /** The boss meter's value when the problem was asked, if the round has one. */
  readonly meter: number | null;
}

/**
 * Answer every remaining problem of the activity correctly (a story's sign, then its number),
 * recording what each one asked; ends on the results.
 */
export async function playRound(page: Page, via: Via, limit = 80): Promise<Played[]> {
  const played: Played[] = [];
  const meter = page.getByTestId('boss-meter');
  for (let step = 0; step < limit; step++) {
    await awaitOpenProblem(page);
    if (await results(page).isVisible()) break;
    if (await page.getByTestId('screen-story').isVisible()) {
      // A won boss ends its level with the closing lines of its story, then the results.
      await finishStory(page);
      continue;
    }
    if (await page.getByTestId('feedback-next').isVisible()) {
      await goOn(page);
      continue;
    }
    const problem = await readProblem(page);
    const value = (await meter.count()) > 0 ? await meter.getAttribute('aria-valuenow') : null;
    const answer = await answerCorrectly(page, via);
    played.push({
      written: written(problem.tokens),
      tokens: problem.tokens,
      step: problem.step,
      story: problem.story.trim(),
      answer,
      meter: value === null ? null : Number(value),
    });
  }
  await expect(results(page), 'the activity ends on its results').toBeVisible();
  return played;
}

/** Through any hatch celebration ("Hooray!" for each new dragon) to the results card. */
export async function throughHatches(page: Page): Promise<void> {
  const hooray = page.getByTestId('hatch-continue');
  const card = page.getByTestId('round-results');
  for (let dragon = 0; dragon < 10; dragon++) {
    await expect
      .poll(async () => (await hooray.isVisible()) || (await card.isVisible()), {
        message: 'a hatching dragon or the results card',
      })
      .toBe(true);
    if (!(await hooray.isVisible())) return;
    await hooray.click();
  }
}

/** From the results, back to the valley (the hub). */
export async function leaveResults(page: Page, name: string): Promise<void> {
  await page.getByTestId('results-continue').click();
  await expectHub(page, name);
}

/** Pause and quit the round ("Back to my egg"), through its results if it shows them. */
export async function quitRound(page: Page, name: string): Promise<void> {
  await page.keyboard.press('Escape');
  await page.getByTestId('pause-quit').click();
  await expect(page.getByTestId('screen-hub').or(results(page))).toBeVisible();
  if (await results(page).isVisible()) await leaveResults(page, name);
  await expectHub(page, name);
}

/** The purse shows `value` coins (it counts up after the coins have flown in). */
export async function expectCoins(page: Page, value: number, message?: string): Promise<void> {
  await expect(
    page.getByTestId('coins'),
    message ?? `the purse holds ${value} coins`,
  ).toHaveAttribute('data-value', String(value));
}

export async function coinCount(page: Page): Promise<number> {
  return Number(await page.getByTestId('coins').getAttribute('data-value'));
}

export async function expectSaved(page: Page): Promise<void> {
  await expect(page.getByTestId('save-status'), 'the save status says Saved').toHaveAttribute(
    'data-state',
    'saved',
  );
}
