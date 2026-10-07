/**
 * Minigame rounds on the rules' typed boards (`MinigameRoundView.current`, docs/contract.md
 * §11.1): Memory Match, Number Trail, Egg Grid and Fact Family Nest here, Sharing Feast and
 * Golem Orders in `boards/`. Every move goes through the
 * command controller with the board revision it was made against; the screen redraws from the
 * view after each commit, cheers when a board is done (`minigame.completed`; the next board
 * replaces it in the same commit), and moves on to the results once the round is over. Boards
 * never punish: a mismatch, a wrong rectangle or a wrong order stays on the board, gently marked,
 * to be fixed. A board this build cannot draw shows a kind message and a way back.
 */
import { formatExpr, num, op, OPERATOR_SYMBOLS } from '../../rules/contract';
import type {
  BoardView,
  EggGridSplit,
  GameView,
  MinigameMove,
  MinigameRoundView,
} from '../../rules/contract';
import { plural } from '../i18n/messages';
import type { MessageKey } from '../i18n/messages';
import { numberToWords } from '../speech/numbers';
import { speakFace } from '../speech/verbalizer';
import { artIcon } from '../ui/art';
import { candyButton } from '../ui/button';
import { confetti } from '../ui/confetti';
import { h } from '../ui/dom';
import { createCoinCounter, createMeter } from '../ui/meters';
import type { Screen } from '../router/router';
import type { ActiveKeeper, App } from '../shell/app';
import { CommandRejectedError } from '../controller/commands';
import { createMoveQueue } from '../controller/moves';
import type { BoardContext, BoardOf, BoardPainter } from './boards/board';
import { sharingFeast } from './boards/feast';
import { golemOrders } from './boards/golem';
import { createSaveStatus, topBar } from './common';
import { faceElement } from './problem-view';
import { backdrop } from './scene';

export function minigameRound(view: GameView): MinigameRoundView | null {
  return view.round?.type === 'minigame' ? view.round : null;
}

// ---- Memory Match ---------------------------------------------------------------------------

/** Columns of memory cards on a landscape window: the cards in two rows (one row up to four). */
export function matchColumnsWide(cards: number): number {
  return cards <= 4 ? Math.max(1, cards) : Math.ceil(cards / 2);
}

/** Columns for a deck: full rows where possible (12 cards are 4 × 3, 10 are 5 × 2). */
export function matchColumns(cards: number): number {
  if (cards <= 4) return Math.max(1, cards);
  if (cards === 6 || cards === 9) return 3;
  if (cards === 10 || cards === 15) return 5;
  return 4;
}

function memoryMatch(context: BoardContext): BoardPainter {
  const { app } = context;
  const t = app.kit.t;
  const grid = h('div', { className: 'dv-match-grid', testId: 'match-grid' });
  const actions = h('div', { className: 'dv-minigame__actions' });
  let matchedBefore = context.board('memory-match')?.matched ?? 0;

  const paint = (): void => {
    const board = context.board('memory-match');
    if (!board) return;
    if (board.matched > matchedBefore) {
      app.kit.cue('fx.dragon-happy');
      context.status(t('match.pair'));
    } else if (board.clearAvailable) {
      context.status(t('match.notPair'));
    } else {
      context.status(t('match.find'));
    }
    matchedBefore = board.matched;
    grid.dataset['count'] = String(board.cards.length);
    grid.style.setProperty('--cols', String(matchColumns(board.cards.length)));
    grid.style.setProperty('--wide-cols', String(matchColumnsWide(board.cards.length)));
    grid.replaceChildren(
      ...board.cards.map((card, index) => {
        const state = card.matched
          ? 'matched'
          : card.faceUp
            ? board.clearAvailable
              ? 'miss'
              : 'open'
            : 'hidden';
        const spoken = card.face ? speakFace(card.face) : t('match.hidden');
        const button = h(
          'button',
          {
            className: 'dv-card-tile',
            testId: `match-card-${card.id}`,
            dataset: { state },
            attributes: {
              type: 'button',
              'aria-label': t('match.card', { number: index + 1, face: spoken }),
            },
          },
          state === 'matched'
            ? artIcon('badge-correct', { className: 'dv-card-tile__badge' })
            : null,
          state === 'miss' ? artIcon('badge-almost', { className: 'dv-card-tile__badge' }) : null,
          card.face
            ? faceElement(card.face, context.notation())
            : h('span', { className: 'dv-card-tile__face' }),
        );
        button.disabled = card.faceUp || card.matched || board.clearAvailable;
        button.addEventListener('click', () => {
          app.kit.cue('ui.tap');
          void context.move({ type: 'select', card: card.id }).catch(app.kit.onError);
        });
        return button;
      }),
    );
    actions.replaceChildren(
      ...(board.clearAvailable
        ? [
            candyButton({
              label: t('match.turnBack'),
              icon: 'retry',
              variant: 'sun',
              testId: 'match-turn-back',
              onPress: async () => {
                await context.move({ type: 'clear' });
              },
              onError: app.kit.onError,
            }),
          ]
        : []),
    );
  };

  return {
    element: h('div', { className: 'dv-minigame__board' }, grid, actions),
    paint,
    focus: () =>
      actions.querySelector('button') ?? grid.querySelector<HTMLElement>('button:not(:disabled)'),
  };
}

