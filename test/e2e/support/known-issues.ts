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
}

export const DEFECTS = {
  'DV-QA-01': {
    owner: 'S3',
    severity: 'minor',
    title:
      'After a failed save, Retry stores the held answer but the round never says so: it keeps the old problem with "Saving stopped. Tap Retry at the top.", no "Yes!", the purse stays behind, and the next OK silently moves on.',
  },
  'DV-QA-02': {
    owner: 'S3',
    severity: 'minor',
    title:
      'Coin messages say "1 coins" ("You got 1 coins!", "1 coins"): the catalog has no singular.',
  },
  'DV-QA-04': {
    owner: 'S3',
    severity: 'minor',
    title:
      'The Retry button in the "Not saved" pill is 40 px tall (.dv-save .dv-button min-height: calc(var(--dv-target) - 8px)), under the 48 px child-safe target.',
  },
  'DV-QA-05': {
    owner: 'S3',
    severity: 'major',
    title:
      "The grown-ups' Settings tab scrolls sideways on a phone: the voice list's long option text widens the panel's grid column (min-width: auto), pushing the notation and text-size buttons off screen.",
  },
  'DV-QA-06': {
    owner: 'S3',
    severity: 'major',
    title:
      'Words and numbers break inside narrow boxes: at 200 % text two-digit choice tiles stack their digits ("1" over "8"), the keypad\'s OK splits into "O/K", and the hub\'s adventure button, "Today\'s goal", level-card activities and Egg Grid labels break mid-word; on a phone the prologue\'s egg labels break even at normal size ("bubbl/y", "golde/n").',
  },
  'DV-QA-08': {
    owner: 'S3',
    severity: 'major',
    title:
      "The router gives every screen's focus target tabindex=-1 (router.ts, mount: focus), so the editor's name field and the error screen's button drop out of the Tab order: Tab and Shift+Tab never return to them, and their focus ring is hidden.",
  },
  'DV-QA-09': {
    owner: 'S3',
    severity: 'major',
    title:
      'After a click on Read aloud (or Show me), Enter presses that button again instead of sending the typed answer: the button keeps focus.',
  },
  'DV-QA-10': {
    owner: 'S3',
    severity: 'major',
    title:
      "At 200 % text on a phone, the hub and the Egg Grid board scroll sideways (551 and 478 px of content in 390 px): the hub's side column and the board do not reflow, and the place buttons and Egg Grid controls stick out.",
  },
  'DV-QA-11': {
    owner: 'S3',
    severity: 'minor',
    title:
      "Map and road hotspots are cut off by the picture's frame: on a phone the one awake place's label, \"Sunny Meadow\", is clipped at the left edge; at 200 % text or zoom level 1's marker and the boss are clipped too.",
  },
  'DV-QA-13': {
    owner: 'S3',
    severity: 'minor',
    engines: ['webkit'],
    title:
      "In WebKit on Linux a keeper's hub at 200 % text first shows at normal size: as it appears, <html> already carries --aegis-text-scale: 2 but its font size is still 24 px; it catches up by itself, 37 ms and 337 ms later in two CI runs.",
  },
  'DV-QA-14': {
    owner: 'S3',
    severity: 'major',
    title:
      "The results card's celebrations scroll inside the card, but the scrolling list cannot take keyboard focus (axe scrollable-region-focusable, serious): on a tablet or phone a keyboard user cannot reach the eggs and stickers below its edge.",
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

export const KNOWN_LAYOUT: readonly KnownLayout[] = [
  {
    defect: 'DV-QA-04',
    where: /./,
    problem: /^<button save-retry> "Retry" is [\d.]+×4\d(\.\d)?px, under 48px$/,
  },
  {
    defect: 'DV-QA-05',
    where: /settings/,
    problem: /^the page scrolls sideways|sticks out of the \d+px viewport/,
  },
  {
    defect: 'DV-QA-06',
    where: /^text-200\//,
    problem: /^the word ".+" breaks as ".+" in </,
  },
  {
    // Even at normal size the three eggs share a phone's width (WebKit, and Chromium on Linux).
    defect: 'DV-QA-06',
    where: /^05-story-eggs \(phone portrait\)$/,
    problem: /^the word ".+" breaks as ".+" in <span story-choice-[a-z]+>/,
  },
  {
    defect: 'DV-QA-10',
    where: /^text-200\/(06-hub|12-hub-after|17-egg-grid) \(phone portrait\)$/,
    problem: /^the page scrolls sideways|sticks out of the 390px viewport/,
  },
  {
    defect: 'DV-QA-11',
    where: /(13-map|14-region) \(/,
    problem:
      /is cut off by <div screen-(map|region)>|^<button (map-region|level)-[a-z0-9.-]+> .* sticks out of the/,
  },
];

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
    testInfo.annotations.push({
      type: 'defect fixed?',
      description: `${id} did not reproduce; remove its marker if it is fixed: ${defect.title}`,
    });
  } catch {
    testInfo.annotations.push({
      type: 'known defect',
      description: `${id} (${defect.severity}, ${defect.owner}): ${defect.title}`,
    });
  }
}
