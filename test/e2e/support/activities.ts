/**
 * Playing the typed activity boards from what the board shows: card faces, trail stones, nest
 * numbers and egg goals. These helpers never read the minigame view or private game state.
 */
import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';
import { results, throughHatches } from './app';

export type ActivityVia = 'keyboard' | 'touch';
export type MemoryMode = 'value' | 'family' | 'term';

interface Card {
  readonly id: string;
  readonly state: string;
  readonly text: string;
  readonly label: string;
}

interface TrailGap {
  readonly gap: number;
  readonly path: number;
  readonly id: string;
  readonly value: number;
}

const TERMS = ['factor', 'product', 'dividend', 'divisor', 'quotient', 'remainder'] as const;

function minigameStatus(page: Page): Locator {
  return page.getByTestId('minigame-status');
}

async function press(control: Locator, via: ActivityVia): Promise<void> {
  if (via === 'touch') {
    await control.tap();
  } else {
    await control.focus();
    await control.page().keyboard.press('Enter');
  }
}

async function progressValue(page: Page): Promise<number> {
  return Number(
    (await page
      .getByTestId('minigame-progress')
      .getAttribute('aria-valuenow', { timeout: 1_000 })
      .catch(() => null)) ?? '0',
  );
}

async function activityEnded(page: Page): Promise<boolean> {
  return (
    (await results(page).isVisible()) ||
    (await page.getByTestId('results-continue').isVisible()) ||
    (await page.getByTestId('screen-round').isVisible())
  );
}

async function waitForActivityMove(
  page: Page,
  moved: () => Promise<boolean>,
  message: string,
): Promise<void> {
  await expect
    .poll(async () => (await activityEnded(page)) || (await moved()), { message, timeout: 90_000 })
    .toBe(true);
}

async function waitForBoardAdvance(page: Page, before: number): Promise<'next board' | 'ended'> {
  let outcome: 'waiting' | 'next board' | 'ended' = 'waiting';
  await expect
    .poll(
      async () => {
        if (await activityEnded(page)) outcome = 'ended';
        else outcome = (await progressValue(page)) > before ? 'next board' : 'waiting';
        return outcome;
      },
      { message: 'the completed board advances or ends the activity', timeout: 90_000 },
    )
    .not.toBe('waiting');
  const advanced = outcome as 'next board' | 'ended';
  return advanced === 'next board' ? 'next board' : 'ended';
}

export async function continueToNextActivity(page: Page): Promise<void> {
  await expect(results(page), 'the previous activity has reached its results').toBeVisible();
  await throughHatches(page);
  await page.getByTestId('results-continue').click();
  const play = page.getByTestId('level-play');
  await expect(
    page.getByTestId('screen-minigame').or(page.getByTestId('screen-round')).or(play),
    'the level offers or starts the next activity',
  ).toBeVisible();
  if (await play.isVisible()) await play.click();
  await expect(
    page.getByTestId('screen-minigame').or(page.getByTestId('screen-round')),
    'the next activity starts',
  ).toBeVisible();
}

async function readCards(page: Page): Promise<Card[]> {
  return page.getByTestId('match-grid').evaluate((grid) =>
    [...grid.querySelectorAll('button[data-testid^="match-card-"]')].map((button) => ({
      id: button.getAttribute('data-testid')!.replace('match-card-', ''),
      state: (button as HTMLElement).dataset['state'] ?? '',
      text: (button.textContent ?? '').trim(),
      label: button.getAttribute('aria-label') ?? '',
    })),
  );
}

async function selectCard(page: Page, card: Card, via: ActivityVia): Promise<void> {
  const control = page.getByTestId(`match-card-${card.id}`);
  await press(control, via);
  await waitForActivityMove(
    page,
    async () => {
      const state = await control.getAttribute('data-state', { timeout: 1_000 }).catch(() => null);
      return state !== card.state || (await page.getByTestId('match-turn-back').isVisible());
    },
    `card ${card.id} turns over or a pair is judged`,
  );
}