// ---- Number Trail ---------------------------------------------------------------------------

function numberTrail(context: BoardContext): BoardPainter {
  const { app } = context;
  const t = app.kit.t;
  const trail = h('ol', { className: 'dv-trail', testId: 'trail' });
  let selected: string | null = null;

  const paint = (): void => {
    const board = context.board('number-trail');
    if (!board) return;
    if (selected && !board.stones.some((stone) => stone.id === selected)) selected = null;
    context.status(
      board.submitted
        ? t('trail.notYet')
        : selected
          ? t('trail.where')
          : t('trail.goal', { step: board.step }),
    );
    trail.replaceChildren(
      ...board.path.map((position, index) => {
        if (position.gap === null) {
          return h(
            'li',
            { className: 'dv-trail__stop' },
            h('span', {
              className: 'dv-trail__stone dv-trail__stone--fixed',
              text: String(position.value ?? ''),
              attributes: { 'aria-label': t('trail.fixed', { value: position.value ?? 0 }) },
            }),
          );
        }
        const gap = position.gap;
        const stone = board.stones[gap];
        const button = h(
          'button',
          {
            className: 'dv-trail__stone',
            testId: `trail-stone-${stone?.id ?? gap}`,
            dataset: { selected: String(stone?.id === selected) },
            attributes: {
              type: 'button',
              'aria-pressed': String(stone?.id === selected),
              'aria-label': t('trail.stone', {
                value: stone ? numberToWords(stone.value) : '',
                place: index + 1,
              }),
            },
          },
          stone ? String(stone.value) : '?',
        );
        button.addEventListener('click', () => {
          app.kit.cue('ui.tap');
          if (!stone) return;
          if (selected === null) {
            selected = stone.id;
            paint();
            return;
          }
          if (selected === stone.id) {
            selected = null;
            paint();
            return;
          }
          const item = selected;
          selected = null;
          void context.move({ type: 'place', item, index: gap }).catch(app.kit.onError);
        });
        return h('li', { className: 'dv-trail__stop' }, button);
      }),
    );
  };

  const check = candyButton({
    label: t('board.check'),
    icon: 'check',
    variant: 'sun',
    testId: 'trail-check',
    onPress: async () => {
      selected = null;
      await context.move({ type: 'submit' });
    },
    onError: app.kit.onError,
  });

  return {
    element: h('div', { className: 'dv-minigame__board' }, trail, check),
    paint,
    focus: () => trail.querySelector<HTMLElement>('button') ?? check,
  };
}

// ---- Egg Grid -------------------------------------------------------------------------------

/** Where the board's strategy picture splits the rows of a nest (after how many rows). */
export function eggSplit(split: EggGridSplit | undefined, rows: number): number | null {
  if (split === 'five-plus' && rows > 5) return 5;
  if (split === 'double' && rows % 2 === 0 && rows >= 2) return rows / 2;
  return null;
}

