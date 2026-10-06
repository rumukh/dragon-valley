/**
 * Minigame rounds on `@aegis/narrative` boards (`MinigameRoundView`): Memory Match (the
 * built-in `matching` kind) and Egg Grid (`dv.egg-grid`). Every move goes through the command
 * controller tagged with the board revision it was made against; the screen redraws from the
 * projected view after each commit, and moves on to the results when the round is complete.
 * A board this build cannot draw shows a kind message and a way back, never a broken screen.
 */
import { formatExpr, num, op } from '../../rules/contract';
import type { GameView, MinigameRoundView } from '../../rules/contract';
import { cardFace } from '../game/cards';
import type { MessageKey } from '../i18n/messages';
import { speakExpr } from '../speech/verbalizer';
import { numberToWords } from '../speech/numbers';
import { artIcon } from '../ui/art';
import { candyButton } from '../ui/button';
import { h } from '../ui/dom';
import { createCoinCounter, createMeter } from '../ui/meters';
import type { Screen } from '../router/router';
import type { ActiveKeeper, App } from '../shell/app';
import { createSaveStatus, topBar } from './common';
import { backdrop } from './scene';

function minigameRound(view: GameView): MinigameRoundView | null {
  return view.round?.type === 'minigame' ? view.round : null;
}

// ---- projected views (validated, because they cross a JSON boundary) ---------------------------

export interface MatchingCard {
  readonly id: string;
  readonly labelKey: string;
  readonly faceUp: boolean;
  readonly matched: boolean;
}

