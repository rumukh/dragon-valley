/**
 * The young players' boards (grades 1-2): Ten Frame and Bundle Sticks (docs/contract.md §11.1).
 *
 * Ten Frame: two frames of ten. A tap on an empty place puts a counter there, a tap on a counter
 * takes the last one back; counters the board started with are round, the ones the child adds
 * square (shape, not only color). "Check" asks the rules; for a crossing task (`8 + 5`) the check
 * says the frames' total, so a right picture is a right answer.
 *
 * Bundle Sticks: bundles of ten and loose sticks. Buttons add or take away a bundle or a stick,
 * tie ten loose sticks into a bundle or untie one for borrowing. The board shows how many tens and
 * ones there are, never the number the child is building.
 *
 * A wrong check only marks the board; everything stays where the child put it.
 */
import { OPERATOR_SYMBOLS } from '../../../rules/contract';
import type { BundleSticksBoard, TenFrameBoard } from '../../../rules/contract';
import { candyButton } from '../../ui/button';
import { h } from '../../ui/dom';
import type { BoardContext, BoardPainter } from './board';

const FRAME = 10;

/** What the child is asked on a ten-frame board. */
function tenFrameGoal(context: BoardContext, board: TenFrameBoard): string {
  const t = context.app.kit.t;
  if (board.last === 'wrong') return t('tenFrame.notYet');
  if (board.task === 'show') return t('tenFrame.show', { target: board.target });
  if (board.task === 'make-ten') return t('tenFrame.makeTen', { a: board.a });
  const plus = OPERATOR_SYMBOLS[context.notation()].add;
  return t('tenFrame.cross', { fact: `${board.a} ${plus} ${board.b ?? 0}` });
}

export function tenFrame(context: BoardContext): BoardPainter {
  const { app } = context;
  const t = app.kit.t;
  const frames = h('div', { className: 'dv-ten-frames', testId: 'ten-frames' });

  const paint = (): void => {
    const board = context.board('ten-frame');
    if (!board) return;
    context.status(tenFrameGoal(context, board));
    // The counters the board started with (`a`, in the first frame) are round.
    const given = board.task === 'show' ? 0 : board.a;
    frames.dataset['last'] = board.last ?? 'none';
    frames.replaceChildren(
      ...board.frames.map((count, frame) => {
        const places = Array.from({ length: FRAME }, (_, index) => {
          const filled = index < count;
          const kind = !filled ? 'empty' : frame === 0 && index < given ? 'given' : 'added';
          const button = h(
            'button',
            {
              className: 'dv-ten-frame__place',
              testId: `ten-frame-${frame}-${index}`,
              dataset: { kind },
              attributes: {
                type: 'button',
                'aria-label': filled
                  ? t('tenFrame.counter', { frame: frame + 1, place: index + 1 })
                  : t('tenFrame.empty', { frame: frame + 1, place: index + 1 }),
              },
            },
            filled ? h('span', { className: 'dv-ten-frame__counter' }) : null,
          );
          button.addEventListener('click', () => {
            app.kit.cue('ui.tap');
            // Counters fill a frame in order: an empty place adds up to it, a counter takes back
            // down to it.
            const move = filled
              ? { type: 'remove' as const, frame, count: count - index }
              : { type: 'add' as const, frame, count: index + 1 - count };
            void context.move(move).catch(app.kit.onError);
          });
          return button;
        });
        return h(
          'div',
          {
            className: 'dv-ten-frame',
            testId: `ten-frame-${frame}`,
            dataset: { count: String(count) },
            attributes: {
              role: 'group',
              'aria-label': t('tenFrame.frame', { frame: frame + 1, count }),
            },
          },
          ...places,
        );
      }),
    );
  };

  const check = candyButton({
    label: t('board.check'),
    icon: 'check',
    variant: 'sun',
    testId: 'ten-frame-check',
    onPress: async () => {
      const board = context.board('ten-frame');
      if (!board) return;
      await context.move(
        board.task === 'cross'
          ? { type: 'submit', value: board.frames[0] + board.frames[1] }
          : { type: 'submit' },
      );
    },
    onError: app.kit.onError,
  });

  return {
    element: h('div', { className: 'dv-minigame__board dv-young-board' }, frames, check),
    paint,
    goal: () => {
      const board = context.board('ten-frame');
      return board ? tenFrameGoal(context, board) : '';
    },
    focus: () => frames.querySelector<HTMLElement>('button') ?? check,
  };
}

