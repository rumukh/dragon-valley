/**
 * Small records (family, preferences): stored through the SDK save service, re-read after a
 * failed write, and explicit recovery when a stored record cannot be opened.
 */
import { MemorySaveStorage } from '@aegis/browser/save';
import type { SaveKey, StoredSave } from '@aegis/browser/save';
import { describe, expect, it } from 'vitest';
import { FAMILY_RECORD } from '../../../src/app/persistence/family';
import { DEFAULT_PREFERENCES } from '../../../src/app/persistence/preferences';
import { RecordStore, recordPolicy } from '../../../src/app/persistence/records';
import { eraseRecord, RecoveryRequired } from '../../../src/app/persistence/recovery';
import { FamilyStore, PreferencesStore } from '../../../src/app/persistence/stores';
import type { Keeper } from '../../../src/app/persistence/family';

const EMA: Keeper = { id: 'profile-1', name: 'Ema', avatar: 'keeper-1' };

/** Memory storage whose next writes can be made to fail, as a full disk would. */
class FlakyStorage extends MemorySaveStorage {
  failures = 0;
  override async compareAndSwap(key: SaveKey, expected: number, next: StoredSave): Promise<void> {
    if (this.failures > 0) {
      this.failures--;
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    }
    return super.compareAndSwap(key, expected, next);
  }
}

describe('family store', () => {
  it('stores keepers and opens them again from storage', async () => {
    const storage = new MemorySaveStorage();
    const family = new FamilyStore(storage);
    await family.open();
    const ema = await family.add({ name: 'Ema', avatar: 'keeper-3' });
    expect(ema).toMatchObject({ ok: true, value: { id: 'profile-1', name: 'Ema' } });
    await family.update('profile-1', { name: 'Emička', avatar: 'keeper-4' });
    const again = new FamilyStore(storage);
    expect((await again.open()).profiles).toEqual([
      { id: 'profile-1', name: 'Emička', avatar: 'keeper-4' },
    ]);
  });

  it('reports validation problems without writing', async () => {
    const storage = new MemorySaveStorage();
    const family = new FamilyStore(storage);
    await family.open();
    expect(await family.add({ name: '   ', avatar: 'keeper-1' })).toEqual({
      ok: false,
      problem: 'empty',
    });
    expect((await storage.read(recordPolicy(FAMILY_RECORD))).current).toBeUndefined();
  });

  it('keeps the stored state after a failed write, and the next write works', async () => {
    const storage = new FlakyStorage();
    const family = new FamilyStore(storage);
    await family.open();
    await family.add({ name: 'Ema', avatar: 'keeper-1' });
    storage.failures = 1;
    await expect(family.add({ name: 'Tom', avatar: 'keeper-2' })).rejects.toThrow();
    expect(family.state().profiles.map((keeper) => keeper.name)).toEqual(['Ema']);
    expect(await family.add({ name: 'Tom', avatar: 'keeper-2' })).toMatchObject({ ok: true });
    expect(family.state().profiles.map((keeper) => keeper.name)).toEqual(['Ema', 'Tom']);
  });

  it('erases a removed keeper’s records before dropping them from the list', async () => {
    const storage = new MemorySaveStorage();
    const family = new FamilyStore(storage);
    await family.open();
    await family.add({ name: 'Ema', avatar: 'keeper-1' });
    const order: string[] = [];
    await family.remove('profile-1', async () => {
      order.push(`erase while listed: ${family.state().profiles.length}`);
    });
    expect(order).toEqual(['erase while listed: 1']);
    expect(family.state().profiles).toEqual([]);
  });
});

describe('preferences store', () => {
  it('starts from the defaults and persists each change', async () => {
    const storage = new MemorySaveStorage();
    const store = new PreferencesStore(storage, 'profile-1');
    expect(await store.open()).toEqual(DEFAULT_PREFERENCES);
    await store.change((draft) => {
      draft.notation = 'international';
    });
    const reopened = new PreferencesStore(storage, 'profile-1');
    expect((await reopened.open()).notation).toBe('international');
    expect((await new PreferencesStore(storage, 'profile-2').open()).notation).toBe('czech');
  });
});

describe('record recovery', () => {
  it('turns a corrupt record into explicit recovery that keeps the original bytes', async () => {
    const storage = new MemorySaveStorage();
    const store = new RecordStore(storage, FAMILY_RECORD);
    await store.load();
    await store.save({ profiles: [] });
    await store.save({ profiles: [EMA] });
    const policy = recordPolicy(FAMILY_RECORD);
    const history = await storage.read(policy);
    const corrupt = history.current!.payload.replace('"keeper-1"', '"keeper-99"');
    expect(corrupt).not.toBe(history.current!.payload);
    await storage.compareAndSwap(policy, history.current!.revision, {
      revision: history.current!.revision + 1,
      payload: corrupt,
    });

    const error = await new RecordStore(storage, FAMILY_RECORD).load().catch((cause) => cause);
    expect(error).toBeInstanceOf(RecoveryRequired);
    const recovery = error as RecoveryRequired;
    expect(recovery.kind).toBe('family');
    expect(recovery.actions.available).toBe(true);
    expect(recovery.actions.original).toBe(corrupt);
    expect(recovery.actions.previous).toBeDefined();

    await expect(recovery.actions.replace('{"not":"a save"}')).rejects.toThrow();
    await recovery.actions.replace(recovery.actions.previous!);
    expect(await new RecordStore(storage, FAMILY_RECORD).load()).toEqual({ profiles: [EMA] });
  });

  it('resets a record only through the explicit action, leaving a revision tombstone', async () => {
    const storage = new MemorySaveStorage();
    const policy = recordPolicy(FAMILY_RECORD);
    await storage.compareAndSwap(policy, 0, { revision: 1, payload: '{"broken": true' });
    const error = (await new RecordStore(storage, FAMILY_RECORD)
      .load()
      .catch((cause) => cause)) as RecoveryRequired;
    expect(error).toBeInstanceOf(RecoveryRequired);
    expect(error.code).toBe('invalid-data');
    await error.actions.reset();
    expect(await storage.read(policy)).toEqual({ revision: 2 });
    expect(await new RecordStore(storage, FAMILY_RECORD).load()).toBeUndefined();
  });

  it('erases a record without loading it, and leaves an absent record alone', async () => {
    const storage = new MemorySaveStorage();
    const policy = recordPolicy(FAMILY_RECORD);
    await eraseRecord(storage, policy);
    expect(await storage.read(policy)).toEqual({});
    const store = new RecordStore(storage, FAMILY_RECORD);
    await store.load();
    await store.save({ profiles: [] });
    await eraseRecord(storage, policy);
    expect((await storage.read(policy)).current).toBeUndefined();
  });

  it('reports unreadable storage as unavailable recovery with no destructive actions', async () => {
    const storage = new MemorySaveStorage();
    storage.read = async () => {
      throw new DOMException('Storage is disabled.', 'SecurityError');
    };
    const error = (await new RecordStore(storage, FAMILY_RECORD)
      .load()
      .catch((cause) => cause)) as RecoveryRequired;
    expect(error).toBeInstanceOf(RecoveryRequired);
    expect(error.actions.available).toBe(false);
    await expect(error.actions.reset()).rejects.toThrow();
  });
});
