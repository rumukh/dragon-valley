/**
 * The grown-ups' Progress tab, shaped from the game view (`parent`, `window`, `dragons`): no rule
 * lives here, only how the rules' numbers are laid out. The Magic Window becomes two plain grids
 * (multiplication 11 × 11, division 10 × 11) for S4's `renderMasteryGrid`; the last 60 days
 * become bars; a practised item becomes words a grown-up can read ("7 · 8 = 56", "Division with
 * remainder by 7").
 */
import { MASTERY_LEVELS, TABLE_MAX, TABLE_MIN } from '../../rules/contract';
import type {
  GameView,
  MasteryLevel,
  Notation,
  ParentView,
  WindowCell,
  WindowView,
} from '../../rules/contract';
import type { PaneState } from '../art/window';
import type { MessageKey, Translate } from '../i18n/messages';
import { factText } from '../math/facts';

const COLUMNS = TABLE_MAX - TABLE_MIN + 1;

/** Cells as rows of panes: `rows` rows from `firstRow`, columns 0..10. Missing cells are dim. */
export function paneRows(
  cells: readonly WindowCell[],
  rows: number,
  firstRow: number,
): PaneState[][] {
  const grid: PaneState[][] = Array.from({ length: rows }, () =>
    Array.from({ length: COLUMNS }, (): PaneState => 'dim'),
  );
  for (const cell of cells) {
    const row = grid[cell.row - firstRow];
    if (!row || cell.column < TABLE_MIN || cell.column > TABLE_MAX) continue;
    row[cell.column - TABLE_MIN] = cell.needsPolish
      ? { level: cell.level, needsPolish: true }
      : cell.level;
  }
  return grid;
}

/** Multiplication: row = first factor 0..10, column = second factor 0..10. */
export function multiplicationPanes(window: WindowView): PaneState[][] {
  return paneRows(window.cells, COLUMNS, TABLE_MIN);
}

/** Division: row = divisor 1..10, column = quotient 0..10. */
export function divisionPanes(window: WindowView): PaneState[][] {
  return paneRows(window.division, COLUMNS - 1, 1);
}

export interface PaneCounts {
  readonly levels: Readonly<Record<MasteryLevel, number>>;
  /** Known facts due again ("needs polishing"). */
  readonly polish: number;
  /** Panes at bronze or better. */
  readonly lit: number;
  readonly total: number;
}

export function paneCounts(cells: readonly WindowCell[]): PaneCounts {
  const levels = Object.fromEntries(MASTERY_LEVELS.map((level) => [level, 0])) as Record<
    MasteryLevel,
    number
  >;
  let polish = 0;
  for (const cell of cells) {
    levels[cell.level] += 1;
    if (cell.needsPolish) polish += 1;
  }
  return { levels, polish, lit: cells.length - levels.dim, total: cells.length };
}

/** Calendar days in the practice chart, ending today. */
export const TREND_DAYS = 60;

/** The most entries the view's hardest list holds (docs/contract.md, `ParentView.hardest`). */
export const HARDEST_LIMIT = 10;

const DAY_MS = 86_400_000;

