/**
 * After a round: what the child achieved and what is next. A finished level shows its stars
 * (one by one, with their sounds) and confetti; a finished activity of a longer level shows how
 * it went and what comes next. Celebrations come from the round's live events, never replayed
 * history: an egg hatching (S4's hatch sequence), a dragon growing, a new egg, a new sticker, a
 * new region. A round stopped by the grown-ups' time limit ends with a kind goodbye.
 */
import type { GameEvent, GameView } from '../../rules/contract';
import type { StickerFrame } from '../art/stickers';
import { resultsNext } from '../game/view';
import type { MessageKey } from '../i18n/messages';
import { candyButton } from '../ui/button';
import { dragonArt, hatchArt, stickerArt, viewDragonArt } from '../ui/art';
import { confetti } from '../ui/confetti';
import { h } from '../ui/dom';
import { createCoinCounter, createStars } from '../ui/meters';
import type { Screen } from '../router/router';
import type { ActiveKeeper, App } from '../shell/app';
import { createSaveStatus, topBar } from './common';
import { backdrop } from './scene';

const CELEBRATED = [
  'level.completed',
  'arena.finished',
  'dragon.hatched',
  'dragon.grew',
  'dragon.crowned',
  'egg.received',
  'sticker.earned',
  'region.unlocked',
] as const;

type Celebrated = Extract<GameEvent, { type: (typeof CELEBRATED)[number] }>;

