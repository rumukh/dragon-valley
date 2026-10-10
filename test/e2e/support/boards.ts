/**
 * Playing the v1 boards from what they show (docs/app.md §14): Sharing Feast deals the fruit the
 * question names and answers the division it shows; Golem Orders reads its expression and picks
 * the gear the school order of operations does next (the deepest brackets first, then · and :
 * before + and −, left to right), then types that step's result. Every move comes from the
 * rendered question, controls and board text, never from the game's state.
 */
import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';
import { results } from './app';

export type BoardVia = 'keyboard' | 'touch';

interface FeastProblem {
  readonly written: string;
  readonly total: number;
  readonly baskets: number;
  readonly quotient: number;
  readonly remainder: number;
  readonly asksRemainder: boolean;
}

interface GolemToken {
  readonly kind: 'number' | 'sign' | 'open' | 'close';
  readonly text: string;
  readonly testId: string | null;
}

interface GolemStep {
  readonly gear: string;
  readonly expression: string;
  readonly value: number;
}

export function minigameStatus(page: Page): Locator {
  return page.getByTestId('minigame-status');
}

async function writtenProblem(page: Page): Promise<string> {
  return page.getByTestId('problem').evaluate((line) =>
    [...line.querySelectorAll('.dv-problem__part > span')]
      .map((span) => span.textContent?.trim() || '?')
      .join(' ')
      .replace(/\( /g, '(')
      .replace(/ \)/g, ')'),
  );
}

export async function readFeastProblem(page: Page): Promise<FeastProblem> {
  const written = await writtenProblem(page);
  const match = /^(\d+) (:|÷) (\d+) = \?(?: (r|R) \?)?$/.exec(written);
  expect(match, `the Sharing Feast question is a rendered division: "${written}"`).not.toBeNull();
  const total = Number(match![1]);
  const baskets = Number(match![3]);
  const remainder = total % baskets;
  return {
    written,
    total,
    baskets,
    quotient: (total - remainder) / baskets,
    remainder,
    asksRemainder: match![4] !== undefined,
  };
}

async function pressButton(button: Locator, via: BoardVia): Promise<void> {
  if (via === 'touch') {
    await button.tap();
  } else {
    await button.focus();
    await button.page().keyboard.press('Enter');
  }
}

async function typeBoardNumber(
  page: Page,
  prefix: string,
  value: number,
  via: BoardVia,
): Promise<void> {
  const digits = String(value);
  if (via === 'touch') {
    for (const digit of digits) await page.getByTestId(`${prefix}-${digit}`).tap();
  } else {
    await page.keyboard.type(digits);
  }
}

async function submitFeastAnswer(
  page: Page,
  answer: Pick<FeastProblem, 'quotient' | 'remainder' | 'asksRemainder'>,
  via: BoardVia,
): Promise<void> {
  await typeBoardNumber(page, 'feast-keypad', answer.quotient, via);
  if (answer.asksRemainder) {
    if (via === 'touch') await page.getByTestId('feast-keypad-field-1').tap();
    else await page.keyboard.press('r');
    await typeBoardNumber(page, 'feast-keypad', answer.remainder, via);
  }
  if (via === 'touch') await page.getByTestId('feast-keypad-ok').tap();
  else await page.keyboard.press('Enter');
}

async function clearFeastAnswer(page: Page, via: BoardVia): Promise<void> {
  for (let press = 0; press < 8; press++) {
    if (via === 'touch') await page.getByTestId('feast-keypad-backspace').tap();
    else await page.keyboard.press('Backspace');
  }
}

/** Whether the activity is over: its results show, or the level's next round. */
async function activityEnded(page: Page): Promise<boolean> {
  return (await results(page).isVisible()) || (await page.getByTestId('screen-round').isVisible());
}

/** An attribute of an element that may be gone a moment later (null then). */
function attributeOf(element: Locator, name: string): Promise<string | null> {
  return element.getAttribute(name, { timeout: 1_000 }).catch(() => null);
}

/**
 * A completed board is followed by the next board (the progress counts it) or, after the last
 * one, by the end of the activity: wait for either, and say which.
 */
