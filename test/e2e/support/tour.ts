/**
 * Walks through every screen and state the game can show today, calling `visit` at each stop.
 * The same walks feed the accessibility sweep, the layout checks and the screenshots for human
 * review (docs/qa/screens.md), so all three always cover the same ground.
 *
 * Stop names are stable file names: `NN-what-it-shows`. Add new stops at the end of a walk (or
 * renumber deliberately) so screenshot history stays comparable.
 */
import type { Page } from '@playwright/test';
import { expect } from './fixtures';
import {
  addKeeper,
  answerCorrectly,
  answerWrongly,
  boot,
  closeGrownUps,
  createFirstKeeper,
  expectHub,
  expectScreen,
  fillKeeper,
  finishRound,
  gateProduct,
  giveAnswer,
  goOn,
  holdGate,
  leaveHub,
  leaveResults,
  loadBackup,
  openGrownUps,
  openTab,
  passGate,
  reload,
  results,
  round,
  startLevel,
  startPlacement,
  typeGateAnswer,
  unlockAhead,
  waitReady,
} from './app';
import { FINALE_BEAT, finaleBackup } from './finale';
import { readAnswer } from './problem';
import {
  corruptRecord,
  FAMILY_KEY,
  gameKey,
  installStorageFaults,
  preferencesKey,
  setStorageFaults,
} from './storage';

export interface Stop {
  readonly name: string;
  readonly description: string;
}

export type Visit = (stop: Stop) => Promise<void>;

/** From an activity back to the hub: quit, and leave its results if it shows them. */
async function backToHub(page: Page, name: string, quit: () => Promise<void>): Promise<void> {
  await quit();
  await expect(page.getByTestId('screen-hub').or(results(page))).toBeVisible();
  if (await results(page).isVisible()) await leaveResults(page, name);
  await expectHub(page, name);
}

/** Title → first keeper → prologue → first egg → hub. Ends on Ada's hub. */
export async function welcomeWalk(page: Page, visit: Visit): Promise<void> {
  await boot(page);
  await visit({ name: '01-title', description: 'Title: Old Glimmer, three eggs and Play' });
  await page.getByTestId('title-play').click();
  await expectScreen(page, 'editor');
  await visit({
    name: '02-editor-new',
    description: 'A new keeper: name field and eight pictures',
  });
  await page.getByTestId('avatar-keeper-3').click();
  await page.getByTestId('keeper-save').click();
  await expect(page.getByTestId('keeper-problem')).toHaveText('Please type a name.');
  await visit({ name: '03-editor-problem', description: 'The editor asking kindly for a name' });
  await fillKeeper(page, { name: 'Ada', avatar: 'keeper-3' });
  await page.getByTestId('keeper-save').click();
  await expect(page.getByTestId('screen-story')).toBeVisible();
  await visit({ name: '04-story', description: 'The prologue, line by line, with Next and Skip' });
  await page.getByTestId('story-skip').click();
  await expect(page.getByTestId('story-choice-bubbles')).toBeVisible();
  await visit({ name: '05-story-eggs', description: 'Choosing the first egg' });
  await page.getByTestId('story-choice-bubbles').click();
  await page.getByTestId('story-next').click();
  await expectHub(page, 'Ada');
  await visit({
    name: '06-hub',
    description: "Ada's hub: the egg, the week, goal, quests, places",
  });
}

/** The placement check from the hub to its results and back. Starts and ends on a hub. */
export async function roundWalk(page: Page, visit: Visit): Promise<void> {
  await startPlacement(page);
  await visit({ name: '07-round-keypad', description: 'The placement check: a keypad problem' });
  const answer = await readAnswer(page);
  await page.keyboard.type(String(answer.kind === 'number' ? answer.value : 0).slice(0, 1));
  await visit({ name: '08-round-typing', description: 'The keypad with a digit typed' });
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('pause-dialog')).toBeVisible();
  await visit({ name: '09-round-paused', description: 'The pause dialog over the round' });
  await page.getByTestId('pause-resume').click();
  await expect(page.getByTestId('pause-dialog')).toHaveCount(0);
  await answerWrongly(page, 'pointer');
  await visit({
    name: '10-round-miss',
    description: 'A miss: orange "Almost!", the right fact and its picture, Got it',
  });
  await goOn(page);
  await finishRound(page, 'pointer');
  await visit({
    name: '11-round-results',
    description: 'Placement results: score, coins, new eggs and stickers',
  });
  await leaveResults(page, 'Ada');
  await visit({ name: '12-hub-after', description: 'The hub after the check: eggs in the nest' });
}

