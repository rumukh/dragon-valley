/**
 * The in-memory screen stack: explicit Back, a root that cannot be popped, bounded depth.
 */
import { describe, expect, it } from 'vitest';
import { createScreenStack, MAX_DEPTH } from '../../../src/app/router/stack';

describe('screen stack', () => {
  it('pushes, replaces and goes back to the previous entry', () => {
    const stack = createScreenStack('title');
    stack.push('keepers');
    stack.push('hub');
    expect(stack.entries()).toEqual(['title', 'keepers', 'hub']);
    expect(stack.previous()).toBe('keepers');
    stack.replace('round');
    expect(stack.current()).toBe('round');
    expect(stack.back()).toBe('keepers');
    expect(stack.depth()).toBe(2);
  });

  it('never pops the root', () => {
    const stack = createScreenStack('title');
    expect(stack.previous()).toBeUndefined();
    expect(stack.back()).toBeUndefined();
    expect(stack.entries()).toEqual(['title']);
  });

  it('resets to a single entry', () => {
    const stack = createScreenStack('title');
    stack.push('keepers');
    stack.push('hub');
    stack.reset('recovery');
    expect(stack.entries()).toEqual(['recovery']);
    expect(stack.back()).toBeUndefined();
  });

  it('keeps the root and drops the oldest entries above it beyond the maximum depth', () => {
    const stack = createScreenStack('root');
    for (let index = 1; index <= MAX_DEPTH + 5; index++) stack.push(`screen-${index}`);
    expect(stack.depth()).toBe(MAX_DEPTH);
    expect(stack.entries()[0]).toBe('root');
    expect(stack.current()).toBe(`screen-${MAX_DEPTH + 5}`);
  });
});