async function waitForBoardAdvance(page: Page, before: number): Promise<'next board' | 'ended'> {
  let outcome = 'waiting' as 'next board' | 'ended' | 'waiting';
  await expect
    .poll(
      async () => {
        if (await activityEnded(page)) outcome = 'ended';
        else {
          const now = await attributeOf(page.getByTestId('minigame-progress'), 'aria-valuenow');
          outcome = now !== null && Number(now) > before ? 'next board' : 'waiting';
        }
        return outcome;
      },
      {
        message: 'a completed board leads to the next board or ends the activity',
        timeout: 20_000,
      },
    )
    .not.toBe('waiting');
  return outcome === 'next board' ? 'next board' : 'ended';
}

export async function playSharingFeast(page: Page, via: BoardVia): Promise<void> {
  await expect(
    page.getByTestId('screen-minigame'),
    'the Sharing Feast activity opens as a minigame',
  ).toBeVisible();
  let provedKindFeedback = false;
  let provedCompletion = false;

  for (let board = 0; board < 10 && (await page.getByTestId('feast').isVisible()); board++) {
    const progress = Number(
      (await page.getByTestId('minigame-progress').getAttribute('aria-valuenow')) ?? '0',
    );
    const problem = await readFeastProblem(page);
    await expect(
      page.getByTestId('feast-goal'),
      'the Sharing Feast goal is visible on the board',
    ).toContainText(`${problem.total} fruit`);
    await expect(
      page.getByTestId('feast-question'),
      'the Sharing Feast prompt asks what the baskets show',
    ).toContainText(problem.asksRemainder ? 'left over' : 'each basket');

    if (!provedKindFeedback) {
      await submitFeastAnswer(page, { ...problem, quotient: problem.quotient + 1 }, via);
      await expect(
        minigameStatus(page),
        'a wrong Sharing Feast answer gets a kind correction instead of completing the board',
      ).toContainText('The bowl can still give every basket one more.');
      await clearFeastAnswer(page, via);
      provedKindFeedback = true;
    }

    for (let round = 0; round < problem.quotient; round++) {
      const expectedBowl = problem.total - (round + 1) * problem.baskets;
      await pressButton(page.getByTestId('feast-deal'), via);
      await expect(
        page.getByTestId('feast-bowl-count'),
        'dealing a round removes one fruit per basket from the bowl',
      ).toHaveText(`In the bowl: ${expectedBowl}`);
    }

    for (let index = 0; index < problem.baskets; index++) {
      await expect(
        page.getByTestId(`feast-basket-${index}`),
        `basket ${index + 1} shows the fair share before the answer is submitted`,
      ).toHaveAttribute('data-count', String(problem.quotient));
    }
    await expect(
      page.getByTestId('feast-bowl-count'),
      'the leftover fruit stays in the bowl before the answer',
    ).toHaveText(`In the bowl: ${problem.remainder}`);

    await submitFeastAnswer(page, problem, via);
    if ((await waitForBoardAdvance(page, progress)) === 'next board') {
      await expect(
        minigameStatus(page),
        'a completed Sharing Feast board cheers before the next board is played',
      ).toHaveText('Well done! Here is the next one.');
      provedCompletion = true;
    }
  }

  expect(provedKindFeedback, 'Sharing Feast gave kind feedback for a wrong step').toBe(true);
  expect(
    provedCompletion,
    'Sharing Feast completed at least one board and advanced the chain',
  ).toBe(true);
}

function opRank(op: string): 1 | 2 {
  return op === '·' || op === '×' || op === ':' || op === '÷' ? 2 : 1;
}

function calculate(left: number, op: string, right: number): number {
  if (op === '+') return left + right;
  if (op === '−' || op === '-') return left - right;
  if (op === '·' || op === '×') return left * right;
  if (right === 0 || left % right !== 0)
    throw new Error(`The rendered operation ${left} ${op} ${right} is not whole.`);
  return left / right;
}

async function readGolemTokens(page: Page): Promise<GolemToken[]> {
  return page.getByTestId('golem-orders').evaluate((orders) =>
    [...orders.children].map((child) => {
      const text = child.textContent?.trim() ?? '';
      const testId = child.getAttribute('data-testid');
      if (child.tagName === 'BUTTON') return { kind: 'sign' as const, text, testId };
      if (text === '(') return { kind: 'open' as const, text, testId };
      if (text === ')') return { kind: 'close' as const, text, testId };
      return { kind: 'number' as const, text, testId };
    }),
  );
}

