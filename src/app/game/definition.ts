/**
 * The Dragon Valley game as the shell's persistence layer sees it: the real rules adapter, the
 * validated content pack and the save namespace. Every keeper's game session is a runtime host
 * of this definition (`persistence/game-session.ts`).
 */
import type { SaveMigration } from '@aegis/browser/save';
import type { ContentPack, RuntimeSnapshot } from '@aegis/runtime';
import { dragonValleyAdapter } from '../../rules/adapter';
import { GAME_ID, STATE_VERSION, migrateSnapshot } from '../../rules/contract';
import type { ContentData, GameAction, GameView, ProfileState } from '../../rules/contract';
import type { GameDefinition, GameSession } from '../persistence/game-session';

export type DvGame = GameDefinition<ProfileState, GameAction, GameView, ContentData>;
export type DvSession = GameSession<ProfileState, GameAction, GameView, ContentData>;
export type DvPack = ContentPack<ContentData>;

/** Save upgrades, one per older state version (`migrateSnapshot`, docs/contract.md §7.6). */
export const SAVE_MIGRATIONS: readonly SaveMigration[] = Array.from(
  { length: STATE_VERSION - 1 },
  (_, index) => ({
    from: index + 1,
    to: index + 2,
    migrate: (state: unknown) => migrateSnapshot(state as RuntimeSnapshot, index + 2),
  }),
);

/** The game for the newest pack: `history` holds older shipped packs at hand, and `loadHistory`
 * fetches one a save pins (`content/history.ts`). */
export function dragonValleyGame(
  content: DvPack,
  history: readonly DvPack[] = [],
  loadHistory?: (revision: string) => Promise<DvPack>,
): DvGame {
  return {
    gameId: GAME_ID,
    adapter: dragonValleyAdapter,
    content,
    history,
    migrations: SAVE_MIGRATIONS,
    ...(loadHistory ? { loadHistory } : {}),
  };
}