/**
 * Egg Grid: a field of nest spots, maxSide × maxSide. Tapping a spot builds the nest up to it
 * (5 rows of 7 is one tap); the steppers do the same from the keyboard. The nest is described in
 * words ("5 rows of 7"), and its total is only told by Check: a right nest, or a hint after a
 * wrong one ("5 rows of 8 make 40. We need 35."), so the board is not a guessing game against a
 * counter.
 */
function eggGrid(context: BoardContext): BoardPainter {
  const { app } = context;
  const t = app.kit.t;
  const first = context.board('egg-grid')!;
  let product = first.product;
  let rows = Math.max(1, first.rows);
  let columns = Math.max(1, first.columns);

  const goal = h('p', { className: 'dv-nest__goal', testId: 'egg-goal' });
  const sentence = h('p', {
    className: 'dv-nest__sentence',
    testId: 'egg-sentence',
    attributes: { 'aria-live': 'polite' },
  });
  // A picture for pointing at: the steppers below are the same control for the keyboard.
  const grid = h('div', {
    className: 'dv-egg-grid',
    testId: 'egg-grid',
    attributes: { 'aria-hidden': 'true' },
  });
  const found = h('ul', {
    className: 'dv-nest__found',
    testId: 'egg-found',
    attributes: { 'aria-label': t('egg.foundList') },
  });
  const values: Record<'rows' | 'columns', HTMLElement> = {
    rows: h('span', { className: 'dv-stepper__value', testId: 'egg-rows-value' }),
    columns: h('span', { className: 'dv-stepper__value', testId: 'egg-columns-value' }),
  };

  const build = (nextRows: number, nextColumns: number): void => {
    const max = context.board('egg-grid')?.maxSide ?? 10;
    rows = Math.min(max, Math.max(1, nextRows));
    columns = Math.min(max, Math.max(1, nextColumns));
    app.kit.cue('ui.tap');
    draw();
  };

  grid.addEventListener('click', (event) => {
    const spot = event.target instanceof Element ? event.target.closest('[data-row]') : null;
    if (!(spot instanceof HTMLElement)) return;
    build(Number(spot.dataset['row']), Number(spot.dataset['column']));
  });

  const stepper = (which: 'rows' | 'columns'): HTMLElement => {
    const label = t(which === 'rows' ? 'egg.rows' : 'egg.columns');
    const change = (delta: number): void =>
      which === 'rows' ? build(rows + delta, columns) : build(rows, columns + delta);
    return h(
      'div',
      { className: 'dv-stepper', attributes: { role: 'group', 'aria-label': label } },
      h('span', { className: 'dv-stepper__label', text: label }),
      candyButton({
        label: t(which === 'rows' ? 'egg.rows.less' : 'egg.columns.less'),
        icon: 'minus',
        iconOnly: true,
        variant: 'paper',
        size: 'small',
        testId: `egg-${which}-less`,
        onPress: () => change(-1),
        onError: app.kit.onError,
      }),
      values[which],
      candyButton({
        label: t(which === 'rows' ? 'egg.rows.more' : 'egg.columns.more'),
        icon: 'plus',
        iconOnly: true,
        variant: 'paper',
        size: 'small',
        testId: `egg-${which}-more`,
        onPress: () => change(1),
        onError: app.kit.onError,
      }),
    );
  };

  /** "5 rows of 7", "1 row of 9". */
  const nest = (nestRows: number, nestColumns: number): string =>
    t(nestRows === 1 ? 'egg.nest.one' : 'egg.nest.other', {
      rows: nestRows,
      columns: nestColumns,
    });

  /** The field of spots with the nest built so far and the board's strategy picture. */
  const draw = (): void => {
    const board = context.board('egg-grid');
    const side = board?.maxSide ?? 10;
    values.rows.textContent = String(rows);
    values.columns.textContent = String(columns);
    sentence.textContent = nest(rows, columns);
    const split = eggSplit(board?.split, rows);
    // Nine rows as "ten rows, one crossed out": the tenth row's eggs are shown missing.
    const tenMinus = board?.split === 'ten-minus' && rows === 9 && side >= 10;
    const spots: Node[] = [];
    for (let row = 1; row <= side; row++) {
      if (split !== null && row === split + 1) {
        spots.push(h('span', { className: 'dv-egg-grid__split' }));
      }
      for (let column = 1; column <= side; column++) {
        const state =
          row <= rows && column <= columns
            ? 'egg'
            : tenMinus && row === 10 && column <= columns
              ? 'missing'
              : 'empty';
        spots.push(
          h('span', {
            className: 'dv-egg-grid__spot',
            dataset: { row: String(row), column: String(column), state },
          }),
        );
      }
    }
    grid.style.setProperty('--side', String(side));
    grid.replaceChildren(...spots);
  };

  const paint = (): void => {
    const board = context.board('egg-grid');
    if (!board) return;
    if (board.product !== product) {
      // A new board (the next product): start the nest again from what the board says.
      product = board.product;
      rows = Math.max(1, board.rows);
      columns = Math.max(1, board.columns);
    }
    const latest = board.found[board.found.length - 1];
    context.status(
      board.last === 'found' && latest
        ? t('egg.found', {
            nest: nest(latest.rows, latest.columns),
            product: board.product,
            left: board.find - board.found.length,
          })
        : board.last === 'again'
          ? t('egg.again', { nest: nest(board.rows, board.columns) })
          : board.last === 'wrong'
            ? t('egg.wrong', {
                nest: nest(board.rows, board.columns),
                total: board.rows * board.columns,
                product: board.product,
              })
            : t('egg.how'),
    );
    goal.textContent = plural(t, board.find, 'egg.goal.one', 'egg.goal.other', {
      product: board.product,
    });
    found.replaceChildren(
      ...board.found.map((rect) =>
        h('li', {
          text: formatExpr(op('mul', num(rect.rows), num(rect.columns)), context.notation()),
        }),
      ),
    );
    draw();
  };

  const check = candyButton({
    label: t('board.check'),
    icon: 'check',
    variant: 'sun',
    testId: 'egg-check',
    onPress: async () => {
      if (await context.move({ type: 'set', rows, columns })) {
        await context.move({ type: 'submit' });
      }
    },
    onError: app.kit.onError,
  });

  return {
    element: h(
      'div',
      { className: 'dv-minigame__board dv-egg-board' },
      h('div', { className: 'dv-egg-board__field' }, grid),
      h(
        'div',
        { className: 'dv-egg-board__panel' },
        goal,
        sentence,
        h('div', { className: 'dv-nest-builder' }, stepper('rows'), stepper('columns')),
        check,
        found,
      ),
    ),
    paint,
    focus: () => check,
  };
}

