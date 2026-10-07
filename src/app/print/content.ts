/**
 * What there is to print for a keeper, from the game view (docs/design.md §7.5): flashcards of the
 * hardest facts or of one times table, and certificates for what the keeper achieved - each
 * crowned dragon, each region whose boss was won over, and the finale. Text comes from the
 * catalogs in the grown-ups' Print tab; this module only decides what exists.
 */
import { TABLE_MAX, TABLE_MIN, divFactId, mulFactId } from '../../rules/contract';
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

export type Certificate =
  | { readonly id: string; readonly kind: 'dragon'; readonly dragon: string }
  | { readonly id: string; readonly kind: 'region'; readonly region: string; readonly boss: string }
  | { readonly id: string; readonly kind: 'finale'; readonly boss: string };

/**
 * Certificates the keeper has earned, in the order they were likely earned: crowned dragons in
 * the valley's order, regions whose boss was won over (map order), and the finale last.
 */
export function earnedCertificates(view: GameView, data: ContentData): Certificate[] {
  const out: Certificate[] = [];
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
