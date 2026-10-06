/**
 * A save from before a content update (docs/app.md §4): every shipped pack is archived in
 * `content/history/<revision>.json`, so a keeper whose save pins an older pack opens on exactly
 * that pack and moves to the newest one at the hub, keeping all progress. While the archived pack
 * cannot be fetched, the save waits untouched on the recovery screen, and "Try opening again"
 * opens it once the pack is back in reach.
 *
 * The site serves its pack under a newer revision, and S2b's Region 1 slice pack (the deployed
 * `1.0.0`) as the archived one; the keeper loads S2b's real slice save as a backup file.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  boot,
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

const NEWER = '1.99.0';

interface Slice {
  readonly pack: string;
  readonly backup: string;
  readonly coins: number;
}

function slice(testInfo: TestInfo): Slice {
  const root = testInfo.config.configFile ? dirname(testInfo.config.configFile) : process.cwd();
  const fixtures = join(root, 'test', 'migration', 'fixtures');
  const snapshot = JSON.parse(readFileSync(join(fixtures, 'slice-save.json'), 'utf8'));
  const envelope = {
    format: 'aegis.save',
    formatVersion: 1,
    gameId: 'dragon-valley',
    profileId: 'slice',
    contentRevision: snapshot.content.revision,
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
    game: envelope,
    preferences: null,
  };
  return {
    pack: readFileSync(join(fixtures, 'slice.content.json'), 'utf8'),
    backup: JSON.stringify(backup),
    coins: snapshot.world.resources['aegis.runtime.state'].coins,
  };
}

/** The site after an update: its pack under a newer revision, the slice pack archived. */
async function serveUpdate(page: Page, pack: string, archived: () => boolean): Promise<void> {
  await page.route('**/content/history/1.0.0.json', (route) =>
    archived()
      ? route.fulfill({ status: 200, contentType: 'application/json', body: pack })
      : route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' }),
  );
  await page.route('**/content/dragon-valley.content.json', async (route) => {
    const response = await route.fetch();
    const current = await response.json();
    await route.fulfill({ response, json: { ...current, revision: NEWER } });
  });
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

async function pinnedRevision(page: Page): Promise<string> {
  const history = await readHistory(page, await gameKey(page, 'profile-1'));
  return JSON.parse(history!.current!.payload).contentRevision as string;
}

test('a save from before an update opens on its own pack and moves to the newest at the hub', async ({
  page,
}, testInfo) => {
  const { pack, backup, coins } = slice(testInfo);
  await serveUpdate(page, pack, () => true);
  await boot(page);
  await expect(page.getByTestId('boot-status')).toHaveAttribute('data-content-revision', NEWER);
  await createFirstKeeper(page, { name: 'Ema' });
  await leaveHub(page);

  await loadBackup(page, backup, 'Ema');
  expect(await pinnedRevision(page), 'the backup keeps the pack it was played with').toBe('1.0.0');

  await keeperCard(page, 1).click();
  await expectHub(page, 'Ema');
  await expectCoins(page, coins, 'the slice save keeps its coins');
  await expect
    .poll(() => pinnedRevision(page), { message: 'moved to the newest pack' })
    .toBe(NEWER);

  await reload(page);
  await playFromTitle(page);
  await keeperCard(page, 1).click();
  await expectHub(page, 'Ema');
  await expectCoins(page, coins);
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
  const { pack, backup } = slice(testInfo);
  let archived = true;
  await serveUpdate(page, pack, () => archived);
  await boot(page);
  await createFirstKeeper(page, { name: 'Bo' });
  await leaveHub(page);
  await loadBackup(page, backup, 'Bo');

  archived = false;
  await reload(page);
  await playFromTitle(page);
  await keeperCard(page, 1).click();
  await expectScreen(page, 'recovery');
  await expect(page.getByTestId('recovery-content')).toBeVisible();
  expect(await pinnedRevision(page), 'nothing was changed').toBe('1.0.0');

  archived = true;
  await page.getByTestId('recovery-retry').click();
  await expectScreen(page, 'keepers');
  await keeperCard(page, 1).click();
  await expectHub(page, 'Bo');
  await expect.poll(() => pinnedRevision(page)).toBe(NEWER);
});