/**
 * The valley map, a region road, a level card, a choice-tile round, an Egg Grid board, the four
 * collections and goodbye with the Dragon Diary. Starts on the hub of a keeper who has finished
 * the placement check today (its stickers fill the diary) and ends back on that hub.
 */
export async function placesWalk(page: Page, visit: Visit, name: string): Promise<void> {
  await page.getByTestId('hub-map').click();
  await expectScreen(page, 'map');
  await visit({ name: '13-map', description: 'The valley map with Sunny Meadow awake' });
  await page.getByTestId('map-region-sunny-meadow').click();
  await expectScreen(page, 'region');
  await visit({ name: '14-region', description: 'The Sunny Meadow road: levels and the boss' });
  await page.getByTestId('level-sunny-meadow.2').click();
  await expectScreen(page, 'level');
  await visit({ name: '15-level', description: 'A level card: its activities and Play' });
  await page.getByTestId('level-back').click();
  await page.getByTestId('region-back').click();
  await page.getByTestId('map-back').click();
  await expectHub(page, name);

  await startLevel(page, 'sunny-meadow', 'sunny-meadow.2');
  await expect(round(page)).toBeVisible();
  await visit({ name: '16-round-choice', description: 'Feeding Time with choice tiles' });
  await answerCorrectly(page, 'pointer');
  await backToHub(page, name, async () => {
    await page.keyboard.press('Escape');
    await page.getByTestId('pause-quit').click();
  });

  await startLevel(page, 'sunny-meadow', 'sunny-meadow.1');
  await expect(page.getByTestId('screen-minigame')).toBeVisible();
  await visit({ name: '17-egg-grid', description: 'Egg Grid: build rows and columns of eggs' });
  await backToHub(page, name, () => page.getByTestId('minigame-quit').click());

  for (const [place, screen, stop, description] of [
    ['market', 'market', '18-market', "Glimmer's Market"],
    ['den', 'den', '19-den', 'The Dragon Den'],
    ['album', 'album', '20-album', 'The Sticker Album'],
    ['window', 'window', '21-window', 'The Magic Window'],
  ] as const) {
    await page.getByTestId(`hub-${place}`).click();
    await expectScreen(page, screen);
    await visit({ name: stop, description });
    await page.getByTestId('collection-back').click();
    await expectHub(page, name);
  }

  await page.getByTestId('hub-back').click();
  await expectScreen(page, 'goodbye');
  await visit({ name: '33-goodbye', description: "Goodbye, with the day's Dragon Diary" });
  await page.getByTestId('goodbye-back').click();
  await expectHub(page, name);
}

/**
 * Keepers, the gate, every tab of the grown-ups' area and a print preview. Starts on a hub, ends
 * on keepers.
 */
export async function grownUpWalk(page: Page, visit: Visit): Promise<void> {
  await leaveHub(page);
  await visit({ name: '22-keepers', description: 'Who is playing? One keeper and New keeper' });
  await page.getByTestId('grownups').click();
  await expect(page.getByTestId('gate-hold')).toBeVisible();
  await visit({ name: '23-gate-hold', description: "The grown-ups' gate: press and hold" });
  await holdGate(page, 'pointer');
  await visit({ name: '24-gate-question', description: 'The gate question and its keypad' });
  await typeGateAnswer(page, await gateProduct(page));
  await expectScreen(page, 'parent');
  await visit({ name: '25-parent-keepers', description: "Grown-ups' area: keepers" });
  await openTab(page, 'settings');
  await visit({
    name: '26-parent-settings',
    description: "Grown-ups' area: one keeper's settings and game rules",
  });
  await openTab(page, 'data');
  await expect(page.getByTestId('storage-status')).toBeVisible();
  await visit({ name: '27-parent-data', description: "Grown-ups' area: backups and storage" });
  await openTab(page, 'offline');
  await expect(page.getByTestId('offline-status')).toHaveAttribute('data-state', /.+/);
  await visit({ name: '28-parent-offline', description: "Grown-ups' area: offline play" });
  await openTab(page, 'about');
  await visit({ name: '29-parent-about', description: "Grown-ups' area: about and privacy" });
  await openTab(page, 'progress');
  await expect(page.getByTestId('progress-summary')).toBeVisible();
  await visit({ name: '34-parent-progress', description: "Grown-ups' area: a keeper's progress" });
  await openTab(page, 'print');
  await visit({ name: '35-parent-print', description: "Grown-ups' area: flashcards to print" });
  await page.getByTestId('print-table').click();
  await expectScreen(page, 'print');
  await expect(page.getByTestId('print-sheet').first()).toBeVisible();
  await visit({ name: '36-print-preview', description: 'Flashcards on A4, front and back' });
  await page.getByTestId('print-back').click();
  await expectScreen(page, 'parent');
  await openTab(page, 'keepers');
  await page.getByTestId('parent-remove-profile-1').click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await visit({ name: '30-confirm-remove', description: 'Confirming the removal of a keeper' });
  await page.getByTestId('confirm-cancel').click();
  await page.getByTestId('parent-edit-profile-1').click();
  await expectScreen(page, 'editor');
  await visit({ name: '31-editor-change', description: 'Changing a keeper, with Remove' });
  await page.getByTestId('back').click();
  await expectScreen(page, 'parent');
  await closeGrownUps(page);
  for (const keeper of [
    { name: 'Ben', avatar: 'keeper-5' },
    { name: 'Cleo', avatar: 'keeper-7' },
    { name: 'Dan', avatar: 'keeper-8' },
  ] as const) {
    await addKeeper(page, keeper);
    await leaveHub(page);
  }
  await visit({ name: '32-keepers-full', description: 'Four keepers: the valley is full' });
}

