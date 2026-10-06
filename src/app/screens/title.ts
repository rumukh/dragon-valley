/**
 * Title: Old Glimmer waves over three warm eggs, the name, and one big Play button. The Play
 * tap is the trusted gesture that unlocks audio. First-time families go straight to making a
 * keeper; others choose who is playing.
 */
import { candyButton } from '../ui/button';
import { dragonArt } from '../ui/art';
import { h } from '../ui/dom';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';

const TITLE_EGGS = ['bubbles', 'sunny', 'goldie'] as const;

export function titleScreen(app: App): ScreenEntry {
  return {
    key: 'title',
    build() {
      const t = app.kit.t;
      const play = candyButton({
        label: t('title.play'),
        icon: 'play',
        variant: 'sun',
        size: 'big',
        testId: 'title-play',
        onPress: async () => {
          app.audio.unlock();
          const next = app.family.state().profiles.length
            ? app.screens.keepers()
            : app.screens.editor(null);
          await app.router.push(next);
        },
        onError: app.kit.onError,
      });
      const glimmer = dragonArt(
        {
          dragon: 'glimmer',
          stage: 'adult',
          expression: 'happy',
          framing: 'fit',
          title: t('title.art'),
        },
        'dv-dragon-art dv-title__glimmer',
      );
      const eggs = TITLE_EGGS.map((dragon) =>
        dragonArt(
          { dragon, stage: 'egg', warmth: 0.6, framing: 'fit' },
          'dv-dragon-art dv-title__egg',
        ),
      );
      const element = h(
        'main',
        { className: 'dv-title', testId: 'screen-title' },
        h(
          'div',
          { className: 'dv-title__scene' },
          glimmer,
          h('div', { className: 'dv-title__eggs' }, ...eggs),
        ),
        h(
          'div',
          { className: 'dv-title__copy' },
          h('h1', { className: 'dv-title__name', text: t('app.title') }),
          h('p', { className: 'dv-title__subtitle', text: t('app.subtitle') }),
          h('p', { className: 'dv-title__tagline', text: t('title.tagline') }),
          play,
        ),
      );
      return {
        element,
        title: t('app.title'),
        field: 'valley',
        region: 'sunny-meadow',
        music: 'title',
      };
    },
  };
}
