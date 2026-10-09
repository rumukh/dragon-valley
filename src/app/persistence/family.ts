/**
 * The family record: up to four keepers (child profiles) on this device, in the contract's
 * fixed profile slots `profile-1` … `profile-4` (docs/contract.md §13). A new keeper takes the
 * first free slot; removing a keeper erases that slot's game and preferences records first,
 * and the storage service's revision tombstones keep a stale window from writing into a
 * reused slot. Names and avatars live only here, never in game state.
 *
 * A keeper may also carry a pending `grade`: the class chosen in the new-keeper editor before
 * the keeper's game save exists. The play screen hands it to the game (`setSetting grade`) at
 * the first session and then drops it, so the save's `settings.grade` stays the only lasting
 * home of a keeper's grade. Schema 2 added the optional field; schema 1 records migrate as they
 * are.
 */
import {
  FAMILY_GAME_ID,
  GRADES,
  FAMILY_PROFILE_ID,
  KEEPER_AVATARS,
  MAX_PROFILE_NAME_LENGTH,
  MAX_PROFILES,
  PROFILE_IDS,
} from '../../rules/contract';
import type { Grade, KeeperAvatar, ProfileId } from '../../rules/contract';
import type { RecordDefinition } from './records';

export const MAX_KEEPERS = MAX_PROFILES;
export const MAX_NAME_LENGTH = MAX_PROFILE_NAME_LENGTH;
/** Schema 2 added a keeper's optional pending `grade`. */
export const FAMILY_SCHEMA_VERSION = 2;

export interface Keeper {
  readonly id: ProfileId;
  readonly name: string;
  readonly avatar: KeeperAvatar;
  /** The grade chosen before the game save exists; handed to the game at the first session. */
  readonly grade?: Grade;
}

export interface FamilyState {
  readonly profiles: readonly Keeper[];
}

export type NameProblem = 'empty' | 'long' | 'chars' | 'taken';
export type FamilyProblem = NameProblem | 'full' | 'missing' | 'avatar' | 'grade';
export type FamilyResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problem: FamilyProblem };

export const EMPTY_FAMILY: FamilyState = { profiles: [] };

const NAME_PATTERN = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '’.-]*$/u;

/** Tidy a typed name (Unicode NFC, single spaces, trimmed) and check it. */
export function normalizeName(
  raw: string,
):
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly problem: NameProblem } {
  const name = raw.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (name === '') return { ok: false, problem: 'empty' };
  if ([...name].length > MAX_NAME_LENGTH) return { ok: false, problem: 'long' };
  if (!NAME_PATTERN.test(name)) return { ok: false, problem: 'chars' };
  return { ok: true, name };
}

function sameName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function isKeeperAvatar(value: unknown): value is KeeperAvatar {
  return typeof value === 'string' && (KEEPER_AVATARS as readonly string[]).includes(value);
}

export function isGrade(value: unknown): value is Grade {
  return typeof value === 'number' && (GRADES as readonly number[]).includes(value);
}

export function isProfileId(value: unknown): value is ProfileId {
  return typeof value === 'string' && (PROFILE_IDS as readonly string[]).includes(value);
}

function hasExactKeys(value: object, keys: readonly string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
}

export function isFamilyState(
  value: unknown,
  version = FAMILY_SCHEMA_VERSION,
): value is FamilyState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  if (!hasExactKeys(value, ['profiles'])) return false;
  const { profiles } = value as Record<string, unknown>;
  if (!Array.isArray(profiles) || profiles.length > MAX_KEEPERS) return false;
  const ids = new Set<string>();
  const names: string[] = [];
  for (const keeper of profiles as unknown[]) {
    if (typeof keeper !== 'object' || keeper === null || Array.isArray(keeper)) return false;
    const withGrade = version >= 2 && 'grade' in keeper;
    if (
      !hasExactKeys(
        keeper,
        withGrade ? ['id', 'name', 'avatar', 'grade'] : ['id', 'name', 'avatar'],
      )
    ) {
      return false;
    }
    const { id, name, avatar, grade } = keeper as Record<string, unknown>;
    if (withGrade && !isGrade(grade)) return false;
    if (!isProfileId(id) || ids.has(id) || typeof name !== 'string') return false;
    const normalized = normalizeName(name);
    if (!normalized.ok || normalized.name !== name) return false;
    if (names.some((other) => sameName(other, name))) return false;
    if (!isKeeperAvatar(avatar)) return false;
    ids.add(id);
    names.push(name);
  }
  return true;
}

