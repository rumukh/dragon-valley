/**
 * What a screen-reader user hears (plan §2.11 "feedback is announced in an aria-live region"):
 * the round's feedback line (role=status), the keypad's spoken display, and the shell's polite
 * and assertive announcers (coins, results, toasts, a failed save). Every change is recorded in
 * the page by a MutationObserver over live regions, in order, as assistive technology would
 * receive it; regions that appear together with their words would not be announced, so the
 * recorder also proves each region existed before it spoke.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './support/fixtures';
import {
  answerWrongly,
  chooseSetting,
  expectNextProblem,
  feedbackAfter,
  finishRound,
  goOn,
  leaveHub,
  newFamily,
  openGrownUps,
  startPlacement,
} from './support/app';
import { readTokens, solve, written } from './support/problem';

interface Announcement {
  readonly region: string;
  readonly live: string;
  readonly text: string;
  /** A visually hidden line inside the region, the words written for screen readers. */
  readonly spoken: string;
  /** The region was already in the page before this change. */
  readonly existedBefore: boolean;
}

async function recordAnnouncements(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const log: Announcement[] = [];
    Object.defineProperty(window, '__dvQaLive', { value: log, configurable: true });
    const selector = '[aria-live], [role="status"], [role="alert"], [role="log"]';
    const seen = new WeakSet<Element>();
    const last = new WeakMap<Element, string>();
    const regionOf = (node: Node): Element | null =>
      (node instanceof Element ? node : node.parentElement)?.closest(selector) ?? null;
    new MutationObserver((records) => {
      const touched = new Map<Element, boolean>();
      for (const record of records) {
        const region = regionOf(record.target);
        if (region) touched.set(region, seen.has(region));
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          for (const added of [node, ...node.querySelectorAll(selector)]) {
            if (added.matches(selector)) touched.set(added, false);
          }
        }
      }
      for (const [region, existedBefore] of touched) {
        seen.add(region);
        const text = (region.textContent ?? '').trim().replace(/\s+/g, ' ');
        if (text === '' || last.get(region) === text) {
          last.set(region, text);
          continue;
        }
        last.set(region, text);
        log.push({
          region: region.getAttribute('data-testid') ?? region.getAttribute('role') ?? '?',
          live:
            region.getAttribute('aria-live') ??
            (region.getAttribute('role') === 'alert' ? 'assertive' : 'polite'),
          text,
          spoken: (region.querySelector('.dv-visually-hidden')?.textContent ?? '').trim(),
          existedBefore,
        });
      }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
}

async function heard(page: Page): Promise<Announcement[]> {
  return page.evaluate(() => (window as unknown as { __dvQaLive: Announcement[] }).__dvQaLive);
}

async function expectHeard(
  page: Page,
  region: string,
  text: string | RegExp,
  timeout?: number,
): Promise<void> {
  await expect
    .poll(
      async () =>
        (await heard(page)).some(
          (item) =>
            item.region === region &&
            item.existedBefore &&
            [item.text, item.spoken].some((words) =>
              typeof text === 'string' ? words === text : text.test(words),
            ),
        ),
      { message: `${region}, already in the page, announced ${String(text)}`, timeout },
    )
    .toBe(true);
}

test.beforeEach(async ({ context }) => {
  await recordAnnouncements(context);
});

test('a round speaks its feedback, the typed answer, coins and the result', async ({ page }) => {
  await newFamily(page, { name: 'Ada' });
  await startPlacement(page);
  await expect(page.getByTestId('feedback')).toHaveAttribute('role', 'status');

  // A miss: the kind words, then the right fact.
  const missed = await readTokens(page);
  const right = solve(missed);
  await answerWrongly(page, 'keyboard');
  await expectHeard(page, 'feedback', /^Almost! Let's look…/);
  const fact = written(missed).replace('?', right.kind === 'number' ? String(right.value) : '?');
  await expectHeard(page, 'feedback', new RegExp(`${fact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  await goOn(page);

  // Typed digits are read back from the answer box.
  const tokens = await readTokens(page);
  const answer = solve(tokens);
  const digits = String(answer.kind === 'number' ? answer.value : 0);
  for (let index = 0; index < digits.length; index++) {
    await page.keyboard.type(digits[index]!);
    await expectHeard(page, 'keypad-display', `Your answer: ${digits.slice(0, index + 1)}`);
  }
  expect(await feedbackAfter(page, () => page.keyboard.press('Enter'))).toBe('correct');
  await expectHeard(page, 'feedback', `Yes! ${written(tokens).replace('?', digits)}`);
  await expectHeard(page, 'announcer-polite', 'You got 1 coin!');

  // The praise stays a moment; the round goes on with the next problem.
  await expectNextProblem(page);
  await finishRound(page, 'keyboard');
  await expectHeard(page, 'announcer-polite', 'The dragons saw what you know!');

  const all = await heard(page);
  expect(
    all.filter((item) => item.region === 'feedback').every((item) => item.live === 'polite'),
    'feedback is polite: it never interrupts',
  ).toBe(true);
});

test('settings changes are announced politely', async ({ page }) => {
  await newFamily(page, { name: 'Ben' });
  await leaveHub(page);
  await openGrownUps(page, 'settings');
  await chooseSetting(page, 'setting-notation-international');
  await expectHeard(page, 'announcer-polite', 'Settings saved.');
});
