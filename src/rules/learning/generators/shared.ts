/**
 * What every problem generator shares: the sources it may draw from, integer ranges, the seeded
 * shuffle and the 3rd-grade number range.
 */
import type { DeepReadonly, RandomStream } from '@aegis/runtime';
import type { ContentData } from '../../contract';

/**
 * Where a generator draws from. `problems` decides items' numbers, positions and shapes; `words`
 * decides the names and objects of word problems; `data` holds the word templates and lists.
 * Nothing else is random, so the same streams and content always give the same problem.
 */
export interface GeneratorSources {
  readonly problems: RandomStream;
  readonly words: RandomStream;
  readonly data: DeepReadonly<Pick<ContentData, 'wordTemplates' | 'wordLists'>>;
}

/**
 * Children in 3rd grade read, write and compare numbers up to 1000 (RVP ZV M-3-1-02). Generated
 * story numbers and answer options stay inside this range.
 */
export const NUMBER_RANGE = 1000;

/** The integers `low..high` (inclusive); empty when `low > high`. */
export function span(low: number, high: number): number[] {
  const values: number[] = [];
  for (let value = low; value <= high; value++) values.push(value);
  return values;
}

/** Fisher-Yates shuffle with a seeded stream. */
export function shuffle<T>(items: readonly T[], random: RandomStream): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random.int(0, i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** The error for an item the skill can never produce (a caller bug or invalid content). */
export function cannotPractise(generator: string, item: string): Error {
  return new Error(`Generator ${generator} cannot practise ${item}.`);
}
