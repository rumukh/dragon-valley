/**
 * Spaced retrieval for one item: response buckets, Leitner moves and mastery levels.
 *
 * Leitner boxes 0..5 (0 = never seen). Correct and fast/ok: up one box. Correct but slow: stay.
 * Miss: back to box 1, invisibly. The item is due `balance.leitner.intervals[box]` days later.
 * Mastery: box 0-1 dim, 2 bronze, 3-4 silver, gold = box 5 with 2 fast answers in the last 3.
 */
import type { DeepReadonly } from '@aegis/runtime';
import type {
  Balance,
  DayNumber,
  ItemState,
  MasteryLevel,
  ResolvedInputMode,
  ResponseBucket,
  WordTiming,
} from '../contract';

type ReadBalance = DeepReadonly<Balance>;

/** Digits of a non-negative integer (0 has one digit). */
export function digits(value: number): number {
  let count = 1;
  for (let rest = value; rest >= 10; rest = (rest - (rest % 10)) / 10) count++;
  return count;
}

/**
 * Sort a response into a bucket. Keypad answers get extra time per extra answer digit, and a
 * word problem's answer its reading time (`allowanceMs`, from `readingAllowanceMs`).
 */
export function responseBucket(
  correct: boolean,
  elapsedMs: number,
  input: ResolvedInputMode,
  answerDigits: number,
  balance: ReadBalance,
  allowanceMs = 0,
): ResponseBucket {
  if (!correct) return 'miss';
  const limits = balance.response[input];
  const extra =
    (input === 'keypad'
      ? Math.max(0, answerDigits - 1) * balance.response.keypad.perExtraDigitMs
      : 0) + allowanceMs;
  if (elapsedMs <= limits.fastMs + extra) return 'fast';
  if (elapsedMs <= limits.okMs + extra) return 'ok';
  return 'slow';
}

/**
 * The reading time a word problem's answer is allowed (design §6.2: time the arithmetic, not
 * the reading): for a story answered whole, `words × perWordMs + wholeStoryMs`; for the number
 * after an operation step (`afterOperation`: the story was read for the operation), the share
 * `rereadPercent` of `words × perWordMs`. None without the template's `words` count or the
 * balance's `response.word`, so content without them keeps the plain limits.
 */
export function readingAllowanceMs(
  words: number | undefined,
  timing: DeepReadonly<WordTiming> | undefined,
  afterOperation: boolean,
): number {
  if (words === undefined || timing === undefined) return 0;
  const reading = words * timing.perWordMs;
  if (!afterOperation) return reading + timing.wholeStoryMs;
  const share = reading * timing.rereadPercent;
  return (share - (share % 100)) / 100;
}

/** The item after one response on `day`. */
export function updateItem(
  item: DeepReadonly<ItemState> | undefined,
  bucket: ResponseBucket,
  day: DayNumber,
  balance: ReadBalance,
): ItemState {
  const box = item?.box ?? 0;
  const nextBox = bucket === 'miss' ? 1 : bucket === 'slow' ? box : Math.min(5, box + 1);
  return {
    box: nextBox,
    due: day + (balance.leitner.intervals[nextBox] ?? 0),
    seen: (item?.seen ?? 0) + 1,
    correct: (item?.correct ?? 0) + (bucket === 'miss' ? 0 : 1),
    recent: [...(item?.recent ?? []), bucket].slice(-3),
    lastDay: day,
  };
}

export function masteryLevel(
  item: DeepReadonly<ItemState> | undefined,
  balance: ReadBalance,
): MasteryLevel {
  if (!item || item.box <= 1) return 'dim';
  if (item.box === 2) return 'bronze';
  const fast = item.recent.slice(-balance.mastery.goldOfLast).filter((b) => b === 'fast').length;
  return item.box >= balance.mastery.goldBox && fast >= balance.mastery.goldFast
    ? 'gold'
    : 'silver';
}

const ORDER: readonly ('seen' | MasteryLevel)[] = ['dim', 'seen', 'bronze', 'silver', 'gold'];

/** True when the item is at `level` or better (`seen` = answered correctly at least once). */
export function atLeast(
  item: DeepReadonly<ItemState> | undefined,
  level: 'seen' | 'bronze' | 'silver' | 'gold',
  balance: ReadBalance,
): boolean {
  if (level === 'seen') return (item?.correct ?? 0) > 0;
  return ORDER.indexOf(masteryLevel(item, balance)) >= ORDER.indexOf(level);
}

/**
 * A known item (answered correctly before) whose review day has come and that was not already
 * practised today: an item seen today is never "due" again the same day, so a dragon is not
 * hungry minutes after it hatched and a pane needs polishing only from a later day on.
 */
export function isDue(item: DeepReadonly<ItemState> | undefined, day: DayNumber): boolean {
  return item !== undefined && item.correct > 0 && item.due <= day && item.lastDay < day;
}
