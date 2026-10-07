/**
 * What the suite knows is wrong, and tolerates on purpose.
 *
 * - KNOWN_ISSUES: guard findings that are not the game's doing (engine noise), by engine.
 * - DEFECTS: product defects found by this suite and routed to their owner through the
 *   coordinator (docs/qa/defects.md). A test states the behaviour it wants and wraps that one
 *   assertion in `unlessKnown(...)`: while the defect reproduces, the test records it as an
 *   annotation and carries on; once the fix lands the assertion simply passes and the report says
 *   the marker can go. Nothing here hides a failure that is not listed.
 *
 * Accessibility findings that are tracked defects live in `a11y.ts` (KNOWN_AXE).
 */
import type { TestInfo } from '@playwright/test';
import type { FindingKind } from './guard';

export type Engine = 'chromium' | 'firefox' | 'webkit';

export interface KnownIssue {
  readonly id: string;
  readonly engines: readonly Engine[];
  readonly kind: FindingKind;
  readonly pattern: RegExp;
  readonly reason: string;
}

export const KNOWN_ISSUES: readonly KnownIssue[] = [];

export function knownIssuesFor(browserName: string): KnownIssue[] {
  return KNOWN_ISSUES.filter((issue) => (issue.engines as readonly string[]).includes(browserName));
}

export type Owner = 'S2a' | 'S2b' | 'S3' | 'S4' | 'S5' | 'SDK';
export type Severity = 'blocker' | 'major' | 'minor';

export interface Defect {
  readonly owner: Owner;
  readonly severity: Severity;
  readonly title: string;
  /** Only these engines show it; on the others its assertions stay strict. */
  readonly engines?: readonly Engine[];
  /**
   * It shows only under some timings (everywhere, or on these engines), so a passing check there
   * is not taken for a fix.
   */
  readonly intermittent?: boolean | readonly Engine[];
}

/**
 * Open defects. Fixed ones leave this list once their fix is verified on every engine (their
 * write-ups and the PR that fixed them are in docs/qa/defects.md); the assertions that pinned
 * them stay in the specs as plain regression checks.
 */
export const DEFECTS = {
  'DV-QA-13': {
    owner: 'S3',
    severity: 'minor',
    engines: ['webkit', 'chromium'],
    intermittent: ['chromium'],
    title:
      "A keeper's hub at 200 % text can first appear at normal size. In WebKit always: the greeting is drawn at 43 px, not 86 px, for 140-435 ms (6 of 6 openings), and the root still reports 24 px in 2 of 6; #19's data-text-scale (no rule reads it) did not change this. In Chromium sometimes: on CI the root was still 24 px as the hub appeared in 2 of 4 runs. Firefox has been right at once.",
  },
  'DV-QA-15': {
    owner: 'S3',
    severity: 'minor',
    engines: ['webkit'],
    title:
      "In WebKit (Safari) the keeper pictures lose their focus ring once an arrow key moves the choice: WebKit does not match :focus-visible on a radio focused by an arrow key (a plain page does the same), and the ring is drawn only for :focus-visible. The moving 'chosen' ring still marks the picture.",
  },
  'DV-QA-17': {
    owner: 'S3',
    severity: 'major',
    title:
      "Memory Match's term cards do not show which number of the example is meant. The rules pair a term with an example whose number of that term is highlighted ('which is 42 in 6 · 7 = 42?'), but the card shows the example as plain text ('30 : 6 = 5') and reads it without the highlight, so a child can only guess whether it pairs with the dividend, the divisor or the quotient (Riddle Ruins 4).",
  },
} as const satisfies Record<string, Defect>;

export type DefectId = keyof typeof DEFECTS;

export interface KnownLayout {
  readonly defect: DefectId;
  /** Where the problem shows: matched against "<stop or state> (<viewport>)". */
  readonly where: RegExp;
  /** The problem line from support/layout.ts. */
  readonly problem: RegExp;
}

export const KNOWN_LAYOUT: readonly KnownLayout[] = [];

/** The engine a test runs on: its project's browser (Edge and Chrome channels are Chromium). */
export function engineOf(testInfo: TestInfo): string {
  const use = testInfo.project.use;
  return use.browserName ?? use.defaultBrowserType ?? 'chromium';
}

/** Whether `id` can show on this test's engine (an engine-specific defect stays strict elsewhere). */
export function defectApplies(testInfo: TestInfo, id: DefectId): boolean {
  const engines: readonly string[] | undefined = (DEFECTS[id] as Defect).engines;
  return engines === undefined || engines.includes(engineOf(testInfo));
}

/** Whether a defect shows only under some timings on this test's engine. */
function intermittentHere(testInfo: TestInfo, defect: Defect): boolean {
  const { intermittent } = defect;
  return typeof intermittent === 'object'
    ? (intermittent as readonly string[]).includes(engineOf(testInfo))
    : intermittent === true;
}

/** Split layout problems into unknown ones (failures) and known defects (annotated). */
export function knownLayout(
  testInfo: TestInfo,
  where: string,
  problems: readonly string[],
): string[] {
  const unknown: string[] = [];
  for (const problem of problems) {
    const known = KNOWN_LAYOUT.find(
      (entry) =>
        entry.where.test(where) &&
        entry.problem.test(problem) &&
        defectApplies(testInfo, entry.defect),
    );
    if (!known) {
      unknown.push(problem);
      continue;
    }
    const defect: Defect = DEFECTS[known.defect];
    testInfo.annotations.push({
      type: 'known defect',
      description: `${known.defect} (${defect.severity}, ${defect.owner}) on ${where}: ${problem}`,
    });
  }
  return unknown;
}

/**
 * Run `assertion` (the behaviour the game should have). If it fails and `id` is a listed
 * defect, record that the defect still reproduces instead of failing; if it passes, record
 * that the marker can be removed. A defect listed for some engines only fails as usual on the
 * others.
 */
export async function unlessKnown(
  testInfo: TestInfo,
  id: DefectId,
  assertion: () => Promise<void>,
): Promise<void> {
  const defect: Defect = DEFECTS[id];
  if (!defectApplies(testInfo, id)) {
    await assertion();
    return;
  }
  try {
    await assertion();
    testInfo.annotations.push(
      intermittentHere(testInfo, defect)
        ? {
            type: 'defect not seen this time',
            description: `${id} did not show in this run (it shows only under some timings): ${defect.title}`,
          }
        : {
            type: 'defect fixed?',
            description: `${id} did not reproduce; remove its marker if it is fixed: ${defect.title}`,
          },
    );
  } catch {
    testInfo.annotations.push({
      type: 'known defect',
      description: `${id} (${defect.severity}, ${defect.owner}): ${defect.title}`,
    });
  }
}
