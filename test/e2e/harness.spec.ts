/**
 * The harness proves itself (docs/testing.md §2.4, "mutation-check"): each guard, the
 * accessibility audit, the layout checks, the focus check, the blank-screen watch and the answer
 * oracle is shown a planted fault and must report it. A check that cannot see a console message,
 * a foreign request, a nameless button, a cut-off control, a ring nobody can see or a screen with
 * nothing on it would let every other spec pass vacuously. The CI matrix is checked too: every
 * part of the suite on every engine.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test as base } from '@playwright/test';
import { expect, test } from './support/fixtures';
import type { FindingKind, Guard } from './support/guard';
import { boot, leaveResults, newFamily, startPlacement, throughHatches } from './support/app';
import { audit, focusPixels, focusStop, SEEN_PIXELS } from './support/a11y';
import { blankReport, markBlankWatch, resetBlankWatch, watchBlankScreens } from './support/blank';
import { layoutProblems } from './support/layout';
import { PARTS } from './support/parts';
import { evaluate, notationOf, solve, storyOperation, toToken, written } from './support/problem';
import type { Token } from './support/problem';

function seen(guard: Guard, kind: FindingKind, pattern: RegExp): boolean {
  return guard.all().some((finding) => finding.kind === kind && pattern.test(finding.detail));
}

async function expectSeen(guard: Guard, kind: FindingKind, pattern: RegExp): Promise<void> {
  await expect
    .poll(() => seen(guard, kind, pattern), { message: `the guard saw a ${kind} ${pattern}` })
    .toBe(true);
  guard.allow(kind, pattern, 'provoked on purpose by the guard self-test');
}

async function inGame(page: Page, work: () => void): Promise<void> {
  await page.evaluate(work);
}

test.describe('the guard sees every kind of finding', () => {
  test('console messages of every level, from the game page', async ({ page, guard }) => {
    await boot(page);
    await inGame(page, () => {
      console.info('qa-info');
      console.warn('qa-warning');
      console.error('qa-error');
    });
    await expectSeen(guard, 'console', /^info: qa-info/);
    await expectSeen(guard, 'console', /^warning: qa-warning/);
    await expectSeen(guard, 'console', /^error: qa-error/);
  });

  test('outbound links, embeds, window.open and beacons, as they are added', async ({
    page,
    guard,
  }) => {
    await boot(page);
    await inGame(page, () => {
      const link = document.createElement('a');
      link.href = 'https://example.com/qa-outbound';
      document.body.append(link);
      const mail = document.createElement('a');
      document.body.append(mail);
      mail.setAttribute('href', 'mailto:qa@example.com');
      const frame = document.createElement('iframe');
      document.body.append(frame);
      window.open('https://example.com/qa-popup');
      navigator.sendBeacon('./qa-beacon');
    });
    await expectSeen(guard, 'outbound', /<a href="https:\/\/example\.com\/qa-outbound">/);
    await expectSeen(guard, 'outbound', /<a href="mailto:qa@example\.com">/);
    await expectSeen(guard, 'outbound', /<iframe> embed/);
    await expectSeen(guard, 'window-open', /qa-popup/);
    await expectSeen(guard, 'network-api', /sendBeacon .*qa-beacon/);
  });

  test('a CSP violation and a 404 on the game page', async ({ page, guard }) => {
    await boot(page);
    await inGame(page, () => {
      const image = new Image();
      image.src = 'https://example.com/qa-blocked.png';
      document.body.append(image);
      void fetch('./qa-missing.json').catch(() => undefined);
    });
    await expectSeen(guard, 'csp', /img-src blocked https:\/\/example\.com\/qa-blocked\.png/);
    await expectSeen(guard, 'outbound', /qa-blocked\.png/);
    await expectSeen(guard, 'failed-request', /qa-missing\.json \(404\)/);
    // Engines also log the refusal and the 404 to the console, and Chromium reports the refused
    // image as a request to another origin that failed with "csp".
    const provoked = 'provoked on purpose above';
    guard.allow('console', /qa-blocked\.png|qa-missing\.json|404/, provoked);
    guard.allow('foreign-request', /qa-blocked\.png/, provoked);
    guard.allow('failed-request', /qa-blocked\.png|qa-missing\.json/, provoked);
  });

  test('a request to another origin', async ({ page, guard }) => {
    // The game's CSP stops cross-origin requests before they start, so this uses a page
    // without it; the request is answered locally and never reaches a network.
    await page.context().route('http://qa-foreign.test/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg"/>',
      }),
    );
    await page.setContent('<img src="http://qa-foreign.test/qa-foreign.svg">');
    await expectSeen(guard, 'foreign-request', /GET http:\/\/qa-foreign\.test\/qa-foreign\.svg/);
  });
});

test.describe('the accessibility audit and the layout checks see planted faults', () => {
  test('a nameless button is a serious violation', async ({ page }, testInfo) => {
    await boot(page);
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.setAttribute('data-testid', 'qa-nameless');
      document.querySelector('main')?.append(button);
    });
    const outcome = await audit(page, testInfo, 'planted nameless button');
    expect(outcome.blocking.some((line) => line.startsWith('button-name (critical)'))).toBe(true);
  });

  test('a small control, sideways scrolling and a broken word are reported', async ({ page }) => {
    await newFamily(page, { name: 'Ada' });
    await startPlacement(page);
    await page.evaluate(() => {
      const main = document.querySelector('main')!;
      const small = document.createElement('button');
      small.textContent = 'x';
      small.setAttribute('data-testid', 'qa-small');
      small.style.cssText = 'min-height:0;min-width:0;width:30px;height:30px;padding:0';
      const wide = document.createElement('div');
      wide.style.cssText = 'width:3000px;height:4px';
      const narrow = document.createElement('p');
      narrow.setAttribute('data-testid', 'qa-narrow');
      narrow.style.cssText = 'width:2.5em;overflow-wrap:anywhere';
      narrow.textContent = 'Multiplication';
      main.append(small, wide, narrow);
    });
    const problems = await layoutProblems(page);
    expect(problems).toContainEqual(
      expect.stringMatching(/^<button qa-small> "x" is 30×30px, under 48px$/),
    );
    expect(problems).toContainEqual(expect.stringMatching(/^the page scrolls sideways/));
    expect(problems).toContainEqual(
      expect.stringMatching(/^the word "Multiplication" breaks as "Mul.* \/ .*" in <p qa-narrow>/),
    );
  });
});

test.describe('the blank-screen watch sees a screen with nothing to see', () => {
  type Blank = 'faded' | 'no words' | 'no screen';
  /** In the page: make the screen blank for a second the planted way, then put it back. */
  const plant = (how: Blank): Promise<void> =>
    new Promise<void>((done) => {
      const stage = document.querySelector('[data-testid="stage"]')!;
      const screen = stage.querySelector(':scope > .dv-screen')!;
      const style = document.createElement('style');
      style.textContent =
        how === 'faded'
          ? '.dv-screen { opacity: 0.1 !important; }'
          : '.dv-screen * { visibility: hidden !important; }';
      if (how === 'no screen') screen.remove();
      else document.head.append(style);
      setTimeout(() => {
        if (how === 'no screen') stage.append(screen);
        else style.remove();
        // Two frames, so the watch has seen the screen come back.
        requestAnimationFrame(() => requestAnimationFrame(() => done()));
      }, 1_000);
    });

  test('a faded screen, a screen whose words are hidden and an empty stage are blank runs; the hub as drawn is not', async ({
    page,
  }) => {
    await watchBlankScreens(page);
    await newFamily(page, { name: 'Ada' });
    await resetBlankWatch(page);
    // Headless WebKit on Windows draws a page at rest only a few times a second.
    await expect
      .poll(async () => (await blankReport(page)).frames, {
        message: 'the watch runs',
        timeout: 20_000,
      })
      .toBeGreaterThan(5);
    expect((await blankReport(page)).runs, 'the hub as the game draws it is never blank').toEqual(
      [],
    );
    for (const how of ['faded', 'no words', 'no screen'] as const) {
      await markBlankWatch(page, how);
      await page.evaluate(plant, how);
      const run = (await blankReport(page)).runs.find((candidate) => candidate.label === how);
      expect(run?.why, `a ${how} plant is seen for what it is`).toBe(how);
      expect(run!.durationMs, `the ${how} run lasts about its second`).toBeGreaterThan(300);
    }
  });
});

