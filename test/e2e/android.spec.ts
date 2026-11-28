/**
 * The game inside the Android app (android/, docs/android.md), with a stand-in for the native
 * shell: the `dvAndroid` object android/'s Bridge.java injects, answering the same requests and
 * sending the same events. What the emulator QA found on 2026-11-26 is checked here on every run:
 *
 * - A backup is reported as saved only after the device wrote it: a cancelled save says nothing,
 *   a failed one says so, and the saved file loads back into the keeper.
 * - Read-aloud speaks with the device's own voices (Android's WebView has no Web Speech voices).
 * - The grown-ups see the app's storage, no offline installation, the privacy policy and the
 *   license notices in place, and printing goes to the device.
 * - Android's Back closes a dialog, pauses a round, goes back a screen, and leaves from the first
 *   screen (the shell then shows the home screen, the game kept as it was).
 */
import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  expectHub,
  expectScreen,
  leaveHub,
  newFamily,
  openGrownUps,
  openTab,
  round,
  startPlacement,
} from './support/app';
import { readTokens, spokenFor } from './support/problem';

interface ShellRequest {
  readonly id: number;
  readonly method: string;
  readonly args: Record<string, unknown>;
}

interface ShellBehaviour {
  /** How the next save ends: written, closed by the grown-up, or failed on the device. */
  save: 'saved' | 'cancelled' | 'write-failed';
  /** What the next open returns: a file's text, or null when the grown-up closes the screen. */
  open: string | null;
}

const BRITISH = {
  voiceURI: 'en-gb-x-gba-local',
  name: 'English (United Kingdom)',
  lang: 'en-GB',
  localService: true,
  default: false,
};

function fakeShell(voices: unknown[]): void {
  // Serialised into the page as written: no helpers from outside this function.
  const requests: ShellRequest[] = [];
  const behaviour: ShellBehaviour = { save: 'saved', open: null };
  const port = {
    onmessage: null as ((event: { data: string }) => void) | null,
    postMessage(message: string): void {
      const request = JSON.parse(message) as ShellRequest;
      requests.push(request);
      const send = (body: unknown): void => {
        setTimeout(() => port.onmessage?.({ data: JSON.stringify(body) }), 0);
      };
      const reply = (result: unknown): void => send({ id: request.id, result });
      const refuse = (error: string): void => send({ id: request.id, error });
      switch (request.method) {
        case 'hello':
          reply({ version: 1 });
          send({ event: 'speech.voices', data: voices });
          break;
        case 'speech.voices':
          reply(voices);
          break;
        case 'speech.speak':
          reply(null);
          setTimeout(() => send({ event: 'speech.end', data: { id: request.args['id'] } }), 30);
          break;
        case 'files.save':
          if (behaviour.save === 'write-failed') refuse('write-failed');
          else reply({ status: behaviour.save });
          break;
        case 'files.open':
          reply(
            behaviour.open === null
              ? { status: 'cancelled' }
              : { status: 'opened', text: behaviour.open },
          );
          break;
        case 'speech.cancel':
        case 'print':
        case 'exit':
          reply(null);
          break;
        default:
          refuse('unknown-method');
      }
    },
  };
  Object.defineProperty(window, 'dvAndroid', { value: port, configurable: true });
  Object.defineProperty(window, '__dvQaAndroid', {
    configurable: true,
    value: {
      requests: () => requests.slice(),
      set: (next: Partial<ShellBehaviour>) => Object.assign(behaviour, next),
      back: () => port.onmessage?.({ data: JSON.stringify({ event: 'back', data: null }) }),
    },
  });
}

async function installShell(context: BrowserContext, voices: unknown[] = [BRITISH]): Promise<void> {
  await context.addInitScript(fakeShell, voices);
}

type Qa = {
  __dvQaAndroid: {
    requests(): ShellRequest[];
    set(next: Partial<ShellBehaviour>): void;
    back(): void;
  };
};

const requests = (page: Page, method: string): Promise<ShellRequest[]> =>
  page.evaluate(
    (name) =>
      (window as unknown as Qa).__dvQaAndroid
        .requests()
        .filter((request) => request.method === name),
    method,
  );

const behave = (page: Page, next: Partial<ShellBehaviour>): Promise<void> =>
  page.evaluate((value) => (window as unknown as Qa).__dvQaAndroid.set(value), next);

const pressBack = (page: Page): Promise<void> =>
  page.evaluate(() => (window as unknown as Qa).__dvQaAndroid.back());

test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ context }) => {
  await installShell(context);
});