/** What the child is asked on a bundle-sticks board. */
function sticksGoal(context: BoardContext, board: BundleSticksBoard): string {
  const t = context.app.kit.t;
  if (board.last === 'wrong') return t('sticks.notYet');
  if (board.task === 'build') return t('sticks.build', { target: board.target ?? 0 });
  const sign = OPERATOR_SYMBOLS[context.notation()][board.task];
  return t('sticks.calc', { fact: `${board.a ?? 0} ${sign} ${board.b ?? 0}` });
}

export function bundleSticks(context: BoardContext): BoardPainter {
  const { app } = context;
  const t = app.kit.t;
  const table = h('div', { className: 'dv-sticks', testId: 'sticks' });
  const actions = h('div', { className: 'dv-sticks__actions' });

  const button = (
    label: string,
    testId: string,
    move: Parameters<BoardContext['move']>[0],
    icon: 'plus' | 'minus' | 'retry' | 'sparkle',
  ): HTMLButtonElement =>
    candyButton({
      label,
      icon,
      variant: 'paper',
      size: 'small',
      testId,
      onPress: async () => {
        await context.move(move);
      },
      onError: app.kit.onError,
    });

  const addBundle = button(
    t('sticks.addBundle'),
    'sticks-add-bundle',
    { type: 'add', what: 'bundle' },
    'plus',
  );
  const removeBundle = button(
    t('sticks.removeBundle'),
    'sticks-remove-bundle',
    { type: 'remove', what: 'bundle' },
    'minus',
  );
  const addStick = button(
    t('sticks.addStick'),
    'sticks-add-stick',
    { type: 'add', what: 'stick' },
    'plus',
  );
  const removeStick = button(
    t('sticks.removeStick'),
    'sticks-remove-stick',
    { type: 'remove', what: 'stick' },
    'minus',
  );
  const tie = button(t('sticks.tie'), 'sticks-tie', { type: 'bundle' }, 'sparkle');
  const untie = button(t('sticks.untie'), 'sticks-untie', { type: 'unbundle' }, 'retry');
  actions.append(addBundle, removeBundle, addStick, removeStick, tie, untie);

  const paint = (): void => {
    const board = context.board('bundle-sticks');
    if (!board) return;
    context.status(sticksGoal(context, board));
    const value = board.bundles * 10 + board.loose;
    table.dataset['last'] = board.last ?? 'none';
    table.replaceChildren(
      h(
        'div',
        {
          className: 'dv-sticks__tens',
          testId: 'sticks-tens',
          dataset: { count: String(board.bundles) },
          attributes: { role: 'img', 'aria-label': t('sticks.tens', { count: board.bundles }) },
        },
        ...Array.from({ length: board.bundles }, () =>
          h('span', { className: 'dv-sticks__bundle' }),
        ),
      ),
      h(
        'div',
        {
          className: 'dv-sticks__ones',
          testId: 'sticks-ones',
          dataset: { count: String(board.loose) },
          attributes: { role: 'img', 'aria-label': t('sticks.ones', { count: board.loose }) },
        },
        ...Array.from({ length: board.loose }, () => h('span', { className: 'dv-sticks__stick' })),
      ),
      h(
        'p',
        { className: 'dv-sticks__count', attributes: { 'aria-hidden': 'true' } },
        t('sticks.count', { tens: board.bundles, ones: board.loose }),
      ),
    );
    addBundle.disabled = board.bundles >= 10 || value + 10 > 100;
    removeBundle.disabled = board.bundles < 1;
    addStick.disabled = value + 1 > 100;
    removeStick.disabled = board.loose < 1;
    tie.disabled = board.loose < 10 || board.bundles >= 10;
    untie.disabled = board.bundles < 1;
  };

  const check = candyButton({
    label: t('board.check'),
    icon: 'check',
    variant: 'sun',
    testId: 'sticks-check',
    onPress: async () => {
      await context.move({ type: 'submit' });
    },
    onError: app.kit.onError,
  });

  return {
    element: h('div', { className: 'dv-minigame__board dv-young-board' }, table, actions, check),
    paint,
    goal: () => {
      const board = context.board('bundle-sticks');
      return board ? sticksGoal(context, board) : '';
    },
    focus: () => actions.querySelector<HTMLElement>('button:not(:disabled)') ?? check,
  };
}
