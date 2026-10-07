// @vitest-environment happy-dom
/**
 * The keypad in the DOM: the physical keyboard and the on-screen keys drive the same state,
 * the remainder mode shows the notation's sign, text fields keep their own typing, and the wide
 * layout beside a board orders its keys in three rows of four.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createKeypad } from '../../../../src/app/ui/keypad';
import { press, settle, testKit } from './kit';

let kit: ReturnType<typeof testKit>;
afterEach(() => kit?.dispose());

function display(element: HTMLElement): string[] {
  return [...element.querySelectorAll('.dv-answer__field')].map((field) => field.textContent ?? '');
}

describe('keypad', () => {
  it('types the same answer from physical keys and on-screen keys', async () => {
    kit = testKit();
    const answers: unknown[] = [];
    const keypad = createKeypad(kit, {
      mode: 'number',
      onSubmit: (answer) => void answers.push(answer),
    });
    document.body.append(keypad.element);

    press('5');
    keypad.element.querySelector<HTMLButtonElement>('[data-testid="keypad-6"]')!.click();
    expect(display(keypad.element)).toEqual(['56']);
    press('Backspace');
    keypad.element.querySelector<HTMLButtonElement>('[data-testid="keypad-backspace"]')!.click();
    expect(display(keypad.element)).toEqual(['']);

    press('4');
    press('2');
    press('Enter');
    await settle();
    expect(answers).toEqual([{ kind: 'number', value: 42 }]);
    expect(kit.cue).toHaveBeenCalledWith('ui.keypad');
    keypad.dispose();
  });

  it('fills quotient and remainder with r between them in Czech notation', async () => {
    kit = testKit();
    const onSubmit = vi.fn();
    const keypad = createKeypad(kit, { mode: 'remainder', remainderSymbol: 'r', onSubmit });
    document.body.append(keypad.element);
    expect(keypad.element.querySelector('.dv-answer__sep')?.textContent).toBe('r');
    press('4');
    press('Enter');
    await settle();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(keypad.state().active).toBe(1);
    press('3');
    keypad.element.querySelector<HTMLButtonElement>('[data-testid="keypad-ok"]')!.click();
    await settle();
    expect(onSubmit).toHaveBeenCalledWith({ kind: 'remainder', quotient: 4, remainder: 3 });
    expect(display(keypad.element)).toEqual(['4', '3']);
    keypad.dispose();
  });

  it('shows R in international notation and lets the fields be chosen by tapping', () => {
    kit = testKit();
    const keypad = createKeypad(kit, {
      mode: 'remainder',
      remainderSymbol: 'R',
      onSubmit: vi.fn(),
    });
    document.body.append(keypad.element);
    expect(keypad.element.querySelector('.dv-answer__sep')?.textContent).toBe('R');
    keypad.element.querySelector<HTMLButtonElement>('[data-testid="keypad-field-1"]')!.click();
    press('7');
    expect(display(keypad.element)).toEqual(['', '7']);
    keypad.dispose();
  });

  it('ignores keys typed into a text field and keys while disabled', () => {
    kit = testKit();
    const keypad = createKeypad(kit, { mode: 'number', onSubmit: vi.fn() });
    const input = document.createElement('input');
    document.body.append(keypad.element, input);
    press('8', input);
    expect(display(keypad.element)).toEqual(['']);
    keypad.setDisabled(true);
    press('8');
    expect(display(keypad.element)).toEqual(['']);
    keypad.setDisabled(false);
    press('8');
    expect(display(keypad.element)).toEqual(['8']);
    keypad.dispose();
    press('9');
    expect(display(keypad.element)).toEqual(['8']);
  });

  it('leaves Enter on a focused key to the browser, so one press is one action', async () => {
    kit = testKit();
    const onSubmit = vi.fn();
    const keypad = createKeypad(kit, { mode: 'number', onSubmit });
    document.body.append(keypad.element);
    press('3');
    const ok = keypad.element.querySelector<HTMLButtonElement>('[data-testid="keypad-ok"]')!;
    const event = press('Enter', ok);
    await settle();
    expect(event.defaultPrevented).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
    keypad.dispose();
  });

  it('lays its keys out phone-style by default, or four wide beside a board', () => {
    kit = testKit();
    const keys = (element: HTMLElement): string[] =>
      [...element.querySelectorAll('.dv-keypad button')].map(
        (key) => key.getAttribute('data-testid')?.replace('keypad-', '') ?? '',
      );
    const phone = createKeypad(kit, { mode: 'number', onSubmit: vi.fn() });
    expect(keys(phone.element)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'backspace',
      '0',
      'ok',
    ]);
    expect(phone.pad.classList.contains('dv-keypad--wide')).toBe(false);
    phone.dispose();
    const wide = createKeypad(kit, { mode: 'number', layout: 'wide', onSubmit: vi.fn() });
    expect(keys(wide.element)).toEqual([
      '1',
      '2',
      '3',
      'backspace',
      '4',
      '5',
      '6',
      '0',
      '7',
      '8',
      '9',
      'ok',
    ]);
    expect(wide.pad.classList.contains('dv-keypad--wide')).toBe(true);
    // A board can take the answer fields into its own sentence; the keys stay with the pad.
    expect(wide.element.contains(wide.display)).toBe(true);
    expect(wide.element.contains(wide.pad)).toBe(true);
    wide.dispose();
  });

  it('does not take focus when a key is clicked, so Enter on the keyboard still submits', () => {
    kit = testKit();
    const keypad = createKeypad(kit, { mode: 'number', onSubmit: vi.fn() });
    document.body.append(keypad.element);
    const key = keypad.element.querySelector<HTMLButtonElement>('[data-testid="keypad-0"]')!;
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    key.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    keypad.dispose();
  });
});
