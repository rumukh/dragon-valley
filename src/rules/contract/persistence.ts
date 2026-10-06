/**
 * Identifiers shared by the rules and the browser persistence layer (S3).
 *
 * Storage layout (docs/architecture.md): one IndexedDB database; a family record listing up to
 * four child profiles; per profile, one game save (a runtime snapshot through the strict
 * checkpoint bridge) and one preferences record. Names, avatars and presentation preferences are
 * not game state and never enter a game hash.
 */

/** The runtime adapter ID, recorded in every snapshot. */
export const ADAPTER_ID = 'dragon-valley';

/** IndexedDB database name used by `IndexedDbSaveStorage`. */
export const SAVE_DATABASE = 'dragon-valley';

/** `SaveService` game IDs. */
export const GAME_ID = 'dragon-valley';
export const FAMILY_GAME_ID = 'dragon-valley-family';
export const PREFERENCES_GAME_ID = 'dragon-valley-preferences';

/** Up to four children share a family device. Profile IDs are fixed slots. */
export const MAX_PROFILES = 4;
export const PROFILE_IDS = ['profile-1', 'profile-2', 'profile-3', 'profile-4'] as const;
export type ProfileId = (typeof PROFILE_IDS)[number];

/** The `SaveService` profile ID of the single family record (profiles, names, avatars). */
export const FAMILY_PROFILE_ID = 'family';

/** Longest child name shown on a profile card. */
export const MAX_PROFILE_NAME_LENGTH = 16;

/**
 * The runtime seed of a profile's game. Fixed per profile slot so a reset profile replays the
 * same deterministic sequence for the same actions (useful for support and tests); the
 * sequence still differs between children because their actions differ.
 */
export function profileSeed(profile: ProfileId): string {
  return `dragon-valley:${profile}`;
}