test('a backup counts as saved only once the device wrote it, and the file loads back', async ({
  page,
}) => {
  await newFamily(page, { name: 'Ada' });
  await leaveHub(page);
  await openGrownUps(page, 'data');
  const toast = page.getByTestId('toast');
  const exportAda = page.getByTestId('backup-export-profile-1');

  await behave(page, { save: 'cancelled' });
  await exportAda.click();
  await expect.poll(async () => (await requests(page, 'files.save')).length).toBe(1);
  const [asked] = await requests(page, 'files.save');
  expect(asked?.args['name']).toMatch(/^dragon-valley-ada-\d{4}-\d{2}-\d{2}\.json$/);
  expect(asked?.args['type']).toBe('application/json');
  const backup = String(asked?.args['text']);
  expect(JSON.parse(backup), 'the whole backup goes to the device').toMatchObject({
    keeper: { name: 'Ada' },
  });
  await expect(toast, 'a closed save screen is not a saved backup').toHaveCount(0);

  await behave(page, { save: 'write-failed' });
  await exportAda.click();
  await expect(toast.last()).toHaveText(
    'The backup file was not saved, so there is no new backup. Try again, or choose another place to save it.',
  );

  await behave(page, { save: 'saved' });
  await exportAda.click();
  await expect(toast.last()).toHaveText('Backup of Ada saved as a file.');

  const importAda = page.getByTestId('backup-import-profile-1');
  await behave(page, { open: null });
  await importAda.click();
  await expect.poll(async () => (await requests(page, 'files.open')).length).toBe(1);
  await expect(page.getByTestId('confirm-dialog'), 'nothing chosen, nothing asked').toHaveCount(0);

  await behave(page, { open: backup });
  await importAda.click();
  await page.getByTestId('confirm-ok').click();
  await expect(toast.last()).toHaveText('Backup loaded for Ada.');
});

test('the grown-ups see app storage, the privacy policy and licenses in place, and print on the device', async ({
  page,
}) => {
  await newFamily(page, { name: 'Ada' });
  await leaveHub(page);
  await openGrownUps(page, 'data');
  await expect(page.getByTestId('parent-tab-offline'), 'the app is already offline').toHaveCount(0);
  await expect(page.getByTestId('storage-status')).toHaveText(
    'Saved progress is kept in the app on this device. Uninstalling Dragon Valley or clearing its storage erases it, so keep a backup.',
  );
  await expect(page.getByTestId('storage-persist'), 'there is no browser to ask').toHaveCount(0);

  await openTab(page, 'about');
  const policy = page.getByTestId('about-privacy');
  await expect(policy.getByRole('heading', { level: 2 })).toHaveText('Privacy policy');
  await expect(policy).toContainText('the Android app has no permission to use the internet');
  await expect(policy).toContainText('Email rus.mukhamedov@gmail.com.');
  await page.getByTestId('about-licenses').locator('summary').click();
  await expect(page.getByTestId('about-licenses-text')).toContainText('MIT License');

  await openTab(page, 'print');
  await page.getByTestId('print-table-7').click();
  await page.getByTestId('print-table').click();
  await expectScreen(page, 'print');
  await page.getByTestId('print-now').click();
  await expect
    .poll(async () => (await requests(page, 'print')).map((request) => request.args['title']))
    .toEqual([expect.stringMatching(/^Flashcards: the 7 times table/)]);
  await page.getByTestId('print-file').click();
  await expect
    .poll(async () => (await requests(page, 'files.save')).map((request) => request.args))
    .toEqual([expect.objectContaining({ name: 'ada-table-7.html', type: 'text/html' })]);
});

test("read-aloud speaks with the device's own voice", async ({ page }) => {
  await newFamily(page, { name: 'Ada' });
  await startPlacement(page);
  const words = spokenFor(await readTokens(page));
  const speaker = page.getByTestId('read-aloud');
  await expect(speaker, 'the device has an English voice').toBeVisible();
  await speaker.click();
  await expect
    .poll(async () => (await requests(page, 'speech.speak')).map((request) => request.args))
    .toEqual([expect.objectContaining({ text: words, voice: BRITISH.voiceURI })]);
});

test("Android's Back closes a dialog, pauses a round, goes back, and leaves from the first screen", async ({
  page,
}) => {
  await newFamily(page, { name: 'Ada' });
  await startPlacement(page);
  await pressBack(page);
  await expect(page.getByTestId('pause-dialog'), 'Back pauses the round').toBeVisible();
  await pressBack(page);
  await expect(page.getByTestId('pause-dialog'), 'Back again goes on playing').toHaveCount(0);
  await expect(round(page)).toBeVisible();
  await pressBack(page);
  await page.getByTestId('pause-quit').click();
  await expectHub(page, 'Ada');

  // Nothing was answered, so the hub's own Back goes straight to "Who is playing?".
  await pressBack(page);
  await expectScreen(page, 'keepers');
  await page.getByTestId('grownups').click();
  await expect(page.getByTestId('parent-gate')).toBeVisible();
  await pressBack(page);
  await expect(page.getByTestId('parent-gate'), 'Back closes the grown-ups check').toHaveCount(0);
  await expectScreen(page, 'keepers');
  expect(await requests(page, 'exit'), 'nothing has left the game yet').toEqual([]);

  // "Who is playing?" is where the hub leads back to: nothing is behind it, so Back leaves.
  await pressBack(page);
  await expect
    .poll(async () => (await requests(page, 'exit')).length, 'Back from the first screen leaves')
    .toBe(1);
  await expectScreen(page, 'keepers');
});
