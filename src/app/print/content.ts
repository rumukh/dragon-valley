/**
 * What there is to print for a keeper, from the game view (docs/design.md §7.5): flashcards of the
 * hardest facts or of one times table, and certificates for what the keeper achieved - each
 * crowned dragon, each region whose boss was won over, and the finale. Text comes from the
 * catalogs in the grown-ups' Print tab; this module only decides what exists.
 */
import {
  TABLE_MAX,
  TABLE_MIN,
  addFactId,
  divFactId,
  mulFactId,
  regionGrade,
  subFactId,
} from '../../rules/contract';
import type { Grade } from '../../rules/contract';
import type { ContentData, GameView, Notation } from '../../rules/contract';
import { factText } from '../math/facts';
import type { FactText } from '../math/facts';

/** The hardest facts the rules list that are small-table facts (skill buckets have no card). */
export function hardestFacts(view: GameView, notation: Notation): FactText[] {
  return view.parent.hardest.flatMap((entry) => {
    const fact = factText(entry.item, notation);
    return fact ? [fact] : [];
  });
}

/**
 * One times table as cards: `1 · n` … `10 · n`, then the divisions `n : n` … `10n : n` (none for
 * the zero table, since nothing is divided by zero).
 */
export function tableFacts(table: number, notation: Notation): FactText[] {
  if (!Number.isInteger(table) || table < TABLE_MIN || table > TABLE_MAX) {
    throw new RangeError('A times table is 0 to 10.');
  }
  const facts: FactText[] = [];
  for (let k = 1; k <= TABLE_MAX; k++) facts.push(factText(mulFactId(k, table), notation)!);
  if (table > 0) {
    for (let k = 1; k <= TABLE_MAX; k++) {
      facts.push(factText(divFactId(k * table, table), notation)!);
    }
  }
  return facts;
}

/**
 * Adding one number as cards, the 1st and 2nd graders' "times table": `n + 0` … `n + 10`, then
 * the subtractions that undo them, `n − n` … `(n + 10) − n`.
 */
export function addTableFacts(addend: number, notation: Notation): FactText[] {
  if (!Number.isInteger(addend) || addend < TABLE_MIN || addend > TABLE_MAX) {
    throw new RangeError('An addition table is 0 to 10.');
  }
  const facts: FactText[] = [];
  for (let k = TABLE_MIN; k <= TABLE_MAX; k++)
    facts.push(factText(addFactId(addend, k), notation)!);
  for (let k = TABLE_MIN; k <= TABLE_MAX; k++) {
    facts.push(factText(subFactId(addend + k, addend), notation)!);
  }
  return facts;
}

export type Certificate =
  | { readonly id: string; readonly kind: 'dragon'; readonly dragon: string }
  | { readonly id: string; readonly kind: 'region'; readonly region: string; readonly boss: string }
  | { readonly id: string; readonly kind: 'grade'; readonly grade: Grade }
  | { readonly id: string; readonly kind: 'finale'; readonly boss: string };

/**
 * The grades below 3rd a keeper has finished: every region of that grade with a boss has its boss
 * won over (3rd grade ends with the finale's own certificate). A pack without the grade's regions
 * finishes nothing.
 */
export function finishedGrades(view: GameView, data: ContentData): Grade[] {
  const won = new Set(
    view.hub.regions.flatMap((region) => (region.boss?.defeated ? [region.id] : [])),
  );
  const out: Grade[] = [];
  for (const grade of [1, 2] as const) {
    const bossed = data.regions.filter(
      (region) => regionGrade(region) === grade && region.boss !== null,
    );
    if (bossed.length > 0 && bossed.every((region) => won.has(region.id))) out.push(grade);
  }
  return out;
}

/** The boss of a grade's last region with one, for the grade's certificate art. */
export function gradeLastBoss(data: ContentData, grade: Grade): string | null {
  return (
    [...data.regions]
      .filter((region) => regionGrade(region) === grade && region.boss !== null)
      .sort((a, b) => b.order - a.order)[0]?.boss ?? null
  );
}

/**
 * Certificates the keeper has earned, in the order they were likely earned: crowned dragons in
 * the valley's order, regions whose boss was won over (map order) with each finished grade right
 * after its last region, and the finale last.
 */
export function earnedCertificates(view: GameView, data: ContentData): Certificate[] {
  const out: Certificate[] = [];
  const lastOfGrade = new Map<string, Grade>();
  for (const grade of finishedGrades(view, data)) {
    const last = data.regions
      .filter((region) => regionGrade(region) === grade && region.boss !== null)
      .sort((a, b) => b.order - a.order)[0];
    if (last) lastOfGrade.set(last.id, grade);
  }
  const finaleBoss = data.bosses.find((boss) => boss.finale === true)?.id ?? null;
  for (const dragon of view.dragons) {
    if (dragon.stage === 'crowned') {
      out.push({ id: `certificate:dragon:${dragon.id}`, kind: 'dragon', dragon: dragon.id });
    }
  }
  for (const region of [...view.hub.regions].sort((a, b) => a.order - b.order)) {
    const boss = region.boss;
    if (!boss?.defeated) continue;
    if (boss.id === finaleBoss) {
      out.push({ id: `certificate:finale:${boss.id}`, kind: 'finale', boss: boss.id });
    } else {
      out.push({
        id: `certificate:region:${region.id}`,
        kind: 'region',
        region: region.id,
        boss: boss.id,
      });
    }
    const grade = lastOfGrade.get(region.id);
    if (grade !== undefined) out.push({ id: `certificate:grade:${grade}`, kind: 'grade', grade });
  }
  return out;
}

/** A date `YYYY-MM-DD` as "7 October 2026", the same in every time zone. */
export function longDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, date)));
}
