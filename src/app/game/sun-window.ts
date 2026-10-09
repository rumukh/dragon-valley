/**
 * The Sun Window (docs/design.md §12.5): the Magic Window's face for + and −, an 11 × 11
 * addition mosaic (`add:A+B`, row A, column B) and a subtraction panel (`sub:M-S`, row S,
 * column the difference), each pane lit by the fact's mastery.
 *
 * Seam: the rules (G2) add the view's `sunWindow`. Until it lands, every pane is dim; the shape
 * read here mirrors `WindowView` (`cells`, `subtraction`, `counts`).
 */
import { allAddFactIds, allSubFactIds, MASTERY_LEVELS, parseItemId } from '../../rules/contract';
import type { GameView, MasteryLevel, WindowCell } from '../../rules/contract';

export interface SunWindowView {
  readonly size: 11;
  /** 121 addition cells, row-major from `add:0+0` to `add:10+10`. */
  readonly cells: readonly WindowCell[];
  /** 121 subtraction cells, by subtrahend (row) then difference (column). */
  readonly subtraction: readonly WindowCell[];
  readonly counts: Readonly<Record<MasteryLevel, number>>;
}

const isLevel = (value: unknown): value is MasteryLevel =>
  (MASTERY_LEVELS as readonly unknown[]).includes(value);

function isCell(value: unknown): value is WindowCell {
  if (typeof value !== 'object' || value === null) return false;
  const cell = value as Record<string, unknown>;
  return (
    typeof cell['item'] === 'string' &&
    typeof cell['row'] === 'number' &&
    typeof cell['column'] === 'number' &&
    isLevel(cell['level']) &&
    typeof cell['needsPolish'] === 'boolean'
  );
}

function dimCell(item: string): WindowCell {
  const parsed = parseItemId(item);
  const [row, column] =
    parsed?.kind === 'add'
      ? [parsed.a, parsed.b]
      : parsed?.kind === 'sub'
        ? [parsed.subtrahend, parsed.difference]
        : [0, 0];
  return { item, row, column, level: 'dim', needsPolish: false };
}

export function countLevels(cells: readonly WindowCell[]): Record<MasteryLevel, number> {
  const counts = Object.fromEntries(MASTERY_LEVELS.map((level) => [level, 0])) as Record<
    MasteryLevel,
    number
  >;
  for (const cell of cells) counts[cell.level] += 1;
  return counts;
}

/** The Sun Window from the view, or every pane dim until the rules serve it. */
export function sunWindowOf(view: GameView): SunWindowView {
  const served = (view as { readonly sunWindow?: unknown }).sunWindow;
  if (typeof served === 'object' && served !== null) {
    const raw = served as Record<string, unknown>;
    const cells = raw['cells'];
    const subtraction = raw['subtraction'];
    if (
      Array.isArray(cells) &&
      Array.isArray(subtraction) &&
      cells.every(isCell) &&
      subtraction.every(isCell)
    ) {
      return { size: 11, cells, subtraction, counts: countLevels([...cells, ...subtraction]) };
    }
  }
  const cells = allAddFactIds().map(dimCell);
  const subtraction = allSubFactIds().map(dimCell);
  return { size: 11, cells, subtraction, counts: countLevels([...cells, ...subtraction]) };
}
