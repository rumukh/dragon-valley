/**
 * The grown-ups' area, behind the parent gate: keepers, each keeper's settings (math signs,
 * read-aloud, voice, volumes, text size, reduced motion), backups and erasing, storage
 * persistence, offline installation and updates, and what the game does and does not do.
 *
 * It is an operating surface: calm, plain and complete. Nothing here plays sounds, and no
 * keeper's game is open while it is shown.
 */
import { assertChildSafeView } from '@aegis/browser/ui';
import type { SettingChange } from '../../rules/contract';
import type { MessageKey } from '../i18n/messages';
import { NOTATIONS } from '../math/notation';
import { shortRevision } from '../parent/about';
import type { OfflineState } from '../parent/offline';
import { BACKUP_MAX_BYTES } from '../persistence/backup';
import { findKeeper, MAX_KEEPERS } from '../persistence/family';
import type { Keeper } from '../persistence/family';
import { TEXT_SCALES, TIME_LIMITS } from '../persistence/preferences';
import type { PreferencesDraft } from '../persistence/preferences';
import { RecoveryRequired } from '../persistence/recovery';
import { formatBytes, requestPersistence, storageReport } from '../persistence/storage';
import { PreferencesStore } from '../persistence/stores';
import { candyButton, linkButton } from '../ui/button';
import { confirmDialog } from '../ui/dialog';
import { h } from '../ui/dom';
import type { ScreenEntry } from '../router/router';
import type { App, ParentTab } from '../shell/app';
import { downloadText, fileSlug, keeperBadge, localDay, pickTextFile, topBar } from './common';
import {
  eraseKeeperData,
  eraseProgress,
  exportKeeper,
  importKeeper,
  parseKeeperBackup,
  readKeeperGame,
} from './keeper-data';
import type { KeeperGame } from './keeper-data';
import { printContent } from './parent-print';
import { progressContent } from './parent-progress';

const TABS: readonly ParentTab[] = [
  'keepers',
  'progress',
  'print',
  'settings',
  'data',
  'offline',
  'about',
];

