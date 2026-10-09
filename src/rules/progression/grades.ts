/**
 * Grades (docs/grades-plan.md, docs/design.md §12): grade certificates and the catch-up egg.
 *
 * - Finishing the last boss of a grade's regions earns that grade's certificate ("1st grade
 *   done!"): `grade.completed` is emitted once, when the last of them is defeated, and the view
 *   lists the grades done. Only the earlier grades have certificates; the 3rd grade ends with the
 *   finale. Certificates are derived from the defeated bosses, never stored.
 * - A child who reaches the 3rd grade's start region (Sunny Meadow) without one of its eggs (a
 *   1st or 2nd grader never chose one) receives the region's first story egg (Bubbles) when a
 *   level there starts, just before its welcome beat. The rule applies only when that region is
 *   not the pack's first region, so a 3rd-grade-only pack is unchanged.
 */
import { DEFAULT_GRADE, EVENTS, GRADES, gradeStart, regionGrade } from '../contract';
import type { Grade } from '../contract';
import { grantEgg } from '../economy/rewards';
import type { Ctx, Data, ReadState } from '../types';

/** The grades that earn a certificate: every grade before the 3rd. */
export const CERTIFICATE_GRADES: readonly Grade[] = GRADES.filter((g) => g < DEFAULT_GRADE);

/** The bosses of `grade`'s regions. */
function gradeBosses(data: Data, grade: Grade): string[] {
  return data.regions
    .filter((region) => regionGrade(region) === grade && region.boss !== null)
    .map((region) => region.boss!);
}

/** Has every boss of `grade`'s regions been defeated (and is there at least one)? */
export function gradeDone(state: ReadState, data: Data, grade: Grade): boolean {
  const bosses = gradeBosses(data, grade);
  return bosses.length > 0 && bosses.every((boss) => state.bosses[boss] !== undefined);
}

/** The certificate grades done, in grade order. */
export function completedGrades(state: ReadState, data: Data): Grade[] {
  return CERTIFICATE_GRADES.filter((grade) => gradeDone(state, data, grade));
}

/** After `boss` was defeated: emit `grade.completed` when it was its grade's last boss. */
export function bossCertificate(ctx: Ctx, boss: string): void {
  const data = ctx.content.data;
  const region = data.regions.find((r) => r.boss === boss);
  if (!region) return;
  const grade = regionGrade(region);
  if (CERTIFICATE_GRADES.includes(grade) && gradeDone(ctx.state, data, grade)) {
    ctx.emit(EVENTS.gradeCompleted, { grade });
  }
}

/** The catch-up egg: see the module comment. Call when a full level run starts. */
export function catchUpEgg(ctx: Ctx, level: string): void {
  const data = ctx.content.data;
  const region = data.levels.find((l) => l.id === level)?.region;
  if (region === undefined || region !== gradeStart(data, DEFAULT_GRADE)) return;
  const first = [...data.regions].sort((a, b) => a.order - b.order)[0];
  if (first?.id === region) return;
  const owns = data.dragons.some((d) => d.region === region && ctx.state.dragons[d.id]);
  if (owns) return;
  for (const mapping of data.story.rewards) {
    if (mapping.grant.kind !== 'egg') continue;
    const dragon = mapping.grant.dragon;
    if (data.dragons.some((d) => d.id === dragon && d.region === region)) {
      grantEgg(ctx, dragon);
      return;
    }
  }
}