/**
 * Riddle Ruins opened ahead by a grown-up: a Compare Stones problem on its stones, the same stones
 * after an answer (values and the right sign), and a Riddle Scrolls story on its scroll.
 */
export async function riddlesWalk(page: Page, visit: Visit): Promise<void> {
  await boot(page);
  await createFirstKeeper(page, { name: 'Ada', avatar: 'keeper-6' });
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  await unlockAhead(page, 'riddle-ruins');
  await closeGrownUps(page);
  await page.getByTestId('keeper-profile-1').click();
  await expectHub(page, 'Ada');
  await startLevel(page, 'riddle-ruins', 'riddle-ruins.3');
  await expect(page.locator('.dv-stone')).toHaveCount(2);
  await visit({ name: '50-compare-stones', description: 'Compare Stones: two stones and a sign' });
  await page.getByTestId('choice-eq').click();
  await expect(page.getByTestId('problem')).toHaveAttribute('data-revealed', 'true');
  await visit({
    name: '51-compare-answered',
    description: "Compare Stones answered: the stones' values and the sign",
  });
  await backToHub(page, 'Ada', async () => {
    if (await page.getByTestId('feedback-next').isVisible()) {
      await page.getByTestId('feedback-next').click();
    }
    await page.keyboard.press('Escape');
    await page.getByTestId('pause-quit').click();
  });
  await startLevel(page, 'riddle-ruins', 'riddle-ruins.5');
  await expect(page.getByTestId('round-scroll')).toBeVisible();
  await visit({ name: '52-riddle-scroll', description: 'Riddle Scrolls: a story on its scroll' });
}

/**
 * The Seven-Headed Dragon and the finale. A grown-up opens Dragon Castle ahead and the child cures
 * the boss's first head; then a save the rules played to the finale beat is loaded
 * (support/finale.ts) for its first two lines: every head cured, then the Magic Window whole.
 */
export async function finaleWalk(page: Page, visit: Visit): Promise<void> {
  await boot(page);
  await createFirstKeeper(page, { name: 'Ada', avatar: 'keeper-4' });
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  await unlockAhead(page, 'dragon-castle');
  await closeGrownUps(page);
  await page.getByTestId('keeper-profile-1').click();
  await expectHub(page, 'Ada');
  await startLevel(page, 'dragon-castle', 'dragon-castle.boss');
  for (let answer = 0; answer < 3; answer++) await answerCorrectly(page, 'keyboard');
  await expect(page.getByTestId('boss-heads')).toHaveText('1 of 7 heads cured');
  await visit({ name: '37-boss-heads', description: 'The Seven-Headed Dragon: one head cured' });
  await backToHub(page, 'Ada', async () => {
    await page.keyboard.press('Escape');
    await page.getByTestId('pause-quit').click();
  });
  await leaveHub(page);

  await loadBackup(page, await finaleBackup(), 'Ada');
  await page.getByTestId('keeper-profile-1').click();
  await expect(page.getByTestId('screen-story')).toHaveAttribute('data-beat', FINALE_BEAT);
  await visit({ name: '38-finale', description: 'The finale: all seven heads smile' });
  await page.getByTestId('story-next').click();
  await expect(page.getByTestId('hall-window')).toBeVisible();
  await visit({
    name: '39-finale-window',
    description: 'The finale: the Magic Window whole again',
  });
}

