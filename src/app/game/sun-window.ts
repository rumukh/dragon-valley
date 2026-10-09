/**
 * The Sun Window (docs/design.md §12.5): the Magic Window's face for + and −, served by the rules
 * as `GameView.sunWindow`: an 11 × 11 addition mosaic (`add:A+B`, row A, column B) and a
 * subtraction panel (`sub:M-S`, row S, column the difference), each pane lit by the fact's mastery.
 */
import { MASTERY_LEVELS } from '../../rules/contract';
import type { GameView, MasteryLevel, SunWindowView, WindowCell } from '../../rules/contract';

export function countLevels(cells: readonly WindowCell[]): Record<MasteryLevel, number> {
  const counts = Object.fromEntries(MASTERY_LEVELS.map((level) => [level, 0])) as Record<
    MasteryLevel,
    number
  >;
  for (const cell of cells) counts[cell.level] += 1;
  return counts;
}

/** The view's Sun Window. */
export function sunWindowOf(view: GameView): SunWindowView {
  return view.sunWindow;
}