function compact(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function expressionValue(text: string): string | null {
  const match = /^(\d+)\s*([·×:÷])\s*(\d+)$/.exec(compact(text));
  if (!match) return null;
  const left = Number(match[1]);
  const right = Number(match[3]);
  if (match[2] === '·' || match[2] === '×') return `num:${left * right}`;
  if (right !== 0 && left % right === 0) return `num:${left / right}`;
  return null;
}

function remainderAnswer(text: string): string | null {
  const match = /^(\d+)\s*[rR]\s*(\d+)$/.exec(compact(text));
  return match ? `rem:${Number(match[1])}:${Number(match[2])}` : null;
}

function sentenceParts(text: string): {
  readonly op: 'mul' | 'div';
  readonly left: number;
  readonly right: number;
  readonly result: number;
  readonly remainder: number | null;
} | null {
  const match = /^(\d+)\s*([·×:÷])\s*(\d+)\s*=\s*(\d+)(?:\s*[rR]\s*(\d+))?$/.exec(compact(text));
  if (!match) return null;
  return {
    op: match[2] === '·' || match[2] === '×' ? 'mul' : 'div',
    left: Number(match[1]),
    right: Number(match[3]),
    result: Number(match[4]),
    remainder: match[5] === undefined ? null : Number(match[5]),
  };
}

function familyKey(text: string): string | null {
  const sentence = sentenceParts(text);
  if (!sentence) return null;
  return sentence.op === 'mul' ? `family:${sentence.result}` : `family:${sentence.left}`;
}

function termKeys(text: string): string[] {
  const term = TERMS.find((candidate) => candidate === text);
  if (term) return [`term:${term}`];
  const sentence = sentenceParts(text);
  if (!sentence) return [];
  if (sentence.op === 'mul') return ['term:factor', 'term:product'];
  return sentence.remainder === null
    ? ['term:dividend', 'term:divisor', 'term:quotient']
    : ['term:dividend', 'term:divisor', 'term:quotient', 'term:remainder'];
}

function faceKeys(text: string, mode: MemoryMode): string[] {
  if (mode === 'family') return familyKey(text) ? [familyKey(text)!] : [];
  if (mode === 'term') return termKeys(text);
  const value = expressionValue(text);
  if (value) return [value];
  const remainder = remainderAnswer(text);
  if (remainder) return [remainder];
  if (/^\d+$/.test(text)) return [`num:${Number(text)}`];
  return [];
}

function possiblePair(left: string, right: string, mode: MemoryMode): boolean {
  if (!left || !right || left === right) return false;
  const leftKeys = faceKeys(left, mode);
  const rightKeys = faceKeys(right, mode);
  return leftKeys.some((key) => rightKeys.includes(key));
}

function pairId(left: string, right: string): string {
  return [left, right].sort().join('\n');
}

async function clearMismatch(page: Page, via: ActivityVia, mismatches: Set<string>): Promise<void> {
  if ((await page.getByTestId('match-grid').count()) === 0) return;
  const open = (await readCards(page)).filter((card) => card.state === 'miss');
  if (open.length === 2) {
    mismatches.add(pairId(open[0]!.text, open[1]!.text));
    await expect(
      minigameStatus(page),
      'a mismatched Memory Match pair gets a kind line',
    ).toHaveText('Not a pair. Turn them back.');
    const before = open.map((card) => card.id).join(',');
    await press(page.getByTestId('match-turn-back'), via);
    await waitForActivityMove(
      page,
      async () => {
        const states = await readCards(page);
        return before
          .split(',')
          .every((id) => states.find((card) => card.id === id)?.state === 'hidden');
      },
      'the mismatched cards turn back',
    );
  }
}

export async function playMemoryMatch(
  page: Page,
  via: ActivityVia,
  mode: MemoryMode,
  /** Called once for each card turned face up the first time, with its face text. */
  onReveal?: (card: Locator, face: string) => Promise<void>,
): Promise<void> {
  await expect(page.getByTestId('screen-minigame')).toBeVisible();
  await expect(page.getByTestId('match-grid'), 'Memory Match opens').toBeVisible();
  const seen = new Map<string, string>();
  const mismatches = new Set<string>();
  let provedMismatch = false;
  let provedPair = false;

  for (let turn = 0; turn < 80 && !(await results(page).isVisible()); turn++) {
    await clearMismatch(page, via, mismatches);
    provedMismatch ||= mismatches.size > 0;
    const cards = await readCards(page);
    cards
      .filter((card) => card.text && card.state !== 'hidden')
      .forEach((card) => seen.set(card.id, card.text));
    const unmatched = cards.filter((card) => card.state !== 'matched');
    if (unmatched.length === 0) break;

    const known = unmatched
      .filter((card) => seen.has(card.id) && card.state === 'hidden')
      .map((card) => ({ ...card, text: seen.get(card.id)! }));
    let planned: [Card, Card] | null = null;
    for (let i = 0; i < known.length && planned === null; i++) {
      for (let j = i + 1; j < known.length; j++) {
        if (
          possiblePair(known[i]!.text, known[j]!.text, mode) &&
          !mismatches.has(pairId(known[i]!.text, known[j]!.text))
        ) {
          planned = [known[i]!, known[j]!];
          break;
        }
      }
    }

    let chosen: [Card, Card];
    if (planned === null) {
      const first =
        unmatched.find((card) => card.state === 'hidden' && !seen.has(card.id)) ??
        unmatched.find((card) => card.state === 'hidden');
      expect(first, 'Memory Match has a card to reveal').toBeDefined();
      await selectCard(page, first!, via);
      const afterFirst = await readCards(page);
      const open = afterFirst.find((card) => card.id === first!.id);
      expect(open?.text, 'the revealed Memory Match card shows a face').toBeTruthy();
      if (onReveal && !seen.has(first!.id)) {
        await onReveal(page.getByTestId(`match-card-${first!.id}`), open!.text);
      }
      seen.set(first!.id, open!.text);
      const second =
        afterFirst
          .filter((card) => card.state === 'hidden')
          .find((card) => {
            const face = seen.get(card.id);
            return (
              face !== undefined &&
              possiblePair(open!.text, face, mode) &&
              !mismatches.has(pairId(open!.text, face))
            );
          }) ?? afterFirst.find((card) => card.state === 'hidden');
      expect(second, 'Memory Match has a second card to try').toBeDefined();
      await selectCard(page, second!, via);
      chosen = [first!, second!];
    } else {
      await selectCard(page, planned[0], via);
      await selectCard(page, planned[1], via);
      chosen = planned;
    }

    // Judged once both chosen cards read as a pair or a miss; an earlier pair's "matched" says
    // nothing about this choice.
    await waitForActivityMove(
      page,
      async () => {
        if (await results(page).isVisible()) return true;
        const current = await readCards(page);
        return chosen.every((card) =>
          ['matched', 'miss'].includes(current.find((c) => c.id === card.id)?.state ?? ''),
        );
      },
      'the Memory Match choice is judged',
    );
    if (await results(page).isVisible()) break;
    const judged = await readCards(page);
    judged
      .filter((card) => card.text && card.state !== 'hidden')
      .forEach((card) => seen.set(card.id, card.text));
    if (judged.some((card) => card.state === 'matched')) {
      provedPair = true;
      await expect(
        page.getByTestId('match-grid').getByRole('button').first(),
        'Memory Match card accessible names include the card number and face/back text',
      ).toHaveAttribute('aria-label', /Card \d+:/);
    }
  }

  expect(provedMismatch, 'Memory Match proved a mismatch and turn-back path').toBe(true);
  expect(provedPair, 'Memory Match found at least one pair').toBe(true);
  await expect(results(page), 'Memory Match ends on its results').toBeVisible();
}

async function readTrail(page: Page): Promise<TrailGap[]> {
  return page.getByTestId('trail').evaluate((trail) => {
    let gap = 0;
    return [...trail.children].flatMap((child, path) => {
      const button = child.querySelector('button[data-testid^="trail-stone-"]');
      if (!button) return [];
      const item = {
        gap,
        path,
        id: button.getAttribute('data-testid')!.replace('trail-stone-', ''),
        value: Number((button.textContent ?? '').trim()),
      };
      gap += 1;
      return [item];
    });
  });
}

async function moveTrailStone(page: Page, source: TrailGap, target: TrailGap, via: ActivityVia) {
  if (source.gap === target.gap) return;
  const before = (await readTrail(page)).map((gap) => gap.id).join(',');
  await press(page.getByTestId(`trail-stone-${source.id}`), via);
  await expect(page.getByTestId(`trail-stone-${source.id}`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await press(page.getByTestId(`trail-stone-${target.id}`), via);
  await waitForActivityMove(
    page,
    async () => (await readTrail(page)).map((gap) => gap.id).join(',') !== before,
    'the trail stones reorder after a move',
  );
}

async function checkTrail(page: Page, via: ActivityVia): Promise<void> {
  await press(page.getByTestId('trail-check'), via);
}

export async function playNumberTrail(page: Page, via: ActivityVia): Promise<void> {
  await expect(page.getByTestId('trail'), 'Number Trail opens').toBeVisible();
  let provedKindFeedback = false;
  let provedCompletion = false;

  for (let board = 0; board < 12 && (await page.getByTestId('trail').isVisible()); board++) {
    const status = await minigameStatus(page).innerText();
    const step = Number(/Count in (\d+)s/.exec(status)?.[1]);
    expect(step, `the trail tells its step: "${status}"`).toBeGreaterThan(0);
    let gaps = await readTrail(page);
    const expected = (gap: TrailGap) => step * (gap.path + 1);

    if (!provedKindFeedback) {
      const first = gaps[0]!;
      const wrong = gaps.find((gap) => gap.value !== expected(first));
      if (wrong && wrong.gap !== first.gap) {
        await moveTrailStone(page, wrong, first, via);
        gaps = await readTrail(page);
      }
      await checkTrail(page, via);
      await expect(
        minigameStatus(page),
        'a wrong Number Trail order gets a kind line and stays editable',
      ).toHaveText('Not quite yet. Move a stone and check again.');
      provedKindFeedback = true;
    }

    for (let slot = 0; slot < 8; slot++) {
      gaps = await readTrail(page);
      const target = gaps.find((gap) => gap.value !== expected(gap));
      if (!target) break;
      const source = gaps.find((gap) => gap.value === expected(target));
      expect(source, `the stone for ${expected(target)} is visible`).toBeDefined();
      await moveTrailStone(page, source!, target, via);
    }

    gaps = await readTrail(page);
    expect(
      gaps.map((gap) => gap.value),
      'the visible stones now make the skip-count sequence',
    ).toEqual(gaps.map((gap) => expected(gap)));
    const before = await progressValue(page);
    await checkTrail(page, via);
    await waitForBoardAdvance(page, before);
    provedCompletion = true;
  }

  expect(provedKindFeedback, 'Number Trail gave kind feedback for a wrong order').toBe(true);
  expect(provedCompletion, 'Number Trail completed at least one board').toBe(true);
  await expect(results(page), 'Number Trail ends on its results').toBeVisible();
}

async function chooseFamilyNumber(page: Page, value: number, via: ActivityVia): Promise<void> {
  await press(page.getByTestId(`family-number-${value}`), via);
  await expect(page.getByTestId(`family-number-${value}`)).toHaveAttribute('aria-pressed', 'true');
}

async function fillFamilySlot(
  page: Page,
  equation: number,
  slot: number,
  value: number,
  via: ActivityVia,
): Promise<void> {
  const target = page.getByTestId(`family-slot-${equation}-${slot}`);
  if ((await target.innerText()) === String(value)) return;
  await chooseFamilyNumber(page, value, via);
  await press(target, via);
  await expect(target, `family slot ${equation}:${slot} is filled`).toHaveText(String(value));
}

async function fillFamilyEquation(
  page: Page,
  equation: number,
  values: readonly [number, number, number],
  via: ActivityVia,
): Promise<void> {
  for (const [slot, value] of values.entries()) {
    await fillFamilySlot(page, equation, slot, value, via);
  }
}

export async function playFactFamily(page: Page, via: ActivityVia): Promise<void> {
  await expect(page.getByTestId('family-nest'), 'Fact Family Nest opens').toBeVisible();
  let provedKindFeedback = false;
  let provedCompletion = false;

  for (let board = 0; board < 12 && (await page.getByTestId('family-nest').isVisible()); board++) {
    const numbersInNest = (
      await page.getByTestId('family-nest').getByRole('button').allTextContents()
    )
      .map(Number)
      .sort((a, b) => a - b);
    const [a, b, product] = numbersInNest as [number, number, number];
    expect(a * b, 'the nest shows two factors and their product').toBe(product);

    if (!provedKindFeedback) {
      await fillFamilyEquation(page, 0, [a, product, b], via);
      await press(page.getByTestId('family-check'), via);
      await expect(
        minigameStatus(page),
        'a wrong Fact Family equation gets a kind line',
      ).toHaveText('Some are not right yet. Look at the orange ones.');
      provedKindFeedback = true;
    }

    const rows: [number, number, number][] = [
      [a, b, product],
      [b, a, product],
      [product, a, b],
      [product, b, a],
    ];
    for (const [equation, row] of rows.entries())
      await fillFamilyEquation(page, equation, row, via);
    const before = await progressValue(page);
    await press(page.getByTestId('family-check'), via);
    await waitForBoardAdvance(page, before);
    provedCompletion = true;
  }

  expect(provedKindFeedback, 'Fact Family gave kind feedback for a wrong equation').toBe(true);
  expect(provedCompletion, 'Fact Family completed at least one board').toBe(true);
  await expect(results(page), 'Fact Family ends on its results').toBeVisible();
}

function rectangleText(rows: number, columns: number): string {
  return `${rows}·${columns}`;
}

async function readEggBoard(page: Page): Promise<{
  readonly over: boolean;
  readonly product: number;
  readonly found: string[];
  readonly maxSide: number;
}> {
  return page.evaluate(() => {
    const grid = document.querySelector('[data-testid="egg-grid"]');
    const rows = [...(grid?.querySelectorAll('[data-row]') ?? [])].map((spot) =>
      Number((spot as HTMLElement).dataset['row']),
    );
    const goal = document.querySelector('[data-testid="egg-goal"]')?.textContent ?? '';
    return {
      over: document.querySelector('[data-testid="screen-results"]') !== null,
      product: Number(/of (\d+) eggs/.exec(goal)?.[1] ?? 0),
      found: [...document.querySelectorAll('[data-testid="egg-found"] li')].map((item) =>
        (item.textContent ?? '').replace(/\s/g, ''),
      ),
      maxSide: Math.max(...rows),
    };
  });
}

async function tapEggNest(page: Page, rows: number, columns: number): Promise<void> {
  await page
    .getByTestId('egg-grid')
    .locator(`[data-row="${rows}"][data-column="${columns}"]`)
    .tap();
  await expect(page.getByTestId('egg-sentence')).toHaveText(
    rows === 1 ? `${rows} row of ${columns}` : `${rows} rows of ${columns}`,
  );
}

/** Build a nest with a stepper's − and + buttons, pressed from the keyboard (Enter). */
async function stepEggNest(page: Page, rows: number, columns: number): Promise<void> {
  for (const [which, target] of [
    ['rows', rows],
    ['columns', columns],
  ] as const) {
    const value = page.getByTestId(`egg-${which}-value`);
    const current = Number(await value.innerText());
    if (current === target) continue;
    // The steppers stay in place while the nest is redrawn, so the focus stays on the button.
    await page.getByTestId(`egg-${which}-${current < target ? 'more' : 'less'}`).focus();
    for (let step = 0; step < Math.abs(target - current); step++) {
      await page.keyboard.press('Enter');
    }
    await expect(value, `the ${which} stepper reads ${target}`).toHaveText(String(target));
  }
  await expect(page.getByTestId('egg-sentence')).toHaveText(
    rows === 1 ? `${rows} row of ${columns}` : `${rows} rows of ${columns}`,
  );
}

/**
 * The Egg Grid from the keyboard alone: the field of spots is a picture for pointing at
 * (`aria-hidden`), so each nest is built with the steppers and sent with Check. Only right nests:
 * the kind line for a wrong one is the touch test's.
 */
export async function playEggGridByKeyboard(page: Page): Promise<void> {
  await expect(page.getByTestId('egg-grid'), 'Egg Grid opens').toBeVisible();
  let nests = 0;
  for (let move = 0; move < 80 && !(await results(page).isVisible()); move++) {
    const before = await readEggBoard(page);
    if (before.over) break;
    const rows = Array.from({ length: before.maxSide }, (_, index) => index + 1).find((side) => {
      const columns = before.product / side;
      return (
        Number.isInteger(columns) &&
        columns <= before.maxSide &&
        !before.found.includes(rectangleText(side, columns))
      );
    });
    expect(
      rows,
      `an Egg Grid nest remains for ${before.product} (found ${before.found.join(', ')})`,
    ).toBeDefined();
    await stepEggNest(page, rows!, before.product / rows!);
    await press(page.getByTestId('egg-check'), 'keyboard');
    await waitForActivityMove(
      page,
      async () => {
        const after = await readEggBoard(page);
        return (
          after.over || after.product !== before.product || after.found.length > before.found.length
        );
      },
      'the Egg Grid takes the nest built with the steppers',
    );
    nests += 1;
  }
  expect(nests, 'the steppers built at least one nest').toBeGreaterThan(0);
  await expect(results(page), 'Egg Grid ends on its results').toBeVisible();
}

export async function playEggGridByTouch(page: Page): Promise<void> {
  await expect(page.getByTestId('egg-grid'), 'Egg Grid opens').toBeVisible();
  let provedKindFeedback = false;
  let provedCompletion = false;

  for (let move = 0; move < 80 && !(await results(page).isVisible()); move++) {
    const before = await readEggBoard(page);
    if (before.over) break;
    if (!provedKindFeedback) {
      const wrongRows = before.product === 1 ? 1 : 1;
      const wrongColumns = before.product === 1 ? 2 : 1;
      await tapEggNest(page, wrongRows, wrongColumns);
      await page.getByTestId('egg-check').tap();
      await expect(
        minigameStatus(page),
        'a wrong Egg Grid rectangle tells its total and the goal',
      ).toContainText(`We need ${before.product}.`);
      provedKindFeedback = true;
    }

    const rectangle = Array.from({ length: before.maxSide }, (_, index) => index + 1).find(
      (rows) => {
        const columns = before.product / rows;
        return (
          Number.isInteger(columns) &&
          columns >= 1 &&
          columns <= before.maxSide &&
          !before.found.includes(rectangleText(rows, columns))
        );
      },
    );
    expect(
      rectangle,
      `an Egg Grid rectangle remains for ${before.product} (found ${before.found.join(', ')})`,
    ).toBeDefined();
    const columns = before.product / rectangle!;
    await tapEggNest(page, rectangle!, columns);
    await page.getByTestId('egg-check').tap();
    await waitForActivityMove(
      page,
      async () => {
        const after = await readEggBoard(page);
        return (
          after.over || after.product !== before.product || after.found.length > before.found.length
        );
      },
      'the Egg Grid records the found rectangle or advances',
    );
    const after = await readEggBoard(page);
    if (!after.over && after.product !== before.product) provedCompletion = true;
  }

  expect(provedKindFeedback, 'Egg Grid gave kind feedback for a wrong rectangle').toBe(true);
  expect(provedCompletion, 'Egg Grid completed at least one board').toBe(true);
  await expect(results(page), 'Egg Grid ends on its results').toBeVisible();
}
