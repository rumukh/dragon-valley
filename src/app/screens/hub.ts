/**
 * The keeper's hub (a placeholder until the valley map arrives in phase 2): a greeting, the
 * keeper's egg growing warmer with practice, the coin purse, the save status, and one big
 * button into a short warm-up round. Entering the hub starts the day's session; it is also the
 * safe boundary where newer content may be activated.
 */
import { candyButton } from '../ui/button';
import { dragonArt } from '../ui/art';
import { h } from '../ui/dom';
import { createCoinCounter, createMeter } from '../ui/meters';
import type { ScreenEntry } from '../router/router';
import type { App } from '../shell/app';
import { createSaveStatus, keeperBadge, localDay, topBar } from './common';

export const HUB_EGG = 'sunny';

export function hubScreen(app: App, keeperId: string): ScreenEntry {
  return {
    key: `hub:${keeperId}`,
    async build() {
      const t = app.kit.t;
      const active = await app.openKeeper(keeperId);
      const host = active.game.host;
      await active.game.activateLatestContent();
      const view = host.getView();
      const saveStatus = createSaveStatus(app, active);
      const coins = createCoinCounter(app.kit, view.coins);
      const meter = createMeter({
        label: t('hub.warmth'),
        max: view.maxWarmth,
        value: view.warmth,
        valueText: (value, max) => t('hub.warmthValue', { value, max }),
        testId: 'egg-warmth',
      });
      const eggSlot = h('div', {
        className: 'dv-hub__egg',
        testId: 'hub-egg',
        attributes: { role: 'img', 'aria-label': t('hub.eggArt') },
      });
      const toasty = h('p', { className: 'dv-hub__toasty', testId: 'hub-toasty' });
      let shownWarmth = -1;
      const paint = (): void => {
        const current = host.getView();
        if (current.warmth !== shownWarmth) {
          shownWarmth = current.warmth;
          eggSlot.replaceChildren(
            dragonArt({
              dragon: HUB_EGG,
              stage: 'egg',
              warmth: current.maxWarmth ? current.warmth / current.maxWarmth : 0,
              framing: 'fit',
            }),
          );
          meter.update(current.warmth);
          toasty.textContent = current.warmth >= current.maxWarmth ? t('hub.toasty') : '';
        }
        coins.set(current.coins);
      };
      paint();
      const unsubscribe = host.subscribe(paint);

      const practice = candyButton({
        label: t('hub.practice'),
        icon: 'play',
        variant: 'sun',
        size: 'big',
        testId: 'hub-practice',
        onPress: async () => {
          const round = host.getView().round;
          if (!round || round.finished) {
            const dispatch = active.commands.capture();
            if (round?.finished) await dispatch({ type: 'endRound' });
            await active.commands.capture()({ type: 'startRound' });
          }
          await app.router.push(app.screens.round(keeperId));
        },
        onError: app.kit.onError,
      });

      const heading = h(
        'h1',
        { className: 'dv-hub__greeting', testId: 'hub-greeting' },
        t('hub.greeting', { name: active.keeper.name }),
      );
      const element = h(
        'main',
        { className: 'dv-hub', testId: 'screen-hub' },
        topBar({
          back: {
            label: t('hub.back'),
            testId: 'hub-back',
            onPress: () => app.router.reset(app.screens.keepers()),
          },
          title: keeperBadge(active.keeper),
          tools: [coins.element, saveStatus.element],
          onError: app.kit.onError,
        }),
        h(
          'section',
          { className: 'dv-hub__stage' },
          heading,
          eggSlot,
          meter.element,
          toasty,
          practice,
          h('p', { className: 'dv-note', text: t('hub.building') }),
        ),
      );

      // A new day's session starts at the hub; time reaches the rules only as this day value.
      const startSession = active.commands.capture();
      return {
        element,
        title: t('hub.greeting', { name: active.keeper.name }),
        field: 'valley',
        region: 'sunny-meadow',
        music: 'hub',
        focusTarget: () => heading,
        mounted() {
          void startSession({ type: 'startSession', day: localDay() }).catch(app.kit.onError);
        },
        dispose() {
          unsubscribe();
          saveStatus.dispose();
        },
      };
    },
  };
}
