/**
 * The big on-screen keypad (phone layout: 1-2-3 on top) with physical keyboard parity, and a
 * remainder mode with two answer fields shown as `4 r 3` or `4 R 3`.
 */
import { h } from './dom';
import { icon } from './icons';
import { animate } from './motion';
import { createKeypad as createKeypadState, keyToInput, reduceKeypad } from './keypad-state';
import type { KeypadAnswer, KeypadInput, KeypadMode, KeypadState } from './keypad-state';
import type { UiKit } from './kit';

export interface KeypadOptions {
  mode: KeypadMode;
  maxDigits?: number;
  /** `r` (Czech) or `R` (international), shown between the remainder fields. */
  remainderSymbol?: string;
  onSubmit(answer: KeypadAnswer): void | Promise<void>;
  testIdPrefix?: string;
}

export interface KeypadView {
  readonly element: HTMLElement;
  state(): KeypadState;
  reset(): void;
  setDisabled(disabled: boolean): void;
  dispose(): void;
}

const LAYOUT = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'backspace', '0', 'ok'] as const;

export function createKeypad(kit: UiKit, options: KeypadOptions): KeypadView {
  const prefix = options.testIdPrefix ?? 'keypad';
  let state = createKeypadState(options.mode, options.maxDigits);
  let disabled = false;
  let busy = false;
  const t = kit.t;

  const fieldLabels =
    options.mode === 'remainder'
      ? [t('keypad.quotientField'), t('keypad.remainderField')]
      : [t('keypad.answer')];
  const fields = fieldLabels.map((label, index) => {
    const field = h('button', {
      className: 'dv-answer__field',
      testId: `${prefix}-field-${index}`,
      attributes: { type: 'button', 'aria-label': label },
    });
    field.addEventListener('click', () => apply({ type: 'focus', field: index }));
    field.addEventListener('mousedown', (event) => event.preventDefault());
    return field;
  });
  const spoken = h('span', { className: 'dv-visually-hidden' });
  const display = h(
    'div',
    {
      className: 'dv-answer',
      testId: `${prefix}-display`,
      attributes: { 'aria-live': 'polite', 'aria-atomic': 'true' },
    },
    spoken,
    fields[0]!,
  );
  if (fields[1]) {
    display.append(
      h('span', {
        className: 'dv-answer__sep',
        text: options.remainderSymbol ?? 'r',
        attributes: { 'aria-hidden': 'true' },
      }),
      fields[1],
    );
  }

  const keys = new Map<string, HTMLButtonElement>();
  const pad = h('div', {
    className: 'dv-keypad',
    attributes: { role: 'group', 'aria-label': t('keypad.label') },
  });
  for (const key of LAYOUT) {
    const button = h('button', {
      className: 'dv-key' + (key === 'ok' ? ' dv-key--ok' : ''),
      testId: `${prefix}-${key}`,
      attributes: { type: 'button' },
    });
    if (key === 'backspace') {
      button.append(icon('backspace'));
      button.setAttribute('aria-label', t('keypad.backspace'));
    } else if (key === 'ok') {
      button.textContent = t('keypad.ok');
    } else {
      button.textContent = key;
    }
    button.addEventListener('click', () => {
      if (key === 'backspace') apply({ type: 'backspace' });
      else if (key === 'ok') apply({ type: 'submit' });
      else apply({ type: 'digit', digit: Number(key) });
    });
    // Like a calculator: tapping or clicking a key does not take focus, so the physical
    // keyboard keeps working (Enter submits instead of pressing the last clicked key again).
    button.addEventListener('mousedown', (event) => event.preventDefault());
    keys.set(key, button);
    pad.append(button);
  }

  const element = h('div', { className: 'dv-stack dv-keypad-wrap', testId: prefix }, display, pad);

  const render = (): void => {
    state.fields.forEach((value, index) => {
      const field = fields[index]!;
      field.textContent = value;
      field.dataset['empty'] = String(value === '');
      field.setAttribute('aria-pressed', String(index === state.active));
    });
    const [first = '', second = ''] = state.fields;
    spoken.textContent =
      options.mode === 'remainder'
        ? t('keypad.spokenRemainder', { quotient: first || '?', remainder: second || '?' })
        : t('keypad.spoken', { value: first || '?' });
    for (const button of [...keys.values(), ...fields]) button.disabled = disabled || busy;
  };

  const nudge = (): void => {
    animate(
      display,
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(0)' },
      ],
      {
        duration: 260,
        easing: 'ease-out',
      },
    );
  };

  const flash = (input: KeypadInput): void => {
    const key =
      input.type === 'digit'
        ? String(input.digit)
        : input.type === 'backspace'
          ? 'backspace'
          : input.type === 'submit'
            ? 'ok'
            : undefined;
    const button = key ? keys.get(key) : undefined;
    if (!button) return;
    button.dataset['flash'] = 'true';
    setTimeout(() => delete button.dataset['flash'], 120);
  };

  function apply(input: KeypadInput): void {
    if (disabled || busy) return;
    const step = reduceKeypad(state, input);
    state = step.state;
    if (step.rejected) nudge();
    if (input.type === 'digit' || input.type === 'backspace') kit.cue('ui.keypad');
    render();
    if (step.answer) {
      busy = true;
      render();
      Promise.resolve()
        .then(() => options.onSubmit(step.answer!))
        .catch(kit.onError)
        .finally(() => {
          busy = false;
          render();
        });
    }
  }

  const release = kit.keyboard.push((event) => {
    if (disabled || !element.isConnected) return 'pass';
    const input = keyToInput(event.key, options.mode);
    if (!input) return 'pass';
    if (event.repeat && input.type === 'submit') return 'handled';
    flash(input);
    apply(input);
    return 'handled';
  });

  render();
  return {
    element,
    state: () => state,
    reset() {
      state = createKeypadState(options.mode, options.maxDigits);
      render();
    },
    setDisabled(value) {
      disabled = value;
      render();
    },
    dispose() {
      release();
    },
  };
}
