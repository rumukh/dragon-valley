/**
 * Create or change a keeper: a name, one of eight keeper pictures and, for a new keeper, the
 * class they are in (1st, 2nd or 3rd; 3rd is picked until someone chooses). The class waits on
 * the keeper's family entry until the play screen hands it to the new game save. Removing a keeper is
 * behind the grown-ups' gate and a confirmation, and erases that keeper's own saved data.
 */
import { DEFAULT_GRADE, GRADES } from '../../rules/contract/kinds';
import type { Grade } from '../../rules/contract/kinds';
import { KEEPER_AVATARS } from '../../rules/contract/ids';
import type { KeeperAvatar } from '../../rules/contract/ids';
import { openParentGate } from '../parent/gate-dialog';
import { findKeeper, MAX_NAME_LENGTH } from '../persistence/family';
import type { FamilyProblem } from '../persistence/family';
import { possessive } from '../i18n/messages';
import type { MessageKey } from '../i18n/messages';
import { candyButton, linkButton } from '../ui/button';
import { avatarArt } from '../ui/art';
import { confirmDialog } from '../ui/dialog';
import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';
import { topBar } from './common';
import { eraseKeeperData } from './keeper-data';

const PROBLEM_KEYS: Record<FamilyProblem, MessageKey> = {
  empty: 'editor.problem.empty',
  long: 'editor.problem.long',
  chars: 'editor.problem.chars',
  taken: 'editor.problem.taken',
  full: 'editor.problem.full',
  missing: 'editor.problem.missing',
  avatar: 'editor.problem.avatar',
  grade: 'editor.problem.grade',
};

export const GRADE_LABEL_KEYS: Readonly<Record<Grade, MessageKey>> = {
  1: 'grade.1',
  2: 'grade.2',
  3: 'grade.3',
};

