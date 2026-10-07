/**
 * After a round: what the child achieved and what is next. An egg that hatched gets its own
 * full-size celebration first (screens/hatch.ts), one dragon at a time. Then a finished level
 * shows its stars (one by one, with their sounds) and confetti; a finished activity of a longer
 * level shows how it went and what comes next. Celebrations come from the round's live events,
 * never replayed history: a dragon growing, a new egg, a new sticker, a new region. Long lists
 * scroll inside the card, so the button onward is always in view. A round stopped by the
 * grown-ups' time limit ends with a kind goodbye.
 */
import type { GameAction, GameEvent, GameView } from '../../rules/contract';
import type { StickerFrame } from '../art/stickers';
import { taken } from '../controller/commands';
import { resultsNext } from '../game/view';
import { plural } from '../i18n/messages';
import type { MessageKey } from '../i18n/messages';
import { candyButton } from '../ui/button';
import { dragonArt, stickerArt, viewDragonArt } from '../ui/art';
import { confetti } from '../ui/confetti';
import { h } from '../ui/dom';
import { createCoinCounter, createStars } from '../ui/meters';
import type { Screen } from '../router/router';
import type { ActiveKeeper, App } from '../shell/app';
import { createSaveStatus, topBar } from './common';
import { hatchCelebration } from './hatch';
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
  const keeperId = active.keeper.id;
  const data = active.game.content().data;
  const view = active.game.view();
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
        text: plural(t, round.coins, 'results.coins.one', 'results.coins.other'),
      }),
    );
  }

  // ---- celebrations -------------------------------------------------------------------------
  // Hatching has its own full-size celebration before the results (screens/hatch.ts).
  const hatched = [
    ...new Set(
      events.flatMap((event) => (event.type === 'dragon.hatched' ? [event.data.dragon] : [])),
    ),
  ].flatMap((id) => view.dragons.filter((dragon) => dragon.id === id));
  const celebrations: Node[] = [];
  for (const event of events) {
    switch (event.type) {
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
          testId: 'results-celebrations',
          dataset: { many: String(celebrations.length > 3) },
          // A list that may scroll inside the card can be reached and scrolled by keyboard.
          attributes: { role: 'region', 'aria-label': t('results.rewards'), tabindex: '0' },
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
      // Going on does not wait for a slow save; a rest closes the game, so it waits for the
      // save first.
      const send = timeUp ? active.commands.capture() : active.commands.captureSend();
      const dispatch = (action: GameAction): Promise<void> => taken(send(action));
      if (next.kind === 'activity') {
        await dispatch({ type: 'startActivity', activity: { kind: 'level', index: next.index } });
      } else {
        await dispatch({ type: 'endRound', reason: 'done' });
      }
      if (timeUp) {
        // Time for a rest: goodbye with the day's diary, the game saved.
        await app.router.reset(app.screens.goodbye(keeperId));
        return;
      }
      await app.continueGame(keeperId);
    },
    onError: app.kit.onError,
  });
  parts.push(proceed);

  const card = h(
    'section',
    { className: 'dv-card dv-results__card', testId: 'round-results' },
    ...parts,
  );
  const stage = hatched.length > 0 ? hatchCelebration(app, hatched) : null;
  card.hidden = stage !== null;
  heading.tabIndex = -1;
  let disposed = false;

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
    ...(stage ? [stage.element] : []),
    card,
  );

  const showResults = (): void => {
    const spoken = [headline, levelDone ? t('results.stars', { count: levelDone.stars }) : '']
      .filter(Boolean)
      .join(' ');
    app.kit.announcer.announce(spoken);
    if (stars) void stars.reveal();
    if (levelDone && !timeUp) void confetti(app.kit.fx);
  };

  return {
    element,
    title: headline,
    field: 'valley',
    region: level?.region ?? null,
    music: 'results',
    focusTarget: () => stage?.focusTarget ?? heading,
    mounted() {
      if (!stage) {
        showResults();
        return;
      }
      void stage
        .play()
        .then(() => {
          if (disposed) return;
          stage.element.remove();
          card.hidden = false;
          heading.focus();
          showResults();
        })
        .catch(app.kit.onError);
    },
    dispose() {
      disposed = true;
      stage?.dispose();
      saveStatus.dispose();
    },
  };
}
