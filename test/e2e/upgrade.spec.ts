/**
 * A save from before a content update (docs/app.md §4): every shipped pack is archived in
 * `content/history/<revision>.json`, so a keeper whose save pins an older pack opens on exactly
 * that pack and moves to the newest one at the hub, keeping all progress. While the archived pack
 * cannot be fetched, the save waits untouched on the recovery screen, and "Try opening again"
 * opens it once the pack is back in reach.
 *
 * The keeper loads S2b's real save of the deployed Region 1 slice (content 1.0.0) as a backup;
 * the build serves the current pack and the archived 1.0.0 one as shipped.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  boot,
  bootStatus,
  closeGrownUps,
  createFirstKeeper,
  expectCoins,
  expectHub,
  expectScreen,
  keeperCard,
  leaveHub,
  openGrownUps,
  playFromTitle,
  reload,
} from './support/app';
import { gameKey, readHistory } from './support/storage';

const ARCHIVED = '1.0.0';

/** S2b's slice save as a backup file, and the coins it holds. */
function sliceBackup(testInfo: TestInfo): { readonly text: string; readonly coins: number } {
  const root = testInfo.config.configFile ? dirname(testInfo.config.configFile) : process.cwd();
  const file = join(root, 'test', 'migration', 'fixtures', 'slice-save.json');
  const snapshot = JSON.parse(readFileSync(file, 'utf8'));
  expect(snapshot.content.revision).toBe(ARCHIVED);
  const game = {
    format: 'aegis.save',
    formatVersion: 1,
    gameId: 'dragon-valley',
    profileId: 'slice',
    contentRevision: ARCHIVED,
    schemaVersion: snapshot.stateVersion,
    engine: { id: 'aegis-runtime', snapshotVersion: 1, revision: 'runtime-1' },
    revision: 1,
    state: snapshot,
    resume: null,
  };
  const backup = {
    format: 'dragon-valley-backup',
    version: 1,
    keeper: { name: 'Slice', avatar: 'keeper-3' },
    game,
    preferences: null,
  };
  return {
    text: JSON.stringify(backup),
    coins: snapshot.world.resources['aegis.runtime.state'].coins,
  };
}

/** Load a backup file into keeper 1 through the grown-ups' area. */
async function loadBackup(page: Page, text: string, name: string): Promise<void> {
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

/** The content revision keeper 1's stored save pins. */
async function pinnedRevision(page: Page): Promise<string> {
  const history = await readHistory(page, await gameKey(page, 'profile-1'));
  return JSON.parse(history!.current!.payload).contentRevision as string;
}

async function currentRevision(page: Page): Promise<string> {
  const revision = await bootStatus(page).getAttribute('data-content-revision');
  expect(revision, 'the build ships a pack newer than the archived one').not.toBe(ARCHIVED);
  return revision!;
}

test('a save from before an update opens on its own pack and moves to the newest at the hub', async ({
  page,
}, testInfo) => {
  const backup = sliceBackup(testInfo);
  await boot(page);
  const current = await currentRevision(page);
  await createFirstKeeper(page, { name: 'Ema' });
  await leaveHub(page);

  await loadBackup(page, backup.text, 'Ema');
  expect(await pinnedRevision(page), 'the backup keeps the pack it was played with').toBe(ARCHIVED);

  await keeperCard(page, 1).click();
  await expectHub(page, 'Ema');
  await expectCoins(page, backup.coins, 'the slice save keeps its coins');
  await expect
    .poll(() => pinnedRevision(page), { message: 'moved to the newest pack' })
    .toBe(current);

  await reload(page);
  await playFromTitle(page);
  await keeperCard(page, 1).click();
  await expectHub(page, 'Ema');
  await expectCoins(page, backup.coins);
});

test('a save whose archived pack is out of reach waits for a grown-up, then opens', async ({
  page,
  guard,
}, testInfo) => {
  for (const kind of ['failed-request', 'console'] as const) {
    guard.allow(
      kind,
      /content\/history\/1\.0\.0\.json/,
      'the archived pack is out of reach on purpose',
    );
  }
  const backup = sliceBackup(testInfo);
  let reachable = true;
  await page.route(`**/content/history/${ARCHIVED}.json`, (route) =>
    reachable
      ? route.continue()
      : route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' }),
  );
  await boot(page);
  const current = await currentRevision(page);
  await createFirstKeeper(page, { name: 'Bo' });
  await leaveHub(page);
  await loadBackup(page, backup.text, 'Bo');

  reachable = false;
  await reload(page);
  await playFromTitle(page);
  await keeperCard(page, 1).click();
  await expectScreen(page, 'recovery');
  await expect(page.getByTestId('recovery-content')).toBeVisible();
  expect(await pinnedRevision(page), 'nothing was changed').toBe(ARCHIVED);

  reachable = true;
  await page.getByTestId('recovery-retry').click();
  await expectScreen(page, 'keepers');
  await keeperCard(page, 1).click();
  await expectHub(page, 'Bo');
  await expect.poll(() => pinnedRevision(page)).toBe(current);
});
