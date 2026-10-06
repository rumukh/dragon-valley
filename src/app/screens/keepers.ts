/**
 * Who is playing? Up to four keeper cards, a "New keeper" card while there is room, a small
 * change button per keeper, and the grown-ups' door behind the parent gate.
 */
import { openParentGate } from '../parent/gate-dialog';
import { MAX_KEEPERS } from '../persistence/family';
import { candyButton } from '../ui/button';
import { avatarArt } from '../ui/art';
import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';
import { topBar } from './common';

export function keepersScreen(app: App): ScreenEntry {
  return {
    key: 'keepers',
    async build(context) {
      await app.closeKeeper();
      const t = app.kit.t;
      const keepers = app.family.state().profiles;
      const grownups = candyButton({
        label: t('keepers.grownups'),
        icon: 'grownups',
        variant: 'paper',
        size: 'small',
        testId: 'grownups',
        onPress: async () => {
          if (await openParentGate(app.kit)) await app.router.push(app.screens.parent());
        },
        onError: app.kit.onError,
      });
      const heading = h('h1', { text: t('keepers.heading') });
      const cards = keepers.map((keeper) => {
        const play = h(
          'button',
          {
            className: 'dv-keeper-card__play',
            testId: `keeper-${keeper.id}`,
            attributes: { type: 'button', 'aria-label': t('keepers.play', { name: keeper.name }) },
          },
          avatarArt(keeper.avatar, 'dv-avatar dv-avatar--large'),
          h('span', { className: 'dv-keeper-card__name', text: keeper.name }),
        );
        play.addEventListener('click', () => {
          app.audio.unlock();
          void app.router.push(app.screens.hub(keeper.id)).catch(app.kit.onError);
        });
        const edit = candyButton({
          label: t('keepers.edit', { name: keeper.name }),
          icon: 'pencil',
          iconOnly: true,
          variant: 'paper',
          size: 'small',
          testId: `keeper-edit-${keeper.id}`,
          onPress: () => app.router.push(app.screens.editor(keeper.id)),
          onError: app.kit.onError,
        });
        return h('li', { className: 'dv-keeper-card' }, play, edit);
      });
      const list = h('ul', { className: 'dv-keeper-grid', testId: 'keeper-list' }, ...cards);
      if (keepers.length < MAX_KEEPERS) {
        const add = h(
          'button',
          {
            className: 'dv-keeper-card__play dv-keeper-card__play--add',
            testId: 'keeper-add',
            attributes: { type: 'button' },
          },
          h('span', { className: 'dv-keeper-card__plus' }, icon('plus')),
          h('span', { className: 'dv-keeper-card__name', text: t('keepers.add') }),
        );
        add.addEventListener('click', () => {
          void app.router.push(app.screens.editor(null)).catch(app.kit.onError);
        });
        list.append(h('li', { className: 'dv-keeper-card dv-keeper-card--add' }, add));
      }
      const element = h(
        'main',
        { className: 'dv-keepers', testId: 'screen-keepers' },
        topBar({
          back: context.canGoBack
            ? { label: t('common.back'), onPress: () => app.router.back() }
            : undefined,
          title: heading,
          tools: [grownups],
          onError: app.kit.onError,
        }),
        list,
        keepers.length >= MAX_KEEPERS
          ? h('p', { className: 'dv-note', text: t('keepers.full') })
          : null,
      );
      return {
        element,
        title: t('keepers.heading'),
        field: 'valley',
        region: null,
        music: 'title',
      };
    },
  };
}
