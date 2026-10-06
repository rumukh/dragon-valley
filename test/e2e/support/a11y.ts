/**
 * Accessibility checks: axe-core (WCAG 2.2 A/AA and best practice) on the page as it is, and
 * what a keyboard user experiences (where focus goes, whether it can be seen, whether a dialog
 * keeps it and gives it back).
 *
 * Serious and critical axe violations fail the test. Moderate and minor ones are attached to
 * the report as advice (docs/qa/accessibility.md collects them for the release review).
 * A violation that is a tracked defect owned by another session is listed in KNOWN_AXE with
 * its defect ID (support/known-issues.ts): it is reported as a known defect instead of failing,
 * on the engines the defect lists. Remove the entry when the fix lands.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { expect } from './fixtures';
import { DEFECTS, defectApplies, engineOf } from './known-issues';
import type { Defect, DefectId } from './known-issues';

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

export interface KnownAxe {
  readonly defect: DefectId;
  /** The axe rule id. */
  readonly rule: string;
  /** Matched against the node's axe target (a CSS selector). */
  readonly target: RegExp;
}

export const KNOWN_AXE: readonly KnownAxe[] = [
  { defect: 'DV-QA-14', rule: 'scrollable-region-focusable', target: /\.dv-results__celebrations/ },
];

export interface AxeOutcome {
  /** Serious or critical violations that are not known defects: each must be fixed. */
  readonly blocking: string[];
  /** Moderate or minor violations (tracked defects are annotated as known defects instead). */
  readonly advisory: string[];
}

/** Run axe on the page and attach the full result as `axe-<state>.json`. */
export async function audit(page: Page, testInfo: TestInfo, state: string): Promise<AxeOutcome> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const engine = engineOf(testInfo);
  const blocking: string[] = [];
  const advisory: string[] = [];
  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      const target = node.target.map(String).join(' ');
      const line = `${violation.id} (${violation.impact ?? 'unknown'}) at ${target}: ${violation.help}`;
      const known = KNOWN_AXE.find(
        (entry) =>
          entry.rule === violation.id &&
          entry.target.test(target) &&
          defectApplies(testInfo, entry.defect),
      );
      if (known) {
        const defect: Defect = DEFECTS[known.defect];
        testInfo.annotations.push({
          type: 'known defect',
          description: `${known.defect} (${defect.severity}, ${defect.owner}) on ${state}: ${line}`,
        });
      } else if (violation.impact === 'serious' || violation.impact === 'critical') {
        blocking.push(line);
      } else advisory.push(line);
    }
  }
  await testInfo.attach(`axe-${state}.json`, {
    contentType: 'application/json',
    body: JSON.stringify(
      {
        state,
        url: results.url,
        engine,
        violations: results.violations,
        incomplete: results.incomplete.map((item) => ({
          id: item.id,
          impact: item.impact,
          help: item.help,
          nodes: item.nodes.map((node) => node.target.map(String).join(' ')),
        })),
        passes: results.passes.length,
      },
      null,
      2,
    ),
  });
  for (const line of advisory) {
    testInfo.annotations.push({ type: 'axe advisory', description: `${state}: ${line}` });
  }
  return { blocking, advisory };
}

/** Fail softly (the walk goes on to the next screen) on serious or critical violations. */
export async function expectAccessible(
  page: Page,
  testInfo: TestInfo,
  state: string,
): Promise<void> {
  const outcome = await audit(page, testInfo, state);
  expect
    .soft(outcome.blocking, `serious or critical accessibility violations on ${state}`)
    .toEqual([]);
}

// ---- Keyboard ------------------------------------------------------------------------------

export interface FocusStop {
  /** The focused element's test ID, or the nearest one around it. */
  readonly id: string | null;
  readonly tag: string;
  readonly name: string;
  /** A visible focus indicator: an outline or ring on the element or its label. */
  readonly ring: boolean;
  /** The focus indicator's box is inside the viewport. */
  readonly onScreen: boolean;
  readonly inDialog: boolean;
  /** Focus is on the page itself (body), as when it moves to the browser's own controls. */
  readonly page: boolean;
}

export async function focusStop(page: Page): Promise<FocusStop> {
  return page.evaluate(() => {
    const element = document.activeElement;
    // Focus that left the page (to the browser's own controls) shows as the body in Chromium
    // and WebKit, and as a page without focus in Firefox.
    if (!(element instanceof HTMLElement) || element === document.body || !document.hasFocus()) {
      return {
        id: null,
        tag: 'body',
        name: '',
        ring: false,
        onScreen: false,
        inDialog: false,
        page: true,
      };
    }
    const hasRing = (style: CSSStyleDeclaration): boolean =>
      (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
      (style.boxShadow !== '' && style.boxShadow !== 'none');
    // A visually hidden radio or checkbox shows its focus on the label around it.
    const label = element.closest('label');
    const tiny = element.getBoundingClientRect().width <= 2;
    const indicator = tiny && label ? label : element;
    const ring =
      element.matches(':focus-visible') &&
      (hasRing(getComputedStyle(element)) || (label !== null && hasRing(getComputedStyle(label))));
    const box = indicator.getBoundingClientRect();
    const onScreen =
      box.width > 0 &&
      box.height > 0 &&
      box.right > 0 &&
      box.bottom > 0 &&
      box.left < innerWidth &&
      box.top < innerHeight;
    const holder = element.closest('[data-testid]');
    return {
      id: element.getAttribute('data-testid') ?? holder?.getAttribute('data-testid') ?? null,
      tag: element.localName,
      name: (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 60),
      ring,
      onScreen,
      inDialog: element.closest('dialog[open]') !== null,
      page: false,
    };
  });
}

/**
 * Press Tab (or Shift+Tab) `count` times and return where focus went after each press.
 * Focus leaving to the page itself (the browser's own controls in a real window) is recorded
 * as a `page` stop.
 */
export async function tabStops(page: Page, count: number, backwards = false): Promise<FocusStop[]> {
  const stops: FocusStop[] = [];
  for (let step = 0; step < count; step++) {
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
    stops.push(await focusStop(page));
  }
  return stops;
}

/**
 * Press Tab (or Shift+Tab) from where focus is now until focus leaves the page (the end of the
 * document) or comes back to a control already visited; the controls in the order reached.
 * Passes in both directions from a screen's first focus cover the whole screen without relying
 * on how each engine wraps around through its own controls.
 */
export async function tabPass(page: Page, backwards = false, limit = 40): Promise<FocusStop[]> {
  const start = await focusStop(page);
  const stops: FocusStop[] = [];
  const same = (a: FocusStop, b: FocusStop): boolean => a.id === b.id && a.tag === b.tag;
  for (let step = 0; step < limit; step++) {
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
    const stop = await focusStop(page);
    if (stop.page) {
      // Focus went to the browser's own controls; take the window back for what follows.
      await page.bringToFront();
      break;
    }
    if (same(stop, start) || stops.some((seen) => same(seen, stop))) break;
    stops.push(stop);
  }
  return stops;
}

export function ids(stops: readonly FocusStop[]): (string | null)[] {
  return stops.filter((stop) => !stop.page).map((stop) => stop.id);
}
