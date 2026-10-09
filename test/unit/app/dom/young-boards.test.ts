// @vitest-environment happy-dom
/**
 * The young players' boards (src/app/screens/boards/young.ts): taps become the rules' moves, the
 * board shows tens and ones but never the number being built, and a crossing check says the
 * frames' total.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type {
  BoardView,
  BundleSticksBoard,
  MinigameMove,
  TenFrameBoard,
} from '../../../../src/rules/contract';
import type { BoardContext } from '../../../../src/app/screens/boards/board';
import { bundleSticks, tenFrame } from '../../../../src/app/screens/boards/young';
import type { App } from '../../../../src/app/shell/app';
import { settle, testKit } from './kit';

let kit = testKit();
afterEach(() => kit.dispose());

function contextFor(board: BoardView): {
  context: BoardContext;
  moves: MinigameMove[];
  status: () => string;
} {
  kit = testKit();
  const moves: MinigameMove[] = [];
  let said = '';
  const context = {
    app: { kit } as unknown as App,
    active: {} as BoardContext['active'],
    board: (kind: BoardView['kind']) => (kind === board.kind ? board : null),
    index: () => 0,
    move: async (move: MinigameMove) => {
      moves.push(move);
      return true;
    },
    status: (text: string) => {
      said = text;
    },
    notation: () => 'czech' as const,
  } as unknown as BoardContext;
  return { context, moves, status: () => said };
}

const byTestId = (root: ParentNode, id: string): HTMLElement =>
  root.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;

describe('Ten Frame', () => {
  const cross: TenFrameBoard = {
    kind: 'ten-frame',
    task: 'cross',
    a: 8,
    b: 5,
    target: 13,
    frames: [8, 0],
    last: null,
    attempts: 0,
  };

  it('fills a frame up to the tapped place and takes back from a tapped counter', async () => {
    const { context, moves, status } = contextFor(cross);
    const painter = tenFrame(context);
    document.body.append(painter.element);
    painter.paint();
    expect(status()).toContain('8 + 5');
    expect(byTestId(painter.element, 'ten-frame-0-0').dataset['kind']).toBe('given');
    byTestId(painter.element, 'ten-frame-0-9').click();
    byTestId(painter.element, 'ten-frame-1-2').click();
    byTestId(painter.element, 'ten-frame-0-6').click();
    await settle();
    expect(moves).toEqual([
      { type: 'add', frame: 0, count: 2 },
      { type: 'add', frame: 1, count: 3 },
      { type: 'remove', frame: 0, count: 2 },
    ]);
  });

  it('checks a crossing with the total the frames show', async () => {
    const { context, moves } = contextFor({ ...cross, frames: [10, 3] });
    const painter = tenFrame(context);
    document.body.append(painter.element);
    painter.paint();
    byTestId(painter.element, 'ten-frame-check').click();
    await settle();
    expect(moves).toEqual([{ type: 'submit', value: 13 }]);
  });

  it('marks a wrong check kindly and keeps the counters', () => {
    const { context, status } = contextFor({
      ...cross,
      task: 'show',
      a: 0,
      b: null,
      target: 7,
      frames: [6, 0],
      last: 'wrong',
    });
    const painter = tenFrame(context);
    painter.paint();
    expect(status()).toMatch(/not quite/i);
    expect(byTestId(painter.element, 'ten-frames').dataset['last']).toBe('wrong');
    expect(byTestId(painter.element, 'ten-frame-0').dataset['count']).toBe('6');
  });
});

describe('Bundle Sticks', () => {
  const build: BundleSticksBoard = {
    kind: 'bundle-sticks',
    task: 'build',
    target: 34,
    a: null,
    b: null,
    bundles: 2,
    loose: 12,
    last: null,
    attempts: 0,
  };

  it('shows tens and ones, never the number, and sends the moves', async () => {
    const { context, moves, status } = contextFor(build);
    const painter = bundleSticks(context);
    document.body.append(painter.element);
    painter.paint();
    expect(status()).toContain('34');
    expect(byTestId(painter.element, 'sticks').textContent).not.toContain('32');
    expect(byTestId(painter.element, 'sticks-tens').children).toHaveLength(2);
    expect(byTestId(painter.element, 'sticks-ones').children).toHaveLength(12);
    expect((byTestId(painter.element, 'sticks-tie') as HTMLButtonElement).disabled).toBe(false);
    byTestId(painter.element, 'sticks-tie').click();
    byTestId(painter.element, 'sticks-add-stick').click();
    byTestId(painter.element, 'sticks-check').click();
    await settle();
    expect(moves).toEqual([{ type: 'bundle' }, { type: 'add', what: 'stick' }, { type: 'submit' }]);
  });

  it('offers only the moves the sticks allow', () => {
    const { context, status } = contextFor({
      ...build,
      task: 'sub',
      target: null,
      a: 42,
      b: 7,
      bundles: 4,
      loose: 2,
    });
    const painter = bundleSticks(context);
    painter.paint();
    expect(status()).toContain('42 \u2212 7');
    const disabled = (id: string): boolean =>
      (byTestId(painter.element, id) as HTMLButtonElement).disabled;
    expect(disabled('sticks-tie')).toBe(true);
    expect(disabled('sticks-untie')).toBe(false);
    expect(disabled('sticks-remove-stick')).toBe(false);
  });
});
