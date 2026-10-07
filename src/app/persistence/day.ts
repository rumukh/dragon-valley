/**
 * The keeper's day so far, for the Dragon Diary (docs/design.md §2.1): when a day's first session
 * starts, the shell notes which facts already shine (bronze or better) and how far each dragon has
 * grown. At the end of the session the diary is the difference between that and the view: what
 * was learned, hatched and grown today. Stickers carry their own day in the view.
 *
 * One small record per keeper (`dragon-valley-day`), apart from the game save: it is never part
 * of the game state, a hash or a backup, and holds nothing the game save does not. So a record
 * that cannot be read is simply replaced (no grown-up is asked), and a write that fails leaves
 * the diary to this page only.
 */
import type { SaveStorage } from '@aegis/browser/save';
import { DRAGON_STAGES } from '../../rules/contract';
import type { DragonStage, GameView } from '../../rules/contract';
import { RecordStore } from './records';
import type { RecordDefinition } from './records';
import { eraseRecord, RecoveryRequired } from './recovery';

export const DAY_GAME_ID = 'dragon-valley-day';

export interface DayRecord {
  /** The local day `YYYY-MM-DD` the baseline was taken on. */
  readonly day: string;
  /** Window items (multiplication and division facts) at bronze or better when it began. */
  readonly lit: readonly string[];
  /** Each owned dragon's stage when it began. */
  readonly stages: Readonly<Record<string, DragonStage>>;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ITEM = /^[a-z0-9]+:[a-z0-9:x-]+$/;
const DRAGON = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_ITEMS = 1000;
const MAX_DRAGONS = 100;

export function isDayRecord(value: unknown): value is DayRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 3 || !['day', 'lit', 'stages'].every((key) => keys.includes(key))) {
    return false;
  }
  const { day, lit, stages } = record;
  if (typeof day !== 'string' || !DAY.test(day)) return false;
  if (!Array.isArray(lit) || lit.length > MAX_ITEMS) return false;
  if (!lit.every((item) => typeof item === 'string' && ITEM.test(item))) return false;
  if (new Set(lit).size !== lit.length) return false;
  if (typeof stages !== 'object' || stages === null || Array.isArray(stages)) return false;
  const entries = Object.entries(stages);
  return (
    entries.length <= MAX_DRAGONS &&
    entries.every(
      ([id, stage]) =>
        DRAGON.test(id) && (DRAGON_STAGES as readonly unknown[]).includes(stage as unknown),
    )
  );
}

export function dayRecord(profileId: string): RecordDefinition<DayRecord> {
  return {
    kind: 'day',
    gameId: DAY_GAME_ID,
    profileId,
    schemaVersion: 1,
    contentRevision: 'day-1',
    isValid: (value) => isDayRecord(value),
    isCurrent: isDayRecord,
  };
}

/** What the view says at the start of `day`: the facts that shine and how far dragons grew. */
export function dayBaseline(day: string, view: GameView): DayRecord {
  const lit = [...view.window.cells, ...view.window.division]
    .filter((cell) => cell.level !== 'dim')
    .map((cell) => cell.item);
  const stages: Record<string, DragonStage> = {};
  for (const dragon of view.dragons) stages[dragon.id] = dragon.stage;
  return { day, lit, stages };
}

/** One keeper's day record. Reading and writing it never stops the game. */
export class DayStore {
  private readonly record: RecordStore<DayRecord>;
  private value: DayRecord | undefined;

  constructor(
    private readonly storage: SaveStorage,
    profileId: string,
  ) {
    this.record = new RecordStore(storage, dayRecord(profileId));
  }

  current(): DayRecord | undefined {
    return this.value;
  }

  async open(): Promise<DayRecord | undefined> {
    try {
      this.value = await this.record.load();
    } catch (error) {
      this.value = undefined;
      // A record that cannot be read holds nothing the game save does not: start it again.
      if (error instanceof RecoveryRequired && error.actions.available) {
        await eraseRecord(this.storage, this.record.policy).catch(() => undefined);
      }
    }
    return this.value;
  }

  /**
   * Note how `day` begins, unless it already has its baseline. The note is kept for this page
   * even when it cannot be stored.
   */
  async begin(day: string, view: GameView): Promise<void> {
    if (this.value?.day === day) return;
    const next = dayBaseline(day, view);
    this.value = next;
    try {
      await this.record.save(next);
    } catch {
      // The diary then covers this page only; the game is not affected.
    }
  }
}
