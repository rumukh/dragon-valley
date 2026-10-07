/**
 * The keeper's home in the valley: their dragons in the nest (the featured one big, with how
 * close it is to growing), the coin purse and save status, today's goal with the week's
 * practised days (a habit view, never a streak), and one big Daily Adventure button that does
 * what the game suggests next (docs/design.md §4.2). The valley map is one tap away.
 */
import type { GameAction, GameView } from '../../rules/contract';
import { taken } from '../controller/commands';
import { adventureFor, featuredDragon, findLevel, growthOf, weekdayIndex } from '../game/view';
import type { Adventure } from '../game/view';
import { plural } from '../i18n/messages';
import type { MessageKey } from '../i18n/messages';
import { openModal } from '../ui/dialog';
import { candyButton } from '../ui/button';
import { artIcon, cosmeticIconArt, viewDragonArt } from '../ui/art';
import { h } from '../ui/dom';
import { createCoinCounter, createMeter } from '../ui/meters';
import type { Screen } from '../router/router';
import type { ActiveKeeper, App } from '../shell/app';
import { createSaveStatus, keeperBadge, toastStickers, topBar } from './common';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const PLACES = {
  market: { label: 'hub.market', icon: 'bag' },
  den: { label: 'hub.den', icon: 'home' },
  album: { label: 'hub.album', icon: 'book' },
  window: { label: 'hub.window', icon: 'window' },
} as const;

