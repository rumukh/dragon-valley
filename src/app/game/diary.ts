/**
 * The Dragon Diary (docs/design.md §2.1): what a keeper's day brought, made from data rather
 * than written: facts that began to shine today (bronze or better; "Today you learned 7 · 8 =
 * 56!"), dragons that hatched, grew or got their crown, and stickers earned. Facts and dragons
 * compare the view with the day's baseline (persistence/day.ts); stickers carry their own day.
 */
import { DRAGON_STAGES } from '../../rules/contract';
import type { DragonStage, GameView } from '../../rules/contract';
import type { DayRecord } from '../persistence/day';

export interface DiaryDragon {
  readonly id: string;
  /** The stage reached today: `hatchling` means hatched, `crowned` a crown. */
  readonly stage: DragonStage;
}

export interface Diary {
  /** Facts that began to shine today, multiplication first, then division. */
  readonly facts: readonly string[];
  readonly dragons: readonly DiaryDragon[];
  /** Sticker IDs earned today. */
  readonly stickers: readonly string[];
}

export function isEmptyDiary(diary: Diary): boolean {
  return diary.facts.length === 0 && diary.dragons.length === 0 && diary.stickers.length === 0;
}

/**
 * Today's diary. Without a baseline for the view's day (none was taken, or it is from another
 * day) only the stickers can be told.
 */
export function diaryOf(view: GameView, baseline: DayRecord | undefined): Diary {
  const day = view.day;
  const stickers =
    day === null
      ? []
      : view.album.pages.flatMap((page) =>
          page.stickers
            .filter((sticker) => sticker.earned && sticker.day === day)
            .map((sticker) => sticker.id),
        );
  if (day === null || baseline?.day !== day) return { facts: [], dragons: [], stickers };
  const before = new Set(baseline.lit);
  const facts = [...view.window.cells, ...view.window.division]
    .filter((cell) => cell.level !== 'dim' && !before.has(cell.item))
    .map((cell) => cell.item);
  const rank = (stage: DragonStage): number => DRAGON_STAGES.indexOf(stage);
  const dragons = view.dragons
    .filter((dragon) => {
      // An egg that arrived today has not grown yet; one that also hatched today has.
      const was = baseline.stages[dragon.id] ?? 'egg';
      return rank(dragon.stage) > rank(was);
    })
    .map((dragon) => ({ id: dragon.id, stage: dragon.stage }));
  return { facts, dragons, stickers };
}
