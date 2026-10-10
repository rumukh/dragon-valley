/**
 * The class chip on the hub ("1st class", "2nd class", "3rd class"; docs/design.md §12.1): a
 * tap opens a picker with the three classes. Picking another class asks "Switch to 2nd class?",
 * and a yes goes through the grown-ups' gate, because changing the class is a grown-up's
 * decision. The game then gets the same `setSetting` the parent area sends; a refusal (no
 * lessons for that class, or a placement check in the middle) changes nothing and says why.
 */
import { GRADES } from '../../rules/contract/kinds';
import type { Grade } from '../../rules/contract/kinds';
import { changeGrade, gradeOf } from '../game/grade';
import type { GradeChange } from '../game/grade';
import { openParentGate } from '../parent/gate-dialog';
import { candyButton } from '../ui/button';
import { openModal } from '../ui/dialog';
import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import type { UiKit } from '../ui/kit';
import type { ActiveKeeper, App } from '../shell/app';
import { GRADE_LABEL_KEYS } from './editor';

export interface ClassPickerOptions {
  /** Read a line aloud (the keeper's read-aloud, when it is on by itself). */
  readonly say?: (text: string) => void;
}

/**
 * The picker: the three classes (the current one marked), then a yes or no for another class.
 * Resolves the class confirmed, or null for "stay" (Back, Escape, the current class, or No).
 */
export function pickClass(
  kit: UiKit,
  current: Grade,
  options: ClassPickerOptions = {},
): Promise<Grade | null> {
  const t = kit.t;
  const say = options.say ?? (() => undefined);
  const label = (grade: Grade): string => t(GRADE_LABEL_KEYS[grade]);
  const heading = t('hub.class.heading');
  let first: HTMLElement | null = null;
  return openModal<Grade | null>(kit, {
    label: heading,
    heading: false,
    testId: 'class-picker',
    dismissValue: null,
    build(body, close) {
      const title = h('h2', {
        className: 'dv-class-picker__title',
        text: heading,
        attributes: { tabindex: '-1' },
      });
      const stage = h('div', { className: 'dv-stack dv-class-picker' });
      body.append(title, stage);

      const choose = (): void => {
        title.textContent = heading;
        const grid = h(
          'div',
          { className: 'dv-grade-grid', attributes: { role: 'group', 'aria-label': heading } },
          ...GRADES.map((grade) => {
            const button = h(
              'button',
              {
                className: 'dv-grade-choice dv-class-choice',
                testId: `class-pick-${grade}`,
                dataset: { current: String(grade === current) },
                attributes: { type: 'button', 'aria-pressed': String(grade === current) },
              },
              h('span', { className: 'dv-grade-choice__number', text: String(grade) }),
              h('span', { className: 'dv-grade-choice__label', text: label(grade) }),
              grade === current
                ? h('span', { className: 'dv-class-choice__now', text: t('hub.class.now') })
                : null,
            );
            button.addEventListener('click', () => {
              kit.cue('ui.tap');
              if (grade === current) close(null);
              else confirm(grade);
            });
            return button;
          }),
        );
        first = grid.querySelector<HTMLElement>('[aria-pressed="true"]');
        stage.replaceChildren(
          grid,
          h(
            'div',
            { className: 'dv-dialog__actions' },
            candyButton({
              label: t('hub.class.cancel'),
              icon: 'back',
              variant: 'paper',
              testId: 'class-cancel',
              onPress: () => close(null),
              onError: kit.onError,
            }),
          ),
        );
      };

      const confirm = (grade: Grade): void => {
        const question = t('hub.class.confirm', { grade: label(grade) });
        title.textContent = question;
        const yes = candyButton({
          label: t('hub.class.yes'),
          icon: 'grownups',
          variant: 'sun',
          testId: 'class-confirm-yes',
          onPress: () => close(grade),
          onError: kit.onError,
        });
        stage.replaceChildren(
          h(
            'p',
            { className: 'dv-class-picker__note', testId: 'class-confirm-note' },
            icon('lock'),
            h('span', { text: t('hub.class.confirmNote') }),
          ),
          h(
            'div',
            { className: 'dv-dialog__actions' },
            candyButton({
              label: t('hub.class.no'),
              variant: 'paper',
              testId: 'class-confirm-no',
              onPress: () => close(null),
              onError: kit.onError,
            }),
            yes,
          ),
        );
        title.focus();
        say(question);
      };

      choose();
      say(heading);
    },
    initialFocus: () => first,
  }).result;
}

export interface ClassSwitchOptions extends ClassPickerOptions {
  /** The grown-ups' gate; resolves true once a grown-up said yes. */
  readonly gate?: () => Promise<boolean>;
}

/** What a tap on the chip ended in. */
export type ClassSwitch = 'stayed' | 'gate-closed' | GradeChange;

/**
 * Pick, confirm, pass the gate, ask the game, and tell the child how it went (a toast). The
 * caller repaints the hub when the class changed.
 */
export async function switchClass(
  app: App,
  active: ActiveKeeper,
  options: ClassSwitchOptions = {},
): Promise<ClassSwitch> {
  const t = app.kit.t;
  const picked = await pickClass(app.kit, gradeOf(active.game.view()), options);
  if (picked === null) return 'stayed';
  const gate = options.gate ?? (() => openParentGate(app.kit));
  if (!(await gate())) return 'gate-closed';
  const result = await changeGrade(active, picked);
  if (result === 'changed') {
    const message = t('hub.class.changed', { grade: t(GRADE_LABEL_KEYS[picked]) });
    app.kit.toasts.show(message, { tone: 'success', durationMs: 2400 });
  } else if (result === 'unavailable') {
    app.kit.toasts.show(t('parent.rules.gradeUnavailable'), { tone: 'warning' });
  } else if (result === 'round-active') {
    app.kit.toasts.show(t('hub.class.roundActive'), { tone: 'warning' });
  }
  return result;
}

/** The chip itself: the keeper's class, opening the picker. */
export function classChip(
  app: App,
  active: ActiveKeeper,
  onChanged: () => void | Promise<void>,
  options: ClassSwitchOptions = {},
): HTMLButtonElement {
  const t = app.kit.t;
  const grade = gradeOf(active.game.view());
  const name = t(GRADE_LABEL_KEYS[grade]);
  const chip = h(
    'button',
    {
      className: 'dv-class-chip',
      testId: 'hub-class',
      dataset: { grade: String(grade) },
      attributes: {
        type: 'button',
        'aria-haspopup': 'dialog',
        'aria-label': t('hub.class.change', { grade: name }),
      },
    },
    h('span', {
      className: 'dv-class-chip__number',
      text: String(grade),
      attributes: { 'aria-hidden': 'true' },
    }),
    h('span', { className: 'dv-class-chip__label', text: name }),
  );
  let busy = false;
  chip.addEventListener('click', () => {
    if (busy) return;
    busy = true;
    app.kit.cue('ui.tap');
    void switchClass(app, active, options)
      .then((result) => (result === 'changed' ? onChanged() : undefined))
      .catch(app.kit.onError)
      .finally(() => {
        busy = false;
      });
  });
  return chip;
}