export function hubScreen(app: App, active: ActiveKeeper): Screen {
  const t = app.kit.t;
  const text = app.text;
  const keeperId = active.keeper.id;
  const view = active.game.view();
  const saveStatus = createSaveStatus(app, active);
  const coins = createCoinCounter(app.kit, view.coins);

  const heading = h(
    'h1',
    { className: 'dv-hub__greeting', testId: 'hub-greeting' },
    t('hub.greeting', { name: active.keeper.name }),
  );

  const nest = h('section', { className: 'dv-hub__nest', testId: 'hub-nest' });
  const paintNest = (current: GameView): void => {
    const featured = featuredDragon(current);
    if (!featured) {
      nest.replaceChildren(h('p', { className: 'dv-note', text: t('hub.noDragons') }));
      return;
    }
    const name = text(featured.nameKey);
    const parts: Node[] = [
      h(
        'div',
        {
          className: 'dv-hub__dragon',
          testId: 'hub-dragon',
          dataset: { dragon: featured.id, stage: featured.stage },
          attributes: {
            role: 'img',
            'aria-label': t(`stage.${featured.stage}` as MessageKey, { name }),
          },
        },
        viewDragonArt(featured, { framing: featured.stage === 'egg' ? 'fit' : 'stage' }),
      ),
      h('p', {
        className: 'dv-hub__dragon-name',
        text: t(`stage.${featured.stage}` as MessageKey, { name }),
      }),
    ];
    const growth = growthOf(featured);
    if (growth) {
      parts.push(
        createMeter({
          label: t(`grow.${growth.next}` as MessageKey, { name }),
          max: growth.need,
          value: growth.have,
          valueText: (value, max) => t('grow.facts', { value, max }),
          testId: 'dragon-growth',
        }).element,
      );
    }
    const others = current.dragons.filter((dragon) => dragon.id !== featured.id);
    if (others.length > 0) {
      parts.push(
        h(
          'ul',
          { className: 'dv-hub__others', attributes: { 'aria-label': t('hub.otherDragons') } },
          ...others.map((dragon) =>
            h(
              'li',
              { className: 'dv-hub__other', dataset: { dragon: dragon.id } },
              viewDragonArt(dragon, {
                className: 'dv-dragon-art dv-dragon-art--small',
                animated: false,
              }),
              h('span', {
                text: t(`stage.${dragon.stage}` as MessageKey, { name: text(dragon.nameKey) }),
              }),
            ),
          ),
        ),
      );
    }
    nest.replaceChildren(...parts);
  };

  const adventureSlot = h('div', { className: 'dv-hub__adventure' });
  const goalSlot = h('div', { className: 'dv-hub__goal' });
  const questSlot = h('div', { className: 'dv-hub__quests' });
  const weekSlot = h('div', { className: 'dv-hub__week' });

  const adventureLabel = (adventure: Adventure, current: GameView): string => {
    switch (adventure.kind) {
      case 'level': {
        const found = findLevel(current, adventure.level);
        const title = found ? text(found.level.titleKey) : '';
        return t(adventure.resume !== null ? 'hub.adventure.resume' : 'hub.adventure.level', {
          level: title,
        });
      }
      case 'snack':
        return t('hub.adventure.snack');
      case 'minigame': {
        const level = active.game.content().data.levels.find((l) => l.id === adventure.level);
        const kind = level?.activities[adventure.activity]?.kind;
        const found = findLevel(current, adventure.level);
        return t('hub.adventure.minigame', {
          game: kind
            ? t(`activity.${kind}` as MessageKey)
            : found
              ? text(found.level.titleKey)
              : '',
        });
      }
      case 'placement':
        return t('hub.adventure.placement');
      case 'gift':
        return t('hub.adventure.gift');
      case 'story':
        return t('hub.adventure.story');
      case 'map':
        return t('hub.adventure.map');
    }
  };

  const go = async (adventure: Adventure): Promise<void> => {
    // The next screen does not wait for a slow save; the save indicator tracks it.
    const send = active.commands.captureSend();
    const dispatch = (action: GameAction): Promise<void> => taken(send(action));
    switch (adventure.kind) {
      case 'level':
        await dispatch(
          adventure.resume !== null
            ? { type: 'startActivity', activity: { kind: 'level', index: adventure.resume } }
            : { type: 'startLevel', level: adventure.level },
        );
        return app.continueGame(keeperId);
      case 'minigame':
        await dispatch({
          type: 'startLevel',
          level: adventure.level,
          activity: adventure.activity,
        });
        return app.continueGame(keeperId);
      case 'snack':
        await dispatch({
          type: 'startActivity',
          activity: { kind: 'snack', dragon: adventure.dragon },
        });
        return app.continueGame(keeperId);
      case 'placement':
        await dispatch({ type: 'startActivity', activity: { kind: 'placement' } });
        return app.continueGame(keeperId);
      case 'gift':
        await dispatch({ type: 'openGift' });
        await showGift();
        toastStickers(app, active);
        return app.router.refresh();
      case 'story':
        return app.continueGame(keeperId);
      case 'map':
        return app.router.push(app.screens.map(keeperId));
    }
  };

  const showGift = async (): Promise<void> => {
    const opened = active.events.take(['gift.opened']).at(-1);
    if (opened?.type !== 'gift.opened') return;
    const grant = opened.data.grant;
    const content = active.game.content().data;
    await openModal<null>(app.kit, {
      label: t('gift.heading'),
      testId: 'gift-dialog',
      dismissValue: null,
      build(body, close) {
        if (grant.kind === 'cosmetic') {
          const item = content.cosmetics.find((c) => c.id === grant.item);
          body.append(
            h('div', { className: 'dv-gift__art' }, cosmeticIconArt(item?.assetId ?? grant.item)),
            h('p', { text: t('gift.item', { item: item ? text(item.nameKey) : grant.item }) }),
          );
        } else if (grant.kind === 'coins') {
          body.append(
            h('div', { className: 'dv-gift__art' }, artIcon('coin')),
            h('p', { text: plural(t, grant.amount, 'gift.coins.one', 'gift.coins.other') }),
          );
        } else {
          body.append(h('p', { text: t('gift.egg') }));
        }
        body.append(
          h(
            'div',
            { className: 'dv-dialog__actions' },
            candyButton({
              label: t('gift.thanks'),
              variant: 'sun',
              testId: 'gift-close',
              onPress: () => close(null),
              onError: app.kit.onError,
            }),
          ),
        );
      },
    }).result;
  };

  const paintAdventure = (current: GameView): void => {
    if (active.timeIsUp()) {
      // The grown-ups' time limit is used up: a kind goodbye instead of a new adventure.
      adventureSlot.replaceChildren(
        h('p', { className: 'dv-hub__rest', testId: 'hub-rest', text: t('hub.rest') }),
        candyButton({
          label: t('results.goodbye'),
          icon: 'home',
          variant: 'sun',
          testId: 'hub-goodbye',
          onPress: () => app.router.reset(app.screens.keepers()),
          onError: app.kit.onError,
        }),
      );
      return;
    }
    const adventure = adventureFor(current);
    adventureSlot.replaceChildren(
      candyButton({
        label: adventureLabel(adventure, current),
        icon: adventure.kind === 'gift' ? 'gift' : 'play',
        variant: 'sun',
        size: 'big',
        testId: 'hub-adventure',
        onPress: () => go(adventure),
        onError: app.kit.onError,
      }),
    );
    const daily = current.daily;
    if (!daily) {
      goalSlot.replaceChildren();
      questSlot.replaceChildren();
      weekSlot.replaceChildren();
      return;
    }
    const today = weekdayIndex(daily.day);
    const meter = createMeter({
      label: t('hub.goal'),
      max: daily.goal,
      value: Math.min(daily.correct, daily.goal),
      valueText: (value, max) => t('hub.goalValue', { value, max }),
      testId: 'daily-goal',
    });
    const week = h(
      'ol',
      { className: 'dv-week', testId: 'week', attributes: { 'aria-label': t('hub.week') } },
      ...daily.week.map((practised, index) =>
        h(
          'li',
          {
            className: 'dv-week__day',
            dataset: { practised: String(practised), today: String(index === today) },
            attributes: {
              'aria-label': t(practised ? 'hub.dayPractised' : 'hub.dayNot', {
                day: t(`day.${WEEKDAYS[index]!}` as MessageKey),
              }),
            },
          },
          h('span', { className: 'dv-week__mark', attributes: { 'aria-hidden': 'true' } }),
          h('span', {
            className: 'dv-week__name',
            attributes: { 'aria-hidden': 'true' },
            text: t(`day.short.${WEEKDAYS[index]!}` as MessageKey),
          }),
        ),
      ),
    );
    const quests =
      daily.quests.length === 0
        ? []
        : [
            h(
              'section',
              { className: 'dv-quests', testId: 'quests' },
              h('h2', { className: 'dv-quests__title', text: t('hub.quests') }),
              h(
                'ul',
                { className: 'dv-quests__list' },
                ...daily.quests.map((quest) =>
                  h(
                    'li',
                    {
                      className: 'dv-quest',
                      testId: `quest-${quest.template}`,
                      dataset: { done: String(quest.done), claimed: String(quest.claimed) },
                    },
                    h('span', { className: 'dv-quest__title', text: text(quest.titleKey) }),
                    quest.claimed
                      ? h('span', { className: 'dv-quest__state', text: t('quest.claimed') })
                      : quest.done
                        ? candyButton({
                            label: plural(t, quest.coins, 'quest.claim.one', 'quest.claim.other'),
                            variant: 'sun',
                            size: 'small',
                            testId: `quest-claim-${quest.template}`,
                            onPress: async () => {
                              await active.commands.capture()({
                                type: 'claimQuest',
                                quest: quest.id,
                              });
                              toastStickers(app, active);
                            },
                            onError: app.kit.onError,
                          })
                        : h('span', {
                            className: 'dv-quest__state',
                            text: t('quest.progress', {
                              value: Math.min(quest.progress, quest.target),
                              max: quest.target,
                            }),
                          }),
                  ),
                ),
              ),
            ),
          ];
    goalSlot.replaceChildren(
      meter.element,
      ...(daily.sleepy ? [h('p', { className: 'dv-note', text: t('hub.sleepy') })] : []),
    );
    weekSlot.replaceChildren(week);
    questSlot.replaceChildren(...quests);
  };

  const paint = (): void => {
    const current = active.game.view();
    coins.set(current.coins);
    paintNest(current);
    paintAdventure(current);
  };
  paint();
  const unsubscribe = active.game.subscribe(() => paint());

  const places = h(
    'nav',
    { className: 'dv-hub__places', attributes: { 'aria-label': t('hub.places') } },
    candyButton({
      label: t('hub.map'),
      icon: 'map',
      variant: 'paper',
      size: 'small',
      testId: 'hub-map',
      onPress: () => app.router.push(app.screens.map(keeperId)),
      onError: app.kit.onError,
    }),
    ...(['market', 'den', 'album', 'window'] as const).map((place) =>
      candyButton({
        label: t(PLACES[place].label),
        icon: PLACES[place].icon,
        variant: 'paper',
        size: 'small',
        testId: `hub-${place}`,
        onPress: () => app.router.push(app.screens[place](keeperId)),
        onError: app.kit.onError,
      }),
    ),
    ...(view.hub.arena.available
      ? [
          candyButton({
            label: t('hub.arena'),
            icon: 'sparkle',
            variant: 'paper',
            size: 'small',
            testId: 'hub-arena',
            onPress: async () => {
              await active.commands.capture()({
                type: 'startActivity',
                activity: { kind: 'arena' },
              });
              await app.continueGame(keeperId);
            },
            onError: app.kit.onError,
          }),
        ]
      : []),
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
      'div',
      { className: 'dv-hub__layout' },
      nest,
      h(
        'section',
        { className: 'dv-card dv-hub__today' },
        heading,
        adventureSlot,
        goalSlot,
        questSlot,
      ),
      weekSlot,
      places,
    ),
  );

  return {
    element,
    title: t('hub.greeting', { name: active.keeper.name }),
    field: 'valley',
    region: 'sunny-meadow',
    music: 'hub',
    focusTarget: () => heading,
    dispose() {
      unsubscribe();
      saveStatus.dispose();
    },
  };
}