export function parentScreen(
  app: App,
  initialTab: ParentTab = 'keepers',
  keeperId?: string,
): ScreenEntry {
  // Kept by the entry, so coming back from the print preview finds the same tab and keeper.
  let tab: ParentTab = initialTab;
  let selected: string | undefined = keeperId;
  let printTable = 2;
  return {
    key: 'parent',
    async build(context) {
      await app.closeKeeper();
      const t = app.kit.t;
      if (!selected || !findKeeper(app.family.state(), selected)) {
        selected = app.family.state().profiles[0]?.id;
      }
      let disposed = false;
      const panel = h('section', { className: 'dv-parent__panel', testId: 'parent-panel' });

      /** A row of toggle buttons; `spoken` names a button for screen readers when its text is signs. */
      const segmented = <T extends string>(
        label: string,
        values: readonly T[],
        current: T,
        text: (value: T) => string,
        testId: (value: T) => string,
        choose: (value: T) => void | Promise<void>,
        spoken?: (value: T) => string,
      ): HTMLElement => {
        const group = h('div', {
          className: 'dv-segmented',
          attributes: { role: 'group', 'aria-label': label },
        });
        for (const value of values) {
          const button = h('button', {
            className: 'dv-segment',
            text: text(value),
            testId: testId(value),
            attributes: {
              type: 'button',
              'aria-pressed': String(value === current),
              ...(spoken ? { 'aria-label': spoken(value) } : {}),
            },
          });
          button.addEventListener('click', () => {
            void Promise.resolve(choose(value)).catch(app.kit.onError);
          });
          group.append(button);
        }
        return group;
      };

      const tabBar = h('nav', {
        className: 'dv-parent__tabs',
        attributes: { 'aria-label': t('parent.heading') },
      });
      const renderTabs = (): void => {
        tabBar.replaceChildren(
          segmented(
            t('parent.heading'),
            TABS,
            tab,
            (value) => t(`parent.tab.${value}` as MessageKey),
            (value) => `parent-tab-${value}`,
            async (value) => {
              tab = value;
              renderTabs();
              await render();
            },
          ),
        );
      };

      const section = (titleKey: MessageKey, ...children: (Node | null)[]): HTMLElement =>
        h(
          'section',
          { className: 'dv-card dv-parent__section' },
          h('h2', { text: t(titleKey) }),
          ...children,
        );

      const keeperPicker = (
        onPick: () => Promise<void>,
        labelKey: MessageKey = 'parent.settings.for',
      ): HTMLElement | null => {
        const keepers = app.family.state().profiles;
        if (keepers.length < 2) return null;
        return h(
          'div',
          { className: 'dv-field' },
          h('span', { className: 'dv-field__label', text: t(labelKey) }),
          segmented(
            t(labelKey),
            keepers.map((keeper) => keeper.id),
            selected ?? '',
            (id) => findKeeper(app.family.state(), id)?.name ?? id,
            (id) => `parent-keeper-${id}`,
            async (id) => {
              selected = id;
              await onPick();
            },
          ),
        );
      };

      // ---- Keepers ------------------------------------------------------------------------
      const keepersPanel = (): HTMLElement => {
        const keepers = app.family.state().profiles;
        const list = h('ul', { className: 'dv-parent__list', testId: 'parent-keepers' });
        for (const keeper of keepers) {
          list.append(
            h(
              'li',
              { className: 'dv-parent__row' },
              keeperBadge(keeper),
              h(
                'span',
                { className: 'dv-row' },
                candyButton({
                  label: t('parent.keepers.edit'),
                  icon: 'pencil',
                  variant: 'paper',
                  size: 'small',
                  testId: `parent-edit-${keeper.id}`,
                  onPress: () => app.router.push(app.screens.editor(keeper.id)),
                  onError: app.kit.onError,
                }),
                candyButton({
                  label: t('parent.keepers.remove'),
                  icon: 'trash',
                  variant: 'coral',
                  size: 'small',
                  testId: `parent-remove-${keeper.id}`,
                  onPress: () => removeKeeper(keeper),
                  onError: app.kit.onError,
                }),
              ),
            ),
          );
        }
        return section(
          'parent.tab.keepers',
          h('p', { text: t('parent.keepers.intro') }),
          keepers.length ? list : h('p', { text: t('parent.keepers.none') }),
          keepers.length < MAX_KEEPERS
            ? candyButton({
                label: t('parent.keepers.add'),
                icon: 'plus',
                testId: 'parent-add',
                onPress: () => app.router.push(app.screens.editor(null)),
                onError: app.kit.onError,
              })
            : null,
        );
      };

      const removeKeeper = async (keeper: Keeper): Promise<void> => {
        const sure = await confirmDialog(app.kit, {
          heading: t('parent.keepers.removeTitle', { name: keeper.name }),
          body: t('parent.keepers.removeBody', { name: keeper.name }),
          confirmLabel: t('parent.keepers.removeConfirm', { name: keeper.name }),
          cancelLabel: t('common.cancel'),
          tone: 'warning',
        });
        if (!sure) return;
        try {
          await app.family.remove(keeper.id, () => eraseKeeperData(app, keeper.id));
          app.kit.toasts.show(t('parent.keepers.removed', { name: keeper.name }), {
            tone: 'success',
          });
          if (selected === keeper.id) selected = app.family.state().profiles[0]?.id;
        } catch {
          app.kit.toasts.show(t('parent.keepers.removeFailed', { name: keeper.name }), {
            tone: 'warning',
          });
        }
        await render();
      };

      // ---- Settings -----------------------------------------------------------------------
      /**
       * The selected keeper's game for the Progress and Print tabs, or a short note when there
       * is no keeper or their saved game cannot be opened (the game itself asks for recovery).
       */
      const keeperGame = async (
        tabKey: MessageKey,
        forKey: MessageKey,
      ): Promise<
        | { keeper: Keeper; game: KeeperGame; frame: (...children: Node[]) => HTMLElement }
        | HTMLElement
      > => {
        const keeper = selected ? findKeeper(app.family.state(), selected) : undefined;
        if (!keeper) return section(tabKey, h('p', { text: t('parent.progress.none') }));
        const frame = (...children: Node[]): HTMLElement =>
          section(tabKey, keeperPicker(render, forKey), ...children);
        try {
          return { keeper, game: await readKeeperGame(app, keeper.id), frame };
        } catch (error) {
          if (!(error instanceof RecoveryRequired)) throw error;
          return frame(
            h('p', {
              className: 'dv-note',
              testId: 'parent-unreadable',
              text: t('parent.progress.unreadable', { name: keeper.name }),
            }),
          );
        }
      };

      const progressPanel = async (): Promise<HTMLElement> => {
        const read = await keeperGame('parent.tab.progress', 'parent.progress.for');
        if (read instanceof HTMLElement) return read;
        return read.frame(
          h(
            'div',
            { className: 'dv-progress', testId: 'parent-progress' },
            ...progressContent(app, read.keeper, read.game.view, read.game.notation),
          ),
        );
      };

      // ---- Print ----------------------------------------------------------------------------
      const printPanel = async (): Promise<HTMLElement> => {
        const read = await keeperGame('parent.tab.print', 'parent.print.for');
        if (read instanceof HTMLElement) return read;
        return read.frame(
          ...printContent(app, read.keeper, read.game, {
            table: printTable,
            chooseTable: async (table) => {
              printTable = table;
              await render();
            },
            segmented,
          }),
        );
      };

      const settingsPanel = async (): Promise<HTMLElement> => {
        const keeper = selected ? findKeeper(app.family.state(), selected) : undefined;
        if (!keeper)
          return section('parent.tab.settings', h('p', { text: t('parent.settings.none') }));
        const store = new PreferencesStore(app.storage, keeper.id);
        try {
          await store.open();
        } catch (error) {
          if (error instanceof RecoveryRequired) app.reportError(error);
          throw error;
        }
        const change = async (edit: (draft: PreferencesDraft) => void): Promise<void> => {
          try {
            await store.change(edit);
            app.kit.toasts.show(t('parent.settings.saved'), { tone: 'success', durationMs: 1800 });
          } catch {
            app.kit.toasts.show(t('parent.settings.failed'), { tone: 'warning' });
          }
          await render();
        };
        const prefs = store.current();
        const switchRow = (
          labelKey: MessageKey,
          checked: boolean,
          testId: string,
          edit: (draft: PreferencesDraft, value: boolean) => void,
        ): HTMLElement => {
          const input = h('input', { testId, attributes: { type: 'checkbox', role: 'switch' } });
          input.checked = checked;
          input.addEventListener('change', () => {
            const value = input.checked;
            void change((draft) => edit(draft, value)).catch(app.kit.onError);
          });
          return h('label', { className: 'dv-switch' }, h('span', { text: t(labelKey) }), input);
        };
        const volumeRow = (
          labelKey: MessageKey,
          value: number,
          testId: string,
          bus: 'music' | 'effects',
        ): HTMLElement => {
          const input = h('input', {
            className: 'dv-range',
            testId,
            attributes: {
              type: 'range',
              min: '0',
              max: '100',
              step: '10',
              'aria-valuetext': t('parent.settings.volumeValue', {
                percent: Math.round(value * 100),
              }),
            },
          });
          input.value = String(Math.round(value * 100));
          const shown = h('span', {
            text: t('parent.settings.volumeValue', { percent: Math.round(value * 100) }),
          });
          input.addEventListener('change', () => {
            const next = Number(input.value) / 100;
            void change((draft) => {
              draft.presentation = {
                ...draft.presentation,
                volumes: { ...draft.presentation.volumes, [bus]: next },
              };
            }).catch(app.kit.onError);
          });
          return h(
            'label',
            { className: 'dv-field' },
            h(
              'span',
              { className: 'dv-field__label dv-row' },
              h('span', { text: t(labelKey) }),
              shown,
            ),
            input,
          );
        };

        const voices = app.speech.voices();
        let voiceControl: HTMLElement;
        if (!app.speech.available()) {
          voiceControl = h('p', {
            className: 'dv-note',
            testId: 'voice-none',
            text: t('parent.settings.noVoice'),
          });
        } else {
          const select = h('select', {
            className: 'dv-select',
            testId: 'setting-voice',
            attributes: { id: 'dv-voice' },
          });
          const fallback = voices[0];
          select.append(
            h('option', {
              text: t('parent.settings.voiceDefault', { name: fallback?.name ?? '' }),
              attributes: { value: '' },
            }),
            ...voices.map((voice) =>
              h('option', {
                text: `${voice.name} (${voice.lang})`,
                attributes: { value: voice.uri },
              }),
            ),
          );
          select.value = prefs.voice ?? '';
          select.addEventListener('change', () => {
            const value = select.value === '' ? null : select.value;
            void change((draft) => {
              draft.voice = value;
            }).catch(app.kit.onError);
          });
          voiceControl = h(
            'div',
            { className: 'dv-field' },
            h('label', {
              className: 'dv-field__label',
              text: t('parent.settings.voice'),
              attributes: { for: 'dv-voice' },
            }),
            h(
              'div',
              { className: 'dv-row' },
              select,
              candyButton({
                label: t('parent.settings.voiceTest'),
                icon: 'speaker',
                variant: 'paper',
                size: 'small',
                testId: 'setting-voice-test',
                onPress: () => {
                  app.speech.speak(t('parent.settings.voiceSample'), {
                    voice: store.current().voice,
                    volume: store.current().presentation.volumes.narration,
                  });
                },
                onError: app.kit.onError,
              }),
            ),
          );
        }

        return section(
          'parent.tab.settings',
          keeperPicker(render),
          h('div', { className: 'dv-parent__keeper' }, keeperBadge(keeper)),
          h(
            'div',
            { className: 'dv-field' },
            h('span', { className: 'dv-field__label', text: t('parent.settings.notation') }),
            segmented(
              t('parent.settings.notation'),
              NOTATIONS,
              prefs.notation,
              (value) => t(`parent.settings.notation.${value}` as MessageKey),
              (value) => `setting-notation-${value}`,
              (value) =>
                change((draft) => {
                  draft.notation = value;
                }),
              (value) => t(`parent.settings.notation.${value}.spoken` as MessageKey),
            ),
          ),
          switchRow(
            'parent.settings.readAloud',
            prefs.readAloud,
            'setting-read-aloud',
            (draft, value) => {
              draft.readAloud = value;
            },
          ),
          switchRow(
            'parent.settings.autoRead',
            prefs.autoRead,
            'setting-auto-read',
            (draft, value) => {
              draft.autoRead = value;
            },
          ),
          voiceControl,
          volumeRow(
            'parent.settings.music',
            prefs.presentation.volumes.music,
            'setting-music',
            'music',
          ),
          volumeRow(
            'parent.settings.effects',
            prefs.presentation.volumes.effects,
            'setting-effects',
            'effects',
          ),
          h(
            'div',
            { className: 'dv-field' },
            h('span', { className: 'dv-field__label', text: t('parent.settings.textSize') }),
            segmented(
              t('parent.settings.textSize'),
              TEXT_SCALES.map(String),
              String(prefs.presentation.textScale),
              (value) => `${Math.round(Number(value) * 100)}%`,
              (value) => `setting-text-${Math.round(Number(value) * 100)}`,
              (value) =>
                change((draft) => {
                  draft.presentation = { ...draft.presentation, textScale: Number(value) };
                }),
            ),
          ),
          switchRow(
            'parent.settings.reducedMotion',
            prefs.presentation.reducedMotion,
            'setting-reduced-motion',
            (draft, value) => {
              draft.presentation = { ...draft.presentation, reducedMotion: value };
            },
          ),
          h(
            'div',
            { className: 'dv-field' },
            h('span', { className: 'dv-field__label', text: t('parent.settings.timeLimit') }),
            segmented(
              t('parent.settings.timeLimit'),
              ['off', ...TIME_LIMITS.map(String)],
              prefs.timeLimit === null ? 'off' : String(prefs.timeLimit),
              (value) =>
                value === 'off'
                  ? t('parent.settings.timeLimitOff')
                  : t('parent.settings.minutes', { count: value }),
              (value) => `setting-time-${value}`,
              (value) =>
                change((draft) => {
                  draft.timeLimit = value === 'off' ? null : Number(value);
                }),
            ),
          ),
          await rulesSection(keeper),
        );
      };

      /** Settings the rules own (daily goal, Arena, placement, regions): actions on the game. */
      const rulesSection = async (keeper: Keeper): Promise<HTMLElement> => {
        const heading = h('h3', { text: t('parent.rules.heading', { name: keeper.name }) });
        const active = await app.openKeeper(keeper.id);
        const view = active.game.view();
        if (view.day === null) {
          return h(
            'div',
            { className: 'dv-parent__rules', testId: 'parent-rules' },
            heading,
            h('p', { className: 'dv-note', text: t('parent.rules.notYet', { name: keeper.name }) }),
          );
        }
        const set = async (setting: SettingChange): Promise<void> => {
          await active.commands.capture()({ type: 'setSetting', setting });
          app.kit.toasts.show(t('parent.rules.saved'), { tone: 'success', durationMs: 1800 });
          await render();
        };
        const goals = [...new Set([10, 20, 30, 50, 100, view.settings.dailyGoal])].sort(
          (a, b) => a - b,
        );
        const arena = h('input', {
          testId: 'setting-arena',
          attributes: { type: 'checkbox', role: 'switch' },
        });
        arena.checked = view.settings.arena;
        arena.addEventListener('change', () => {
          void set({ key: 'arena', value: arena.checked }).catch(app.kit.onError);
        });
        // Regions still locked, and those opened ahead (so they can be closed again).
        const locked = view.hub.regions.filter(
          (region) => !region.unlocked || view.settings.unlockAhead.includes(region.id),
        );
        return h(
          'div',
          { className: 'dv-parent__rules', testId: 'parent-rules' },
          heading,
          h(
            'div',
            { className: 'dv-field' },
            h('span', { className: 'dv-field__label', text: t('parent.rules.dailyGoal') }),
            segmented(
              t('parent.rules.dailyGoal'),
              goals.map(String),
              String(view.settings.dailyGoal),
              (value) => value,
              (value) => `setting-goal-${value}`,
              (value) => set({ key: 'dailyGoal', value: Number(value) }),
            ),
          ),
          h(
            'label',
            { className: 'dv-switch' },
            h('span', { text: t('parent.rules.arena') }),
            arena,
          ),
          ...(locked.length > 0
            ? [
                h(
                  'div',
                  { className: 'dv-field' },
                  h('span', { className: 'dv-field__label', text: t('parent.rules.unlock') }),
                  ...locked.map((region) => {
                    const input = h('input', {
                      testId: `setting-unlock-${region.id}`,
                      attributes: { type: 'checkbox', role: 'switch' },
                    });
                    input.checked = view.settings.unlockAhead.includes(region.id);
                    input.addEventListener('change', () => {
                      const others = view.settings.unlockAhead.filter((id) => id !== region.id);
                      void set({
                        key: 'unlockAhead',
                        value: input.checked ? [...others, region.id] : others,
                      }).catch(app.kit.onError);
                    });
                    return h(
                      'label',
                      { className: 'dv-switch' },
                      h('span', { text: app.text(region.titleKey) }),
                      input,
                    );
                  }),
                ),
              ]
            : []),
          candyButton({
            label: t('parent.rules.placement'),
            icon: 'retry',
            variant: 'paper',
            size: 'small',
            testId: 'setting-placement',
            onPress: async () => {
              await active.commands.capture()({
                type: 'startActivity',
                activity: { kind: 'placement' },
              });
              app.kit.toasts.show(t('parent.rules.placementStarted', { name: keeper.name }));
            },
            onError: app.kit.onError,
          }),
        );
      };

      // ---- Data ---------------------------------------------------------------------------
      const dataPanel = async (): Promise<HTMLElement> => {
        const keepers = app.family.state().profiles;
        const rows = keepers.map((keeper) =>
          h(
            'li',
            { className: 'dv-parent__row dv-parent__row--stack' },
            keeperBadge(keeper),
            h(
              'span',
              { className: 'dv-row' },
              candyButton({
                label: t('parent.data.export', { name: keeper.name }),
                icon: 'download',
                variant: 'paper',
                size: 'small',
                testId: `backup-export-${keeper.id}`,
                onPress: async () => {
                  try {
                    const text = await exportKeeper(app, keeper);
                    downloadText(`dragon-valley-${fileSlug(keeper.name)}-${localDay()}.json`, text);
                    app.kit.toasts.show(t('parent.data.exported', { name: keeper.name }), {
                      tone: 'success',
                    });
                  } catch {
                    app.kit.toasts.show(t('parent.data.exportFailed', { name: keeper.name }), {
                      tone: 'warning',
                    });
                  }
                },
                onError: app.kit.onError,
              }),
              candyButton({
                label: t('parent.data.import', { name: keeper.name }),
                icon: 'upload',
                variant: 'paper',
                size: 'small',
                testId: `backup-import-${keeper.id}`,
                onPress: async () => {
                  let text: string | null;
                  try {
                    text = await pickTextFile(BACKUP_MAX_BYTES);
                  } catch {
                    app.kit.toasts.show(t('parent.data.importFailed'), { tone: 'warning' });
                    return;
                  }
                  if (text === null) return;
                  try {
                    const backup = parseKeeperBackup(text);
                    const sure = await confirmDialog(app.kit, {
                      heading: t('parent.data.importConfirmTitle', { name: keeper.name }),
                      body: t('parent.data.importConfirmBody', { name: keeper.name }),
                      confirmLabel: t('parent.data.importConfirm'),
                      cancelLabel: t('common.cancel'),
                      tone: 'warning',
                    });
                    if (!sure) return;
                    await importKeeper(app, keeper, backup);
                    app.kit.toasts.show(t('parent.data.imported', { name: keeper.name }), {
                      tone: 'success',
                    });
                  } catch {
                    app.kit.toasts.show(t('parent.data.importFailed'), { tone: 'warning' });
                  }
                },
                onError: app.kit.onError,
              }),
              linkButton({
                label: t('parent.data.reset', { name: keeper.name }),
                icon: 'trash',
                testId: `progress-reset-${keeper.id}`,
                onPress: async () => {
                  const sure = await confirmDialog(app.kit, {
                    heading: t('parent.data.resetTitle', { name: keeper.name }),
                    body: t('parent.data.resetBody', { name: keeper.name }),
                    confirmLabel: t('parent.data.resetConfirm'),
                    cancelLabel: t('common.cancel'),
                    tone: 'warning',
                  });
                  if (!sure) return;
                  await eraseProgress(app, keeper.id);
                  app.kit.toasts.show(t('parent.data.resetDone', { name: keeper.name }), {
                    tone: 'success',
                  });
                },
                onError: app.kit.onError,
              }),
            ),
          ),
        );
        const report = await storageReport();
        const storageText =
          report.persisted === true
            ? t('parent.data.persisted')
            : report.persisted === false
              ? t('parent.data.notPersisted')
              : t('parent.data.persistUnknown');
        return h(
          'div',
          { className: 'dv-stack' },
          section(
            'parent.data.backupHeading',
            h('p', { text: t('parent.data.backupIntro') }),
            keepers.length
              ? h('ul', { className: 'dv-parent__list', testId: 'parent-data' }, ...rows)
              : h('p', { text: t('parent.keepers.none') }),
          ),
          section(
            'parent.data.storageHeading',
            h('p', {
              testId: 'storage-status',
              text: storageText,
              dataset: { persisted: String(report.persisted) },
            }),
            report.usageBytes !== null
              ? h('p', {
                  className: 'dv-note',
                  text: t('parent.data.usage', { size: formatBytes(report.usageBytes) }),
                })
              : null,
            report.persisted === true
              ? null
              : candyButton({
                  label: t('parent.data.persist'),
                  icon: 'shield',
                  variant: 'paper',
                  size: 'small',
                  testId: 'storage-persist',
                  onPress: async () => {
                    await requestPersistence();
                    await render();
                  },
                  onError: app.kit.onError,
                }),
          ),
        );
      };

      // ---- Offline ------------------------------------------------------------------------
      const offlinePanel = async (): Promise<HTMLElement> => {
        const status = h('p', {
          className: 'dv-offline-status',
          testId: 'offline-status',
          attributes: { 'aria-live': 'polite' },
        });
        const show = (state: OfflineState): void => {
          status.dataset['state'] = state.kind;
          status.textContent =
            state.kind === 'installing'
              ? t('parent.offline.installing', { completed: state.completed, total: state.total })
              : state.kind === 'ready'
                ? t('parent.offline.ready')
                : state.kind === 'missing'
                  ? t('parent.offline.missing')
                  : state.kind === 'unavailable'
                    ? t('parent.offline.unavailable')
                    : state.kind === 'up-to-date'
                      ? t('parent.offline.upToDate')
                      : state.kind === 'update-ready'
                        ? t('parent.offline.updateReady')
                        : t('parent.offline.failed', { code: state.code });
        };
        const initial = await app.offline.inspect();
        show(initial);
        const supported = app.offline.supported();
        const install = candyButton({
          label: t('parent.offline.install'),
          icon: 'download',
          testId: 'offline-install',
          onPress: async () => {
            const result = await app.offline.install(show);
            show(result);
            install.hidden = result.kind === 'ready' || result.kind === 'update-ready';
            await requestPersistence();
          },
          onError: app.kit.onError,
        });
        install.hidden = initial.kind === 'ready';
        return section(
          'parent.offline.heading',
          h('p', { text: t('parent.offline.intro') }),
          status,
          supported
            ? h(
                'div',
                { className: 'dv-row' },
                install,
                candyButton({
                  label: t('parent.offline.check'),
                  icon: 'retry',
                  variant: 'paper',
                  testId: 'offline-update',
                  onPress: async () => show(await app.offline.checkForUpdate(show)),
                  onError: app.kit.onError,
                }),
              )
            : null,
        );
      };

      // ---- About --------------------------------------------------------------------------
      const aboutPanel = (): HTMLElement =>
        section(
          'parent.tab.about',
          h('p', {
            testId: 'about-version',
            text: t('parent.about.version', { revision: shortRevision(app.env.revision) }),
            // The whole revision for support, as in index.html and resource-graph.json.
            attributes: { title: app.env.revision },
            dataset: { revision: app.env.revision },
          }),
          h('p', { text: t('parent.about.privacy') }),
          h('p', { text: t('parent.about.font') }),
          h('a', {
            className: 'dv-link-button',
            text: t('parent.about.licenses'),
            attributes: {
              href: new URL('licenses.txt', app.env.baseUrl).href,
              target: '_blank',
              rel: 'noopener',
            },
          }),
        );

      const render = async (): Promise<void> => {
        if (disposed) return;
        let content: HTMLElement;
        try {
          content =
            tab === 'keepers'
              ? keepersPanel()
              : tab === 'progress'
                ? await progressPanel()
                : tab === 'print'
                  ? await printPanel()
                  : tab === 'settings'
                    ? await settingsPanel()
                    : tab === 'data'
                      ? await dataPanel()
                      : tab === 'offline'
                        ? await offlinePanel()
                        : aboutPanel();
        } catch (error) {
          if (!(error instanceof RecoveryRequired)) app.kit.onError(error);
          return;
        }
        if (disposed) return;
        assertChildSafeView(content, app.kit.baseUrl);
        panel.replaceChildren(content);
      };

      renderTabs();
      await render();
      const heading = h('h1', { text: t('parent.heading') });
      const element = h(
        'main',
        { className: 'dv-parent', testId: 'screen-parent' },
        topBar({
          back: context.canGoBack
            ? { label: t('parent.close'), testId: 'parent-close', onPress: () => app.router.back() }
            : undefined,
          title: heading,
          onError: app.kit.onError,
        }),
        tabBar,
        panel,
      );
      const unsubscribeFamily = app.family.subscribe(() => {
        if (tab === 'keepers') void render();
      });
      return {
        element,
        title: t('parent.heading'),
        field: 'desk',
        region: null,
        dispose() {
          disposed = true;
          unsubscribeFamily();
        },
      };
    },
  };
}