/**
 * Everything that can go wrong, in one family: a save that fails, damaged records, storage
 * that will not open, an invalid content pack and a broken page shell. Installs storage
 * faults, so call it on a page that has not loaded the game yet.
 */
export async function troubleWalk(page: Page, visit: Visit): Promise<void> {
  const context = page.context();
  await installStorageFaults(context);
  await boot(page);
  await createFirstKeeper(page, { name: 'Ema', avatar: 'keeper-1' });
  await startPlacement(page);
  await answerCorrectly(page, 'keyboard');
  await setStorageFaults(page, { failWrites: true });
  await giveAnswer(page, await readAnswer(page), 'keyboard');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'failed');
  await visit({ name: '41-save-failed', description: 'Not saved: the save status with Retry' });
  await setStorageFaults(page, { failWrites: false });
  await page.getByTestId('save-retry').click();
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
  await backToHub(page, 'Ema', async () => {
    await page.keyboard.press('Escape');
    await page.getByTestId('pause-quit').click();
  });
  await leaveHub(page);

  await corruptRecord(page, await gameKey(page, 'profile-1'));
  await page.getByTestId('keeper-profile-1').click();
  await expectScreen(page, 'recovery');
  await visit({ name: '42-recovery-game', description: "Recovery: Ema's saved game" });
  await page.getByTestId('recovery-reset').click();
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await visit({ name: '43-recovery-confirm', description: 'Recovery: confirm erasing a record' });
  await page.getByTestId('confirm-cancel').click();
  await page.getByTestId('recovery-previous').click();
  await expectScreen(page, 'keepers');

  await page.getByTestId('grownups').click();
  await passGate(page);
  await openTab(page, 'settings');
  await page.getByTestId('setting-notation-international').click();
  await expect(page.getByTestId('toast').last()).toHaveText('Settings saved.');
  await visit({ name: '44-settings-saved', description: 'A setting saved, with its toast' });
  await closeGrownUps(page);
  await corruptRecord(page, preferencesKey('profile-1'), '{"not":"settings"}');
  await page.getByTestId('keeper-profile-1').click();
  await expectScreen(page, 'recovery');
  await visit({ name: '45-recovery-settings', description: "Recovery: Ema's settings" });
  await page.getByTestId('recovery-previous').click();
  await expectScreen(page, 'keepers');

  await corruptRecord(page, FAMILY_KEY);
  await reload(page);
  await expectScreen(page, 'recovery');
  await visit({ name: '46-recovery-family', description: 'Recovery: the list of keepers' });
  await page.getByTestId('recovery-previous').click();
  await expectScreen(page, 'title');

  await context.addInitScript(() => {
    (window as unknown as { __dvQaStorage: { unavailable: boolean } }).__dvQaStorage.unavailable =
      true;
  });
  await reload(page);
  await expectScreen(page, 'recovery');
  await visit({ name: '47-recovery-unavailable', description: 'Storage that will not open' });
  await setStorageFaults(page, { unavailable: false });
  await page.getByTestId('recovery-retry').click();
  await expectScreen(page, 'title');

  await page.route('**/content/dragon-valley.content.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"broken"}' }),
  );
  await page.goto('./');
  await waitReady(page);
  await expectScreen(page, 'error');
  await visit({ name: '48-error', description: 'The error screen: a dragon sneezed' });
  await page.unroute('**/content/dragon-valley.content.json');

  await page.route(/\/dragon-valley\/(index\.html)?$/, async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/<meta name="dv-base"[^>]*>/, '');
    await route.fulfill({ response, body: html });
  });
  await page.goto('./');
  await expect(page.getByTestId('startup-failure')).toBeVisible();
  await visit({ name: '49-startup-failure', description: 'The page shell could not start' });
  await page.unroute(/\/dragon-valley\/(index\.html)?$/);
}

/** A new family whose keeper has finished the placement check; ends on the hub. */
export async function familyAfterPlacement(page: Page, name: string): Promise<void> {
  await boot(page);
  await createFirstKeeper(page, { name, avatar: 'keeper-3' });
  await startPlacement(page);
  await finishRound(page, 'keyboard');
  await leaveResults(page, name);
}