export interface MatchingView {
  readonly clearAvailable: boolean;
  readonly cards: readonly MatchingCard[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseMatchingView(value: unknown): MatchingView | null {
  if (!isRecord(value) || !Array.isArray(value['cards'])) return null;
  const cards: MatchingCard[] = [];
  for (const card of value['cards'] as unknown[]) {
    if (
      !isRecord(card) ||
      typeof card['id'] !== 'string' ||
      typeof card['labelKey'] !== 'string' ||
      typeof card['faceUp'] !== 'boolean' ||
      typeof card['matched'] !== 'boolean'
    ) {
      return null;
    }
    cards.push({
      id: card['id'],
      labelKey: card['labelKey'],
      faceUp: card['faceUp'],
      matched: card['matched'],
    });
  }
  return { clearAvailable: value['clearAvailable'] === true, cards };
}

export interface EggGridView {
  readonly product: number;
  readonly maxSide: number;
  readonly split: string;
  readonly find: number;
  readonly rows: number;
  readonly columns: number;
  readonly found: readonly { readonly rows: number; readonly columns: number }[];
  readonly last: 'found' | 'again' | 'wrong' | null;
}

const isCount = (value: unknown, max = 100): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

export function parseEggGridView(value: unknown): EggGridView | null {
  if (!isRecord(value)) return null;
  const { product, maxSide, split, find, rows, columns, found, last } = value;
  if (!isCount(product) || !isCount(maxSide, 12) || maxSide < 1 || !isCount(find, 20)) return null;
  if (!isCount(rows, 12) || !isCount(columns, 12) || !Array.isArray(found)) return null;
  const rectangles: { rows: number; columns: number }[] = [];
  for (const entry of found as unknown[]) {
    if (!isRecord(entry) || !isCount(entry['rows'], 12) || !isCount(entry['columns'], 12)) {
      return null;
    }
    rectangles.push({ rows: entry['rows'], columns: entry['columns'] });
  }
  const outcome = last === 'found' || last === 'again' || last === 'wrong' ? last : null;
  return {
    product,
    maxSide,
    split: typeof split === 'string' ? split : 'none',
    find: Math.max(1, find),
    rows,
    columns,
    found: rectangles,
    last: outcome,
  };
}

// ---- shared frame -------------------------------------------------------------------------------

interface BoardFrame {
  readonly element: HTMLElement;
  readonly heading: HTMLElement;
  readonly board: HTMLElement;
  readonly status: HTMLElement;
  update(view: GameView): void;
  dispose(): void;
}

function boardFrame(app: App, active: ActiveKeeper, round: MinigameRoundView): BoardFrame {
  const t = app.kit.t;
  const data = app.game.content.data;
  const level =
    round.source.kind === 'level'
      ? data.levels.find((candidate) => candidate.id === (round.source as { level: string }).level)
      : undefined;
  const region = data.regions.find((candidate) => candidate.id === level?.region);
  const saveStatus = createSaveStatus(app, active);
  const coins = createCoinCounter(app.kit, active.game.host.getView().coins);
  const heading = h('h1', {
    className: 'dv-round__title',
    text: t(`activity.${round.activity}` as MessageKey),
  });
  const progress = createMeter({
    label: t(`activity.${round.activity}` as MessageKey),
    max: round.boards,
    value: round.board,
    valueText: (value, max) =>
      t('minigame.boards', { current: Math.min(value + 1, max), total: max }),
    testId: 'minigame-progress',
  });
  const board = h('div', { className: 'dv-minigame__board' });
  const status = h('p', {
    className: 'dv-minigame__status',
    testId: 'minigame-status',
    attributes: { role: 'status' },
  });
  const quit = candyButton({
    label: t('minigame.quit'),
    icon: 'home',
    variant: 'paper',
    size: 'small',
    testId: 'minigame-quit',
    onPress: async () => {
      await active.commands.capture()({ type: 'endRound', reason: 'quit' });
      await app.continueGame(active.keeper.id);
    },
    onError: app.kit.onError,
  });
  const element = h(
    'main',
    {
      className: 'dv-round dv-minigame',
      testId: 'screen-minigame',
      dataset: { activity: round.activity },
    },
    backdrop(region?.background ?? 'sunny-meadow'),
    topBar({
      title: h('div', { className: 'dv-round__header' }, heading, progress.element),
      tools: [coins.element, saveStatus.element, quit],
      onError: app.kit.onError,
    }),
    h('section', { className: 'dv-card dv-minigame__card' }, status, board),
  );
  return {
    element,
    heading,
    board,
    status,
    update(view) {
      coins.set(view.coins);
      const current = minigameRound(view);
      if (current) progress.update(current.board);
    },
    dispose: () => saveStatus.dispose(),
  };
}

/** After a move: stay on the board, or go to the results once the round is over. */
async function afterMove(app: App, active: ActiveKeeper): Promise<boolean> {
  const view = active.game.host.getView();
  const round = minigameRound(view);
  if (view.screen !== 'round' || !round || round.status !== 'active') {
    await app.continueGame(active.keeper.id);
    return false;
  }
  return true;
}

// ---- Memory Match ---------------------------------------------------------------------------------

function memoryMatchScreen(app: App, active: ActiveKeeper, first: MinigameRoundView): Screen {
  const t = app.kit.t;
  const host = active.game.host;
  const frame = boardFrame(app, active, first);
  const turnBack = h('div', { className: 'dv-minigame__actions' });
  let busy = false;
  let matchedBefore =
    parseMatchingView(first.minigame.view)?.cards.filter((c) => c.matched).length ?? 0;

  const faceText = (card: MatchingCard): { text: string; spoken: string } => {
    const face = cardFace(card.labelKey, card.faceUp);
    const notation = active.preferences.current().notation;
    switch (face.kind) {
      case 'back':
        return { text: '', spoken: t('match.hidden') };
      case 'fact':
        return { text: formatExpr(face.expr, notation), spoken: speakExpr(face.expr) };
      case 'number':
        return { text: String(face.value), spoken: numberToWords(face.value) };
      case 'term':
        return {
          text: t(`term.${face.term}` as MessageKey),
          spoken: t(`term.${face.term}` as MessageKey),
        };
      case 'text': {
        const words = app.text.has(face.key) ? app.text(face.key) : '?';
        return { text: words, spoken: words };
      }
    }
  };

  const move = async (
    revision: number,
    value: { type: 'select'; card: string } | { type: 'clear' },
  ): Promise<void> => {
    if (busy) return;
    busy = true;
    try {
      await active.commands.capture()({ type: 'minigameMove', revision, move: value });
    } finally {
      busy = false;
    }
    if (await afterMove(app, active)) paint();
  };

  const paint = (): void => {
    const view = host.getView();
    const round = minigameRound(view);
    const board = round ? parseMatchingView(round.minigame.view) : null;
    frame.update(view);
    if (!round || !board) return;
    const matched = board.cards.filter((card) => card.matched).length;
    if (matched > matchedBefore) {
      app.kit.cue('fx.dragon-happy');
      frame.status.textContent = t('match.pair');
    } else if (board.clearAvailable) {
      frame.status.textContent = t('match.notPair');
    } else {
      frame.status.textContent = t('match.find');
    }
    matchedBefore = matched;
    const cards = board.cards.map((card, index) => {
      const face = faceText(card);
      const state = card.matched
        ? 'matched'
        : card.faceUp
          ? board.clearAvailable
            ? 'miss'
            : 'open'
          : 'hidden';
      const button = h(
        'button',
        {
          className: 'dv-card-tile',
          testId: `match-card-${card.id}`,
          dataset: { state },
          attributes: {
            type: 'button',
            'aria-label': t('match.card', { number: index + 1, face: face.spoken }),
          },
        },
        card.matched ? artIcon('badge-correct', { className: 'dv-card-tile__badge' }) : null,
        state === 'miss' ? artIcon('badge-almost', { className: 'dv-card-tile__badge' }) : null,
        h('span', { className: 'dv-card-tile__face', text: face.text }),
      );
      button.disabled = card.faceUp || card.matched || board.clearAvailable;
      button.addEventListener('click', () => {
        app.kit.cue('ui.tap');
        void move(round.minigame.revision, { type: 'select', card: card.id }).catch(
          app.kit.onError,
        );
      });
      return button;
    });
    frame.board.replaceChildren(
      h('div', { className: 'dv-match-grid', dataset: { count: String(cards.length) } }, ...cards),
    );
    turnBack.replaceChildren(
      ...(board.clearAvailable
        ? [
            candyButton({
              label: t('match.turnBack'),
              icon: 'retry',
              variant: 'sun',
              testId: 'match-turn-back',
              onPress: () => move(round.minigame.revision, { type: 'clear' }),
              onError: app.kit.onError,
            }),
          ]
        : []),
    );
    frame.board.append(turnBack);
    (
      turnBack.querySelector('button') ??
      frame.board.querySelector<HTMLElement>('button:not(:disabled)')
    )?.focus();
  };

  paint();
  return {
    element: frame.element,
    title: t('activity.memory-match'),
    field: 'valley',
    music: 'round',
    focusTarget: () =>
      frame.board.querySelector<HTMLElement>('button:not(:disabled)') ?? frame.heading,
    dispose: frame.dispose,
  };
}

// ---- Egg Grid ---------------------------------------------------------------------------------

function eggGridScreen(app: App, active: ActiveKeeper, first: MinigameRoundView): Screen {
  const t = app.kit.t;
  const host = active.game.host;
  const frame = boardFrame(app, active, first);
  const initial = parseEggGridView(first.minigame.view)!;
  let rows = Math.max(1, initial.rows || 1);
  let columns = Math.max(1, initial.columns || 1);
  let busy = false;

  const nest = h('div', {
    className: 'dv-nest',
    testId: 'egg-nest',
    attributes: { 'aria-hidden': 'true' },
  });
  const sizeLabel = h('p', { className: 'dv-nest__size', testId: 'egg-size' });
  const foundList = h('ul', { className: 'dv-nest__found', testId: 'egg-found' });

  const stepper = (
    label: string,
    get: () => number,
    set: (value: number) => void,
    max: () => number,
    testId: string,
  ): HTMLElement => {
    const value = h('span', { className: 'dv-stepper__value', testId: `${testId}-value` });
    const less = candyButton({
      label: t('egg.less', { what: label }),
      icon: 'back',
      iconOnly: true,
      variant: 'paper',
      size: 'small',
      testId: `${testId}-less`,
      onPress: () => {
        if (get() > 1) set(get() - 1);
        draw();
      },
      onError: app.kit.onError,
    });
    const more = candyButton({
      label: t('egg.more', { what: label }),
      icon: 'plus',
      iconOnly: true,
      variant: 'paper',
      size: 'small',
      testId: `${testId}-more`,
      onPress: () => {
        if (get() < max()) set(get() + 1);
        draw();
      },
      onError: app.kit.onError,
    });
    const box = h(
      'div',
      { className: 'dv-stepper', attributes: { role: 'group', 'aria-label': label } },
      h('span', { className: 'dv-stepper__label', text: label }),
      less,
      value,
      more,
    );
    const refresh = (): void => {
      value.textContent = String(get());
    };
    stepperRefresh.push(refresh);
    return box;
  };
  const stepperRefresh: (() => void)[] = [];

  const view = (): EggGridView | null => {
    const round = minigameRound(host.getView());
    return round ? parseEggGridView(round.minigame.view) : null;
  };

  const draw = (): void => {
    const board = view();
    if (!board) return;
    for (const refresh of stepperRefresh) refresh();
    const eggs: Node[] = [];
    for (let index = 0; index < rows * columns; index++) {
      eggs.push(h('span', { className: 'dv-nest__egg' }));
    }
    nest.style.setProperty('--columns', String(columns));
    nest.replaceChildren(...eggs);
    sizeLabel.textContent = t('egg.size', { rows, columns, count: rows * columns });
  };

  const paint = (): void => {
    const current = host.getView();
    frame.update(current);
    const board = view();
    if (!board) return;
    frame.status.textContent =
      board.last === 'found'
        ? t('egg.found')
        : board.last === 'again'
          ? t('egg.again')
          : board.last === 'wrong'
            ? t('egg.wrong', { product: board.product })
            : t('egg.goal', { product: board.product });
    foundList.replaceChildren(
      ...board.found.map((rect) =>
        h('li', {
          text: formatExpr(
            op('mul', num(rect.rows), num(rect.columns)),
            active.preferences.current().notation,
          ),
        }),
      ),
    );
    draw();
  };

  const check = candyButton({
    label: t('egg.check'),
    icon: 'check',
    variant: 'sun',
    testId: 'egg-check',
    onPress: async () => {
      if (busy) return;
      busy = true;
      try {
        let round = minigameRound(host.getView());
        if (!round) return;
        await active.commands.capture()({
          type: 'minigameMove',
          revision: round.minigame.revision,
          move: { type: 'set', rows, columns },
        });
        round = minigameRound(host.getView());
        if (!round) return;
        await active.commands.capture()({
          type: 'minigameMove',
          revision: round.minigame.revision,
          move: { type: 'submit' },
        });
      } finally {
        busy = false;
      }
      if (await afterMove(app, active)) paint();
    },
    onError: app.kit.onError,
  });

  frame.board.append(
    h(
      'div',
      { className: 'dv-nest-builder' },
      stepper(
        t('egg.rows'),
        () => rows,
        (value) => (rows = value),
        () => initial.maxSide,
        'egg-rows',
      ),
      stepper(
        t('egg.columns'),
        () => columns,
        (value) => (columns = value),
        () => initial.maxSide,
        'egg-columns',
      ),
    ),
    nest,
    sizeLabel,
    check,
    foundList,
  );
  paint();
  return {
    element: frame.element,
    title: t('activity.egg-grid'),
    field: 'valley',
    music: 'round',
    focusTarget: () => check,
    dispose: frame.dispose,
  };
}

// ---- anything else --------------------------------------------------------------------------

function unsupportedScreen(app: App, active: ActiveKeeper, round: MinigameRoundView): Screen {
  const t = app.kit.t;
  const frame = boardFrame(app, active, round);
  frame.status.textContent = t('minigame.soon');
  frame.board.append(
    candyButton({
      label: t('minigame.back'),
      icon: 'home',
      variant: 'sun',
      testId: 'minigame-back',
      onPress: async () => {
        await active.commands.capture()({ type: 'endRound', reason: 'quit' });
        await app.continueGame(active.keeper.id);
      },
      onError: app.kit.onError,
    }),
  );
  return {
    element: frame.element,
    title: t(`activity.${round.activity}` as MessageKey),
    field: 'valley',
    music: 'round',
    focusTarget: () => frame.heading,
    dispose: frame.dispose,
  };
}

export function minigameScreen(app: App, active: ActiveKeeper): Screen {
  const round = minigameRound(active.game.host.getView())!;
  if (round.activity === 'memory-match' && parseMatchingView(round.minigame.view)) {
    return memoryMatchScreen(app, active, round);
  }
  if (round.activity === 'egg-grid' && parseEggGridView(round.minigame.view)) {
    return eggGridScreen(app, active, round);
  }
  return unsupportedScreen(app, active, round);
}