test.describe('waiting for results, the helpers fail at once when they find the hub', () => {
  test('throughHatches and leaveResults say what the hub says, within seconds', async ({
    page,
  }) => {
    await newFamily(page, { name: 'Ada' });
    for (const [name, wait] of [
      ['throughHatches', () => throughHatches(page)],
      ['leaveResults', () => leaveResults(page, 'Ada')],
    ] as const) {
      const started = Date.now();
      await expect(wait(), `${name} on the hub`).rejects.toThrow(
        /^Expected the results, but the hub is showing \(Daily Adventure "Show the dragons what you know!"/,
      );
      expect(Date.now() - started, `${name} fails at once, not at the test's timeout`).toBeLessThan(
        5_000,
      );
    }
  });
});

test.describe('the focus check sees rings by their pixels', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a drawn ring is seen; a removed or covered one is not, even when the next stop scrolls', async ({
    page,
  }) => {
    await boot(page);
    await page.evaluate(() => {
      const button = (id: string, style = ''): HTMLButtonElement => {
        const node = document.createElement('button');
        node.textContent = id;
        node.setAttribute('data-testid', id);
        node.style.cssText = style;
        return node;
      };
      const room = (): HTMLDivElement => {
        const node = document.createElement('div');
        node.style.height = '2000px';
        return node;
      };
      // Art over a control: its ring is drawn, then painted over.
      const covered = document.createElement('div');
      covered.style.cssText = 'position:relative;display:inline-block';
      const art = document.createElement('div');
      art.style.cssText = 'position:absolute;inset:-24px;background:#fff';
      covered.append(button('qa-covered'), art);
      document
        .querySelector('main')
        ?.append(
          button('qa-start'),
          button('qa-ring'),
          button('qa-no-ring', 'outline:none !important;box-shadow:none !important'),
          room(),
          covered,
          room(),
          button('qa-end'),
        );
    });
    await page.getByTestId('qa-start').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('qa-ring')).toBeFocused();
    expect(
      await focusPixels(page, () => page.keyboard.press('Tab')),
      'the ring the game draws is seen',
    ).toBeGreaterThanOrEqual(SEEN_PIXELS);
    await expect(page.getByTestId('qa-no-ring')).toBeFocused();
    expect(
      await focusPixels(page, () => page.keyboard.press('Tab')),
      'a ring a rule takes away is not seen, though Tab scrolled the page to the next stop',
    ).toBeLessThan(SEEN_PIXELS);
    await expect(page.getByTestId('qa-covered')).toBeFocused();
    expect((await focusStop(page)).ring, 'its computed style still promises a ring').toBe(true);
    expect(
      await focusPixels(page, () => page.keyboard.press('Tab')),
      'a ring under art is not seen',
    ).toBeLessThan(SEEN_PIXELS);
  });
});