export function resultsScreen(app: App, active: ActiveKeeper): Screen {
  const t = app.kit.t;
  const text = app.text;
  const host = active.game.host;
  const keeperId = active.keeper.id;
  const data = app.game.content.data;
  const view = host.getView();
  const round = view.round!;
  const run = view.run;
  const events = active.events.take(CELEBRATED) as Celebrated[];
  const levelId = round.source.kind === 'level' ? round.source.level : null;
  const level = levelId ? data.levels.find((candidate) => candidate.id === levelId) : undefined;
  const levelDone = run?.result ?? null;
  const timeUp = round.endReason === 'time-limit';
  const arena = events.find(
    (event): event is Extract<Celebrated, { type: 'arena.finished' }> =>
      event.type === 'arena.finished',
  );
  const next = resultsNext(view);

  const saveStatus = createSaveStatus(app, active);
  const coins = createCoinCounter(app.kit, view.coins);
  const dragonName = (id: string): string => {
    const dragon = data.dragons.find((candidate) => candidate.id === id);
    return dragon ? text(dragon.nameKey) : id;
  };

  const headline = timeUp
    ? t('results.timeUp')
    : round.endReason === 'time-up'
      ? t('results.timeIsUp')
      : round.activity === 'placement'
        ? t('results.placement')
        : levelDone
          ? t('results.levelDone')
          : t('results.activityDone');
  const heading = h('h1', {
    className: 'dv-results__title',
    testId: 'results-title',
    text: headline,
  });
  const parts: Node[] = [heading];
  if (level && !timeUp) {
    parts.push(h('p', { className: 'dv-results__level', text: text(level.titleKey) }));
  }

  const stars = levelDone
    ? createStars(levelDone.stars, t('results.stars', { count: levelDone.stars }))
    : null;
  if (stars) parts.push(stars.element);

  if (arena) {
    parts.push(
      h('p', {
        className: 'dv-results__summary',
        testId: 'results-arena',
        text: t('results.arena', { score: arena.data.score }),
      }),
      h('p', {
        className: 'dv-results__level',
        text: arena.data.record
          ? t('results.arenaRecord')
          : t('results.arenaBest', { best: arena.data.best }),
      }),
    );
  } else if (round.type === 'problems' && round.progress.answered > 0) {
    parts.push(
      h('p', {
        className: 'dv-results__summary',
        testId: 'results-summary',
        text: t('results.correct', {
          correct: round.progress.correct,
          answered: round.progress.answered,
        }),
      }),
    );
  }
  if (round.coins > 0) {
    parts.push(
      h('p', {
        className: 'dv-results__coins',
        testId: 'results-coins',
        text: t('results.coins', { count: round.coins }),
      }),
    );
  }

  // ---- celebrations -------------------------------------------------------------------------
  const celebrations: Node[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'dragon.hatched': {
        const dragon = data.dragons.find((candidate) => candidate.id === event.data.dragon);
        if (!dragon) break;
        celebrations.push(
          h(
            'figure',
            { className: 'dv-celebrate dv-celebrate--hatch', testId: 'celebrate-hatch' },
            hatchArt(dragon.rig),
            h('figcaption', { text: t('results.hatched', { name: text(dragon.nameKey) }) }),
          ),
        );
        break;
      }
      case 'dragon.grew': {
        const dragon = view.dragons.find((candidate) => candidate.id === event.data.dragon);
        if (!dragon) break;
        celebrations.push(
          h(
            'figure',
            { className: 'dv-celebrate', testId: 'celebrate-grew' },
            viewDragonArt(dragon, { expression: 'proud' }),
            h('figcaption', {
              text: t(`results.grew.${event.data.stage}` as MessageKey, {
                name: text(dragon.nameKey),
              }),
            }),
          ),
        );
        break;
      }
      case 'dragon.crowned': {
        celebrations.push(
          h('p', {
            className: 'dv-celebrate',
            text: t('results.crowned', { name: dragonName(event.data.dragon) }),
          }),
        );
        break;
      }
      case 'egg.received': {
        const dragon = data.dragons.find((candidate) => candidate.id === event.data.dragon);
        if (!dragon) break;
        celebrations.push(
          h(
            'figure',
            { className: 'dv-celebrate', testId: 'celebrate-egg' },
            dragonArt({ dragon: dragon.rig, stage: 'egg', warmth: 0.4, framing: 'fit' }),
            h('figcaption', { text: t('results.egg', { name: text(dragon.nameKey) }) }),
          ),
        );
        break;
      }
      case 'sticker.earned': {
        const sticker = data.stickers.find((candidate) => candidate.id === event.data.sticker);
        if (!sticker) break;
        celebrations.push(
          h(
            'figure',
            { className: 'dv-celebrate', testId: 'celebrate-sticker' },
            stickerArt({
              frame: sticker.frame as StickerFrame,
              color: sticker.color,
              icon: sticker.icon,
            }),
            h('figcaption', { text: t('results.sticker', { name: text(sticker.nameKey) }) }),
          ),
        );
        break;
      }
      case 'region.unlocked': {
        const region = data.regions.find((candidate) => candidate.id === event.data.region);
        if (!region) break;
        celebrations.push(
          h('p', {
            className: 'dv-celebrate',
            text: t('results.region', { name: text(region.titleKey) }),
          }),
        );
        break;
      }
      default:
        break;
    }
  }
  if (celebrations.length > 0) {
    parts.push(
      h(
        'div',
        {
          className: 'dv-results__celebrations',
          dataset: { many: String(celebrations.length > 3) },
        },
        ...celebrations,
      ),
    );
  }

  // ---- what next ------------------------------------------------------------------------------
  const nextLabel = (current: GameView): string => {
    if (next.kind === 'activity') {
      const kind = current.run?.activities[next.index]?.kind;
      return t('results.nextActivity', {
        activity: kind ? t(`activity.${kind}` as MessageKey) : '',
      });
    }
    return timeUp ? t('results.goodbye') : t('results.continue');
  };
  const proceed = candyButton({
    label: nextLabel(view),
    icon: 'forward',
    variant: 'sun',
    size: 'big',
    testId: 'results-continue',
    onPress: async () => {
      const dispatch = active.commands.capture();
      if (next.kind === 'activity') {
        await dispatch({ type: 'startActivity', activity: { kind: 'level', index: next.index } });
      } else {
        await dispatch({ type: 'endRound', reason: 'done' });
      }
      await app.continueGame(keeperId);
    },
    onError: app.kit.onError,
  });
  parts.push(proceed);

  const element = h(
    'main',
    {
      className: 'dv-results',
      testId: 'screen-results',
      dataset: { level: String(levelDone !== null) },
    },
    backdrop(
      data.regions.find((region) => region.id === level?.region)?.background ?? 'sunny-meadow',
    ),
    topBar({ tools: [coins.element, saveStatus.element], onError: app.kit.onError }),
    h('section', { className: 'dv-card dv-results__card', testId: 'round-results' }, ...parts),
  );

  return {
    element,
    title: headline,
    field: 'valley',
    region: level?.region ?? null,
    music: 'results',
    focusTarget: () => heading,
    mounted() {
      const spoken = [headline, levelDone ? t('results.stars', { count: levelDone.stars }) : '']
        .filter(Boolean)
        .join(' ');
      app.kit.announcer.announce(spoken);
      if (stars) void stars.reveal();
      if (levelDone && !timeUp) void confetti(app.kit.fx);
    },
    dispose() {
      saveStatus.dispose();
    },
  };
}