function dayStart(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

/** Whole calendar days from `from` to `to` (both `YYYY-MM-DD`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayStart(to) - dayStart(from)) / DAY_MS);
}

/** The day `offset` calendar days after `day` (before it when negative). */
export function shiftDay(day: string, offset: number): string {
  return new Date(dayStart(day) + offset * DAY_MS).toISOString().slice(0, 10);
}

export interface TrendBar {
  readonly day: string;
  readonly answers: number;
  readonly correct: number;
  readonly fast: number;
  readonly x: number;
  readonly width: number;
  /** Heights in the chart's units: all answers, the right ones, the quick ones. */
  readonly height: number;
  readonly correctHeight: number;
  readonly fastHeight: number;
}

export interface TrendChart {
  /** The practised days in the window, oldest first. */
  readonly bars: readonly TrendBar[];
  /** The window's first and last calendar days. */
  readonly first: string;
  readonly last: string;
  readonly most: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The `span` calendar days up to `today` as bars, so gaps in practice show: every day has the
 * same slot, a practised day's bar takes 70 % of it, and the busiest day fills the height. Days
 * before the window (the view keeps the last 60 practised days) are left to the list.
 */
export function trendChart(
  trend: ParentView['trend'],
  today: string,
  width: number,
  height: number,
  span = TREND_DAYS,
): TrendChart {
  const shown = trend
    .map((day) => ({ day, index: span - 1 - daysBetween(day.day, today) }))
    .filter(({ index }) => index >= 0 && index < span);
  const most = Math.max(1, ...shown.map(({ day }) => day.answers));
  const slot = width / span;
  const round = (value: number): number => Math.round(value * 100) / 100;
  const scale = (value: number): number => round((value / most) * height);
  const bars = shown.map(({ day, index }) => ({
    day: day.day,
    answers: day.answers,
    correct: day.correct,
    fast: day.fast,
    x: round(index * slot + slot * 0.15),
    width: round(slot * 0.7),
    height: scale(day.answers),
    correctHeight: scale(day.correct),
    fastHeight: scale(day.fast),
  }));
  return { bars, first: shiftDay(today, -(span - 1)), last: today, most, width, height };
}

/**
 * Times tables with no answers yet. The view gives each table shares, not a count, and a table
 * answered only wrongly shows the same zeros. But all of such a table's answered facts would be at
 * 0 % right, and the hardest list puts 0 % facts first: unless that list is all 0 % (it may then
 * leave some out), a table at zero with none of its facts on it has not been answered.
 */
export function unansweredTables(view: GameView): ReadonlySet<number> {
  const missed = new Set(
    view.parent.hardest.filter((entry) => entry.accuracy === 0).map((entry) => entry.item),
  );
  const tables = new Set<number>();
  if (missed.size >= HARDEST_LIMIT) return tables;
  for (const row of view.parent.tables) {
    if (row.accuracy > 0 || row.fastShare > 0 || row.mastered > 0) continue;
    const answered = view.window.cells.some(
      (cell) => (cell.row === row.table || cell.column === row.table) && missed.has(cell.item),
    );
    if (!answered) tables.add(row.table);
  }
  return tables;
}

/** Grown-up names of the generators' skill buckets (docs/contract.md §5.4). */
const BUCKETS: Readonly<Record<string, MessageKey>> = {
  'pow10:x10': 'parent.item.pow10.x10',
  'pow10:x100': 'parent.item.pow10.x100',
  'mul2d1d:carry': 'parent.item.mul2d1d.carry',
  'mul2d1d:nocarry': 'parent.item.mul2d1d.nocarry',
  'div2d1d:regroup': 'parent.item.div2d1d.regroup',
  'div2d1d:noregroup': 'parent.item.div2d1d.noregroup',
  'order:brackets': 'parent.item.order.brackets',
  'order:no-brackets': 'parent.item.order.no-brackets',
  'compare:fact-number': 'parent.item.compare.fact-number',
  'compare:fact-fact': 'parent.item.compare.fact-fact',
  'compare:expression': 'parent.item.compare.expression',
};

const WORD_FAMILY_NAMES: Readonly<Record<string, MessageKey>> = {
  'equal-groups': 'parent.family.equal-groups',
  sharing: 'parent.family.sharing',
  grouping: 'parent.family.grouping',
  'times-as-many': 'parent.family.times-as-many',
  'times-fewer': 'parent.family.times-fewer',
  'more-than': 'parent.family.more-than',
  'fewer-than': 'parent.family.fewer-than',
  leftover: 'parent.family.leftover',
  'two-step': 'parent.family.two-step',
};

const TERM_NAMES: Readonly<Record<string, MessageKey>> = {
  factor: 'term.factor',
  product: 'term.product',
  dividend: 'term.dividend',
  divisor: 'term.divisor',
  quotient: 'term.quotient',
  remainder: 'term.remainder',
};

/**
 * What a practised item is, in words: a small-table fact written out in the keeper's notation
 * (`7 · 8 = 56`), else the skill bucket it stands for. Unknown buckets show their ID.
 */
export function itemLabel(item: string, notation: Notation, t: Translate): string {
  const fact = factText(item, notation);
  if (fact) return fact.sentence;
  const fixed = BUCKETS[item];
  if (fixed) return t(fixed);
  const [family = '', bucket = ''] = item.split(':');
  const divisor = /^d(\d+)$/.exec(bucket)?.[1];
  if (family === 'rem' && divisor) return t('parent.item.rem', { n: divisor });
  if (family === 'tens' && divisor) return t('parent.item.tens', { n: divisor });
  if (family === 'word' && WORD_FAMILY_NAMES[bucket]) {
    return t('parent.item.word', { family: t(WORD_FAMILY_NAMES[bucket]) });
  }
  if (family === 'terms' && TERM_NAMES[bucket]) {
    return t('parent.item.terms', { term: t(TERM_NAMES[bucket]) });
  }
  return item;
}

/** Skills the child has begun (some mastery or some accuracy), in the rules' order. */
export function practisedSkills(skills: ParentView['skills']): ParentView['skills'] {
  return skills.filter((skill) => skill.mastered > 0 || skill.accuracy > 0);
}
