// @vitest-environment happy-dom
/**
 * The hub's class chip (src/app/screens/class-chip.ts): the picker marks the current class,
 * asks before switching, and only a yes past the grown-ups' gate sends the grade to the game; a
 * refusal changes nothing and says why.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Grade } from '../../../../src/rules/contract/kinds';
import type { GameAction } from '../../../../src/rules/contract';
import { CommandRejectedError } from '../../../../src/app/controller/commands';
import { classChip, pickClass, switchClass } from '../../../../src/app/screens/class-chip';
import type { ActiveKeeper, App } from '../../../../src/app/shell/app';
import { settle, testKit } from './kit';

let kit = testKit();
afterEach(() => kit.dispose());

const byTestId = (id: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

const click = (id: string): void => {
  const element = byTestId(id);
  if (!element) throw new Error(`No ${id} on the page.`);
  element.click();
};

function keeperIn(
  grade: Grade,
  answer: (action: GameAction) => void = () => undefined,
): { active: ActiveKeeper; sent: GameAction[]; grade: () => Grade } {
  let current = grade;
  const sent: GameAction[] = [];
  const active = {
    game: { view: () => ({ settings: { grade: current } }) },
    commands: {
      capture: () => async (action: GameAction) => {
        sent.push(action);
        answer(action);
        if (action.type === 'setSetting' && action.setting.key === 'grade') {
          current = action.setting.value;
        }
      },
    },
  } as unknown as ActiveKeeper;
  return { active, sent, grade: () => current };
}

const rejected = (code: string): CommandRejectedError =>
  new CommandRejectedError({ code, message: code } as never, false);

function appWith(): App {
  kit = testKit();
  return { kit } as unknown as App;
}

const toastTexts = (): string[] =>
  [...kit.toasts.element.querySelectorAll('[data-testid="toast"]')].map(
    (toast) => toast.textContent ?? '',
  );

describe('the class picker', () => {
  it('marks the current class and stays on it, Back or the current class', async () => {
    kit = testKit();
    const said: string[] = [];
    const picked = pickClass(kit, 2, { say: (line) => said.push(line) });
    expect(byTestId('class-picker')).not.toBeNull();
    expect(said).toEqual(['Which class are you in?']);
    expect(byTestId('class-pick-2')?.getAttribute('aria-pressed')).toBe('true');
    expect(byTestId('class-pick-1')?.getAttribute('aria-pressed')).toBe('false');
    expect(byTestId('class-pick-2')?.textContent).toContain('Now');
    expect(document.activeElement).toBe(byTestId('class-pick-2'));
    click('class-pick-2');
    expect(await picked).toBeNull();
    expect(byTestId('class-picker')).toBeNull();

    const again = pickClass(kit, 2);
    click('class-cancel');
    expect(await again).toBeNull();
  });

  it('asks before switching, and No keeps the class', async () => {
    kit = testKit();
    const said: string[] = [];
    const picked = pickClass(kit, 1, { say: (line) => said.push(line) });
    click('class-pick-2');
    expect(byTestId('class-picker')?.textContent).toContain('Switch to 2nd class?');
    expect(byTestId('class-confirm-note')?.textContent).toContain('A grown-up says yes.');
    expect(said.at(-1)).toBe('Switch to 2nd class?');
    click('class-confirm-no');
    expect(await picked).toBeNull();

    const yes = pickClass(kit, 1);
    click('class-pick-3');
    click('class-confirm-yes');
    expect(await yes).toBe(3);
  });
});

describe('switching the class from the hub', () => {
  it('sends the grade only after the gate, and says so', async () => {
    const app = appWith();
    const keeper = keeperIn(1);
    const gate = vi.fn(async () => true);
    const result = switchClass(app, keeper.active, { gate });
    click('class-pick-2');
    click('class-confirm-yes');
    expect(await result).toBe('changed');
    expect(gate).toHaveBeenCalledOnce();
    expect(keeper.sent).toEqual([{ type: 'setSetting', setting: { key: 'grade', value: 2 } }]);
    expect(toastTexts().join()).toContain('Now you are in 2nd class!');
  });

  it('changes nothing when the grown-ups close the gate', async () => {
    const app = appWith();
    const keeper = keeperIn(3);
    const result = switchClass(app, keeper.active, { gate: async () => false });
    click('class-pick-1');
    click('class-confirm-yes');
    expect(await result).toBe('gate-closed');
    expect(keeper.sent).toEqual([]);
  });

  it('says why when the game refuses: no lessons, or a placement check going on', async () => {
    for (const [code, outcome, text] of [
      ['invalid-setting', 'unavailable', 'no lessons for that class'],
      ['round-active', 'round-active', "Finish the dragons' check first."],
    ] as const) {
      const app = appWith();
      const keeper = keeperIn(3, () => {
        throw rejected(code);
      });
      const result = switchClass(app, keeper.active, { gate: async () => true });
      click('class-pick-2');
      click('class-confirm-yes');
      expect(await result).toBe(outcome);
      expect(keeper.grade()).toBe(3);
      expect(toastTexts().join()).toContain(text);
    }
  });

  it('shows the class on the chip and repaints only after a change', async () => {
    const app = appWith();
    const keeper = keeperIn(1);
    const changed = vi.fn();
    const chip = classChip(app, keeper.active, changed, { gate: async () => true });
    document.body.append(chip);
    expect(chip.textContent).toContain('1st class');
    expect(chip.dataset['grade']).toBe('1');
    expect(chip.getAttribute('aria-haspopup')).toBe('dialog');
    expect(chip.getAttribute('aria-label')).toBe('1st class. Change class');

    chip.click();
    click('class-cancel');
    await settle();
    expect(changed).not.toHaveBeenCalled();

    chip.click();
    click('class-pick-2');
    click('class-confirm-yes');
    await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(keeper.grade()).toBe(2);
    expect(kit.errors).toEqual([]);
  });
});
