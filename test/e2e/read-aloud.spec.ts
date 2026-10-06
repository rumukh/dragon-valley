/**
 * Read-aloud with the device's own voices (docs/app.md §11, plan §2.10): a stand-in speech
 * engine (support/speech.ts) offers local and remote voices and records what would be spoken.
 *
 * - Only local English voices are ever used (`localService === true`, an `en` language), even
 *   when the browser's default voice is a remote "natural" one.
 * - The words follow the written problem: "Two times four equals what?".
 * - With no local English voice the speaker button is hidden and the grown-ups' area says why;
 *   voices that arrive late (`voiceschanged`) make it appear without a reload.
 */
import { expect, test } from './support/fixtures';
import {
  answerCorrectly,
  closeGrownUps,
  leaveHub,
  newFamily,
  openGrownUps,
  playAs,
  quitRound,
  setSwitch,
  startPlacement,
  changeOnPanel,
  expectSettingsSaved,
} from './support/app';
import {
  installSpeech,
  LOCAL_AMERICAN,
  LOCAL_BRITISH,
  LOCAL_CZECH,
  publishVoices,
  REMOTE_ENGLISH,
  speechLog,
  spokenTexts,
  TYPICAL_VOICES,
} from './support/speech';
import { readTokens, spokenFor } from './support/problem';

test.describe('with local English voices on the device', () => {
  test.beforeEach(async ({ context }) => {
    await installSpeech(context, TYPICAL_VOICES);
  });

  test('the speaker reads the problem aloud with a local English voice only', async ({ page }) => {
    await newFamily(page, { name: 'Ada' });
    await startPlacement(page);
    const firstWords = spokenFor(await readTokens(page));
    const speaker = page.getByTestId('read-aloud');
    await expect(speaker).toBeVisible();
    await expect(speaker).toHaveAccessibleName('Read aloud');
    await speaker.click();
    await expect.poll(() => spokenTexts(page)).toEqual([firstWords]);
    const [line] = (await speechLog(page)).spoken;
    expect(line?.voiceLocal, 'a voice on the device').toBe(true);
    expect(line?.voiceURI, 'never the remote default voice').not.toBe(REMOTE_ENGLISH.voiceURI);
    expect(line?.voiceURI, 'the best local English voice: British first').toBe(
      LOCAL_BRITISH.voiceURI,
    );
    expect(line?.lang).toBe('en-GB');

    // Tapped, not typed: Enter after a click on the speaker is DV-QA-09 (input.spec.ts).
    for (let step = 0; step < 7; step++) await answerCorrectly(page, 'pointer');
    const laterWords = spokenFor(await readTokens(page));
    await page.getByTestId('read-aloud').click();
    await expect.poll(async () => (await spokenTexts(page)).at(-1)).toBe(laterWords);
  });

  test('grown-ups choose among local English voices only, and the choice is used', async ({
    page,
  }) => {
    await newFamily(page, { name: 'Ben' });
    await leaveHub(page);
    await openGrownUps(page, 'settings');
    const voice = page.getByTestId('setting-voice');
    await expect(voice.locator('option')).toHaveText([
      'Device default (English (United Kingdom))',
      'English (United Kingdom) (en-GB)',
      'English (United States) (en-US)',
    ]);
    await changeOnPanel(page, async () => {
      await voice.selectOption(LOCAL_AMERICAN.voiceURI);
    });
    await expectSettingsSaved(page);
    await page.getByTestId('setting-voice-test').click();
    await expect
      .poll(async () => (await speechLog(page)).spoken.at(-1))
      .toMatchObject({
        text: 'Fifty-six divided by seven equals eight.',
        voiceURI: LOCAL_AMERICAN.voiceURI,
        voiceLocal: true,
      });
    await closeGrownUps(page);

    await playAs(page, 1, 'Ben');
    await startPlacement(page);
    await page.getByTestId('read-aloud').click();
    await expect
      .poll(async () => (await speechLog(page)).spoken.at(-1)?.voiceURI)
      .toBe(LOCAL_AMERICAN.voiceURI);
  });

  test('auto-read speaks each new problem; pausing stops the voice', async ({ page }) => {
    await newFamily(page, { name: 'Cleo' });
    await leaveHub(page);
    await openGrownUps(page, 'settings');
    await setSwitch(page, 'setting-auto-read', true);
    await closeGrownUps(page);
    await playAs(page, 1, 'Cleo');
    await startPlacement(page);
    const first = spokenFor(await readTokens(page));
    await expect.poll(() => spokenTexts(page)).toEqual([first]);
    await answerCorrectly(page, 'keyboard');
    const second = spokenFor(await readTokens(page));
    await expect.poll(() => spokenTexts(page)).toEqual([first, second]);

    const before = (await speechLog(page)).cancels;
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('pause-dialog')).toBeVisible();
    expect((await speechLog(page)).cancels, 'pausing silences the voice').toBeGreaterThan(before);
  });

  test('turning read-aloud off hides the speaker', async ({ page }) => {
    await newFamily(page, { name: 'Dan' });
    await leaveHub(page);
    await openGrownUps(page, 'settings');
    await setSwitch(page, 'setting-read-aloud', false);
    await closeGrownUps(page);
    await playAs(page, 1, 'Dan');
    await startPlacement(page);
    await expect(page.getByTestId('problem')).toBeVisible();
    await expect(page.getByTestId('read-aloud')).toHaveCount(0);
  });
});

test.describe('without a local English voice', () => {
  test.beforeEach(async ({ context }) => {
    await installSpeech(context, [REMOTE_ENGLISH, LOCAL_CZECH]);
  });

  test('the speaker is hidden and the grown-ups area explains why', async ({ page }) => {
    await newFamily(page, { name: 'Ema' });
    await startPlacement(page);
    await expect(page.getByTestId('problem')).toBeVisible();
    await expect(page.getByTestId('read-aloud'), 'no remote voice, no Czech voice').toHaveCount(0);
    expect((await speechLog(page)).spoken).toEqual([]);

    await quitRound(page, 'Ema');
    await leaveHub(page);
    await openGrownUps(page, 'settings');
    await expect(page.getByTestId('setting-voice')).toHaveCount(0);
    await expect(page.getByTestId('voice-none')).toContainText(
      'This device has no built-in English voice, so the read-aloud button is hidden.',
    );
    await expect(page.getByTestId('voice-none')).toContainText('no text ever leaves it');
  });

  test('a local English voice that arrives late makes the speaker appear', async ({ page }) => {
    await newFamily(page, { name: 'Filip' });
    await startPlacement(page);
    const words = spokenFor(await readTokens(page));
    await expect(page.getByTestId('read-aloud')).toHaveCount(0);
    await publishVoices(page, [REMOTE_ENGLISH, LOCAL_CZECH, LOCAL_BRITISH]);
    await expect(page.getByTestId('read-aloud')).toBeVisible();
    await page.getByTestId('read-aloud').click();
    await expect
      .poll(async () => (await speechLog(page)).spoken)
      .toEqual([
        expect.objectContaining({
          text: words,
          voiceURI: LOCAL_BRITISH.voiceURI,
        }),
      ]);
  });
});
