/**
 * The Dragon Valley game as the shell's persistence layer sees it: the real rules adapter, the
 * validated content pack and the save namespace. Every keeper's game session is a runtime host
 * of this definition (`persistence/game-session.ts`).
 */
import type { ContentPack } from '@aegis/runtime';
import { dragonValleyAdapter } from '../../rules/adapter';
import { GAME_ID } from '../../rules/contract';
import type { ContentData, GameAction, GameView, ProfileState } from '../../rules/contract';
import type { GameDefinition, GameSession } from '../persistence/game-session';

export type DvGame = GameDefinition<ProfileState, GameAction, GameView, ContentData>;
export type DvSession = GameSession<ProfileState, GameAction, GameView, ContentData>;
export type DvPack = ContentPack<ContentData>;

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
    ...(loadHistory ? { loadHistory } : {}),
  };
}
