/**
 * The grown-ups' Progress tab, shaped from the game view (`parent`, `window`, `dragons`): no rule
 * lives here, only how the rules' numbers are laid out. The Magic Window becomes two plain grids
 * (multiplication 11 × 11, division 10 × 11) for S4's `renderMasteryGrid`; the 60-day trend
 * becomes bars; a practised item becomes words a grown-up can read ("7 · 8 = 56", "Division with
 * remainder by 7").
 */
import { MASTERY_LEVELS, TABLE_MAX, TABLE_MIN } from '../../rules/contract';
import type {
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
  readonly bars: readonly TrendBar[];
  readonly most: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Bars for the practised days (oldest first), scaled so the busiest day fills the height. Each
 * day gets the same slot; a bar takes 70 % of its slot.
 */
export function trendChart(trend: ParentView['trend'], width: number, height: number): TrendChart {
  const most = Math.max(1, ...trend.map((day) => day.answers));
  const slot = trend.length > 0 ? width / trend.length : width;
  const scale = (value: number): number => Math.round((value / most) * height * 100) / 100;
  const bars = trend.map((day, index) => ({
    day: day.day,
    answers: day.answers,
    correct: day.correct,
    fast: day.fast,
    x: Math.round((index * slot + slot * 0.15) * 100) / 100,
    width: Math.round(slot * 0.7 * 100) / 100,
    height: scale(day.answers),
    correctHeight: scale(day.correct),
    fastHeight: scale(day.fast),
  }));
  return { bars, most, width, height };
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