function depthBefore(tokens: readonly GolemToken[]): number[] {
  let depth = 0;
  return tokens.map((token) => {
    if (token.kind === 'close') depth--;
    const current = depth;
    if (token.kind === 'open') depth++;
    return current;
  });
}

function primaryBounds(
  tokens: readonly GolemToken[],
  depths: readonly number[],
  at: number,
  direction: -1 | 1,
): [number, number] {
  const depth = depths[at]!;
  const index = at + direction;
  if (tokens[index]?.kind === 'number' && depths[index] === depth) return [index, index];
  if (direction < 0 && tokens[index]?.kind === 'close' && depths[index] === depth) {
    let open = index - 1;
    while (open >= 0 && !(tokens[open]?.kind === 'open' && depths[open] === depth)) open--;
    return [open, index];
  }
  if (direction > 0 && tokens[index]?.kind === 'open' && depths[index] === depth) {
    let close = index + 1;
    while (close < tokens.length && !(tokens[close]?.kind === 'close' && depths[close] === depth))
      close++;
    return [index, close];
  }
  throw new Error(`The rendered Golem operation at token ${at} does not have visible operands.`);
}

function evaluateTokens(tokens: readonly GolemToken[]): number {
  let at = 0;
  const depths = depthBefore(tokens);
  const sum = (): number => {
    let value = product();
    while (tokens[at]?.kind === 'sign' && opRank(tokens[at]!.text) === 1) {
      const op = tokens[at++]!.text;
      value = calculate(value, op, product());
    }
    return value;
  };
  const product = (): number => {
    let value = primary();
    while (tokens[at]?.kind === 'sign' && opRank(tokens[at]!.text) === 2) {
      const op = tokens[at++]!.text;
      value = calculate(value, op, primary());
    }
    return value;
  };
  const primary = (): number => {
    const token = tokens[at++];
    if (token?.kind === 'number') return Number(token.text);
    if (token?.kind === 'open') {
      const value = sum();
      if (tokens[at++]?.kind !== 'close')
        throw new Error('The rendered Golem expression has an unclosed bracket.');
      return value;
    }
    throw new Error(`Unexpected ${token?.kind ?? 'end'} in the rendered Golem expression.`);
  };
  const value = sum();
  if (at !== tokens.length || depths.length !== tokens.length) {
    throw new Error('The rendered Golem expression has trailing tokens.');
  }
  return value;
}

export function nextGolemStep(tokens: readonly GolemToken[]): GolemStep {
  const depths = depthBefore(tokens);
  const signIndexes = tokens
    .map((token, index) => ({ token, index, depth: depths[index]! }))
    .filter((item) => item.token.kind === 'sign' && item.token.testId !== null);
  expect(signIndexes.length, 'the Golem expression has at least one visible gear').toBeGreaterThan(
    0,
  );
  const deepest = Math.max(...signIndexes.map((item) => item.depth));
  const scope = signIndexes.filter((item) => item.depth === deepest);
  const strong = scope.find((item) => opRank(item.token.text) === 2);
  const chosen = strong ?? scope[0]!;
  const [leftStart, leftEnd] = primaryBounds(tokens, depths, chosen.index, -1);
  const [rightStart, rightEnd] = primaryBounds(tokens, depths, chosen.index, 1);
  const left = evaluateTokens(tokens.slice(leftStart, leftEnd + 1));
  const right = evaluateTokens(tokens.slice(rightStart, rightEnd + 1));
  const expression = tokens
    .slice(leftStart, rightEnd + 1)
    .map((token) => token.text)
    .join(' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')');
  return {
    gear: chosen.token.testId!,
    expression,
    value: calculate(left, chosen.token.text, right),
  };
}

async function submitGolemValue(page: Page, value: number, via: BoardVia): Promise<void> {
  await typeBoardNumber(page, 'golem-keypad', value, via);
  if (via === 'touch') await page.getByTestId('golem-keypad-ok').tap();
  else await page.keyboard.press('Enter');
}

