/**
 * Saved data from the outside, the way a broken disk or another tab would see it.
 *
 * The game stores every record in one IndexedDB database (`dragon-valley`, object store
 * `saves`, docs/app.md §4) under the key `JSON.stringify([gameId, profileId])`, as a history
 * `{ current, previous }` of `{ revision, payload }`. These helpers read and overwrite that
 * history to stage corrupt records, and install faults (failing writes, storage that refuses to
 * open) before the game starts. They never read game state to decide what to answer.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { expect } from './fixtures';

export const DATABASE = 'dragon-valley';
export const FAMILY_KEY: RecordKey = ['dragon-valley-family', 'family'];
export const PREFERENCES_GAME_ID = 'dragon-valley-preferences';
/** The Dragon Diary's day record (docs/app.md §4): how the keeper's day began. */
export const DAY_GAME_ID = 'dragon-valley-day';

export type RecordKey = readonly [gameId: string, profileId: string];

export interface StoredSave {
  readonly revision: number;
  readonly payload: string;
}

export interface SaveHistory {
  readonly current?: StoredSave;
  readonly previous?: StoredSave;
  readonly revision?: number;
}

export function preferencesKey(profileId: string): RecordKey {
  return [PREFERENCES_GAME_ID, profileId];
}

type Operation =
  | { readonly type: 'keys' }
  | { readonly type: 'get'; readonly id: string }
  | { readonly type: 'put'; readonly id: string; readonly value: SaveHistory };

async function run<T>(page: Page, operation: Operation): Promise<T> {
  return page.evaluate(
    async ({ database, operation }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(database, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('saves');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        return await new Promise<unknown>((resolve, reject) => {
          const transaction = db.transaction(
            'saves',
            operation.type === 'put' ? 'readwrite' : 'readonly',
          );
          const store = transaction.objectStore('saves');
          const request =
            operation.type === 'keys'
              ? store.getAllKeys()
              : operation.type === 'get'
                ? store.get(operation.id)
                : store.put(operation.value, operation.id);
          let result: unknown;
          request.onsuccess = () => {
            result = request.result;
          };
          transaction.oncomplete = () => resolve(operation.type === 'put' ? undefined : result);
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        });
      } finally {
        db.close();
      }
    },
    { database: DATABASE, operation },
  ) as Promise<T>;
}

export async function recordKeys(page: Page): Promise<RecordKey[]> {
  const keys = await run<string[]>(page, { type: 'keys' });
  return keys.map((key) => JSON.parse(key) as RecordKey);
}

/** The game save of a keeper, whatever namespace the current rules use. */
export async function gameKey(page: Page, profileId: string): Promise<RecordKey> {
  const keys = await recordKeys(page);
  const found = keys.find(
    ([gameId, profile]) =>
      profile === profileId &&
      gameId !== PREFERENCES_GAME_ID &&
      gameId !== DAY_GAME_ID &&
      gameId !== FAMILY_KEY[0],
  );
  expect(found, `a stored game save for ${profileId} among ${JSON.stringify(keys)}`).toBeTruthy();
  return found!;
}

export async function readHistory(page: Page, key: RecordKey): Promise<SaveHistory | undefined> {
  return run<SaveHistory | undefined>(page, { type: 'get', id: JSON.stringify(key) });
}

export async function writeHistory(page: Page, key: RecordKey, value: SaveHistory): Promise<void> {
  await run<void>(page, { type: 'put', id: JSON.stringify(key), value });
}

/**
 * Damage the current copy of a record the way a failing disk would, keeping the intact copy
 * as the "previous" one the recovery screen can go back to. Returns both payloads.
 */
export async function corruptRecord(
  page: Page,
  key: RecordKey,
  damaged = '{"format":"aegis.save","formatVersion":1,"gameId":',
): Promise<{ readonly intact: string; readonly damaged: string }> {
  const history = await readHistory(page, key);
  expect(history?.current, `a stored ${key.join('/')} record to damage`).toBeTruthy();
  const current = history!.current!;
  await writeHistory(page, key, {
    current: { revision: current.revision + 1, payload: damaged },
    previous: current,
  });
  return { intact: current.payload, damaged };
}

// ---- Faults ---------------------------------------------------------------------------------

export interface StorageFaults {
  /** Every IndexedDB write throws, as a full disk would. */
  readonly failWrites: boolean;
  /** IndexedDB refuses to open, as some private windows do. */
  readonly unavailable: boolean;
}

/** Runs before the game in every page of the context; toggled with `setStorageFaults`. */
function storageFaultScript(initial: StorageFaults): void {
  const control = { failWrites: initial.failWrites, unavailable: initial.unavailable };
  Object.defineProperty(window, '__dvQaStorage', { value: control, configurable: true });
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: [unknown, IDBValidKey?]) {
    if (control.failWrites) {
      throw new DOMException('QA fault: the disk is full.', 'QuotaExceededError');
    }
    return put.apply(this, args);
  };
  const open = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function (this: IDBFactory, ...args: [string, number?]) {
    if (control.unavailable) {
      throw new DOMException('QA fault: storage is not available here.', 'InvalidStateError');
    }
    return open.apply(this, args);
  };
}

export async function installStorageFaults(
  context: BrowserContext,
  initial: Partial<StorageFaults> = {},
): Promise<void> {
  await context.addInitScript(storageFaultScript, {
    failWrites: false,
    unavailable: false,
    ...initial,
  });
}

export async function setStorageFaults(page: Page, faults: Partial<StorageFaults>): Promise<void> {
  await page.evaluate((next) => {
    const control = (window as unknown as { __dvQaStorage?: Record<string, boolean> })
      .__dvQaStorage;
    if (!control) throw new Error('installStorageFaults() was not called before the page loaded.');
    Object.assign(control, next);
  }, faults);
}
