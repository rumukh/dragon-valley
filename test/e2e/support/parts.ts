/**
 * The suite in parts, so CI can spread each engine over parallel jobs.
 *
 * `DV_E2E_PART` selects one or more parts, comma-separated (`walks`, `regions,valley`): a named
 * part runs its own spec files, `rest` runs every spec file no named part claims, and no part
 * (the default, as locally) runs the whole suite. A new spec file belongs to `rest` until it is
 * named here, so no file can fall between the parts. The parts are balanced by run times on a
 * hosted runner (docs/testing.md §5).
 */
import { basename } from 'node:path';

export const NAMED_PARTS = {
  // The screen walks and the large-text reflow walks: long tests with many screenshots.
  walks: ['screens', 'reflow'],
  // Whole rounds with saves, reloads, failures and settings.
  rounds: ['input', 'persistence', 'recovery', 'settings'],
  // One activity in each region of the valley.
  regions: ['regions'],
  // The v1 boards, the bosses, the finale and the map with every region awake, and saves from
  // before an update.
  valley: ['boards', 'bosses', 'upgrade', 'finale', 'map'],
  // The activities beyond the boards: Memory Match, Number Trail, Fact Family, the Egg Grid.
  activities: ['activities'],
  // The day around the rounds: the Daily Adventure, its goal and gift, pacing, the collections.
  days: ['daily', 'collections'],
  // The grown-ups' remaining controls, and the pause when the page is hidden.
  controls: ['grown-ups', 'visibility'],
  // The coordinator's playtest findings on the Region 1 slice, as regression checks.
  playtest: ['playtest'],
} as const satisfies Record<string, readonly string[]>;

type NamedPart = keyof typeof NAMED_PARTS;
export type Part = NamedPart | 'rest';

const NAMED = Object.keys(NAMED_PARTS) as NamedPart[];
export const PARTS: readonly Part[] = [...NAMED, 'rest'];

/** The part a spec file belongs to. */
export function partOf(file: string): Part {
  const name = basename(file).replace(/\.spec\.ts$/, '');
  return NAMED.find((part) => (NAMED_PARTS[part] as readonly string[]).includes(name)) ?? 'rest';
}

/** The parts `DV_E2E_PART` selects, or undefined for the whole suite. */
export function selectedParts(
  value: string | undefined = process.env['DV_E2E_PART'],
): Part[] | undefined {
  if (!value) return undefined;
  const parts = value.split(',').map((part) => part.trim());
  for (const part of parts) {
    if (!(PARTS as readonly string[]).includes(part)) {
      throw new Error(`DV_E2E_PART takes ${PARTS.join(', ')} (comma-separated); it is "${value}".`);
    }
  }
  return parts as Part[];
}

function specFiles(names: readonly string[]): RegExp {
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'));
  return new RegExp(`[\\\\/](?:${escaped.join('|')})\\.spec\\.ts$`);
}

/** Playwright's testMatch and testIgnore for some parts (matched against absolute file paths). */
export function partFilter(parts: readonly Part[] | undefined): {
  testMatch: RegExp;
  testIgnore: RegExp[];
} {
  if (parts === undefined) return { testMatch: /\.spec\.ts$/, testIgnore: [] };
  const named = NAMED.filter((part) => parts.includes(part));
  if (parts.includes('rest')) {
    const others = NAMED.filter((part) => !parts.includes(part)).flatMap((p) => NAMED_PARTS[p]);
    return { testMatch: /\.spec\.ts$/, testIgnore: others.length > 0 ? [specFiles(others)] : [] };
  }
  return { testMatch: specFiles(named.flatMap((part) => NAMED_PARTS[part])), testIgnore: [] };
}
