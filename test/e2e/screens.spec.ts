/**
 * Every screen reachable today, in every engine: photographed at tablet, desktop and phone
 * sizes for human review (docs/qa/screens.md), checked with axe (no serious or critical WCAG 2.2
 * A/AA violations) and checked for layout (no sideways scrolling, nothing cut off, every control
 * at least 48 px, no word broken in the middle). Each stop is checked at all three sizes; the
 * walks are separate tests so they run side by side.
 */
import { test } from './support/fixtures';
import { checkStop, writeContactSheet } from './support/screens';
import { installSpeech, TYPICAL_VOICES } from './support/speech';
import {
  familyAfterPlacement,
  grownUpWalk,
  placesWalk,
  roundWalk,
  troubleWalk,
  welcomeWalk,
} from './support/tour';
import type { Stop } from './support/tour';

const everything = { screenshots: true, axe: true, layout: true };

test.use({ reducedMotion: 'reduce' });

// The same voices everywhere, so the grown-ups' voice list looks the same in every engine.
test.beforeEach(async ({ context }) => {
  await installSpeech(context, TYPICAL_VOICES);
  test.setTimeout(600_000);
});

test('the first run and the placement check', async ({ page }, testInfo) => {
  const stops: Stop[] = [];
  const visit = async (stop: Stop): Promise<void> => {
    stops.push(stop);
    await checkStop(page, testInfo, stop, everything);
  };
  await welcomeWalk(page, visit);
  await roundWalk(page, visit);
  writeContactSheet(testInfo, 'first-run-and-placement', stops);
});

test('the valley: map, levels, a choice round, Egg Grid and the collections', async ({
  page,
}, testInfo) => {
  await familyAfterPlacement(page, 'Ada');
  const stops: Stop[] = [];
  await placesWalk(
    page,
    async (stop) => {
      stops.push(stop);
      await checkStop(page, testInfo, stop, everything);
    },
    'Ada',
  );
  writeContactSheet(testInfo, 'the-valley', stops);
});

test("the keepers and the grown-ups' area", async ({ page }, testInfo) => {
  // After the placement check, so the Progress and Print tabs have answers to show.
  await familyAfterPlacement(page, 'Ada');
  const stops: Stop[] = [];
  await grownUpWalk(page, async (stop) => {
    stops.push(stop);
    await checkStop(page, testInfo, stop, everything);
  });
  writeContactSheet(testInfo, 'keepers-and-grown-ups', stops);
});

test('when things go wrong: failed saves, recovery, errors', async ({ page }, testInfo) => {
  const stops: Stop[] = [];
  await troubleWalk(page, async (stop) => {
    stops.push(stop);
    await checkStop(page, testInfo, stop, everything);
  });
  writeContactSheet(testInfo, 'when-things-go-wrong', stops);
});