// ---- Fact Family Nest -----------------------------------------------------------------------

function factFamily(context: BoardContext): BoardPainter {
  const { app } = context;
  const t = app.kit.t;
  const nest = h('div', {
    className: 'dv-family__nest',
    testId: 'family-nest',
    attributes: { role: 'group', 'aria-label': t('family.nest') },
  });
  const equations = h('ol', { className: 'dv-family__equations', testId: 'family-equations' });
  let picked: number | null = null;

  const paint = (): void => {
    const board = context.board('fact-family');
    if (!board) return;
    context.status(
      board.submitted
        ? t('family.notYet')
        : picked === null
          ? t('family.pick')
          : t('family.place', { value: picked }),
    );
    nest.replaceChildren(
      ...board.numbers.map((value) => {
        const button = h(
          'button',
          {
            className: 'dv-family__number',
            testId: `family-number-${value}`,
            dataset: { picked: String(picked === value) },
            attributes: { type: 'button', 'aria-pressed': String(picked === value) },
          },
          String(value),
        );
        button.addEventListener('click', () => {
          app.kit.cue('ui.tap');
          picked = value;
          paint();
        });
        return button;
      }),
    );
    equations.replaceChildren(
      ...board.equations.map((equation, index) => {
        const sign = OPERATOR_SYMBOLS[context.notation()][equation.op];
        const slot = (position: number): HTMLElement => {
          const value = equation.slots[position] ?? null;
          const button = h(
            'button',
            {
              className: 'dv-family__slot',
              testId: `family-slot-${index}-${position}`,
              dataset: { empty: String(value === null) },
              attributes: {
                type: 'button',
                'aria-label':
                  value === null
                    ? t('family.empty')
                    : t('family.filled', { value: numberToWords(value) }),
              },
            },
            value === null ? '' : String(value),
          );
          button.addEventListener('click', () => {
            app.kit.cue('ui.tap');
            // The picked number fills the box; tapping a box that already holds it empties it.
            if (picked !== null && picked !== value) {
              const value = picked;
              void context
                .move({ type: 'fill', equation: index, slot: position, value })
                .catch(app.kit.onError);
            } else if (value !== null) {
              void context
                .move({ type: 'fill', equation: index, slot: position, value: null })
                .catch(app.kit.onError);
            }
          });
          return button;
        };
        const state =
          equation.correct === true ? 'correct' : equation.correct === false ? 'miss' : 'open';
        return h(
          'li',
          { className: 'dv-family__equation', dataset: { state } },
          slot(0),
          h('span', { className: 'dv-family__sign', text: sign }),
          slot(1),
          h('span', { className: 'dv-family__sign', text: '=' }),
          slot(2),
          state === 'correct'
            ? artIcon('badge-correct', { className: 'dv-family__badge' })
            : state === 'miss'
              ? artIcon('badge-almost', { className: 'dv-family__badge' })
              : null,
        );
      }),
    );
  };

  const check = candyButton({
    label: t('board.check'),
    icon: 'check',
    variant: 'sun',
    testId: 'family-check',
    onPress: async () => {
      picked = null;
      await context.move({ type: 'submit' });
    },
    onError: app.kit.onError,
  });

  return {
    element: h('div', { className: 'dv-minigame__board dv-family' }, nest, equations, check),
    paint,
    focus: () => nest.querySelector('button') ?? check,
  };
}

