/**
 * A fixture pack for the grades 1-3 rules, built from the archived 1.3.0 pack (the last without
 * grades; the shipped pack has the real Pebble Brook since 1.4.0): Sunny Meadow is the 1st grade's region, Whispering Woods the
 * 2nd grade's and the rest the 3rd grade's, which starts at Fire Mountain. The placement ladder's
 * first four steps are the 3rd grade's (no `grades`), the two Whispering Woods steps the 2nd
 * grade's; the 1st grade has none.
 */
import { parseContentJson, requireValue } from '@aegis/runtime';
import type { ContentPack } from '@aegis/runtime';
import { contentRegistration } from '../../../src/rules/contract';
import type { ContentData } from '../../../src/rules/contract';
import { loadPack } from '../../traces/support';

export const GRADE_STARTS = {
  1: 'sunny-meadow',
  2: 'whispering-woods',
  3: 'fire-mountain',
} as const;

export function gradePack(
  change: (data: ContentData) => void = () => undefined,
): ContentPack<ContentData> {
  const pack = structuredClone(
    loadPack('content/history/1.3.0.json'),
  ) as ContentPack<ContentData> & { data: ContentData };
  const data = pack.data;
  data.grades = [
    { grade: 1, start: GRADE_STARTS[1] },
    { grade: 2, start: GRADE_STARTS[2] },
    { grade: 3, start: GRADE_STARTS[3] },
  ];
  for (const region of data.regions) {
    region.grade = region.id === GRADE_STARTS[1] ? 1 : region.id === GRADE_STARTS[2] ? 2 : 3;
  }
  data.placement.steps.forEach((step) => {
    if (step.levels.every((level) => level.startsWith(`${GRADE_STARTS[2]}.`))) step.grades = [2];
  });
  change(data);
  return requireValue(
    parseContentJson(JSON.stringify(pack), contentRegistration, 'grade-pack.json'),
  );
}
