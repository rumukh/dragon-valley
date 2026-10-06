/**
 * The answer keypad as a pure state machine, shared by the on-screen keys and the physical
 * keyboard so both behave identically.
 *
 * - `number` mode has one field; `remainder` mode has two (quotient and remainder), shown as
 *   `4 r 3` (Czech) or `4 R 3` (international).
 * - Leading zeros never pile up: typing into a field that holds just `0` replaces it.
 * - Submitting an incomplete remainder answer moves to the empty remainder field instead of
 *   submitting, so a child who presses OK after the quotient is guided, not judged.
 */
export type KeypadMode = 'number' | 'remainder';

export interface KeypadState {
  readonly mode: KeypadMode;
  readonly fields: readonly string[];
  readonly active: number;
  readonly maxDigits: number;
}

export type KeypadAnswer =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'remainder'; readonly quotient: number; readonly remainder: number };

export type KeypadInput =
  | { readonly type: 'digit'; readonly digit: number }
  | { readonly type: 'backspace' }
  | { readonly type: 'clear' }
  | { readonly type: 'next' }
  | { readonly type: 'previous' }
  | { readonly type: 'focus'; readonly field: number }
  | { readonly type: 'submit' };

export interface KeypadStep {
  readonly state: KeypadState;
  /** Present only when the input completed an answer. */
  readonly answer?: KeypadAnswer;
  /** Why an input did nothing, for a gentle cue (a shake, a sound). */
  readonly rejected?: 'empty' | 'full';
}

export const DEFAULT_MAX_DIGITS = 4;

export function createKeypad(mode: KeypadMode, maxDigits = DEFAULT_MAX_DIGITS): KeypadState {
  if (!Number.isInteger(maxDigits) || maxDigits < 1 || maxDigits > 7) {
    throw new RangeError('maxDigits must be an integer from 1 to 7.');
  }
  return { mode, fields: mode === 'remainder' ? ['', ''] : [''], active: 0, maxDigits };
}

function withField(state: KeypadState, index: number, value: string): KeypadState {
  const fields = [...state.fields];
  fields[index] = value;
  return { ...state, fields };
}

function clamp(state: KeypadState, field: number): number {
  return Math.min(Math.max(field, 0), state.fields.length - 1);
}

export function reduceKeypad(state: KeypadState, input: KeypadInput): KeypadStep {
  const current = state.fields[state.active] ?? '';
  switch (input.type) {
    case 'digit': {
      if (!Number.isInteger(input.digit) || input.digit < 0 || input.digit > 9) {
        throw new RangeError('A keypad digit is 0-9.');
      }
      if (current === '0') return { state: withField(state, state.active, String(input.digit)) };
      if (current.length >= state.maxDigits) return { state, rejected: 'full' };
      return { state: withField(state, state.active, current + String(input.digit)) };
    }
    case 'backspace': {
      if (current.length > 0)
        return { state: withField(state, state.active, current.slice(0, -1)) };
      if (state.active > 0) return { state: { ...state, active: state.active - 1 } };
      return { state, rejected: 'empty' };
    }
    case 'clear':
      return { state: createKeypad(state.mode, state.maxDigits) };
    case 'next':
      return { state: { ...state, active: clamp(state, state.active + 1) } };
    case 'previous':
      return { state: { ...state, active: clamp(state, state.active - 1) } };
    case 'focus':
      return { state: { ...state, active: clamp(state, input.field) } };
    case 'submit': {
      const [first = '', second = ''] = state.fields;
      if (first === '') return { state: { ...state, active: 0 }, rejected: 'empty' };
      if (state.mode === 'number') {
        return { state, answer: { kind: 'number', value: Number(first) } };
      }
      if (second === '') return { state: { ...state, active: 1 }, rejected: 'empty' };
      return {
        state,
        answer: { kind: 'remainder', quotient: Number(first), remainder: Number(second) },
      };
    }
  }
}

/**
 * The keypad input for a physical key, or null when the key is not the keypad's. Numpad
 * digits arrive as `event.key` digits too. In remainder mode `r`, `R`, Space and the arrows
 * move between the two fields; Tab stays with the browser for focus navigation.
 */
export function keyToInput(key: string, mode: KeypadMode): KeypadInput | null {
  if (key.length === 1 && key >= '0' && key <= '9') return { type: 'digit', digit: Number(key) };
  if (key === 'Backspace' || key === 'Delete') return { type: 'backspace' };
  if (key === 'Enter') return { type: 'submit' };
  if (mode === 'remainder') {
    if (key === 'r' || key === 'R' || key === ' ' || key === 'ArrowRight') return { type: 'next' };
    if (key === 'ArrowLeft') return { type: 'previous' };
  }
  return null;
}

export function isEmpty(state: KeypadState): boolean {
  return state.fields.every((field) => field === '');
}