export function editorScreen(app: App, keeperId: string | null): ScreenEntry {
  return {
    key: keeperId ? `editor:${keeperId}` : 'editor:new',
    build(context) {
      const t = app.kit.t;
      const existing = keeperId ? findKeeper(app.family.state(), keeperId) : undefined;
      if (keeperId && !existing) throw new Error('That keeper is not on this device.');
      const heading = h('h1', {
        text: t(existing ? 'editor.editHeading' : 'editor.createHeading'),
      });

      const nameInput = h('input', {
        className: 'dv-input dv-input--name',
        testId: 'keeper-name',
        attributes: {
          id: 'dv-keeper-name',
          type: 'text',
          maxlength: String(MAX_NAME_LENGTH + 10),
          autocomplete: 'off',
          autocapitalize: 'words',
          spellcheck: 'false',
          enterkeyhint: 'done',
          'aria-describedby': 'dv-keeper-name-hint dv-keeper-problem',
        },
      });
      nameInput.value = existing?.name ?? '';
      const problem = h('p', {
        className: 'dv-error-text',
        testId: 'keeper-problem',
        attributes: { id: 'dv-keeper-problem', 'aria-live': 'polite' },
      });
      const showProblem = (key: MessageKey | null): void => {
        problem.replaceChildren(...(key ? [icon('warning'), h('span', { text: t(key) })] : []));
        nameInput.setAttribute(
          'aria-invalid',
          String(key !== null && key !== 'editor.problem.avatar'),
        );
      };

      let chosen: KeeperAvatar | null = existing?.avatar ?? null;
      const radios = KEEPER_AVATARS.map((avatar) => {
        const input = h('input', {
          className: 'dv-avatar-choice__input',
          attributes: { type: 'radio', name: 'dv-avatar', value: avatar },
        });
        input.checked = avatar === chosen;
        input.addEventListener('change', () => {
          if (input.checked) chosen = avatar;
        });
        return h(
          'label',
          { className: 'dv-avatar-choice', testId: `avatar-${avatar}` },
          input,
          avatarArt(avatar, 'dv-avatar dv-avatar-choice__art'),
          h('span', { className: 'dv-visually-hidden', text: t(`avatar.${avatar}` as MessageKey) }),
        );
      });

      let grade: Grade = DEFAULT_GRADE;
      const gradeQuestion = h('legend', { className: 'dv-field__label' });
      const askGrade = (): void => {
        const name = nameInput.value.trim();
        gradeQuestion.textContent =
          name === '' ? t('editor.gradeLabel') : t('editor.gradeLabelNamed', { name });
      };
      askGrade();
      nameInput.addEventListener('input', askGrade);
      // The editor has no keeper yet, so it reads the class aloud with the device default voice.
      const say = (text: string): void => {
        if (app.speech.available()) app.speech.speak(text, { voice: null });
      };
      const gradeRadios = GRADES.map((value) => {
        const input = h('input', {
          className: 'dv-grade-choice__input',
          attributes: { type: 'radio', name: 'dv-grade', value: String(value) },
        });
        input.checked = value === grade;
        input.addEventListener('change', () => {
          if (!input.checked) return;
          grade = value;
          say(t(GRADE_LABEL_KEYS[value]));
        });
        return h(
          'label',
          { className: 'dv-grade-choice', testId: `grade-${value}` },
          input,
          h('span', { className: 'dv-grade-choice__number', text: String(value) }),
          h('span', { className: 'dv-grade-choice__label', text: t(GRADE_LABEL_KEYS[value]) }),
        );
      });
      const gradePicker = existing
        ? null
        : h(
            'fieldset',
            { className: 'dv-grade-picker', testId: 'keeper-grade' },
            gradeQuestion,
            h('div', { className: 'dv-grade-grid' }, ...gradeRadios),
          );
      gradeQuestion.addEventListener('click', () => say(gradeQuestion.textContent ?? ''));

      const submit = async (): Promise<void> => {
        if (!chosen) {
          showProblem('editor.problem.avatar');
          return;
        }
        let result;
        try {
          result = existing
            ? await app.family.update(existing.id, { name: nameInput.value, avatar: chosen })
            : await app.family.add({ name: nameInput.value, avatar: chosen, grade });
        } catch {
          showProblem('editor.problem.save');
          return;
        }
        if (!result.ok) {
          showProblem(PROBLEM_KEYS[result.problem]);
          if (result.problem !== 'avatar') nameInput.focus();
          return;
        }
        showProblem(null);
        if (existing) await app.router.back();
        else await app.router.replace(app.screens.play(result.value.id));
      };

      const save = candyButton({
        label: t(existing ? 'editor.save' : 'editor.create'),
        icon: existing ? 'check' : 'play',
        variant: 'sun',
        size: 'big',
        testId: 'keeper-save',
        onPress: submit,
        onError: app.kit.onError,
      });
      const picker = h(
        'fieldset',
        { className: 'dv-avatar-picker' },
        h('legend', { className: 'dv-field__label', text: t('editor.avatarLabel') }),
        h('div', { className: 'dv-avatar-grid' }, ...radios),
      );
      // WebKit does not match :focus-visible on a radio an arrow key moved to (DV-QA-15), so the
      // picker notes keyboard use itself and the focused picture shows its ring for that too.
      picker.addEventListener('keydown', () => {
        picker.dataset['keys'] = 'true';
      });
      picker.addEventListener('pointerdown', () => {
        delete picker.dataset['keys'];
      });
      const form = h(
        'form',
        { className: 'dv-card dv-editor__card', attributes: { novalidate: '' } },
        h(
          'div',
          { className: 'dv-field' },
          h('label', {
            className: 'dv-field__label',
            text: t('editor.nameLabel'),
            attributes: { for: 'dv-keeper-name' },
          }),
          nameInput,
          h('span', {
            className: 'dv-field__hint',
            text: t('editor.nameHint'),
            attributes: { id: 'dv-keeper-name-hint' },
          }),
        ),
        picker,
        gradePicker,
        problem,
        h('div', { className: 'dv-row dv-row--end' }, save),
      );
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        save.click();
      });

      const remove =
        existing &&
        linkButton({
          label: t('editor.remove'),
          icon: 'trash',
          testId: 'keeper-remove',
          onPress: async () => {
            if (!(await openParentGate(app.kit))) return;
            const sure = await confirmDialog(app.kit, {
              heading: t('parent.keepers.removeTitle', { name: existing.name }),
              body: t('parent.keepers.removeBody', { owner: possessive(existing.name) }),
              confirmLabel: t('parent.keepers.removeConfirm', { name: existing.name }),
              cancelLabel: t('common.cancel'),
              tone: 'warning',
            });
            if (!sure) return;
            if (app.active()?.keeper.id === existing.id) await app.closeKeeper();
            const result = await app.family.remove(existing.id, () =>
              eraseKeeperData(app, existing.id),
            );
            if (result.ok) {
              app.kit.toasts.show(t('parent.keepers.removed', { name: existing.name }));
              await app.router.reset(app.screens.keepers());
            }
          },
          onError: app.kit.onError,
        });

      const element = h(
        'main',
        { className: 'dv-editor', testId: 'screen-editor' },
        topBar({
          back: context.canGoBack
            ? { label: t('common.back'), onPress: () => app.router.back() }
            : undefined,
          title: heading,
          onError: app.kit.onError,
        }),
        form,
        remove ? h('div', { className: 'dv-row dv-row--center' }, remove) : null,
      );
      return {
        element,
        title: heading.textContent ?? '',
        field: 'valley',
        region: null,
        music: 'title',
        focusTarget: () => nameInput,
      };
    },
  };
}
