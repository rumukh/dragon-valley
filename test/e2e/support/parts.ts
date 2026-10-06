/**
 * The suite in parts, so CI can spread its slowest engine (WebKit) over parallel jobs.
 *
 * `DV_E2E_PART` selects one part: a named part runs its own spec files, `rest` runs every other
 * spec file, and no part (the default; Chromium and Firefox in CI) runs the whole suite. A new
 * spec file belongs to `rest` until it is named here, so no file can fall between the parts.
 * The parts are balanced by WebKit's run times on a hosted runner (docs/testing.md §5).
 */
import { basename } from 'node:path';

export const NAMED_PARTS = {
  // The screen walks and the large-text reflow walks: long tests with many screenshots.
  walks: ['screens', 'reflow'],
  // Whole rounds with saves, reloads, failures and settings.
  rounds: ['input', 'persistence', 'recovery', 'settings'],
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

/** The part `DV_E2E_PART` selects, or undefined for the whole suite. */
export function selectedPart(
  value: string | undefined = process.env['DV_E2E_PART'],
): Part | undefined {
  if (!value) return undefined;
  if (!(PARTS as readonly string[]).includes(value)) {
    throw new Error(`DV_E2E_PART must be one of ${PARTS.join(', ')}; it is "${value}".`);
  }
  return value as Part;
}

function specFiles(names: readonly string[]): RegExp {
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'));
  return new RegExp(`[\\\\/](?:${escaped.join('|')})\\.spec\\.ts$`);
}

/** Playwright's testMatch and testIgnore for a part (matched against absolute file paths). */
export function partFilter(part: Part | undefined): { testMatch: RegExp; testIgnore: RegExp[] } {
  if (part === undefined) return { testMatch: /\.spec\.ts$/, testIgnore: [] };
  if (part === 'rest') {
    return {
      testMatch: /\.spec\.ts$/,
      testIgnore: [specFiles(NAMED.flatMap((p) => NAMED_PARTS[p]))],
    };
  }
  return { testMatch: specFiles(NAMED_PARTS[part]), testIgnore: [] };
}
