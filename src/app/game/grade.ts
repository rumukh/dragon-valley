/**
 * A keeper's grade (1st, 2nd or 3rd class) on the shell's side. The game save's
 * `settings.grade` is its home; the family record only holds the grade picked in the new-keeper
 * editor until the save exists (`persistence/family.ts`). `applyPendingGrade` hands it over right
 * after the first `startSession`, before the prologue ends, so the first-egg beat (triggered
 * `after-beat` on the prologue, with a `grades` filter) already knows the grade.
 */
import { DEFAULT_GRADE } from '../../rules/contract/kinds';
import type { Grade } from '../../rules/contract/kinds';
import { regionGrade } from '../../rules/contract';
import type { DeepReadonly } from '@aegis/runtime';
import type { ContentData, GameView } from '../../rules/contract';
import { CommandRejectedError } from '../controller/commands';
import { findKeeper } from '../persistence/family';
import type { ActiveKeeper, App } from '../shell/app';

/** A view's grade (a save from before grades is 3rd grade). */
export function gradeOf(view: GameView): Grade {
  return view.settings.grade ?? DEFAULT_GRADE;
}

/**
 * The grade each skill belongs to: the lowest grade of the regions whose levels teach it (a
 * 3rd-grade review of a 2nd-grade skill keeps it in 2nd grade). A skill no level uses is 3rd grade.
 */
export function skillGrades(data: DeepReadonly<ContentData>): ReadonlyMap<string, Grade> {
  const regions = new Map(data.regions.map((region) => [region.id, regionGrade(region)]));
  const grades = new Map<string, Grade>();
  for (const level of data.levels) {
    const grade = regions.get(level.region) ?? DEFAULT_GRADE;
    for (const activity of level.activities) {
      for (const skill of activity.skills) {
        const known = grades.get(skill);
        if (known === undefined || grade < known) grades.set(skill, grade);
      }
    }
  }
  return grades;
}

/** Grades 1 and 2 get the young players' screens: pictures, big numerals, a short keypad. */
export function isYoungGrade(grade: Grade): boolean {
  return grade < 3;
}

/** The longest answer a grade's keypad takes: two digits for a 1st grader. */
export function keypadDigitsFor(grade: Grade, digits: number): number {
  return grade === 1 ? Math.min(digits, 2) : digits;
}

/** Whether a grade turns "read each new problem aloud" on by default (1st grade). */
export function autoReadsByDefault(grade: Grade): boolean {
  return grade === 1;
}

/**
 * Ask the game for a grade. Content that does not serve the grade yet refuses it
 * (`invalid-setting`), and a placement round refuses a change (`round-active`); either leaves
 * the game as it is and returns false.
 */
export async function requestGrade(active: ActiveKeeper, grade: Grade): Promise<boolean> {
  if (gradeOf(active.game.view()) === grade) return true;
  try {
    await active.commands.capture()({
      type: 'setSetting',
      setting: { key: 'grade', value: grade },
    });
    return true;
  } catch (error) {
    if (
      error instanceof CommandRejectedError &&
      (error.error.code === 'invalid-setting' || error.error.code === 'round-active')
    ) {
      return false;
    }
    throw error;
  }
}

/**
 * Before the keeper's session starts (so the first-session story is the grade's): hand the
 * editor's grade to the game, turn on auto read-aloud for a 1st grader, and drop the pending
 * grade from the family record.
 */
export async function applyPendingGrade(app: App, active: ActiveKeeper): Promise<void> {
  const keeper = findKeeper(app.family.state(), active.keeper.id);
  const grade = keeper?.grade;
  if (grade === undefined) return;
  await requestGrade(active, grade);
  if (autoReadsByDefault(grade) && !active.preferences.current().autoRead) {
    await active.preferences.change((draft) => {
      draft.autoRead = true;
    });
  }
  await app.family.setPendingGrade(active.keeper.id, null);
}