export async function playGolemOrders(page: Page, via: BoardVia): Promise<void> {
  await expect(
    page.getByTestId('screen-minigame'),
    'the Golem Orders activity opens as a minigame',
  ).toBeVisible();
  let provedKindFeedback = false;
  let provedSolvedChain = false;

  for (let board = 0; board < 10 && (await page.getByTestId('golem').isVisible()); board++) {
    let progress = Number(
      (await page.getByTestId('minigame-progress').getAttribute('aria-valuenow')) ?? '0',
    );
    await expect(
      page.getByTestId('golem-ask'),
      'the Golem board asks which sign goes first',
    ).toContainText('sign');
    await expect(
      page.getByTestId('golem-orders'),
      'the Golem expression is rendered as visible orders',
    ).toBeVisible();

    if (!provedKindFeedback) {
      const tokens = await readGolemTokens(page);
      const right = nextGolemStep(tokens);
      const wrong = tokens.find(
        (token) => token.kind === 'sign' && token.testId && token.testId !== right.gear,
      );
      if (wrong?.testId) {
        await pressButton(page.getByTestId(wrong.testId), via);
        await expect(
          minigameStatus(page),
          'a Golem gear chosen out of order gets kind order-of-operations feedback',
        ).toContainText('Not yet! First brackets');
      } else {
        await pressButton(page.getByTestId(right.gear), via);
        await submitGolemValue(page, right.value + 1, via);
        await expect(
          minigameStatus(page),
          'a wrong Golem result gets kind arithmetic feedback',
        ).toContainText('Almost!');
      }
      provedKindFeedback = true;
    }

    for (let step = 0; step < 12 && (await page.getByTestId('golem').isVisible()); step++) {
      progress = Number(
        (await page.getByTestId('minigame-progress').getAttribute('aria-valuenow')) ?? '0',
      );
      const tokens = await readGolemTokens(page);
      const next = nextGolemStep(tokens);
      await pressButton(page.getByTestId(next.gear), via);
      await expect(
        page.getByTestId('golem-ask'),
        'after a gear is picked, Golem Orders asks for that visible operation result',
      ).toHaveText(`${next.expression} = ?`);
      await submitGolemValue(page, next.value, via);

      // A move is taken once it is saved; the gears read before then would be the old ones. The
      // board shows the step taken (no gear picked), the next board, or the end of the activity.
      await expect
        .poll(
          async () =>
            (await activityEnded(page)) ||
            (await attributeOf(page.getByTestId('golem-ask'), 'data-picked')) === 'false',
          {
            message: 'the Golem board takes a correct result before the next gear is picked',
            timeout: 20_000,
          },
        )
        .toBe(true);

      if (await page.getByTestId('golem').isVisible()) {
        const newProgress = Number(
          (await page.getByTestId('minigame-progress').getAttribute('aria-valuenow')) ?? '0',
        );
        if (newProgress > progress) {
          await expect(
            page.getByTestId('golem-solved'),
            "a finished Golem board's chain stays visible when the next board starts",
          ).toContainText('Done:');
          provedSolvedChain = true;
          break;
        }
        await expect(
          page.getByTestId('golem-trail'),
          'a correct Golem step leaves the written chain visible',
        ).toBeVisible();
      } else {
        break;
      }
    }
  }

  expect(provedKindFeedback, 'Golem Orders gave kind feedback for a wrong step').toBe(true);
  expect(provedSolvedChain, "Golem Orders kept a finished board's chain on show").toBe(true);
}

/** What a Bundle Sticks board asks, read from its goal line: the number to show at the end. */
interface SticksGoal {
  readonly task: 'build' | 'add' | 'sub';
  readonly a: number;
  readonly b: number;
  readonly target: number;
}

function readSticksGoal(text: string): SticksGoal | null {
  const build = /Make (\d+) with sticks/.exec(text);
  if (build) return { task: 'build', a: 0, b: Number(build[1]), target: Number(build[1]) };
  const calc = /Work out (\d+) (\+|−|-) (\d+) with sticks/.exec(text);
  if (!calc) return null;
  const a = Number(calc[1]);
  const b = Number(calc[3]);
  return calc[2] === '+'
    ? { task: 'add', a, b, target: a + b }
    : { task: 'sub', a, b, target: a - b };
}