base.describe('the answer oracle works the written problem out by itself', () => {
  const tokens = (text: string): Token[] =>
    text
      .split(' ')
      .map((part) =>
        toToken(
          part === '?'
            ? { className: 'dv-problem__blank', text: '?' }
            : /^\d+$/.test(part)
              ? { className: 'dv-problem__number', text: part }
              : part === '(' || part === ')'
                ? { className: 'dv-problem__bracket', text: part }
                : { className: 'dv-problem__sign', text: part },
        ),
      );

  base('in Czech and international notation, for every problem form', () => {
    const cases: [string, unknown, 'czech' | 'international' | null][] = [
      ['2 · 4 = ?', { kind: 'number', value: 8 }, 'czech'],
      ['2 × 4 = ?', { kind: 'number', value: 8 }, 'international'],
      ['56 : 7 = ?', { kind: 'number', value: 8 }, 'czech'],
      ['56 ÷ 7 = ?', { kind: 'number', value: 8 }, 'international'],
      ['? · 6 = 42', { kind: 'number', value: 7 }, 'czech'],
      ['48 : ? = 6', { kind: 'number', value: 8 }, 'czech'],
      ['23 : 5 = ? r ?', { kind: 'remainder', quotient: 4, remainder: 3 }, 'czech'],
      ['23 ÷ 5 = ? R ?', { kind: 'remainder', quotient: 4, remainder: 3 }, 'international'],
      ['( 3 + 4 ) · 2 = ?', { kind: 'number', value: 14 }, 'czech'],
      ['3 + 4 · 2 = ?', { kind: 'number', value: 11 }, 'czech'],
      ['100 − 4 · 9 = ?', { kind: 'number', value: 64 }, 'czech'],
      ['30 + 12 = ?', { kind: 'number', value: 42 }, null],
    ];
    for (const [text, answer, notation] of cases) {
      const parsed = tokens(text);
      expect(solve(parsed), text).toEqual(answer);
      expect(notationOf(parsed), text).toBe(notation);
      expect(written(parsed), text).toBe(text.replace('( ', '(').replace(' )', ')'));
    }
    expect(evaluate(tokens('7 : 2'), 0), 'division must come out whole').toBeNaN();
    expect(() => solve(tokens('2 · 4'))).toThrow('no equals sign');
  });

  base("comparisons, term questions and a story's sign", () => {
    // `*` marks the number a term question asks about; `○` is a story's empty sign slot.
    const marked = (text: string): Token[] =>
      text.split(' ').map((part) =>
        part.startsWith('*')
          ? toToken({
              className: 'dv-problem__number dv-problem__number--asked',
              text: part.slice(1),
            })
          : part === '○'
            ? toToken({ className: 'dv-problem__slot', text: '' })
            : tokens(part)[0]!,
      );
    const relations: [string, string][] = [
      ['3 · 4 ? 2 · 6', 'eq'],
      ['8 · ( 6 + 4 ) ? 8 · 6 + 4', 'gt'],
      ['2 · 4 + 5 ? 2 · ( 4 + 5 )', 'lt'],
      ['56 ? 7 · 8', 'eq'],
    ];
    for (const [text, relation] of relations) {
      expect(solve(tokens(text)), text).toEqual({ kind: 'relation', relation });
    }
    const terms: [string, string][] = [
      ['*7 · 8 = 56', 'factor'],
      ['7 · *8 = 56', 'factor'],
      ['7 · 8 = *56', 'product'],
      ['*56 : 7 = 8', 'dividend'],
      ['56 : *7 = 8', 'divisor'],
      ['56 : 7 = *8', 'quotient'],
      ['35 : 9 = 3 r *8', 'remainder'],
    ];
    for (const [text, term] of terms) {
      expect(solve(marked(text)), text).toEqual({ kind: 'term', term });
    }
    expect(() => solve(marked('8 ○ 2 = ?')), 'numbers alone cannot tell a sign').toThrow(
      'only the story tells',
    );
    const stories: [string, string][] = [
      ['There are 6 bikes at school. Each bike has 2 wheels. How many wheels are there?', 'mul'],
      ['Anna has 24 apples. She puts 6 in each bag. How many bags does she fill?', 'div'],
      ['Anna has 9 plums. Tom has 3 fewer. How many does Tom have?', 'sub'],
    ];
    for (const [story, operation] of stories) expect(storyOperation(story), story).toBe(operation);
    expect(
      () =>
        storyOperation(
          'Anna plants 3 rows of carrots. Each row has 4 carrots. Then Anna plants 5 more carrots. How many carrots are there?',
        ),
      'a two-step story asks no sign',
    ).toThrow('do not name one operation');
    expect(() => storyOperation('A dragon sneezes.'), 'an unknown story').toThrow(
      'No word-problem template',
    );
  });
});

