/**
 * The keypad state machine shared by on-screen keys and the physical keyboard, including the
 * remainder mode (quotient and remainder fields).
 */
import { describe, expect, it } from 'vitest';
import { createKeypad, isEmpty, keyToInput, reduceKeypad } from '../../../src/app/ui/keypad-state';
import type { KeypadInput, KeypadState, KeypadStep } from '../../../src/app/ui/keypad-state';

function run(state: KeypadState, inputs: KeypadInput[]): { state: KeypadState; last: KeypadStep } {
  let current = state;
  let last: KeypadStep = { state };
  for (const input of inputs) {
    last = reduceKeypad(current, input);
    current = last.state;
  }
  return { state: current, last };
}

const digits = (text: string): KeypadInput[] =>
  [...text].map((digit) => ({ type: 'digit', digit: Number(digit) }));

describe('keypad in number mode', () => {
  it('types digits and submits the number', () => {
    const { state, last } = run(createKeypad('number'), [...digits('56'), { type: 'submit' }]);
    expect(state.fields).toEqual(['56']);
    expect(last.answer).toEqual({ kind: 'number', value: 56 });
  });

  it('refuses digits beyond the maximum and reports it', () => {
    const { state, last } = run(createKeypad('number', 2), digits('123'));
    expect(state.fields).toEqual(['12']);
    expect(last.rejected).toBe('full');
  });

  it('replaces a lone zero instead of stacking leading zeros', () => {
    expect(run(createKeypad('number'), digits('05')).state.fields).toEqual(['5']);
    expect(run(createKeypad('number'), digits('00')).state.fields).toEqual(['0']);
    const zero = run(createKeypad('number'), [...digits('0'), { type: 'submit' }]);
    expect(zero.last.answer).toEqual({ kind: 'number', value: 0 });
  });

  it('deletes with backspace and gently refuses an empty submit', () => {
    const typed = run(createKeypad('number'), [...digits('42'), { type: 'backspace' }]);
    expect(typed.state.fields).toEqual(['4']);
    const empty = run(createKeypad('number'), [{ type: 'backspace' }, { type: 'submit' }]);
    expect(empty.last.rejected).toBe('empty');
    expect(empty.last.answer).toBeUndefined();
  });

  it('clears back to the initial state', () => {
    const { state } = run(createKeypad('number'), [...digits('99'), { type: 'clear' }]);
    expect(isEmpty(state)).toBe(true);
    expect(state).toEqual(createKeypad('number'));
  });

  it('rejects impossible digits and maximums', () => {
    expect(() => reduceKeypad(createKeypad('number'), { type: 'digit', digit: 10 })).toThrow();
    expect(() => createKeypad('number', 0)).toThrow();
    expect(() => createKeypad('number', 8)).toThrow();
  });
});

describe('keypad in remainder mode', () => {
  it('fills the quotient, moves to the remainder and submits both', () => {
    const { last } = run(createKeypad('remainder'), [
      ...digits('4'),
      { type: 'next' },
      ...digits('3'),
      { type: 'submit' },
    ]);
    expect(last.answer).toEqual({ kind: 'remainder', quotient: 4, remainder: 3 });
  });

  it('moves to the empty remainder field instead of submitting half an answer', () => {
    const { state, last } = run(createKeypad('remainder'), [...digits('4'), { type: 'submit' }]);
    expect(last.answer).toBeUndefined();
    expect(last.rejected).toBe('empty');
    expect(state.active).toBe(1);
  });

  it('backspace on an empty remainder returns to the quotient', () => {
    const { state } = run(createKeypad('remainder'), [
      ...digits('12'),
      { type: 'next' },
      { type: 'backspace' },
      { type: 'backspace' },
    ]);
    expect(state.active).toBe(0);
    expect(state.fields).toEqual(['1', '']);
  });

  it('keeps focus inside the two fields', () => {
    const start = createKeypad('remainder');
    expect(run(start, [{ type: 'previous' }]).state.active).toBe(0);
    expect(run(start, [{ type: 'next' }, { type: 'next' }]).state.active).toBe(1);
    expect(run(start, [{ type: 'focus', field: 7 }]).state.active).toBe(1);
  });

  it('submitting with an empty quotient goes back to the quotient', () => {
    const { state, last } = run(createKeypad('remainder'), [
      { type: 'next' },
      ...digits('3'),
      { type: 'submit' },
    ]);
    expect(last.rejected).toBe('empty');
    expect(state.active).toBe(0);
  });
});

describe('physical keys', () => {
  it('maps digits, deletion and Enter in both modes', () => {
    for (const mode of ['number', 'remainder'] as const) {
      expect(keyToInput('7', mode)).toEqual({ type: 'digit', digit: 7 });
      expect(keyToInput('Backspace', mode)).toEqual({ type: 'backspace' });
      expect(keyToInput('Delete', mode)).toEqual({ type: 'backspace' });
      expect(keyToInput('Enter', mode)).toEqual({ type: 'submit' });
      expect(keyToInput('Tab', mode)).toBeNull();
      expect(keyToInput('a', mode)).toBeNull();
    }
  });

  it('moves between remainder fields with r, R, Space and the arrows only in remainder mode', () => {
    for (const key of ['r', 'R', ' ', 'ArrowRight']) {
      expect(keyToInput(key, 'remainder')).toEqual({ type: 'next' });
      expect(keyToInput(key, 'number')).toBeNull();
    }
    expect(keyToInput('ArrowLeft', 'remainder')).toEqual({ type: 'previous' });
  });
});
