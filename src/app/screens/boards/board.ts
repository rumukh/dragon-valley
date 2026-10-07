/**
 * What a minigame board painter gets from the minigame screen (`screens/minigames.ts`), and what
 * it gives back. A painter draws one kind of board from the rules' typed board view and sends
 * the child's moves; it never decides whether a move is right (the view says so).
 */
import type { BoardView, MinigameMove } from '../../../rules/contract';
import type { ActiveKeeper, App } from '../../shell/app';

export type BoardOf<K extends BoardView['kind']> = Extract<BoardView, { kind: K }>;

export interface BoardContext {
  readonly app: App;
  readonly active: ActiveKeeper;
  /** The current board of this kind, or null once the round has moved past it. */
  board<K extends BoardView['kind']>(kind: K): BoardOf<K> | null;
  /** Which board of the round is showing (0 first); a new number is a new board. */
  index(): number;
  /** Send one move against the current board revision; false when the round is over. */
  move(move: MinigameMove): Promise<boolean>;
  status(text: string): void;
  notation(): 'czech' | 'international';
}

export interface BoardPainter {
  readonly element: HTMLElement;
  paint(): void;
  focus(): HTMLElement | null;
  /** Release what outlives the element, such as a keypad's keyboard handler. */
  dispose?(): void;
}
