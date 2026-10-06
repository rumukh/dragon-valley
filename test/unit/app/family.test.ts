/**
 * Family records: name rules (Czech names welcome), up to four keepers in the contract's fixed
 * profile slots, and strict validation of what is stored.
 */
import { describe, expect, it } from 'vitest';
import {
  addKeeper,
  EMPTY_FAMILY,
  findKeeper,
  FAMILY_RECORD,
  isFamilyState,
  MAX_KEEPERS,
  MAX_NAME_LENGTH,
  normalizeName,
  removeKeeper,
  updateKeeper,
} from '../../../src/app/persistence/family';
import type { FamilyState } from '../../../src/app/persistence/family';
import {
  FAMILY_GAME_ID,
  FAMILY_PROFILE_ID,
  MAX_PROFILE_NAME_LENGTH,
  MAX_PROFILES,
  PROFILE_IDS,
} from '../../../src/rules/contract';
import type { KeeperAvatar } from '../../../src/rules/contract';

function family(...names: string[]): FamilyState {
  let state = EMPTY_FAMILY;
  for (const name of names) {
    const result = addKeeper(state, { name, avatar: 'keeper-1' });
    if (!result.ok) throw new Error(result.problem);
    state = result.value.state;
  }
  return state;
}

describe('keeper names', () => {
  it('tidies spaces and keeps Czech letters', () => {
    expect(normalizeName('  Šárka   Nováková ')).toEqual({ ok: true, name: 'Šárka Nováková' });
    expect(normalizeName('Jiří')).toEqual({ ok: true, name: 'Jiří' });
    expect(normalizeName("O'Brien-Smith")).toEqual({ ok: true, name: "O'Brien-Smith" });
  });

  it('normalises to NFC, so the same name typed two ways is the same name', () => {
    const decomposed = 'S\u030carka';
    expect(normalizeName(decomposed)).toEqual({ ok: true, name: 'Šarka' });
  });

  it('rejects empty, too long and symbol names, counting letters rather than code units', () => {
    expect(MAX_NAME_LENGTH).toBe(MAX_PROFILE_NAME_LENGTH);
    expect(normalizeName('   ')).toEqual({ ok: false, problem: 'empty' });
    expect(normalizeName('Ž'.repeat(MAX_NAME_LENGTH))).toEqual({
      ok: true,
      name: 'Ž'.repeat(MAX_NAME_LENGTH),
    });
    expect(normalizeName('a'.repeat(MAX_NAME_LENGTH + 1))).toEqual({ ok: false, problem: 'long' });
    expect(normalizeName('<b>')).toEqual({ ok: false, problem: 'chars' });
    expect(normalizeName('-Ann')).toEqual({ ok: false, problem: 'chars' });
    expect(normalizeName('Ann🐉')).toEqual({ ok: false, problem: 'chars' });
  });
});

describe('keepers', () => {
  it('takes the first free profile slot, and a removed slot is offered again', () => {
    let state = family('Ann', 'Ben', 'Cyril');
    expect(state.profiles.map((keeper) => keeper.id)).toEqual([
      'profile-1',
      'profile-2',
      'profile-3',
    ]);
    const removed = removeKeeper(state, 'profile-2');
    if (!removed.ok) throw new Error('remove failed');
    state = removed.value;
    const added = addKeeper(state, { name: 'Dana', avatar: 'keeper-4' });
    if (!added.ok) throw new Error('add failed');
    expect(added.value.keeper.id).toBe('profile-2');
    // Cards keep slot order, so a returning slot does not jump to the end.
    expect(added.value.state.profiles.map((keeper) => keeper.name)).toEqual([
      'Ann',
      'Dana',
      'Cyril',
    ]);
  });

  it('allows at most four keepers', () => {
    expect(MAX_KEEPERS).toBe(MAX_PROFILES);
    const state = family('Ann', 'Ben', 'Cyril', 'Dana');
    expect(state.profiles.map((keeper) => keeper.id)).toEqual([...PROFILE_IDS]);
    expect(addKeeper(state, { name: 'Eva', avatar: 'keeper-2' })).toEqual({
      ok: false,
      problem: 'full',
    });
  });

  it('refuses a second keeper with the same name, ignoring case', () => {
    const state = family('Ann');
    expect(addKeeper(state, { name: 'ANN', avatar: 'keeper-2' })).toEqual({
      ok: false,
      problem: 'taken',
    });
  });

  it('renames and changes the picture, but not into another keeper’s name', () => {
    const state = family('Ann', 'Ben');
    const renamed = updateKeeper(state, 'profile-1', { name: 'Anička', avatar: 'keeper-5' });
    if (!renamed.ok) throw new Error('rename failed');
    expect(findKeeper(renamed.value.state, 'profile-1')).toEqual({
      id: 'profile-1',
      name: 'Anička',
      avatar: 'keeper-5',
    });
    expect(updateKeeper(state, 'profile-1', { name: 'ben', avatar: 'keeper-1' })).toEqual({
      ok: false,
      problem: 'taken',
    });
    // Keeping one's own name with different letter case is fine.
    expect(updateKeeper(state, 'profile-1', { name: 'ANN', avatar: 'keeper-1' }).ok).toBe(true);
    expect(updateKeeper(state, 'profile-4', { name: 'Zoe', avatar: 'keeper-1' })).toEqual({
      ok: false,
      problem: 'missing',
    });
  });

  it('rejects unknown avatars', () => {
    expect(addKeeper(EMPTY_FAMILY, { name: 'Ann', avatar: 'keeper-9' as KeeperAvatar })).toEqual({
      ok: false,
      problem: 'avatar',
    });
  });

  it('refuses to remove a keeper who is not there', () => {
    expect(removeKeeper(family('Ann'), 'profile-3')).toEqual({ ok: false, problem: 'missing' });
  });
});

describe('stored family validation', () => {
  it('stores the record under the contract identity', () => {
    expect(FAMILY_RECORD.gameId).toBe(FAMILY_GAME_ID);
    expect(FAMILY_RECORD.profileId).toBe(FAMILY_PROFILE_ID);
  });

  it('accepts what the operations produce', () => {
    expect(isFamilyState(EMPTY_FAMILY)).toBe(true);
    expect(isFamilyState(family('Ann', 'Šárka', 'Jiří', 'Dana'))).toBe(true);
  });

  it('rejects tampered records', () => {
    const ann = { id: 'profile-1', name: 'Ann', avatar: 'keeper-1' };
    const cases: unknown[] = [
      null,
      [],
      {},
      { profiles: {} },
      { profiles: [], extra: 1 },
      { profiles: [{ ...ann, id: 'profile-5' }] },
      { profiles: [{ ...ann, id: 'child-1' }] },
      { profiles: [ann, { ...ann, name: 'Ben' }] },
      { profiles: [ann, { ...ann, id: 'profile-2', name: 'ann' }] },
      { profiles: [{ ...ann, name: ' Ann' }] },
      { profiles: [{ ...ann, name: 'a'.repeat(MAX_NAME_LENGTH + 1) }] },
      { profiles: [{ ...ann, avatar: 'keeper-0' }] },
      { profiles: [{ ...ann, seed: 'dragon-valley:profile-1' }] },
      {
        profiles: ['profile-1', 'profile-2', 'profile-3', 'profile-4', 'profile-4'].map(
          (id, index) => ({ id, name: `Kid ${index}`, avatar: 'keeper-1' }),
        ),
      },
    ];
    for (const value of cases) expect(isFamilyState(value)).toBe(false);
  });
});
