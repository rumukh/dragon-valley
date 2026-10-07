/**
 * Recovery and error screens, on the night sky so they never look like ordinary play.
 *
 * Recovery: a stored record could not be opened. Nothing was changed. A grown-up can save the
 * stored bytes to a file, go back to the previous copy, load a backup (game saves), erase the
 * record after confirming, or try again. Every replacement is validated like a fresh load.
 *
 * Error: something unexpected went wrong. The child is told their progress is safe and can go
 * back to the start; a short code helps a grown-up report it.
 */
import { readBackup, rebind } from '../persistence/backup';
import { BACKUP_MAX_BYTES } from '../persistence/backup';
import { possessive } from '../i18n/messages';
import { findKeeper } from '../persistence/family';
import { errorCode, RecoveryRequired } from '../persistence/recovery';
import { candyButton, linkButton } from '../ui/button';
import { confirmDialog } from '../ui/dialog';
import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';
import { downloadText, pickTextFile } from './common';

export function recoveryScreen(app: App, problem: RecoveryRequired): ScreenEntry {
  return {
    key: `recovery:${problem.kind}:${problem.profileId}`,
    build() {
      const t = app.kit.t;
      const name = findKeeper(app.family.state(), problem.profileId)?.name ?? problem.profileId;
      const status = h('p', {
        className: 'dv-recovery__status',
        testId: 'recovery-status',
        attributes: { role: 'status' },
      });
      const fail = (): void => {
        status.textContent = t('recovery.failed');
      };
      const afterChange = async (): Promise<void> => {
        if (problem.kind === 'family') {
          await app.family.open();
          await app.router.reset(app.screens.title());
        } else {
          await app.router.reset(app.screens.keepers());
        }
      };
      const action = (
        label: string,
        testId: string,
        work: () => Promise<void>,
        variant: 'paper' | 'coral' | 'sun' = 'paper',
      ): HTMLElement =>
        candyButton({
          label,
          testId,
          variant,
          onPress: async () => {
            try {
              await work();
            } catch (error) {
              if (error instanceof RecoveryRequired) {
                status.textContent = t('recovery.failed');
                return;
              }
              fail();
            }
          },
          onError: app.kit.onError,
        });

      const actions: HTMLElement[] = [];
      const original = problem.actions.original;
      if (original !== undefined) {
        actions.push(
          action(t('recovery.export'), 'recovery-export', async () => {
            downloadText(
              `dragon-valley-${problem.kind}-${problem.profileId}-stored.json`,
              original,
            );
          }),
        );
      }
      if (problem.actions.available) {
        const previous = problem.actions.previous;
        if (previous !== undefined) {
          actions.push(
            action(t('recovery.previous'), 'recovery-previous', async () => {
              await problem.actions.replace(previous);
              await afterChange();
            }),
          );
        }
        if (problem.kind !== 'family') {
          actions.push(
            action(t('recovery.import'), 'recovery-import', async () => {
              const text = await pickTextFile(BACKUP_MAX_BYTES);
              if (text === null) return;
              const backup = readBackup(text);
              const envelope = problem.kind === 'game' ? backup.game : backup.preferences;
              if (envelope === null) throw new Error('The backup has no such record.');
              await problem.actions.replace(rebind(envelope, problem.profileId));
              await afterChange();
            }),
          );
        }
        actions.push(
          action(
            t('recovery.reset'),
            'recovery-reset',
            async () => {
              const sure = await confirmDialog(app.kit, {
                heading: t('recovery.resetTitle'),
                body: t('recovery.resetBody'),
                confirmLabel: t('recovery.resetConfirm'),
                cancelLabel: t('common.cancel'),
                tone: 'warning',
              });
              if (!sure) return;
              await problem.actions.reset();
              await afterChange();
            },
            'coral',
          ),
        );
      }
      actions.push(action(t('recovery.retry'), 'recovery-retry', afterChange, 'sun'));

      const message =
        problem.kind === 'family'
          ? t('recovery.family')
          : problem.kind === 'game'
            ? t('recovery.game', { owner: possessive(name) })
            : t('recovery.preferences', { owner: possessive(name) });
      const element = h(
        'main',
        { className: 'dv-recovery', testId: 'screen-recovery', dataset: { kind: problem.kind } },
        h(
          'div',
          { className: 'dv-card dv-recovery__card' },
          h('span', { className: 'dv-recovery__icon' }, icon('shield')),
          h('h1', { text: t('recovery.heading') }),
          h('p', { text: message }),
          problem.code === 'content-unavailable'
            ? h('p', { testId: 'recovery-content', text: t('recovery.content') })
            : null,
          h('p', {
            text: problem.actions.available ? t('recovery.unchanged') : t('recovery.unavailable'),
          }),
          h('p', { className: 'dv-note', text: t('recovery.code', { code: problem.code }) }),
          status,
          h('div', { className: 'dv-recovery__actions' }, ...actions),
          problem.kind === 'family'
            ? null
            : linkButton({
                label: t('recovery.back'),
                icon: 'back',
                testId: 'recovery-back',
                onPress: () => app.router.reset(app.screens.keepers()),
                onError: app.kit.onError,
              }),
        ),
      );
      return { element, title: t('recovery.heading'), field: 'night', region: null };
    },
  };
}

export function errorScreen(app: App, error: unknown): ScreenEntry {
  if (error instanceof RecoveryRequired) return recoveryScreen(app, error);
  return {
    key: 'error',
    build() {
      const t = app.kit.t;
      const restart = candyButton({
        label: t('error.restart'),
        icon: 'home',
        variant: 'sun',
        size: 'big',
        testId: 'error-restart',
        onPress: async () => {
          await app.family.open();
          await app.router.reset(app.screens.title());
        },
        onError: (failure) => {
          if (failure instanceof RecoveryRequired)
            void app.router.reset(recoveryScreen(app, failure));
        },
      });
      const element = h(
        'main',
        { className: 'dv-recovery dv-error', testId: 'screen-error' },
        h(
          'div',
          { className: 'dv-card dv-recovery__card' },
          h('h1', { text: t('error.heading') }),
          h('p', { text: t('error.body') }),
          h('p', { className: 'dv-note', text: t('error.code', { code: errorCode(error) }) }),
          restart,
        ),
      );
      return {
        element,
        title: t('error.heading'),
        field: 'night',
        region: null,
        focusTarget: () => restart,
      };
    },
  };
}