// ---- the screen -----------------------------------------------------------------------------

const PAINTERS: {
  readonly [K in BoardView['kind']]: (context: BoardContext) => BoardPainter;
} = {
  'memory-match': memoryMatch,
  'number-trail': numberTrail,
  'egg-grid': eggGrid,
  'fact-family': factFamily,
  'sharing-feast': sharingFeast,
  'golem-orders': golemOrders,
};

export function minigameScreen(app: App, active: ActiveKeeper): Screen {
  const t = app.kit.t;
  const data = active.game.content().data;
  const first = minigameRound(active.game.view())!;
  const kind = first.current?.kind;
  const levelId = first.source.kind === 'level' ? first.source.level : null;
  const level = levelId ? data.levels.find((candidate) => candidate.id === levelId) : undefined;
  const region = data.regions.find((candidate) => candidate.id === level?.region);
  const saveStatus = createSaveStatus(app, active);
  const coins = createCoinCounter(app.kit, active.game.view().coins);
  const heading = h('h1', {
    className: 'dv-round__title',
    text: t(`activity.${first.activity}` as MessageKey),
  });
  const progress = createMeter({
    label: t(`activity.${first.activity}` as MessageKey),
    max: first.boards,
    value: first.board,
    valueText: (value, max) =>
      t('minigame.boards', { current: Math.min(value + 1, max), total: max }),
    testId: 'minigame-progress',
    compact: true,
  });
  const status = h('p', {
    className: 'dv-minigame__status',
    testId: 'minigame-status',
    attributes: { role: 'status' },
  });
  let disposed = false;
  /** A move the game took but could not save yet: the board shows it once Retry stores it. */
  let heldMove = false;

  // A move made while the one before is still saving waits for it rather than being lost (a
  // quick second tap on "One for each basket" deals twice). It is sent against the board as it
  // is by then, and dropped only if that board is gone, the round is over, or a move could not
  // be saved (the board then waits for Retry). A waiting move the rules no longer allow (a second
  // tap on a card the first tap already turned) is dropped quietly too.
  const moves = createMoveQueue(
    async ({
      move,
      board,
      waited,
    }: {
      move: MinigameMove;
      board: number;
      waited: boolean;
    }): Promise<boolean> => {
      const round = minigameRound(active.game.view());
      if (disposed || heldMove || !round || round.status !== 'active' || round.board !== board) {
        return false;
      }
      try {
        // The board redraws once the move is saved, or once it is taken if saving is slow.
        await active.commands.captureSend()({
          type: 'minigameMove',
          revision: round.minigame.revision,
          move,
        });
      } catch (error) {
        if (error instanceof CommandRejectedError && error.accepted) {
          // Taken but not saved: the board shows it once Retry stores it.
          heldMove = true;
          return false;
        }
        if (waited && error instanceof CommandRejectedError) return false;
        throw error;
      }
      return afterMove();
    },
  );

  const context: BoardContext = {
    app,
    active,
    board<K extends BoardView['kind']>(wanted: K): BoardOf<K> | null {
      const current = minigameRound(active.game.view())?.current;
      return current?.kind === wanted ? (current as BoardOf<K>) : null;
    },
    index: () => minigameRound(active.game.view())?.board ?? 0,
    move(move) {
      return moves.push({
        move,
        board: minigameRound(active.game.view())?.board ?? -1,
        waited: moves.pending() > 0,
      });
    },
    status(text) {
      status.textContent = text;
    },
    notation: () => active.preferences.current().notation,
  };

  const painter = kind ? PAINTERS[kind](context) : null;

  /** The grown-ups' time limit ends the round gently, between moves. */
  const endForRest = async (): Promise<boolean> => {
    clearInterval(restTimer);
    if (minigameRound(active.game.view())?.status === 'active') {
      await active.commands.capture()({ type: 'endRound', reason: 'time-limit' });
    }
    await app.continueGame(active.keeper.id);
    return false;
  };
  const restTimer = setInterval(() => {
    if (moves.pending() === 0 && !disposed && active.timeIsUp()) {
      void endForRest().catch(app.kit.onError);
    }
  }, 5000);

  /** Redraw after a move: cheer a finished board, or leave once the round is over. */
  const afterMove = async (): Promise<boolean> => {
    if (disposed) return false;
    if (active.timeIsUp()) return endForRest();
    const view = active.game.view();
    const round = minigameRound(view);
    coins.set(view.coins);
    const completed = active.events.take(['minigame.completed']);
    if (view.screen !== 'round' || !round || round.status !== 'active') {
      await app.continueGame(active.keeper.id);
      return false;
    }
    progress.update(round.board);
    painter?.paint();
    if (completed.length > 0) {
      app.kit.cue('fx.dragon-happy');
      app.kit.announcer.announce(t('board.done'));
      status.textContent = t('board.done');
      void confetti(app.kit.fx);
    }
    return true;
  };

  // Retry stored a held move: now the board shows it.
  const unsubscribeSaved = active.game.subscribeIndicator((indicator) => {
    if (indicator.kind !== 'saved' || !heldMove || disposed) return;
    heldMove = false;
    void afterMove().catch(app.kit.onError);
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

  const body: Node[] = [status];
  if (painter) {
    body.push(painter.element);
    painter.paint();
  } else {
    status.textContent = t('minigame.soon');
    body.push(
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
  }

  const element = h(
    'main',
    {
      className: 'dv-round dv-minigame',
      testId: 'screen-minigame',
      dataset: { activity: first.activity },
    },
    backdrop(region?.background ?? 'sunny-meadow'),
    topBar({
      title: h('div', { className: 'dv-round__header' }, heading, progress.element),
      tools: [coins.element, saveStatus.element, quit],
      onError: app.kit.onError,
    }),
    h('section', { className: 'dv-card dv-minigame__card' }, ...body),
  );

  return {
    element,
    title: t(`activity.${first.activity}` as MessageKey),
    field: 'valley',
    region: region?.id ?? null,
    music: 'round',
    focusTarget: () => painter?.focus() ?? heading,
    dispose() {
      disposed = true;
      unsubscribeSaved();
      clearInterval(restTimer);
      painter?.dispose?.();
      saveStatus.dispose();
    },
  };
}