/** The bundles and loose sticks on the table, as drawn. */
async function sticksOnTable(page: Page): Promise<{ bundles: number; loose: number }> {
  const count = async (testId: string) =>
    Number((await attributeOf(page.getByTestId(testId), 'data-count')) ?? 'NaN');
  return { bundles: await count('sticks-tens'), loose: await count('sticks-ones') };
}

/** Press a Bundle Sticks control and wait for the table to change. */
async function sticksMove(page: Page, testId: string, via: BoardVia): Promise<void> {
  const before = await sticksOnTable(page);
  const control = page.getByTestId(testId);
  await expect(control, `${testId} can be pressed`).toBeEnabled();
  await pressButton(control, via);
  await expect
    .poll(async () => JSON.stringify(await sticksOnTable(page)), {
      message: `${testId} changes the sticks on the table`,
    })
    .not.toBe(JSON.stringify(before));
}

/**
 * Bundle Sticks, played from the goal line and the sticks on the table: add or take away the
 * tens, then the ones, untying a ten when there are too few ones to take away and tying ten loose
 * sticks into a bundle; then Check. The first board is checked once too early, which only says
 * "not quite yet" and leaves the sticks where they are.
 */
export async function playBundleSticks(page: Page, via: BoardVia): Promise<void> {
  await expect(
    page.getByTestId('screen-minigame'),
    'Bundle Sticks opens as a minigame',
  ).toBeVisible();
  let provedNotYet = false;
  for (let board = 0; board < 12 && (await page.getByTestId('sticks').isVisible()); board++) {
    const progress = Number(
      (await attributeOf(page.getByTestId('minigame-progress'), 'aria-valuenow')) ?? '0',
    );
    let goal: SticksGoal | null = null;
    await expect
      .poll(async () => (goal = readSticksGoal((await minigameStatus(page).textContent()) ?? '')), {
        message: 'the board says what to make',
      })
      .not.toBeNull();
    const { task, b, target } = goal!;
    const start = await sticksOnTable(page);
    expect(
      start.bundles * 10 + start.loose,
      'add and take-away boards start from the first number',
    ).toBe(task === 'build' ? 0 : goal!.a);

    if (!provedNotYet && start.bundles * 10 + start.loose !== target) {
      await pressButton(page.getByTestId('sticks-check'), via);
      await expect(minigameStatus(page), 'checking too early is only "not yet"').toContainText(
        'Not quite yet',
      );
      expect(await sticksOnTable(page), 'and leaves the sticks as they were').toEqual(start);
      provedNotYet = true;
    }

    // As the sum is worked: the tens of b, then its ones.
    const tens = Math.floor(b / 10);
    const ones = b % 10;
    if (task === 'sub') {
      for (let i = 0; i < tens; i++) await sticksMove(page, 'sticks-remove-bundle', via);
      if ((await sticksOnTable(page)).loose < ones) {
        await sticksMove(page, 'sticks-untie', via);
      }
      for (let i = 0; i < ones; i++) await sticksMove(page, 'sticks-remove-stick', via);
    } else {
      for (let i = 0; i < tens; i++) await sticksMove(page, 'sticks-add-bundle', via);
      for (let i = 0; i < ones; i++) {
        await sticksMove(page, 'sticks-add-stick', via);
        if ((await sticksOnTable(page)).loose === 10 && (await sticksOnTable(page)).bundles < 10) {
          await sticksMove(page, 'sticks-tie', via);
        }
      }
    }
    const end = await sticksOnTable(page);
    expect(end.bundles * 10 + end.loose, 'the table shows the answer').toBe(target);
    expect(end.loose, 'as tens and ones').toBeLessThan(10);
    await pressButton(page.getByTestId('sticks-check'), via);
    if ((await waitForBoardAdvance(page, progress)) === 'ended') break;
  }
  await expect(
    results(page).or(page.getByTestId('screen-round')),
    'Bundle Sticks ends in its results or the next round of the lesson',
  ).toBeVisible();
}