// Each CI job audits only its own parts, so a part left out of every job of an engine would go
// unnoticed: the matrix itself must run each part exactly once per engine.
base('the CI matrix runs every part of the suite once on every engine', () => {
  const workflow = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.github', 'workflows', 'ci.yml'),
    'utf8',
  );
  // Matrix entries are YAML flow mappings, `- { engine: …, label: …, part: '…' }`, on one line or
  // wrapped by Prettier over several.
  const entries = [...workflow.matchAll(/-\s*\{([^}]*)\}/g)].map(
    ([, body]) =>
      Object.fromEntries(
        [...(body ?? '').matchAll(/(\w+):\s*(?:'([^']*)'|([^,\s}]+))/g)].map(
          ([, key, quoted, plain]) => [key, quoted ?? plain],
        ),
      ) as Record<string, string | undefined>,
  );
  const jobs = entries
    .filter((entry) => entry['engine'] !== undefined)
    .map((entry) => ({
      engine: entry['engine'],
      label: entry['label'],
      parts: (entry['part'] ?? '').split(','),
    }));
  expect(jobs.length, 'the e2e matrix in ci.yml').toBeGreaterThan(0);
  const engines = ['chromium', 'firefox', 'webkit'];
  expect([...new Set(jobs.map((job) => job.engine))].sort()).toEqual(engines);
  for (const engine of engines) {
    const parts = jobs.filter((job) => job.engine === engine).flatMap((job) => job.parts);
    expect(parts.sort(), `the parts ${engine} runs`).toEqual([...PARTS].sort());
  }
  const names = jobs.map((job) => `${job.engine}-${job.label}`);
  expect(new Set(names).size, 'every job names its artifacts uniquely').toBe(names.length);
});
