/**
 * Board moves in order (src/app/controller/moves.ts): a move made while the one before it is
 * still being saved waits for it instead of being dropped, and one failure stops nothing after
 * it.
 */
import { describe, expect, it } from 'vitest';
import { createMoveQueue } from '../../../src/app/controller/moves';

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

describe('board moves', () => {
  it('runs a move made during a slow save after it, in the order they were made', async () => {
    const slow = deferred();
    const ran: string[] = [];
    const queue = createMoveQueue(async (move: string) => {
      ran.push(`start ${move}`);
      if (move === 'deal 1') await slow.promise;
      ran.push(`end ${move}`);
      return true;
    });
    const first = queue.push('deal 1');
    const second = queue.push('deal 2');
    await Promise.resolve();
    expect(queue.pending()).toBe(2);
    expect(ran).toEqual(['start deal 1']);
    slow.resolve();
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(ran).toEqual(['start deal 1', 'end deal 1', 'start deal 2', 'end deal 2']);
    expect(queue.pending()).toBe(0);
  });

  it('keeps going after a failed move, which only its own caller hears about', async () => {
    const ran: string[] = [];
    const queue = createMoveQueue(async (move: string) => {
      ran.push(move);
      if (move === 'bad') throw new Error('refused');
      return move !== 'stale';
    });
    const bad = queue.push('bad');
    const stale = queue.push('stale');
    const good = queue.push('good');
    await expect(bad).rejects.toThrow('refused');
    await expect(stale).resolves.toBe(false);
    await expect(good).resolves.toBe(true);
    expect(ran).toEqual(['bad', 'stale', 'good']);
  });
});