export function findKeeper(state: FamilyState, id: string): Keeper | undefined {
  return state.profiles.find((keeper) => keeper.id === id);
}

/** Keepers in slot order, so cards keep their places when one is removed. */
function ordered(profiles: readonly Keeper[]): Keeper[] {
  return [...profiles].sort((a, b) => PROFILE_IDS.indexOf(a.id) - PROFILE_IDS.indexOf(b.id));
}

export function addKeeper(
  state: FamilyState,
  input: { name: string; avatar: KeeperAvatar; grade?: Grade },
): FamilyResult<{ state: FamilyState; keeper: Keeper }> {
  const slot = PROFILE_IDS.find((id) => !findKeeper(state, id));
  if (!slot) return { ok: false, problem: 'full' };
  const normalized = normalizeName(input.name);
  if (!normalized.ok) return normalized;
  if (state.profiles.some((keeper) => sameName(keeper.name, normalized.name))) {
    return { ok: false, problem: 'taken' };
  }
  if (!isKeeperAvatar(input.avatar)) return { ok: false, problem: 'avatar' };
  if (input.grade !== undefined && !isGrade(input.grade)) return { ok: false, problem: 'grade' };
  const keeper: Keeper = {
    id: slot,
    name: normalized.name,
    avatar: input.avatar,
    ...(input.grade !== undefined ? { grade: input.grade } : {}),
  };
  return {
    ok: true,
    value: { state: { profiles: ordered([...state.profiles, keeper]) }, keeper },
  };
}

export function updateKeeper(
  state: FamilyState,
  id: string,
  input: { name: string; avatar: KeeperAvatar },
): FamilyResult<{ state: FamilyState; keeper: Keeper }> {
  const current = findKeeper(state, id);
  if (!current) return { ok: false, problem: 'missing' };
  const normalized = normalizeName(input.name);
  if (!normalized.ok) return normalized;
  if (state.profiles.some((keeper) => keeper.id !== id && sameName(keeper.name, normalized.name))) {
    return { ok: false, problem: 'taken' };
  }
  if (!isKeeperAvatar(input.avatar)) return { ok: false, problem: 'avatar' };
  const keeper: Keeper = { ...current, name: normalized.name, avatar: input.avatar };
  return {
    ok: true,
    value: {
      state: { profiles: state.profiles.map((other) => (other.id === id ? keeper : other)) },
      keeper,
    },
  };
}

/** Set or drop (`null`) a keeper's pending grade. */
export function setPendingGrade(
  state: FamilyState,
  id: string,
  grade: Grade | null,
): FamilyResult<{ state: FamilyState; keeper: Keeper }> {
  const current = findKeeper(state, id);
  if (!current) return { ok: false, problem: 'missing' };
  if (grade !== null && !isGrade(grade)) return { ok: false, problem: 'grade' };
  const rest: Keeper = { id: current.id, name: current.name, avatar: current.avatar };
  const keeper: Keeper = grade === null ? rest : { ...rest, grade };
  return {
    ok: true,
    value: {
      state: { profiles: state.profiles.map((other) => (other.id === id ? keeper : other)) },
      keeper,
    },
  };
}

export function removeKeeper(state: FamilyState, id: string): FamilyResult<FamilyState> {
  if (!findKeeper(state, id)) return { ok: false, problem: 'missing' };
  return { ok: true, value: { profiles: state.profiles.filter((keeper) => keeper.id !== id) } };
}

export const FAMILY_RECORD: RecordDefinition<FamilyState> = {
  kind: 'family',
  gameId: FAMILY_GAME_ID,
  profileId: FAMILY_PROFILE_ID,
  schemaVersion: FAMILY_SCHEMA_VERSION,
  contentRevision: 'family-1',
  isValid: (value, version) => isFamilyState(value, version),
  isCurrent: (value): value is FamilyState => isFamilyState(value),
  // Schema 2 only adds the optional pending grade, so a schema 1 family is already valid.
  migrations: [{ from: 1, to: 2, migrate: (state: unknown) => state }],
};
